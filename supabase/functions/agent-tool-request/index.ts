// K11: Tool request agent
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
        capability_required: 'classify_request', query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch { return null }
}

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
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

    const { request_id } = await req.json()
    const { data: request } = await supabase.from('tool_requests').select('*, profiles!tool_requests_requested_by_fkey(full_name), projects(title)').eq('id', request_id).single()
    if (!request) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })

    const basePrompt = await callAssembleContext('agent-tool-request', 'classify this tool purchase request')
    const systemPrompt = (basePrompt ??
      'You are an AI assistant for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio.')
      + `\n\nTOOL REQUEST CLASSIFIER\nReview tool requests. Estimate cost, suggest source, recommend purchase or rental.`

    const classification = await callClaude(systemPrompt, `Tool request:
Tool: ${request.tool_name}
Project: ${(request as any).projects?.title ?? 'N/A'}
Needed by: ${request.needed_by}
Notes: ${request.notes ?? 'none'}

Classify:
1. Likely available at Lowe's / Home Depot? (yes/no)
2. Estimated cost range
3. Purchase or rental?
4. Specific model/spec recommendations
5. 1-sentence message to Adam about this request

Return JSON.`)

    await supabase.from('ai_actions').insert({
      request_text: `Tool request: ${request.tool_name}`,
      action_type: 'tool_request_classified',
      action_data: {
        request_id: request.id,
        tool_name: request.tool_name,
        classification,
      },
      requires_approval: true,
      risk_level: 'medium',
      status: 'pending',
    })

    return new Response(JSON.stringify({ classification }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
