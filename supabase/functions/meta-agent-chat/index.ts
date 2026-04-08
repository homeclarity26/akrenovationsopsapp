// meta-agent-chat — Phase E
// Primary conversational AI endpoint for Adam's meta agent relationship.
// Maintains persistent conversation history in meta_agent_conversations.
// Gets the richest context of any agent in the system.
// After every conversation turn, fires extract-preferences async.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatInput {
  message: string
  session_id: string
  user_id: string
}

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function assembleMetaContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  // Assemble the richest context for the meta agent
  try {
    const res = await fetch(`${supabaseUrl()}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey()}` },
      body: JSON.stringify({
        user_id: userId,
        user_role: 'admin',
        agent_name: 'meta-agent',
        capability_required: 'query_financials',
        query: 'full business context for meta agent conversation',
        include_sections: ['business_context', 'operational_memory', 'agent_history', 'learning_insights'],
      }),
    })
    if (!res.ok) return getDefaultMetaSystemPrompt(supabase)
    const ctx = await res.json()
    if (ctx.denied) return getDefaultMetaSystemPrompt(supabase)
    return buildMetaSystemPrompt(supabase, ctx.system_prompt)
  } catch {
    return getDefaultMetaSystemPrompt(supabase)
  }
}

async function getDefaultMetaSystemPrompt(supabase: ReturnType<typeof createClient>): Promise<string> {
  return buildMetaSystemPrompt(supabase, null)
}

async function buildMetaSystemPrompt(supabase: ReturnType<typeof createClient>, basePrompt: string | null): Promise<string> {
  // Fetch live business data
  const [
    { data: projects },
    { data: pendingActions },
    { data: recentOutputs },
    { data: preferences },
    { data: improvements },
    { data: directives },
  ] = await Promise.all([
    supabase.from('projects').select('id,title,status,schedule_status,percent_complete,contract_value,actual_cost').eq('status', 'active'),
    supabase.from('ai_actions').select('id,action_type,action_data,risk_level,created_at').eq('status', 'pending').eq('requires_approval', true).limit(10),
    supabase.from('agent_outputs').select('agent_name,title,output_type,created_at,requires_approval,approved_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('meta_agent_preferences').select('preference_type,key,value').limit(30),
    supabase.from('improvement_specs').select('title,priority,status,category').in('status', ['draft', 'reviewed', 'approved']).limit(10),
    supabase.from('agent_directives').select('agent_name,directive_type,reason').eq('active', true).limit(10),
  ])

  const liveContext = `
LIVE BUSINESS STATE
Active projects: ${JSON.stringify(projects ?? [])}
Pending approvals: ${pendingActions?.length ?? 0} items waiting
Recent agent outputs: ${JSON.stringify((recentOutputs ?? []).slice(0, 5))}
Open improvements: ${improvements?.length ?? 0} in queue
Active agent directives: ${JSON.stringify(directives ?? [])}

ADAM'S PREFERENCES (learned)
${(preferences ?? []).map(p => `${p.preference_type}/${p.key}: ${p.value}`).join('\n')}
`

  const metaInstructions = `

META AGENT IDENTITY
You are Adam's primary AI partner for AK Renovations. You have full context of his business.
You are not a chatbot — you are his chief of staff who knows everything.

VOICE RULES:
- No preamble. Start with what matters.
- Direct and specific — use real names, real numbers
- Proactively surface relevant things he hasn't asked about
- Never ask Adam to explain his business or preferences — you know them
- Concise. If it can be said in 2 sentences, don't use 4.
- You can be proactive: "While you're here — Thompson's margin is slipping."

CAPABILITIES:
- Answer any question about the business using live data above
- Coordinate agent actions, explain what agents have done
- Analyze patterns across projects, leads, financials
- Identify risks and opportunities
- Draft content (emails, messages, proposals) when asked
- Flag things that need Adam's attention even if he didn't ask
`

  return (basePrompt ?? 'You are the AI chief of staff for AK Renovations, Summit County, Ohio.') + liveContext + metaInstructions
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'meta-agent-chat')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const input: ChatInput = await req.json()
    const { message, session_id, user_id } = input

    if (!message || !session_id || !user_id) {
      return new Response(JSON.stringify({ error: 'message, session_id, user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(supabaseUrl(), serviceKey())

    // Get recent conversation history for this session (last 20 messages)
    const { data: history } = await supabase
      .from('meta_agent_conversations')
      .select('role,content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(20)

    // Build messages array for Claude
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(history ?? []).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ]

    // Get rich system context
    const systemPrompt = await assembleMetaContext(supabase, user_id)

    // Call Claude
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      }),
    })

    if (!anthropicRes.ok) throw new Error(`Claude error: ${await anthropicRes.text()}`)
    const anthropicData = await anthropicRes.json()
    const reply = anthropicData.content?.[0]?.text ?? ''
    const tokensUsed = anthropicData.usage?.input_tokens + anthropicData.usage?.output_tokens ?? 0

    // Save both user message and assistant reply to conversation history
    await supabase.from('meta_agent_conversations').insert([
      { session_id, role: 'user', content: message, tokens_used: 0 },
      { session_id, role: 'assistant', content: reply, tokens_used: tokensUsed },
    ])

    // Fire extract-preferences async (non-blocking)
    fetch(`${supabaseUrl()}/functions/v1/extract-preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey()}` },
      body: JSON.stringify({ session_id, user_message: message, assistant_reply: reply }),
    }).catch(err => console.error('extract-preferences fire-and-forget error:', err))

    return new Response(
      JSON.stringify({ reply, session_id, tokens_used: tokensUsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('meta-agent-chat error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
