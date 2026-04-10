// J6: agent-calibrate-templates — triggered when project.status = 'complete'
// Extracts actual costs from a completed project and updates the matching
// estimate template range. Per spec: use median (not average), require >= 3
// actuals before recalibrating, never update from a single outlier.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
})

async function callAssembleContext(agentName: string, query: string): Promise<string | null> {
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
        capability_required: 'calibrate_estimate_templates',
        query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch {
    return null
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

interface CalibrateRequest {
  project_id: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const rl = await checkRateLimit(req, 'agent-calibrate-templates')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { project_id } = parsedInput.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    await callAssembleContext(
      'agent-calibrate-templates',
      `calibrate estimate template from project ${project_id}`,
    )

    // Fetch the completed project
    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id, project_type, contract_value, actual_cost, estimated_duration_weeks, status')
      .eq('id', project_id)
      .single()

    if (projectErr || !project) {
      return new Response(JSON.stringify({ error: 'project not found', detail: projectErr }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (project.status !== 'complete') {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'project is not complete' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Find the matching template (first active match by project_type)
    const { data: templates } = await supabase
      .from('estimate_templates')
      .select('*')
      .eq('project_type', project.project_type)
      .eq('is_active', true)
      .limit(1)

    const template = templates?.[0]
    if (!template) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no template for project_type' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Record the actual
    const { error: actualErr } = await supabase
      .from('estimate_template_actuals')
      .insert({
        template_id: template.id,
        project_id: project.id,
        actual_total_cost: project.actual_cost ?? 0,
        actual_contract_value: project.contract_value ?? 0,
        actual_duration_weeks: project.estimated_duration_weeks ?? null,
      })

    if (actualErr) {
      return new Response(JSON.stringify({ error: 'failed to record actual', detail: actualErr }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Recalculate ranges from all actuals for this template
    const { data: allActuals } = await supabase
      .from('estimate_template_actuals')
      .select('actual_total_cost')
      .eq('template_id', template.id)

    const actualsList = (allActuals ?? []).map((a: { actual_total_cost: number }) =>
      Number(a.actual_total_cost),
    )

    let calibrated = false
    if (actualsList.length >= 3) {
      const newMin = Math.min(...actualsList)
      const newMax = Math.max(...actualsList)
      const newTypical = median(actualsList)

      await supabase
        .from('estimate_templates')
        .update({
          total_cost_min: newMin,
          total_cost_max: newMax,
          total_cost_typical: newTypical,
          projects_count: actualsList.length,
          confidence_level: actualsList.length >= 10 ? 'actual' : 'regional',
          last_calibrated_at: new Date().toISOString(),
        })
        .eq('id', template.id)

      calibrated = true
    }

    return new Response(
      JSON.stringify({
        ok: true,
        template_id: template.id,
        actuals_count: actualsList.length,
        calibrated,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
