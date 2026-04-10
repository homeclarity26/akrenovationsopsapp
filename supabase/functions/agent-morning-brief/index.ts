import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

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
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return { text: data.content?.[0]?.text ?? '', usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 } }
}

async function writeOutput(
  supabase: ReturnType<typeof createClient>,
  agentName: string,
  outputType: string,
  title: string,
  content: string,
  metadata?: Record<string, unknown>,
  requiresApproval = false,
) {
  await supabase.from('agent_outputs').insert({
    agent_name: agentName, output_type: outputType, title, content,
    metadata: metadata ?? null, requires_approval: requiresApproval,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-morning-brief')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const today = new Date().toISOString().split('T')[0]

    const [{ data: projects }, { data: leads }, { data: invoices }, { data: tasks }, { data: todayEvents }] =
      await Promise.all([
        supabase
          .from('projects')
          .select('id,title,project_type,status,schedule_status,percent_complete,client_name,actual_cost,estimated_cost,target_completion_date')
          .eq('status', 'active'),
        supabase
          .from('leads')
          .select('id,full_name,stage,next_action_date,project_type,estimated_value')
          .neq('stage', 'complete')
          .neq('stage', 'lost'),
        supabase
          .from('invoices')
          .select('id,invoice_number,title,total,status,due_date')
          .in('status', ['overdue', 'sent']),
        supabase
          .from('tasks')
          .select('id,title,due_date,priority,status')
          .in('status', ['todo', 'in_progress'])
          .lte('due_date', new Date(Date.now() + 86400000).toISOString().split('T')[0]),
        supabase
          .from('schedule_events')
          .select('id,title,event_type,start_date,start_time')
          .eq('start_date', today),
      ])

    // NEW: Unclosed time entries from yesterday (forgot to clock out)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: unclosedYesterday } = await supabase
      .from('time_entries')
      .select('id, user_id, clock_in, project_id')
      .is('clock_out', null)
      .gte('clock_in', `${yesterdayStr}T00:00:00`)
      .lt('clock_in', `${yesterdayStr}T23:59:59`)

    // NEW: Manual entries pending approval
    const { data: pendingManual } = await supabase
      .from('time_entries')
      .select('id, user_id, clock_in, total_minutes, manual_reason')
      .eq('entry_method', 'manual')
      .is('approved_by', null)

    // NEW: Billable hours this week vs last week
    const startOfThisWeek = new Date()
    startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay())
    startOfThisWeek.setHours(0, 0, 0, 0)

    const startOfLastWeek = new Date(startOfThisWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    const { data: thisWeekEntries } = await supabase
      .from('time_entries')
      .select('total_minutes, is_billable')
      .gte('clock_in', startOfThisWeek.toISOString())
      .eq('is_billable', true)
      .not('clock_out', 'is', null)

    const { data: lastWeekEntries } = await supabase
      .from('time_entries')
      .select('total_minutes, is_billable')
      .gte('clock_in', startOfLastWeek.toISOString())
      .lt('clock_in', startOfThisWeek.toISOString())
      .eq('is_billable', true)
      .not('clock_out', 'is', null)

    const billableHoursThisWeek = (thisWeekEntries ?? []).reduce((sum, e) => sum + (e.total_minutes ?? 0), 0) / 60
    const billableHoursLastWeek = (lastWeekEntries ?? []).reduce((sum, e) => sum + (e.total_minutes ?? 0), 0) / 60

    // Phase I — Payroll alerts: warn if pay date is within 3 days
    const { data: nextPeriod } = await supabase
      .from('pay_periods')
      .select('id, period_start, period_end, pay_date, status')
      .in('status', ['open', 'processing', 'upcoming'])
      .order('pay_date', { ascending: true })
      .limit(1)
      .maybeSingle()

    let payrollSummary = ''
    if (nextPeriod) {
      const payDate = new Date(`${nextPeriod.pay_date}T00:00:00`)
      const daysUntilPayroll = Math.ceil((payDate.getTime() - Date.now()) / 86400000)
      if (daysUntilPayroll <= 3) {
        const { data: estRecords } = await supabase
          .from('payroll_records')
          .select('gross_pay')
          .eq('pay_period_id', nextPeriod.id)
        const estTotal = (estRecords ?? []).reduce((s: number, r: { gross_pay: number | null }) => s + (Number(r.gross_pay) || 0), 0)
        payrollSummary = `\n\nPAYROLL ALERT:\n- Payroll runs ${nextPeriod.pay_date} (${daysUntilPayroll} days away)\n- Estimated total: $${estTotal.toFixed(2)}\n- Manual time entries pending approval: ${(pendingManual ?? []).length}\n- This MUST be reviewed and submitted to Gusto before the pay date.`
      }
    }

    // Phase K — additional pulls
    const { data: pendingToolRequests } = await supabase
      .from('tool_requests')
      .select('id, tool_name, requested_by, project_id, needed_by, urgency')
      .eq('status', 'pending')
      .order('needed_by', { ascending: true })

    const { data: openWarrantyClaims } = await supabase
      .from('warranty_claims')
      .select('id, description, project_id, status')
      .neq('status', 'resolved')
      .neq('status', 'denied')
      .order('reported_at', { ascending: false })

    const { data: portfolioPending } = await supabase
      .from('ai_actions')
      .select('id')
      .eq('action_type', 'portfolio_suggestion')
      .eq('status', 'pending')

    const phaseKSummary = `

PHASE K SIGNALS:
- Pending tool requests from crew: ${(pendingToolRequests ?? []).length}
- Open warranty claims: ${(openWarrantyClaims ?? []).length}
- Unreviewed portfolio suggestions: ${(portfolioPending ?? []).length}`

    const basePrompt = await callAssembleContext('agent-morning-brief', 'generate morning business brief')
    const systemPrompt =
      (basePrompt ??
        'You are an AI chief of staff for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio.') +
      `

MORNING BRIEF TASK
Generate a concise, plain-English morning brief for Adam Kilgore. Format with clear sections:
1. Today at a Glance (1-3 sentences)
2. Active Projects (flag any At Risk or Behind)
3. Hot Leads Needing Attention
4. Money (overdue invoices, cash to collect)
5. Today's Schedule
6. Action Items (top 3-5 things Adam should do today)

Be specific — use real names, real numbers. Flag issues that need his attention today.
Tone: direct, no fluff, like a trusted chief of staff. No em dashes.`

    const briefData = JSON.stringify({
      date: today,
      projects: projects ?? [],
      leads: leads ?? [],
      invoices: invoices ?? [],
      tasks: tasks ?? [],
      todayEvents: todayEvents ?? [],
    }) + `\n\nTIME TRACKING FLAGS:
- Unclosed entries from yesterday: ${(unclosedYesterday ?? []).length} (employees who forgot to clock out)
- Manual entries pending approval: ${(pendingManual ?? []).length}
- Billable hours this week: ${billableHoursThisWeek.toFixed(1)}h vs last week ${billableHoursLastWeek.toFixed(1)}h${payrollSummary}${phaseKSummary}`

    const _t0 = Date.now()

    const { text: brief, usage: _u } = await callClaude(systemPrompt, `Generate the morning brief from this data: ${briefData}`, 1500)

    logAiUsage({ function_name: 'agent-morning-brief', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })

    await writeOutput(
      supabase,
      'agent-morning-brief',
      'brief',
      `Morning Brief — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      brief,
      {
        project_count: projects?.length ?? 0,
        lead_count: leads?.length ?? 0,
        overdue_invoices: invoices?.filter((i) => i.status === 'overdue').length ?? 0,
        generated_date: today,
      },
      false,
    )

    return new Response(JSON.stringify({ success: true, brief }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('agent-morning-brief error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
