// K27: Conversation transcriber agent
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system', user_role: 'admin', agent_name: agentName,
        capability_required: 'transcribe_audio', query,
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

async function transcribeAudio(url: string): Promise<string> {
  // Deepgram transcription if available, otherwise placeholder
  const dgKey = Deno.env.get('DEEPGRAM_API_KEY')
  if (!dgKey) return '[transcription unavailable — DEEPGRAM_API_KEY not set]'
  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&punctuate=true', {
    method: 'POST',
    headers: { 'Authorization': `Token ${dgKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) return '[transcription failed]'
  const data = await res.json()
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { log_id } = await req.json()
    const { data: log } = await supabase.from('communication_log').select('*').eq('id', log_id).single()
    if (!log) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })

    const transcript = log.recording_url ? await transcribeAudio(log.recording_url) : ''

    const basePrompt = await callAssembleContext('agent-conversation-transcriber', 'extract action items from conversation')
    const systemPrompt = (basePrompt ??
      'You are an AI assistant for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio.')
      + `\n\nCONVERSATION ANALYZER\nExtract structured insights from logged client conversations.`

    const insights = await callClaude(systemPrompt, `Conversation log for AK Renovations.
Audio transcript: ${transcript}
Manual notes: ${log.summary ?? ''}

Extract:
1. Key decisions made (array of strings)
2. Action items for Adam (array of {task, due_date_if_mentioned})
3. Action items for client (array of strings)
4. Scope changes or new requests
5. Client sentiment: positive/neutral/concerned/negative
6. 2-3 sentence plain English summary
7. Follow-up that should be scheduled

Return JSON.`)

    await supabase.from('communication_log').update({
      transcript,
      summary: insights,
    }).eq('id', log_id)

    return new Response(JSON.stringify({ transcript, insights }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
