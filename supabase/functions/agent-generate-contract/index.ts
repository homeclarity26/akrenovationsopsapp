// H6: agent-generate-contract — generates sub contract from approved template + scope
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callAssembleContext(agentName: string, query: string, projectId?: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system',
        user_role: 'admin',
        agent_name: agentName,
        capability_required: 'generate_documents',
        query,
        entity_type: projectId ? 'project' : undefined,
        entity_id: projectId,
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

function formatCurrency(n: number): string {
  return `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/```\s*([\s\S]*?)```/)
  const txt = (fenced ? fenced[1] : raw).trim()
  try { return JSON.parse(txt) } catch {
    const firstBracket = txt.indexOf('[')
    const lastBracket = txt.lastIndexOf(']')
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      return JSON.parse(txt.slice(firstBracket, lastBracket + 1))
    }
    return []
  }
}

type PaymentMilestone = { milestone: string; amount: number; due_condition: string }

function formatPaymentTable(schedule: PaymentMilestone[]): string {
  if (!Array.isArray(schedule) || schedule.length === 0) return '[To be determined]'
  return schedule
    .map((m, i) => `  ${i + 1}. ${m.milestone} — ${formatCurrency(m.amount)} (${m.due_condition})`)
    .join('\n')
}

function substituteVariables(template: Record<string, unknown>, vars: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(template)
  let out = json
  for (const [k, v] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{\\{${k}\\}\\}`, 'g')
    const replacement = v === null || v === undefined ? '' : String(v)
    // Escape backslashes and double quotes so the replacement stays valid JSON
    const escaped = replacement.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
    out = out.replace(pattern, escaped)
  }
  // Strip conditional blocks that didn't match
  const conditional = vars.liquidated_damages as boolean | undefined
  const parsed = JSON.parse(out) as Record<string, unknown>
  if (Array.isArray(parsed.sections) && !conditional) {
    parsed.sections = (parsed.sections as Array<Record<string, unknown>>).filter(
      (s) => s.conditional !== 'liquidated_damages',
    )
  }
  return parsed
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const {
      project_id,
      scope_id,
      retention_percent,
      start_date,
      completion_date,
      liquidated_damages_per_day,
    } = body

    if (!project_id || !scope_id) {
      return new Response(
        JSON.stringify({ error: 'project_id and scope_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Assemble context
    const basePrompt = await callAssembleContext('agent-generate-contract', `generate sub contract from scope ${scope_id}`, project_id)

    // Fetch scope, quote, sub, project
    const { data: scope } = await supabase.from('sub_scopes').select('*').eq('id', scope_id).single()
    if (!scope) throw new Error('Scope not found')
    if (!['reviewed', 'sent', 'acknowledged'].includes(scope.status)) {
      throw new Error(`Cannot generate contract — scope status is "${scope.status}". Scope must be reviewed first.`)
    }

    const { data: quote } = await supabase.from('budget_quotes').select('*').eq('id', scope.budget_quote_id).single()
    if (!quote) throw new Error('Budget quote not found')
    const { data: sub } = await supabase.from('subcontractors').select('*').eq('id', scope.subcontractor_id).single()
    if (!sub) throw new Error('Subcontractor not found')
    const { data: project } = await supabase.from('projects').select('*').eq('id', project_id).single()
    if (!project) throw new Error('Project not found')

    // Get current approved/default template
    const { data: template } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('is_current', true)
      .eq('template_type', 'subcontractor_agreement')
      .single()
    if (!template) throw new Error('No current subcontractor_agreement template found')

    // Generate payment schedule using Claude
    const pmtSystem =
      (basePrompt ?? 'You are AK Renovations contracts assistant.') +
      `

Generate a fair and practical payment schedule for this subcontractor agreement.
Return ONLY a JSON array of {milestone, amount, due_condition}.
Typical for construction: 30-40% mobilization, 30-40% mid-project, balance on completion.
No markdown fences, no commentary.`
    const pmtUser = `Contract amount: ${quote.amount}. Trade: ${scope.trade}. Project type: ${project.project_type}.`
    let paymentSchedule: PaymentMilestone[] = []
    try {
      const pmtRaw = await callClaude(pmtSystem, pmtUser, 1024)
      const parsed = extractJson(pmtRaw)
      if (Array.isArray(parsed)) paymentSchedule = parsed as PaymentMilestone[]
    } catch {
      // Fallback: 40/40/20
      const amt = Number(quote.amount) || 0
      paymentSchedule = [
        { milestone: 'Mobilization', amount: Math.round(amt * 0.4 * 100) / 100, due_condition: 'Upon mobilization to site' },
        { milestone: 'Mid-project', amount: Math.round(amt * 0.4 * 100) / 100, due_condition: 'At 50% completion of scope' },
        { milestone: 'Final', amount: Math.round(amt * 0.2 * 100) / 100, due_condition: 'Upon substantial completion and punch list sign-off' },
      ]
    }

    const vars: Record<string, unknown> = {
      contract_number: 'TO BE ASSIGNED',
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      sub_company_name: sub.company_name,
      sub_contact_name: sub.contact_name ?? '[CONTACT NAME]',
      sub_title: 'Owner',
      sub_address: sub.address ?? '[ADDRESS]',
      sub_license_number: sub.license_number ?? '[LICENSE NO. TO BE CONFIRMED]',
      sub_insurance_policy: '[SEE CERTIFICATE OF INSURANCE]',
      project_name: project.title,
      project_address: project.address,
      client_name: project.client_name,
      scope_title: `Scope of Work — ${scope.trade} — ${project.title}`,
      scope_number: scope.scope_number,
      scope_date: new Date(scope.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      contract_amount: formatCurrency(quote.amount),
      payment_schedule_table: formatPaymentTable(paymentSchedule),
      retention_percent: retention_percent ?? 10,
      required_gl_amount: '1,000,000',
      start_date: start_date ?? '[TO BE CONFIRMED]',
      completion_date: completion_date ?? '[TO BE CONFIRMED]',
      liquidated_damages: !!liquidated_damages_per_day,
      liquidated_damages_per_day: liquidated_damages_per_day ?? 0,
    }

    // Substitute variables into template JSON (legal body stays in template, not in contract row)
    const filledTemplate = substituteVariables(template.content as Record<string, unknown>, vars)

    // Insert sub_contract
    const { data: contract, error: insertErr } = await supabase
      .from('sub_contracts')
      .insert({
        project_id,
        scope_id: scope.id,
        subcontractor_id: sub.id,
        budget_quote_id: quote.id,
        contract_amount: quote.amount,
        payment_schedule: paymentSchedule,
        retention_percent: retention_percent ?? 10,
        start_date: start_date ?? null,
        completion_date: completion_date ?? null,
        liquidated_damages_per_day: liquidated_damages_per_day ?? null,
        required_gl_amount: 1000000,
        required_wc: true,
        additional_insured: true,
        template_version: template.version,
        status: 'draft',
        attorney_approved_template: !!template.attorney_approved,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    return new Response(
      JSON.stringify({ contract, rendered_template: filledTemplate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
