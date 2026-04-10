/*
 * F24 AUDIT — Bonus Qualification & Billed Labor Revenue
 *
 * This agent reads projects.actual_margin for margin qualification.
 * projects.actual_margin must be kept in sync by the invoice-creation flow:
 * when time_entries with billing_status='invoiced' are added to an invoice,
 * the project's actual_cost should increase by the labor cost (employee_rate × hours)
 * and contract_value/revenue should reflect the billed_amount.
 *
 * Current state: agent reads projects.actual_margin directly — no changes needed here.
 * Required for full accuracy: ensure InvoicesPage / invoice creation updates
 * projects.actual_cost and projects.contract_value when billable time is invoiced.
 * This will happen when Supabase is connected and real invoice creation is wired.
 *
 * No code changes required in this file.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
})

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

// Bonus amounts by project type per the spec
const BONUS_AMOUNTS: Record<string, number> = {
  addition: 900,
  kitchen: 900,
  basement: 600,
  bathroom: 600,
  first_floor: 600,
  other: 350,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-bonus-qualification')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { project_id } = parsedInput.data

    const basePrompt = await callAssembleContext('agent-bonus-qualification', 'calculate employee bonus qualification for completed project')

    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id,title,project_type,client_name,actual_completion_date,target_completion_date,actual_cost,contract_value,target_margin,bonus_eligible')
      .eq('id', project_id)
      .single()

    if (projError || !project) throw projError ?? new Error('Project not found')

    if (!project.bonus_eligible) {
      return new Response(JSON.stringify({ success: true, message: 'Project not bonus eligible' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check schedule target
    const scheduleHit =
      project.actual_completion_date && project.target_completion_date
        ? new Date(project.actual_completion_date) <= new Date(project.target_completion_date)
        : false

    // Check margin target
    const actualMargin =
      project.contract_value > 0
        ? (project.contract_value - project.actual_cost) / project.contract_value
        : 0
    const marginHit = actualMargin >= (project.target_margin ?? 0.38)

    const qualified = scheduleHit && marginHit

    // Get assigned employees
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('employee_id,role')
      .eq('project_id', project_id)

    const bonusAmount = BONUS_AMOUNTS[project.project_type] ?? BONUS_AMOUNTS.other

    const bonusRecords: Array<{
      project_id: string
      employee_id: string
      project_type: string
      bonus_amount: number
      schedule_target_met: boolean
      margin_target_met: boolean
      qualified: boolean
    }> = []

    for (const assignment of assignments ?? []) {
      // Check if bonus record already exists
      const { data: existing } = await supabase
        .from('bonus_records')
        .select('id')
        .eq('project_id', project_id)
        .eq('employee_id', assignment.employee_id)
        .single()

      if (existing) continue

      bonusRecords.push({
        project_id,
        employee_id: assignment.employee_id,
        project_type: project.project_type,
        bonus_amount: qualified ? bonusAmount : 0,
        schedule_target_met: scheduleHit,
        margin_target_met: marginHit,
        qualified,
      })
    }

    if (bonusRecords.length > 0) {
      await supabase.from('bonus_records').insert(bonusRecords)
    }

    // Update project bonus fields
    await supabase
      .from('projects')
      .update({
        bonus_schedule_hit: scheduleHit,
        bonus_margin_hit: marginHit,
        actual_margin: actualMargin,
        bonus_amount_per_employee: bonusAmount,
      })
      .eq('id', project_id)

    const systemPrompt =
      (basePrompt ?? 'You are an AI assistant for AK Renovations.') +
      ' Write a concise bonus qualification summary for Adam. Include who qualifies, why or why not, and the total payout.'

    const summaryText = await callClaude(
      systemPrompt,
      `Project: ${project.title} (${project.client_name})
Type: ${project.project_type}
Schedule Target Met: ${scheduleHit} (completed ${project.actual_completion_date}, target ${project.target_completion_date})
Margin Target Met: ${marginHit} (actual ${(actualMargin * 100).toFixed(1)}%, target ${((project.target_margin ?? 0.38) * 100).toFixed(1)}%)
Employees Evaluated: ${bonusRecords.length}
Qualified: ${qualified}
Bonus Per Employee: $${bonusAmount}
Total Payout: $${qualified ? bonusAmount * bonusRecords.length : 0}

Write the bonus qualification summary.`,
      400,
    )

    await writeOutput(
      supabase,
      'agent-bonus-qualification',
      'report',
      `Bonus Qualification: ${project.title}`,
      summaryText,
      {
        project_id,
        project_title: project.title,
        qualified,
        schedule_hit: scheduleHit,
        margin_hit: marginHit,
        actual_margin: actualMargin,
        bonus_amount_per_employee: bonusAmount,
        employees_evaluated: bonusRecords.length,
        total_payout: qualified ? bonusAmount * bonusRecords.length : 0,
      },
      false,
    )

    return new Response(
      JSON.stringify({
        success: true,
        qualified,
        schedule_hit: scheduleHit,
        margin_hit: marginHit,
        actual_margin: actualMargin,
        bonus_amount: bonusAmount,
        employees_evaluated: bonusRecords.length,
        records_created: bonusRecords.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-bonus-qualification error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
