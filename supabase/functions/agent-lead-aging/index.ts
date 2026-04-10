import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'

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

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 2048): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_CONFIG.PRIMARY_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return { text: data.content?.[0]?.text ?? '', usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 } }
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime()
  const now = Date.now()
  return Math.floor((now - then) / 86400000)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-lead-aging')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const company = await getCompanyProfile(supabase, 'system')

    const basePrompt = await callAssembleContext('agent-lead-aging', 'draft follow-up messages for aging leads')
    const systemPrompt =
      (basePrompt ??
        buildSystemPrompt(company, 'sales assistant')) +
      `

LEAD FOLLOW-UP TASK
Draft a short, warm, professional follow-up message for the lead described.
Write as Adam Kilgore speaking directly to the prospect.
Keep it to 3-5 sentences. Personalize to the project type and context given.
Do not use em dashes. Be conversational, not salesy.`

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id,full_name,email,phone,stage,stage_entered_at,project_type,project_description,consultation_date,notes')
      .not('stage', 'in', '("complete","lost","active_project")')

    if (error) throw error

    const actionsCreated: string[] = []

    for (const lead of leads ?? []) {
      const daysInStage = daysSince(lead.stage_entered_at)
      let shouldDraft = false
      let messageContext = ''

      if (lead.stage === 'lead' && daysInStage >= 3) {
        shouldDraft = true
        messageContext = `Initial follow-up. Lead has been in the pipeline ${daysInStage} days without contact. Project type: ${lead.project_type ?? 'renovation'}.`
      } else if (lead.stage === 'consultation' && !lead.consultation_date && daysInStage >= 5) {
        shouldDraft = true
        messageContext = `Need to schedule a consultation. Lead has been in consultation stage ${daysInStage} days with no appointment set. Project type: ${lead.project_type ?? 'renovation'}.`
      } else if (lead.stage === 'proposal_sent') {
        if (daysInStage >= 14) {
          shouldDraft = true
          messageContext = `Proposal check-in #3 (14+ days). Proposal has been out for ${daysInStage} days with no response. This is a gentle final check-in before closing the opportunity.`
        } else if (daysInStage >= 8) {
          shouldDraft = true
          messageContext = `Proposal follow-up #2 (8+ days). Proposal has been out for ${daysInStage} days. Ask if they have questions.`
        } else if (daysInStage >= 4) {
          shouldDraft = true
          messageContext = `Proposal follow-up #1 (4+ days). Proposal has been out for ${daysInStage} days. Friendly check-in.`
        }
      } else if (lead.stage === 'contract_signed' && daysInStage >= 7) {
        shouldDraft = true
        messageContext = `Contract signed ${daysInStage} days ago but project hasn't started yet. Draft a message to schedule the kickoff and confirm start date.`
      }

      if (!shouldDraft) continue

      const draftPrompt = `Lead: ${lead.full_name}
Stage: ${lead.stage}
Days in stage: ${daysInStage}
Project type: ${lead.project_type ?? 'renovation'}
Project description: ${lead.project_description ?? 'not specified'}
Notes: ${lead.notes ?? 'none'}
Context: ${messageContext}

Draft the follow-up message.`

      const _t0 = Date.now()

      const { text: draftedMessage, usage: _u } = await callClaude(systemPrompt, draftPrompt, 400)

      logAiUsage({ function_name: 'agent-lead-aging', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })

      await supabase.from('ai_actions').insert({
        request_text: `Draft follow-up message for lead ${lead.full_name} (${lead.stage}, ${daysInStage} days)`,
        action_type: 'send_sms_or_email',
        action_data: {
          lead_id: lead.id,
          recipient_name: lead.full_name,
          recipient_email: lead.email,
          recipient_phone: lead.phone,
          message: draftedMessage,
          stage: lead.stage,
          days_in_stage: daysInStage,
          context: messageContext,
        },
        requires_approval: true,
        risk_level: 'high',
        status: 'pending',
      })

      actionsCreated.push(`${lead.full_name} (${lead.stage}, ${daysInStage}d)`)
    }

    return new Response(
      JSON.stringify({ success: true, actions_created: actionsCreated.length, leads: actionsCreated }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-lead-aging error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
