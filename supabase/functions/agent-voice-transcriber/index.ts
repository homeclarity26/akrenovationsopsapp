import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callAssembleContext(agentName: string, query: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system', user_role: 'admin', agent_name: agentName,
        capability_required: 'query_financials', query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch { return null }
}

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 2048): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const { file_id, project_id, submitted_by } = body

    if (!file_id) {
      return new Response(JSON.stringify({ error: 'file_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await callAssembleContext('agent-voice-transcriber', 'transcribe voice note and extract action items')

    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY')
    if (!deepgramApiKey) {
      return new Response(JSON.stringify({ error: 'DEEPGRAM_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get file record
    const { data: file, error: fileError } = await supabase
      .from('project_files')
      .select('id,file_url,project_id,file_name')
      .eq('id', file_id)
      .single()

    if (fileError || !file) throw fileError ?? new Error('File not found')

    const targetProjectId = project_id ?? file.project_id

    // Download the audio file
    const audioRes = await fetch(file.file_url)
    if (!audioRes.ok) throw new Error(`Failed to fetch audio file: ${audioRes.status}`)
    const audioBuffer = await audioRes.arrayBuffer()

    // Call Deepgram for transcription
    const deepgramRes = await fetch(
      'https://api.deepgram.com/v1/listen?punctuate=true&model=nova-2',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${deepgramApiKey}`,
          'Content-Type': audioRes.headers.get('content-type') ?? 'audio/wav',
        },
        body: audioBuffer,
      },
    )

    if (!deepgramRes.ok) throw new Error(`Deepgram error: ${await deepgramRes.text()}`)

    const deepgramData = await deepgramRes.json()
    const transcript = deepgramData?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''

    if (!transcript) {
      return new Response(JSON.stringify({ error: 'No transcript returned from Deepgram' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send transcript to Claude for action item extraction
    const actionItemSystemPrompt = `You are an AI assistant for AK Renovations. A field worker or Adam just recorded a voice note.
Extract action items and return ONLY a valid JSON object:
{
  "summary": "1-2 sentence summary of the voice note",
  "tasks": [{"title": "task description", "priority": "low|medium|high", "type": "task"}],
  "shopping_items": [{"item_name": "item", "quantity": 1, "unit": "each|box|sqft|etc", "notes": "optional"}],
  "issues": ["list of issues or flags mentioned"],
  "general_notes": "any other notes that don't fit as tasks or items"
}
Return ONLY the JSON.`

    const extractionResult = await callClaude(
      actionItemSystemPrompt,
      `Voice note transcript: "${transcript}"\n\nExtract action items and return JSON.`,
      800,
    )

    let extracted: Record<string, unknown> = {}
    try {
      extracted = JSON.parse(extractionResult.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      const jsonMatch = extractionResult.match(/\{[\s\S]+\}/)
      if (jsonMatch) {
        try { extracted = JSON.parse(jsonMatch[0]) } catch { extracted = { general_notes: transcript } }
      }
    }

    // Save to communication_log
    await supabase.from('communication_log').insert({
      project_id: targetProjectId ?? null,
      comm_type: 'voice_note',
      direction: 'inbound',
      summary: (extracted.summary as string) ?? transcript.substring(0, 200),
      transcript,
      action_items: { tasks: extracted.tasks, shopping_items: extracted.shopping_items },
    })

    // Create task records
    const tasksCreated: string[] = []
    for (const task of (extracted.tasks as Array<{ title: string; priority: string }>) ?? []) {
      await supabase.from('tasks').insert({
        project_id: targetProjectId ?? null,
        assigned_to: submitted_by ?? null,
        title: task.title,
        priority: task.priority ?? 'medium',
        status: 'todo',
        created_by: submitted_by ?? null,
      })
      tasksCreated.push(task.title)
    }

    // Create shopping list items
    const itemsCreated: string[] = []
    if (targetProjectId) {
      for (const item of (extracted.shopping_items as Array<{ item_name: string; quantity: number; unit?: string; notes?: string }>) ?? []) {
        await supabase.from('shopping_list_items').insert({
          project_id: targetProjectId,
          item_name: item.item_name,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? 'each',
          notes: item.notes ?? null,
          added_by: submitted_by ?? null,
          status: 'needed',
        })
        itemsCreated.push(item.item_name)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        summary: extracted.summary,
        tasks_created: tasksCreated,
        shopping_items_created: itemsCreated,
        issues: extracted.issues,
        general_notes: extracted.general_notes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-voice-transcriber error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
