import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'

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
      model: AI_CONFIG.PRIMARY_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-cash-flow')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const company = await getCompanyProfile(supabase, 'system');

    const basePrompt = await callAssembleContext('agent-cash-flow', 'project 30 and 60 day cash flow')
    const systemPrompt =
      (basePrompt ?? buildSystemPrompt(company, 'financial analyst')) +
      `

CASH FLOW PROJECTION TASK
Analyze the incoming and outgoing cash for the next 30 and 60 days.
Flag any periods where outgoing exceeds incoming (negative cash position).
Be specific: list which invoices are due, which sub payments are pending.
Recommend action items if cash is tight. No em dashes.`

    const today = new Date()
    const in30Days = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]
    const in60Days = new Date(today.getTime() + 60 * 86400000).toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    const [{ data: incomingInvoices }, { data: subPayments }] = await Promise.all([
      supabase
        .from('invoices')
        .select('id,invoice_number,title,balance_due,due_date,status,project_id')
        .in('status', ['sent', 'overdue', 'partial_paid'])
        .lte('due_date', in60Days),
      supabase
        .from('project_subcontractors')
        .select('id,project_id,contracted_amount,paid_amount,scheduled_end,subcontractor_id')
        .in('status', ['scheduled', 'active', 'complete'])
        .lte('scheduled_end', in60Days)
        .gte('scheduled_end', todayStr),
    ])

    // Get project/client names
    const invoiceProjectIds = [...new Set((incomingInvoices ?? []).map((i) => i.project_id))]
    const subProjectIds = [...new Set((subPayments ?? []).map((s) => s.project_id))]
    const allProjectIds = [...new Set([...invoiceProjectIds, ...subProjectIds])]

    const { data: projects } = await supabase
      .from('projects')
      .select('id,title,client_name')
      .in('id', allProjectIds)

    const projectMap = new Map((projects ?? []).map((p) => [p.id, p]))

    // Get subcontractor names
    const subIds = [...new Set((subPayments ?? []).map((s) => s.subcontractor_id))]
    const { data: subContractors } = await supabase
      .from('subcontractors')
      .select('id,company_name')
      .in('id', subIds)
    const subMap = new Map((subContractors ?? []).map((s) => [s.id, s]))

    // Bucket into 30-day and 60-day windows
    const incoming30 = (incomingInvoices ?? []).filter((i) => i.due_date <= in30Days)
    const incoming60 = (incomingInvoices ?? []).filter((i) => i.due_date > in30Days && i.due_date <= in60Days)
    const outgoing30 = (subPayments ?? []).filter((s) => s.scheduled_end <= in30Days)
    const outgoing60 = (subPayments ?? []).filter((s) => s.scheduled_end > in30Days && s.scheduled_end <= in60Days)

    const totalIn30 = incoming30.reduce((sum, i) => sum + (i.balance_due ?? 0), 0)
    const totalIn60 = incoming60.reduce((sum, i) => sum + (i.balance_due ?? 0), 0)
    const totalOut30 = outgoing30.reduce((sum, s) => sum + ((s.contracted_amount ?? 0) - (s.paid_amount ?? 0)), 0)
    const totalOut60 = outgoing60.reduce((sum, s) => sum + ((s.contracted_amount ?? 0) - (s.paid_amount ?? 0)), 0)

    const net30 = totalIn30 - totalOut30
    const net60 = totalIn30 + totalIn60 - (totalOut30 + totalOut60)

    const projectionData = {
      as_of: todayStr,
      next_30_days: {
        expected_in: totalIn30,
        expected_out: totalOut30,
        net: net30,
        invoices: incoming30.map((i) => ({
          number: i.invoice_number,
          client: projectMap.get(i.project_id)?.client_name ?? 'Unknown',
          amount: i.balance_due,
          due: i.due_date,
        })),
        sub_payments: outgoing30.map((s) => ({
          company: subMap.get(s.subcontractor_id)?.company_name ?? 'Unknown',
          project: projectMap.get(s.project_id)?.title ?? 'Unknown',
          amount: (s.contracted_amount ?? 0) - (s.paid_amount ?? 0),
          due: s.scheduled_end,
        })),
      },
      next_60_days: {
        expected_in: totalIn30 + totalIn60,
        expected_out: totalOut30 + totalOut60,
        net: net60,
      },
      flags: [
        ...(net30 < 0 ? [`ALERT: Negative 30-day cash position of -$${Math.abs(net30).toLocaleString()}`] : []),
        ...(net60 < 0 ? [`ALERT: Negative 60-day cash position of -$${Math.abs(net60).toLocaleString()}`] : []),
      ],
    }

    const reportText = await callClaude(
      systemPrompt,
      `Cash flow projection data: ${JSON.stringify(projectionData, null, 2)}\n\nWrite the cash flow report.`,
      800,
    )

    await writeOutput(
      supabase,
      'agent-cash-flow',
      'report',
      `Cash Flow Projection — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      reportText,
      {
        as_of: todayStr,
        net_30: net30,
        net_60: net60,
        total_ar_30: totalIn30,
        total_ar_60: totalIn30 + totalIn60,
        total_payables_30: totalOut30,
        total_payables_60: totalOut30 + totalOut60,
        negative_position: net30 < 0 || net60 < 0,
      },
      false,
    )

    return new Response(
      JSON.stringify({ success: true, net_30: net30, net_60: net60, projection: projectionData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-cash-flow error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
