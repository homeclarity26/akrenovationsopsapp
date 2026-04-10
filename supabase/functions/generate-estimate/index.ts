// generate-estimate — Takes walkthrough answers + estimate templates and produces
// structured estimate line items via Claude. Returns line items with pricing that
// the frontend renders, and optionally inserts an estimate + draft proposal into DB.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  project_type: z.enum(['bathroom', 'kitchen', 'basement', 'addition']),
  walkthrough_answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
  lead_id: z.string().uuid().optional(),
  client_name: z.string().optional(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'generate-estimate')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { project_type, walkthrough_answers, lead_id, client_name } = parsed.data

    const company = await getCompanyProfile(supabase, 'system')

    // Fetch estimate templates for this project type from DB (fall back to empty)
    const { data: templates } = await supabase
      .from('estimate_templates')
      .select('*')
      .eq('project_type', project_type)
      .limit(5)

    // Fetch labor benchmarks for this project type
    const { data: benchmarks } = await supabase
      .from('labor_benchmarks')
      .select('*')
      .or(`project_type.eq.${project_type},project_type.is.null`)
      .eq('is_active', true)

    // Build the prompt with real template/benchmark data
    const templateContext = (templates && templates.length > 0)
      ? templates.map(t =>
        `Template: ${t.name} (${t.finish_level})\n` +
        `  Cost range: $${t.total_cost_min?.toLocaleString()}–$${t.total_cost_max?.toLocaleString()} (typical $${t.total_cost_typical?.toLocaleString()})\n` +
        `  Duration: ${t.duration_weeks_min}–${t.duration_weeks_max} weeks (typical ${t.duration_weeks_typical})\n` +
        `  Unit costs: ${JSON.stringify(t.unit_costs)}\n` +
        `  Trade breakdown: ${JSON.stringify(t.trade_breakdown)}`
      ).join('\n\n')
      : `No templates in DB yet for ${project_type}. Use industry-standard pricing for a mid-range ${project_type} remodel.`

    const benchmarkContext = (benchmarks && benchmarks.length > 0)
      ? benchmarks.map(b =>
        `${b.task_name} (${b.category}): ${b.hours_min}–${b.hours_max} hrs typical ${b.hours_typical} hrs, unit: ${b.unit}`
      ).join('\n')
      : 'No labor benchmarks available. Use industry-standard labor estimates.'

    const walkthroughText = walkthrough_answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')

    const systemPrompt = buildSystemPrompt(company, 'senior estimator') + `

You are generating a detailed construction estimate from site walk interview answers.
You have access to the company's estimate templates and labor benchmarks below.

ESTIMATE TEMPLATES:
${templateContext}

LABOR BENCHMARKS:
${benchmarkContext}

INSTRUCTIONS:
1. Analyze the walkthrough answers to understand the full scope of work.
2. Generate a detailed estimate with line items grouped by trade/category.
3. Each line item must have: category, item name, description, quantity, unit, unit cost, and total.
4. Include labor costs as separate line items where applicable.
5. Add a contingency line item (typically 10-15% for remodels).
6. Be realistic — use the template unit costs as a guide but adjust based on the specific scope described.

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.

JSON format:
{
  "summary": "Brief 2-3 sentence summary of the project scope",
  "project_type": "${project_type}",
  "finish_level": "mid_range|high_end|builder|luxury",
  "estimated_duration_weeks": <number>,
  "line_items": [
    {
      "category": "string (e.g. Demolition, Plumbing, Tile, Fixtures, Electrical, Cabinetry, Countertops, Labor, Contingency)",
      "item_name": "string",
      "description": "string",
      "quantity": <number>,
      "unit": "string (e.g. sqft, each, linear ft, allowance, flat, hours)",
      "unit_cost": <number>,
      "total": <number>
    }
  ],
  "subtotal": <number>,
  "contingency_percent": <number>,
  "contingency_amount": <number>,
  "total_estimated_cost": <number>,
  "margin_percent": 38,
  "total_proposed_price": <number>,
  "payment_schedule": [
    { "milestone": "string", "percent": <number>, "amount": <number> }
  ]
}`

    const t0 = Date.now()
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_CONFIG.PRIMARY_MODEL,
        max_tokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Generate a detailed estimate for this ${project_type} remodel based on the site walk interview:\n\n${walkthroughText}`,
        }],
      }),
    })

    if (!anthropicRes.ok) throw new Error(`Claude error: ${await anthropicRes.text()}`)
    const anthropicData = await anthropicRes.json()
    const rawText = anthropicData.content?.[0]?.text ?? ''
    const duration = Date.now() - t0

    // Log usage
    logAiUsage({
      function_name: 'generate-estimate',
      model_provider: 'anthropic',
      model_name: AI_CONFIG.PRIMARY_MODEL,
      input_tokens: anthropicData.usage?.input_tokens ?? 0,
      output_tokens: anthropicData.usage?.output_tokens ?? 0,
      duration_ms: duration,
      status: 'success',
    }).catch(() => {})

    // Parse the JSON from Claude's response
    let estimate: Record<string, unknown>
    try {
      // Strip any markdown code fences if present
      const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
      estimate = JSON.parse(cleaned)
    } catch {
      // If JSON parsing fails, return the raw text as a summary fallback
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to parse estimate JSON from AI',
          raw_response: rawText,
        }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Insert estimate into DB — non-blocking. A DB failure must never prevent
    // the estimate JSON from reaching the frontend. We always return line items.
    let savedEstimateId: string | null = null
    let savedProposalId: string | null = null
    let dbSaveError: string | null = null

    try {
      const estimateRecord = {
        lead_id: lead_id ?? null,
        project_type,
        walkthrough_data: walkthrough_answers,
        material_list: (estimate.line_items as unknown[])?.filter((li: Record<string, unknown>) => li.category !== 'Labor' && li.category !== 'Contingency') ?? [],
        labor_estimate: (estimate.line_items as unknown[])?.filter((li: Record<string, unknown>) => li.category === 'Labor') ?? [],
        total_estimated_cost: estimate.total_estimated_cost ?? 0,
        total_proposed_price: estimate.total_proposed_price ?? 0,
        margin_percent: estimate.margin_percent ?? 38,
        status: 'draft',
      }

      const { data: savedEstimate, error: estError } = await supabase
        .from('estimates')
        .insert(estimateRecord)
        .select('id')
        .single()

      if (estError) {
        dbSaveError = estError.message
      } else if (savedEstimate) {
        savedEstimateId = savedEstimate.id

        // Create a draft proposal linked to the estimate
        const sections = buildProposalSections(estimate)
        const { data: proposal } = await supabase
          .from('proposals')
          .insert({
            estimate_id: savedEstimate.id,
            lead_id: lead_id ?? null,
            title: `${capitalize(project_type)} Remodel Proposal`,
            client_name: client_name ?? 'Client',
            project_type,
            overview_body: estimate.summary ?? '',
            sections,
            total_price: estimate.total_proposed_price ?? 0,
            payment_schedule: estimate.payment_schedule ?? [],
            status: 'draft',
          })
          .select('id')
          .single()
        savedProposalId = proposal?.id ?? null
      }
    } catch (dbErr) {
      // Log but do not throw — the estimate data is what matters
      dbSaveError = String(dbErr)
      console.error('generate-estimate DB save error (non-fatal):', dbErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        estimate_id: savedEstimateId,
        proposal_id: savedProposalId,
        db_save_error: dbSaveError, // visible in dev tools if save failed; ignored by frontend
        ...estimate,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('generate-estimate error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})

/** Group line items by category into proposal sections */
function buildProposalSections(estimate: Record<string, unknown>): { title: string; bullets: string[] }[] {
  const lineItems = (estimate.line_items as { category: string; item_name: string; description: string; total: number }[]) ?? []
  const grouped: Record<string, string[]> = {}
  for (const li of lineItems) {
    const cat = li.category || 'General'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(`${li.item_name}: ${li.description} — $${li.total.toLocaleString()}`)
  }
  return Object.entries(grouped).map(([title, bullets]) => ({ title, bullets }))
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
