// budget-ai-action — updated A13
// General-purpose budget AI endpoint.
// NOW calls assemble-context first to get memory-enriched base prompt,
// then layers budget-specific data on top.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  project_id: string
  user_message: string
  action_type?: string
  user_id?: string
  user_role?: 'admin' | 'employee' | 'client'
}

interface ActionResult {
  response: string
  suggested_action?: { type: string; data: Record<string, unknown> }
}

async function callAssembleContext(
  user_id: string,
  user_role: string,
  project_id: string,
  query: string
): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_id,
        user_role,
        agent_name: 'budget-ai-action',
        capability_required: 'query_financials',
        entity_type: 'project',
        entity_id: project_id,
        query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    if (ctx.denied) return null
    return ctx.system_prompt ?? null
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { project_id, user_message, action_type, user_id, user_role = 'admin' } = body

    if (!project_id || !user_message) {
      return new Response(
        JSON.stringify({ error: 'project_id and user_message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. CALL ASSEMBLE-CONTEXT (memory-enriched base prompt)
    let baseSystemPrompt: string | null = null
    if (user_id) {
      baseSystemPrompt = await callAssembleContext(user_id, user_role, project_id, user_message)
    }

    // 2. FETCH BUDGET-SPECIFIC DATA
    const [projectResult, settingsResult, tradesResult, quotesResult] = await Promise.all([
      supabase.from('projects').select('*').eq('id', project_id).single(),
      supabase.from('budget_settings').select('*').eq('project_id', project_id).single(),
      supabase.from('budget_trades').select('*').eq('project_id', project_id).order('sort_order'),
      supabase.from('budget_quotes').select('*').eq('project_id', project_id),
    ])

    const project  = projectResult.data
    const settings = settingsResult.data
    const trades   = tradesResult.data ?? []
    const quotes   = quotesResult.data ?? []

    // Compute financials
    const totalSubCost      = trades.filter((t: { is_locked: boolean; awarded_amount: number | null }) => t.is_locked).reduce((s: number, t: { awarded_amount: number | null }) => s + (t.awarded_amount ?? 0), 0)
    const sub_markup_pct    = settings?.sub_markup_percent ?? 0.25
    const subMarkupRevenue  = totalSubCost * sub_markup_pct
    const pmFee             = (settings?.duration_weeks ?? 18) * (settings?.pm_hours_per_week ?? 10) * (settings?.pm_rate_per_hour ?? 120)
    const crewCost          = (settings?.crew_weeks_on_site ?? 3.5) * (settings?.crew_weekly_cost ?? 3300)
    const crewBilled        = crewCost * (settings?.crew_bill_multiplier ?? 2.0)
    const crewMargin        = crewBilled - crewCost
    const overheadAlloc     = ((settings?.duration_weeks ?? 18) / 4.33) * (settings?.monthly_overhead ?? 5000)
    const contractPrice     = totalSubCost + subMarkupRevenue + crewBilled + pmFee + (settings?.contingency_amount ?? 5000)
    const netProfit         = subMarkupRevenue + crewMargin + pmFee + (settings?.contingency_amount ?? 5000) - overheadAlloc
    const netMarginPct      = contractPrice > 0 ? ((netProfit / contractPrice) * 100).toFixed(1) : '0.0'

    const budgetData = {
      project: { id: project?.id, title: project?.title, project_type: project?.project_type, client_name: project?.client_name },
      settings,
      trades: trades.map((t: Record<string, unknown>) => ({
        id: t.id, name: t.name, trade_category: t.trade_category,
        budget_amount: t.budget_amount, awarded_amount: t.awarded_amount, is_locked: t.is_locked, notes: t.notes,
        quote_count: quotes.filter((q: Record<string, unknown>) => q.trade_id === t.id && q.status !== 'declined').length,
      })),
      quotes: quotes.map((q: Record<string, unknown>) => ({
        id: q.id, trade_id: q.trade_id, company_name: q.company_name, amount: q.amount,
        status: q.status, includes_materials: q.includes_materials,
        scope_included: q.scope_included, scope_excluded: q.scope_excluded,
      })),
      computed: {
        totalSubCost, subMarkupRevenue, pmFee, crewBilled, crewMargin, overheadAlloc,
        contractPrice, netProfit, netMarginPct: `${netMarginPct}%`,
        lockedTradeCount: trades.filter((t: { is_locked: boolean }) => t.is_locked).length,
        totalTradeCount: trades.length,
        openTradeCount: trades.filter((t: { is_locked: boolean; awarded_amount: number | null }) => !t.is_locked && t.awarded_amount == null).length,
      },
    }

    // 3. BUILD FINAL SYSTEM PROMPT
    // If assemble-context returned a base prompt, layer budget data on top.
    // Otherwise use the standalone budget prompt (backward compatibility).
    const budgetSection = `
BUDGET MODULE CONTEXT — PROJECT: ${project?.title ?? project_id}
${JSON.stringify(budgetData, null, 2)}

${action_type ? `Action type requested: ${action_type}` : ''}

BUDGET AI CAPABILITIES
- Compare quotes apples-to-apples (scope exclusions change everything)
- Flag over-budget trades and suggest variance absorption strategies
- Calculate margin impact of any lever change
- Draft sub award notices, follow-up requests, and change order descriptions
- Suggest contingency amounts based on project complexity

RESPONSE FORMAT
Respond ONLY with valid JSON:
{ "response": "your answer", "suggested_action": { "type": "draft_email", "data": { "to": "...", "subject": "...", "body": "..." } } }
The suggested_action field is optional — only include it when drafting a communication.`

    const systemPrompt = baseSystemPrompt
      ? `${baseSystemPrompt}\n\n${budgetSection}`
      : `You are the financial intelligence layer for AK Ops, a renovation contracting business in Summit County, Ohio.\n${budgetSection}`

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: [{ role: 'user', content: user_message }],
      }),
    })

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text()
      throw new Error(`Claude API error: ${err}`)
    }

    const claudeResult = await anthropicResponse.json()
    const rawText = claudeResult.content?.[0]?.text ?? '{}'

    let result: ActionResult
    try {
      result = JSON.parse(rawText)
    } catch {
      result = { response: rawText }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('budget-ai-action error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
