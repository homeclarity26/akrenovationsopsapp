// H5: agent-generate-scope — generates scope of work for a subcontractor trade
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
  project_id: z.string().uuid('project_id must be a valid UUID'),
  budget_quote_id: z.string().uuid('budget_quote_id must be a valid UUID'),
  trade: z.string(),
  additional_instructions: z.string().optional(),
})

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

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 4096): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
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

// Trade knowledge base — injected into prompts per trade
const TRADE_KNOWLEDGE: Record<string, string> = {
  framing: `
    Standard inclusions: structural framing, headers, LVL beams, temporary bracing,
    blocking for cabinets/fixtures, shear walls per engineering, stair framing,
    roof framing or trusses, hurricane ties and seismic straps per code.
    Standard exclusions: foundation, roofing, windows, doors, exterior sheathing (unless specified),
    insulation, drywall.
    Ohio-specific: must meet OBC 2024 R602 wood wall framing requirements.
    Inspection: rough framing inspection before insulation — sub schedules with AHJ.
    Coordination: rough opening sizes with window/door supplier, beam sizing with structural engineer if applicable.
  `,
  plumbing: `
    Standard inclusions: all rough-in supply and drain lines, fixture connections,
    water heater installation (if in scope), pressure testing, permit and inspection coordination,
    all penetrations through framing properly supported and fire-stopped.
    Standard exclusions: fixtures supply (unless specified), finish trim (unless specified),
    gas line work (separate license required unless plumber has dual license).
    Ohio-specific: Ohio plumbing code OPC 2022, licensed plumber required (Ohio HIC license),
    all work permitted and inspected.
    Inspection: rough plumbing before drywall, final after fixtures.
    Coordination: fixture selections must be confirmed before rough-in, coordinate with HVAC for penetrations.
  `,
  electrical: `
    Standard inclusions: all rough wiring, panel upgrade if in scope, circuit layout per plan,
    outlet and switch boxes, can light rough-ins, smoke/CO detector rough-ins,
    all work to NEC 2023 and Ohio amendments, permit and all inspections.
    Standard exclusions: fixture supply, low voltage (separate if not specified),
    generator hookup (unless specified).
    Ohio-specific: licensed electrician required (Ohio ESO), all work permitted.
    Inspection: rough electrical before drywall, load calc for panel work, final.
    Coordination: fixture selections before rough-in for can light layout, coordinate with HVAC.
  `,
  hvac: `
    Standard inclusions: ductwork design and installation, equipment supply and installation,
    all penetrations, startup and commissioning, Manual J load calculation if required,
    all permits and inspections.
    Standard exclusions: gas line to unit (plumber unless HVAC contractor licensed for gas),
    electrical connection to unit (electrician), thermostat wiring (sometimes HVAC, confirm).
    Ohio-specific: licensed HVAC contractor, Ohio mechanical code, EPA 608 certification for refrigerant.
    Inspection: rough mechanical before drywall, final commissioning.
    Coordination: equipment location with framing, penetrations with roofing.
  `,
  drywall: `
    Standard inclusions: hang, tape, finish to Level 4 (standard) or Level 5 (paint-ready),
    corner bead, blocking coordination with framing trade, fire-rated assemblies where required.
    Standard exclusions: priming and painting (separate trade), texture (unless specified).
    Ohio-specific: fire-rated assemblies per OBC, garage/living space separation requirements.
    Inspection: none typically required but must meet fire separation requirements.
    Coordination: must be complete before cabinet installation, coordinate Level 5 finish with painter.
  `,
  roofing: `
    Standard inclusions: tear-off if needed, decking repair, underlayment, ice and water shield,
    shingles or specified roofing material, ridge vent, flashing, boot stacks, all penetrations sealed.
    Standard exclusions: framing, fascia replacement (unless specified), gutters (unless specified).
    Ohio-specific: ice and water shield required 24" inside exterior wall line, OBC compliance.
    Inspection: typically none but must meet manufacturer warranty requirements.
    Coordination: with siding for flashing, with HVAC for vent stacks and equipment curbs.
  `,
  concrete: `
    Standard inclusions: excavation if in scope, forms, rebar per engineering, pour, finish, strip,
    waterproofing if foundation, damp proofing per code.
    Standard exclusions: footings drain tile (sometimes separate), backfill, compaction testing.
    Ohio-specific: frost depth 36" minimum in Summit County, OBC compliance for foundations.
    Inspection: footing inspection before pour, foundation inspection before backfill.
    Coordination: with framing for anchor bolt layout, with plumber for under-slab rough.
  `,
  excavation: `
    Standard inclusions: site clearing, topsoil stripping, excavation to design depth, spoils management,
    rough grading, backfill and compaction around foundation.
    Standard exclusions: tree removal beyond footprint, hazardous soil removal, retaining walls.
    Ohio-specific: Ohio 811 call before dig required, erosion control per EPA.
    Inspection: typically no inspection but subgrade must be approved before foundation.
    Coordination: with concrete sub for footing layout and pour timing.
  `,
  siding: `
    Standard inclusions: house wrap, flashing, siding material install, trim, caulking, penetrations sealed.
    Standard exclusions: sheathing, windows, doors, painting (unless pre-finished material).
    Ohio-specific: weather barrier per OBC, flashing at all penetrations.
    Inspection: typically none but must be weather-tight before interior finish.
    Coordination: with roofing for step flashing, with window installer for flashing details.
  `,
  flooring: `
    Standard inclusions: subfloor prep, underlayment, flooring install per manufacturer, transitions, base shoe if specified.
    Standard exclusions: subfloor repair beyond prep, baseboards (unless specified), demo of existing flooring.
    Ohio-specific: manufacturer warranty requirements apply.
    Inspection: none.
    Coordination: with trim carpenter for base and transitions, with tile sub for thresholds.
  `,
}

function getTradeKnowledge(trade: string): string {
  const normalized = trade.toLowerCase()
  for (const key of Object.keys(TRADE_KNOWLEDGE)) {
    if (normalized.includes(key)) return TRADE_KNOWLEDGE[key]
  }
  return 'Standard trade inclusions and exclusions apply. Follow Ohio Building Code 2024 and best practices for residential construction.'
}

function isRelevantToTrade(selection: { category?: string | null; item_name?: string | null }, trade: string): boolean {
  const t = trade.toLowerCase()
  const text = `${selection.category ?? ''} ${selection.item_name ?? ''}`.toLowerCase()
  if (t.includes('plumb')) return /plumb|faucet|sink|toilet|shower|tub|fixture/.test(text)
  if (t.includes('electric')) return /electric|light|outlet|switch|fan|fixture/.test(text)
  if (t.includes('floor')) return /floor|tile|carpet|vinyl|hardwood|lvp/.test(text)
  if (t.includes('tile')) return /tile|grout/.test(text)
  if (t.includes('cabinet')) return /cabinet|hardware|knob|pull/.test(text)
  if (t.includes('paint')) return /paint|stain|color/.test(text)
  if (t.includes('window') || t.includes('door')) return /window|door/.test(text)
  if (t.includes('roof')) return /roof|shingle|gutter/.test(text)
  if (t.includes('siding')) return /siding|trim|exterior/.test(text)
  return false
}

function extractJson(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/```\s*([\s\S]*?)```/)
  const txt = (fenced ? fenced[1] : raw).trim()
  try { return JSON.parse(txt) } catch {
    const firstBrace = txt.indexOf('{')
    const lastBrace = txt.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(txt.slice(firstBrace, lastBrace + 1))
    }
    throw new Error('Could not parse JSON from Claude response')
  }
}

function flattenToPlainText(scope: Record<string, unknown>): string {
  const lines: string[] = []
  const header = scope.header as Record<string, unknown> | undefined
  if (header) {
    lines.push(`${header.scope_number ?? ''}`)
    lines.push(`${header.project_name ?? ''}`)
    lines.push(`${header.project_address ?? ''}`)
    lines.push(`Trade: ${header.trade ?? ''}`)
    lines.push(`Subcontractor: ${header.subcontractor ?? ''}`)
    lines.push('')
  }
  if (scope.scope_summary) { lines.push('SUMMARY'); lines.push(String(scope.scope_summary)); lines.push('') }
  const sectionList: Array<[string, unknown]> = [
    ['INCLUSIONS', scope.inclusions],
    ['EXCLUSIONS', scope.exclusions],
    ['QUALITY STANDARDS', scope.quality_standards],
    ['COORDINATION REQUIREMENTS', scope.coordination_requirements],
    ['INSPECTION REQUIREMENTS', scope.inspection_requirements],
    ['SPECIAL CONDITIONS', scope.special_conditions],
  ]
  for (const [label, val] of sectionList) {
    if (Array.isArray(val) && val.length) {
      lines.push(label)
      for (const item of val) lines.push(`  - ${item}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-generate-scope')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const company = await getCompanyProfile(supabase, 'system');

    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { project_id, budget_quote_id, trade, additional_instructions } = parsedInput.data

    // Assemble context first
    const basePrompt = await callAssembleContext('agent-generate-scope', `generate scope for ${trade} on project ${project_id}`, project_id)

    // Fetch all data
    const { data: project } = await supabase.from('projects').select('*').eq('id', project_id).single()
    const { data: quote } = await supabase.from('budget_quotes').select('*').eq('id', budget_quote_id).single()
    let sub: Record<string, unknown> | null = null
    if (quote?.subcontractor_id) {
      const { data } = await supabase.from('subcontractors').select('*').eq('id', quote.subcontractor_id).single()
      sub = data
    }
    const { data: tradeRow } = quote?.trade_id
      ? await supabase.from('budget_trades').select('*').eq('id', quote.trade_id).single()
      : { data: null }
    const { data: selections } = await supabase.from('client_selections').select('*').eq('project_id', project_id)
    const { data: existingTrades } = await supabase.from('budget_trades').select('name').eq('project_id', project_id)

    if (!project || !quote) {
      return new Response(
        JSON.stringify({ error: 'project or quote not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const relevantSelections = (selections ?? []).filter((s) => isRelevantToTrade(s, trade))

    const systemPrompt =
      (basePrompt ?? buildSystemPrompt(company, 'contracts assistant')) +
      `

You are generating a professional Scope of Work document for a residential renovation subcontractor in Ohio.

TRADE KNOWLEDGE BASE — ${String(trade).toUpperCase()}:
${getTradeKnowledge(trade)}

CRITICAL REQUIREMENTS:
- Be specific and technical — vague scopes cause disputes
- Every inclusion must be unambiguous
- Every exclusion must be explicitly stated
- Reference Ohio Building Code 2024 for all applicable requirements
- Match the tone of a professional construction document
- Quantities and specifications should be specific where data is available
- If a detail is unknown, flag it with [TO BE CONFIRMED] rather than guessing
- No em dashes anywhere

Return a complete ScopeDocument JSON object with this exact shape:
{
  "header": {
    "scope_number": "TO BE ASSIGNED",
    "project_name": string,
    "project_address": string,
    "client_name": string,
    "trade": string,
    "subcontractor": string,
    "contract_amount": number,
    "date_prepared": string,
    "prepared_by": "${company.name} — ${company.owner_name}"
  },
  "scope_summary": string,
  "inclusions": string[],
  "exclusions": string[],
  "materials": {
    "furnished_by_sub": string[],
    "furnished_by_akr": string[],
    "client_selections": string[]
  },
  "quality_standards": string[],
  "coordination_requirements": string[],
  "inspection_requirements": string[],
  "schedule": {
    "mobilization_date": string,
    "substantial_completion": string,
    "milestones": string[]
  },
  "payment_terms": {
    "total_amount": number,
    "schedule": string,
    "retention": string
  },
  "special_conditions": string[],
  "signature_block": {
    "akr_signature_line": true,
    "sub_signature_line": true,
    "date_line": true
  }
}

Return ONLY the JSON object. No markdown fences, no commentary.`

    const userMessage = `Generate a complete Scope of Work for the following:

PROJECT: ${JSON.stringify(project)}
AWARDED QUOTE: ${JSON.stringify(quote)}
SUBCONTRACTOR: ${JSON.stringify(sub)}
TRADE DETAILS: ${JSON.stringify(tradeRow)}
CLIENT SELECTIONS (relevant to this trade): ${JSON.stringify(relevantSelections)}
OTHER TRADES ON PROJECT: ${(existingTrades ?? []).map((t: { name: string }) => t.name).join(', ')}
ADDITIONAL INSTRUCTIONS: ${additional_instructions || 'None'}

Generate the complete scope document as a JSON object.`

    const _t0 = Date.now()

    const { text: raw, usage: _u } = await callClaude(systemPrompt, userMessage, 4096)

    logAiUsage({ function_name: 'agent-generate-scope', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })
    const scope = extractJson(raw)
    const plainText = flattenToPlainText(scope)

    // Insert sub_scope row
    const { data: inserted, error: insertErr } = await supabase
      .from('sub_scopes')
      .insert({
        project_id,
        budget_trade_id: quote.trade_id ?? null,
        budget_quote_id: quote.id,
        subcontractor_id: quote.subcontractor_id ?? null,
        trade,
        revision: 1,
        scope_sections: scope,
        scope_plain_text: plainText,
        status: 'draft',
        ai_generated: true,
        generation_notes: `Generated from budget_quote ${quote.id}; awarded amount ${quote.amount}.`,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    return new Response(
      JSON.stringify({ scope: inserted }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
