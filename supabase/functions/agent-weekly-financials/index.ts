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

  const rl = await checkRateLimit(req, 'agent-weekly-financials')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const basePrompt = await callAssembleContext('agent-weekly-financials', 'compile weekly financial summary')
    const systemPrompt =
      (basePrompt ?? 'You are an AI CFO assistant for AK Renovations.') +
      `

WEEKLY FINANCIAL SUMMARY TASK
Compile a clear, concise weekly financial summary for Adam Kilgore.
Include: cash collected this week, new invoices sent, total outstanding AR, total expenses this week, and any flags.
Format with clear sections. Use real dollar amounts. No em dashes. Be direct.`

    const weekStart = new Date(Date.now() - 7 * 86400000).toISOString()
    const weekStartDate = weekStart.split('T')[0]

    const [
      { data: paidThisWeek },
      { data: sentThisWeek },
      { data: outstandingInvoices },
      { data: expensesThisWeek },
    ] = await Promise.all([
      supabase
        .from('invoices')
        .select('id,invoice_number,total,paid_amount,project_id')
        .eq('status', 'paid')
        .gte('paid_at', weekStart),
      supabase
        .from('invoices')
        .select('id,invoice_number,total,project_id')
        .eq('status', 'sent')
        .gte('sent_at', weekStart),
      supabase
        .from('invoices')
        .select('id,invoice_number,title,total,balance_due,due_date,status')
        .in('status', ['sent', 'overdue', 'partial_paid']),
      supabase
        .from('expenses')
        .select('id,amount,category,vendor,description,project_id')
        .gte('date', weekStartDate),
    ])

    const totalCollected = (paidThisWeek ?? []).reduce((sum, i) => sum + (i.paid_amount ?? i.total ?? 0), 0)
    const totalInvoiced = (sentThisWeek ?? []).reduce((sum, i) => sum + (i.total ?? 0), 0)
    const totalOutstandingAR = (outstandingInvoices ?? []).reduce((sum, i) => sum + (i.balance_due ?? 0), 0)
    const totalExpenses = (expensesThisWeek ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0)
    const overdueCount = (outstandingInvoices ?? []).filter((i) => i.status === 'overdue').length

    const expenseByCategory: Record<string, number> = {}
    for (const e of expensesThisWeek ?? []) {
      expenseByCategory[e.category ?? 'misc'] = (expenseByCategory[e.category ?? 'misc'] ?? 0) + e.amount
    }

    const _t0 = Date.now()

    const { text: summaryText, usage: _u } = await callClaude(
      systemPrompt,
      `Week ending: ${new Date()

    logAiUsage({ function_name: 'agent-weekly-financials', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' }).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

Cash Collected This Week: $${totalCollected.toLocaleString()}
New Invoices Sent: $${totalInvoiced.toLocaleString()} (${sentThisWeek?.length ?? 0} invoices)
Total Outstanding AR: $${totalOutstandingAR.toLocaleString()} (${outstandingInvoices?.length ?? 0} invoices, ${overdueCount} overdue)
Total Expenses This Week: $${totalExpenses.toLocaleString()}
Expenses by Category: ${JSON.stringify(expenseByCategory)}

Write the weekly financial summary.`,
      600,
    )

    await writeOutput(
      supabase,
      'agent-weekly-financials',
      'report',
      `Weekly Financial Summary — Week of ${new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      summaryText,
      {
        week_start: weekStartDate,
        total_collected: totalCollected,
        total_invoiced: totalInvoiced,
        total_ar: totalOutstandingAR,
        total_expenses: totalExpenses,
        overdue_count: overdueCount,
      },
      false,
    )

    return new Response(
      JSON.stringify({
        success: true,
        total_collected: totalCollected,
        total_invoiced: totalInvoiced,
        total_ar: totalOutstandingAR,
        total_expenses: totalExpenses,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-weekly-financials error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
