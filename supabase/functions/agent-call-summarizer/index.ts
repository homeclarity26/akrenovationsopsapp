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
    const { recording_url, call_sid, from_phone, to_phone, call_duration, lead_id, project_id } = body

    if (!recording_url) {
      return new Response(JSON.stringify({ error: 'recording_url required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await callAssembleContext('agent-call-summarizer', 'transcribe and summarize phone call recording')

    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY')
    if (!deepgramApiKey) {
      return new Response(JSON.stringify({ error: 'DEEPGRAM_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Download the recording
    const recordingRes = await fetch(recording_url)
    if (!recordingRes.ok) throw new Error(`Failed to fetch recording: ${recordingRes.status}`)
    const recordingBuffer = await recordingRes.arrayBuffer()

    // Transcribe with Deepgram
    const deepgramRes = await fetch(
      'https://api.deepgram.com/v1/listen?punctuate=true&model=nova-2&diarize=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${deepgramApiKey}`,
          'Content-Type': 'audio/wav',
        },
        body: recordingBuffer,
      },
    )

    if (!deepgramRes.ok) throw new Error(`Deepgram error: ${await deepgramRes.text()}`)
    const deepgramData = await deepgramRes.json()
    const transcript = deepgramData?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''

    if (!transcript) {
      return new Response(JSON.stringify({ error: 'No transcript returned' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Analyze with Claude
    const analysisSystemPrompt = `You are an AI business assistant for AK Renovations. Analyze this call transcript and return ONLY a valid JSON object:
{
  "summary": "2-3 sentence summary of the call",
  "key_decisions": ["list of decisions made or agreed upon"],
  "action_items_adam": [{"action": "what Adam needs to do", "priority": "low|medium|high", "due": "timeframe if mentioned"}],
  "action_items_client": [{"action": "what the client/other party agreed to do"}],
  "topics_discussed": ["list of main topics"],
  "next_steps": "what happens next",
  "call_sentiment": "positive|neutral|negative|mixed"
}
Return ONLY the JSON.`

    const analysisResult = await callClaude(
      analysisSystemPrompt,
      `Call transcript:\n${transcript}\n\nAnalyze and return JSON.`,
      1000,
    )

    let analysis: Record<string, unknown> = {}
    try {
      analysis = JSON.parse(analysisResult.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      const jsonMatch = analysisResult.match(/\{[\s\S]+\}/)
      if (jsonMatch) {
        try { analysis = JSON.parse(jsonMatch[0]) } catch { analysis = { summary: analysisResult } }
      }
    }

    // Save to communication_log
    const { data: commLog } = await supabase
      .from('communication_log')
      .insert({
        lead_id: lead_id ?? null,
        project_id: project_id ?? null,
        comm_type: 'call',
        direction: 'inbound',
        summary: analysis.summary as string ?? transcript.substring(0, 300),
        transcript,
        recording_url,
        duration_seconds: call_duration ?? null,
        action_items: {
          adam: analysis.action_items_adam,
          client: analysis.action_items_client,
        },
      })
      .select()
      .single()

    // Create task records for Adam's action items
    const tasksCreated: string[] = []
    for (const item of (analysis.action_items_adam as Array<{ action: string; priority: string; due?: string }>) ?? []) {
      await supabase.from('tasks').insert({
        project_id: project_id ?? null,
        title: item.action,
        description: `From call on ${new Date().toLocaleDateString()}`,
        priority: item.priority ?? 'medium',
        status: 'todo',
        due_date: null, // Could parse item.due in a more sophisticated version
      })
      tasksCreated.push(item.action)
    }

    return new Response(
      JSON.stringify({
        success: true,
        comm_log_id: commLog?.id,
        transcript_length: transcript.length,
        summary: analysis.summary,
        key_decisions: analysis.key_decisions,
        action_items_adam: analysis.action_items_adam,
        action_items_client: analysis.action_items_client,
        tasks_created: tasksCreated,
        sentiment: analysis.call_sentiment,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-call-summarizer error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
