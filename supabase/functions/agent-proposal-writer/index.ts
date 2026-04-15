// agent-proposal-writer — Final Build
// Generates AI-written proposal content matching the ProposalData interface.
// Takes project_id or estimate_id, queries all relevant data, uses Claude
// to generate structured proposal JSON including scope sections and selections.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  project_id: z.string().uuid().optional(),
  estimate_id: z.string().uuid().optional(),
}).refine(d => d.project_id || d.estimate_id, {
  message: 'Either project_id or estimate_id is required',
})

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Scope frameworks matching the proposal-generator.ts SCOPE_FRAMEWORKS
const SCOPE_FRAMEWORKS: Record<string, Array<{ number: string; title: string }>> = {
  bathroom: [
    { number: 'Section 01', title: 'Site Protection and Prep' },
    { number: 'Section 02', title: 'Demolition and Wall Removal' },
    { number: 'Section 03', title: 'Framing, Electrical and Plumbing Rough-In' },
    { number: 'Section 04', title: 'Subfloor, Waterproofing and Tile Backer' },
    { number: 'Section 05', title: 'Custom Tile Shower' },
    { number: 'Section 06', title: 'Freestanding Tub and Wall Recess' },
    { number: 'Section 07', title: 'Vanity, Cabinetry and Floor Tile' },
    { number: 'Section 08', title: 'Lighting, Fans and Electrical Finish' },
    { number: 'Section 09', title: 'Drywall, Paint and Final Finish' },
  ],
  kitchen: [
    { number: 'Section 01', title: 'Site Protection and Prep' },
    { number: 'Section 02', title: 'Demolition' },
    { number: 'Section 03', title: 'Framing, Electrical and Plumbing Rough-In' },
    { number: 'Section 04', title: 'Drywall and Prep' },
    { number: 'Section 05', title: 'Cabinet Installation' },
    { number: 'Section 06', title: 'Countertop and Backsplash' },
    { number: 'Section 07', title: 'Flooring' },
    { number: 'Section 08', title: 'Appliance Installation' },
    { number: 'Section 09', title: 'Lighting, Electrical Finish and Hardware' },
    { number: 'Section 10', title: 'Paint and Final Finish' },
  ],
  basement: [
    { number: 'Section 01', title: 'Site Protection and Prep' },
    { number: 'Section 02', title: 'Framing and Insulation' },
    { number: 'Section 03', title: 'Electrical Rough-In' },
    { number: 'Section 04', title: 'Drywall and Ceilings' },
    { number: 'Section 05', title: 'Flooring' },
    { number: 'Section 06', title: 'Trim, Doors and Hardware' },
    { number: 'Section 07', title: 'Electrical Finish and Lighting' },
    { number: 'Section 08', title: 'Paint and Final Finish' },
  ],
  porch: [
    { number: 'Section 01', title: 'Site Protection and Prep' },
    { number: 'Section 02', title: 'Demolition' },
    { number: 'Section 03', title: 'Foundation and Structural' },
    { number: 'Section 04', title: 'Framing and Roof' },
    { number: 'Section 05', title: 'Windows, Doors and Exterior' },
    { number: 'Section 06', title: 'Electrical and Lighting' },
    { number: 'Section 07', title: 'Trim, Paint and Final Finish' },
  ],
  flooring: [
    { number: 'Section 01', title: 'Site Protection and Prep' },
    { number: 'Section 02', title: 'Subfloor Prep' },
    { number: 'Section 03', title: 'Flooring Installation' },
    { number: 'Section 04', title: 'Trim and Transitions' },
    { number: 'Section 05', title: 'Final Cleanup' },
  ],
}

async function callAssembleContext(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl()}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey()}` },
      body: JSON.stringify({
        user_id: userId,
        user_role: 'admin',
        agent_name: 'agent-proposal-writer',
        capability_required: 'generate_proposals',
        query: 'generate proposal content for a project',
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'agent-proposal-writer')
  if (!rl.allowed) return rateLimitResponse(rl)

  // Assemble context (project rule)
  await callAssembleContext(auth.user_id)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { project_id, estimate_id } = parsedInput.data

    const supabase = createClient(supabaseUrl(), serviceKey())
    const company = await getCompanyProfile(supabase, auth.user_id)
    const startTime = Date.now()

    // Gather all relevant data
    let project: Record<string, unknown> | null = null
    let estimate: Record<string, unknown> | null = null
    let lineItems: Array<Record<string, unknown>> = []
    let clientProfile: Record<string, unknown> | null = null
    let selections: Array<Record<string, unknown>> = []

    if (estimate_id) {
      const { data: est } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimate_id)
        .single()
      estimate = est

      if (est?.project_id) {
        const { data: proj } = await supabase
          .from('projects')
          .select('*')
          .eq('id', est.project_id)
          .single()
        project = proj
      }

      const { data: items } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimate_id)
        .order('sort_order', { ascending: true })
      lineItems = items ?? []
    }

    if (project_id && !project) {
      const { data: proj } = await supabase
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .single()
      project = proj

      // Get the latest estimate for this project if not already loaded
      if (!estimate) {
        const { data: est } = await supabase
          .from('estimates')
          .select('*')
          .eq('project_id', project_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        estimate = est

        if (est) {
          const { data: items } = await supabase
            .from('estimate_line_items')
            .select('*')
            .eq('estimate_id', est.id)
            .order('sort_order', { ascending: true })
          lineItems = items ?? []
        }
      }
    }

    if (!project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Get client profile
    if (project.client_id) {
      const { data: client } = await supabase
        .from('profiles')
        .select('id,full_name,email,phone')
        .eq('id', project.client_id)
        .single()
      clientProfile = client
    }

    // Get selections
    const { data: sels } = await supabase
      .from('client_selections')
      .select('*')
      .eq('project_id', project.id)
      .order('category', { ascending: true })
    selections = sels ?? []

    // Determine project type for scope framework
    const projectType = ((project.project_type as string) ?? 'general').toLowerCase()
    const framework = SCOPE_FRAMEWORKS[projectType] ?? SCOPE_FRAMEWORKS['bathroom']
    const sectionCount = framework.length
    const sectionRange = `Sections 01–${String(sectionCount).padStart(2, '0')}`

    // Build context for Claude
    const projectContext = `
PROJECT DATA:
- Title: ${project.title}
- Type: ${project.project_type}
- Client: ${(project as Record<string, unknown>).client_name ?? clientProfile?.full_name ?? 'Unknown'}
- Address: ${project.address ?? 'Not specified'}
- City/State: ${project.city ?? ''}, ${project.state ?? 'OH'}
- Contract Value: $${((project.contract_value as number) ?? 0).toLocaleString()}
- Duration: ${project.estimated_duration ?? '6-8 weeks'}

ESTIMATE LINE ITEMS (${lineItems.length} items):
${lineItems.map(item => `- ${item.description}: $${((item.total as number) ?? 0).toLocaleString()} (${item.category})`).join('\n') || 'No line items available'}

CLIENT SELECTIONS (${selections.length} items):
${selections.map(s => `- [${s.category}] ${s.item_name}: ${s.description ?? ''} — ${s.shop ?? ''}`).join('\n') || 'No selections yet'}

SCOPE FRAMEWORK (use these exact section numbers and titles):
${framework.map(s => `${s.number}: ${s.title}`).join('\n')}
`

    const systemPrompt = `You are a professional proposal writer for ${company.name}, a high-end residential remodeling contractor in ${company.location}.

You must return a VALID JSON object matching the ProposalData interface exactly. No markdown, no explanation — just the JSON.

The ProposalData interface:
{
  clientLastName: string,       // Client's last name only
  clientFullNames: string,      // Full name(s) of client(s)
  address1: string,             // Street address
  address2: string,             // City, State ZIP
  projectType: string,          // e.g. "Primary Bathroom Remodel"
  duration: string,             // e.g. "6–8 weeks"
  overviewTitle: string,        // Compelling title for the overview section
  overviewBody: string,         // 2-3 paragraphs describing the project vision and approach
  totalPrice: string,           // Formatted: "$XX,XXX"
  sectionRange: string,         // e.g. "Sections 01–09"
  hasAddOn: boolean,            // true if there's an optional add-on
  addOnName: string,            // Name of add-on (empty if none)
  addOnDetail: string,          // Description of add-on (empty if none)
  addOnPrice: string,           // Formatted: "$X,XXX" (empty if none)
  estimatedDuration: string,    // Same as duration
  phone: string,                // Always "(330) 942-4242"
  website: string,              // Always "akrenovationsohio.com"
  sections: [                   // Scope sections with bullets
    {
      number: string,           // "Section 01", "Section 02", etc.
      title: string,            // Matching the framework titles
      bullets: [
        { label: string, desc: string | null }  // 3-6 bullets per section
      ]
    }
  ],
  selections: [                 // Shopping list categories
    {
      label: string,            // Category label (e.g. "TILE", "FIXTURES")
      items: [
        { name: string, desc: string, shop: string }
      ]
    }
  ]
}

RULES:
- Use the EXACT section numbers and titles from the SCOPE FRAMEWORK provided
- Each section MUST have 3-6 specific, detailed scope bullets
- Bullets should describe actual construction work, not vague descriptions
- The overviewBody should be warm, professional, and specific to this project
- If selections data is available, organize into logical categories
- If no selections, create reasonable placeholder categories for the project type
- totalPrice should come from the contract value or estimate total
- phone is always "(330) 942-4242" and website is always "akrenovationsohio.com"
- Return ONLY valid JSON, no other text`

    const userMessage = `Generate the ProposalData JSON for this project:\n\n${projectContext}`

    // Call Claude
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
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!anthropicRes.ok) throw new Error(`Claude error: ${await anthropicRes.text()}`)
    const anthropicData = await anthropicRes.json()
    const rawResponse = anthropicData.content?.[0]?.text ?? ''

    // Parse the JSON response — strip any markdown fencing if present
    let proposalData: Record<string, unknown>
    try {
      const jsonStr = rawResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      proposalData = JSON.parse(jsonStr)
    } catch {
      throw new Error('Failed to parse AI response as valid ProposalData JSON')
    }

    const durationMs = Date.now() - startTime

    // Log AI usage
    logAiUsage({
      function_name: 'agent-proposal-writer',
      model_provider: 'anthropic',
      model_name: AI_CONFIG.PRIMARY_MODEL,
      input_tokens: anthropicData.usage?.input_tokens ?? 0,
      output_tokens: anthropicData.usage?.output_tokens ?? 0,
      duration_ms: durationMs,
      status: 'success',
    }).catch(() => {})

    // Save to agent_outputs
    await supabase.from('agent_outputs').insert({
      agent_name: 'agent-proposal-writer',
      output_type: 'proposal_data',
      title: `Proposal: ${project.title}`,
      content: JSON.stringify(proposalData),
      metadata: {
        project_id: project.id,
        estimate_id: estimate?.id ?? null,
        project_type: projectType,
      },
      requires_approval: true,
    }).catch(err => console.error('Failed to save agent output:', err))

    return new Response(
      JSON.stringify({
        success: true,
        proposal_data: proposalData,
        project_id: project.id,
        estimate_id: estimate?.id ?? null,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-proposal-writer error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
