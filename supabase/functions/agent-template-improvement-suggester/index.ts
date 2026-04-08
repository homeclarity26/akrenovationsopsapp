// N27: agent-template-improvement-suggester
// Runs weekly Sunday night via pg_cron.
// Analyzes diverged instances to detect patterns and suggest template improvements.
// Writes to improvement_specs table.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const anthropicKey = () => Deno.env.get('ANTHROPIC_API_KEY') ?? ''

interface DivergenceRecord {
  id: string
  template_id: string
  divergence_summary: unknown[]
  template_name?: string
  [key: string]: unknown
}

async function analyzeDivergences(
  supabase: ReturnType<typeof createClient>,
  deliverableType: string,
  instanceTable: string,
  templateIdField: string,
  templateTable: string,
  templateNameField: string,
) {
  const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: divergedInstances } = await supabase
    .from(instanceTable)
    .select(`id, ${templateIdField}, divergence_summary, template_version_at_generation`)
    .eq('diverged_from_template', true)
    .gte('created_at', twelveWeeksAgo)
    .not(templateIdField, 'is', null)
    .limit(200)

  if (!divergedInstances || divergedInstances.length < 2) return

  // Group by template_id
  const byTemplate = new Map<string, typeof divergedInstances>()
  for (const inst of divergedInstances) {
    const tid = inst[templateIdField] as string
    if (!tid) continue
    if (!byTemplate.has(tid)) byTemplate.set(tid, [])
    byTemplate.get(tid)!.push(inst)
  }

  for (const [templateId, instances] of byTemplate.entries()) {
    if (instances.length < 2) continue

    // Get template name
    const { data: template } = await supabase
      .from(templateTable)
      .select(`id, ${templateNameField}`)
      .eq('id', templateId)
      .single()

    const templateName = template?.[templateNameField] ?? templateId

    // Get business context
    const contextRes = await fetch(`${supabaseUrl()}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context_type: 'general' }),
    })
    const contextData = contextRes.ok ? await contextRes.json() : {}
    const systemPrompt = contextData.system_prompt ?? 'You are the AI assistant for AK Renovations.'

    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Analyze these ${instances.length} instances of the "${templateName}" ${deliverableType} template.
Each instance has been edited after generation — the divergence_summary shows what changed.

Divergence summaries:
${JSON.stringify(instances.map((i) => ({ id: i.id, divergence_summary: i.divergence_summary })), null, 2)}

Identify:
1. Items added in 2+ instances (candidate for template addition)
2. Items removed in 2+ instances (candidate for template removal)
3. Items edited similarly in 2+ instances (candidate for template update)
4. Items that seem project-specific (do NOT suggest for template)

Only suggest changes with clear patterns across multiple projects. Ignore one-offs.

Return ONLY valid JSON:
{
  "suggested_additions": [{"title": "...", "description": "...", "rationale": "..."}],
  "suggested_removals": [{"item_title": "...", "rationale": "..."}],
  "suggested_edits": [{"old_title": "...", "new_title": "...", "rationale": "..."}],
  "confidence": "high" | "medium" | "low",
  "summary": "..."
}`,
        }],
      }),
    })

    if (!aiResp.ok) continue

    const aiData = await aiResp.json()
    const rawText = aiData.content?.[0]?.text ?? '{}'

    let analysis: {
      suggested_additions: unknown[]
      suggested_removals: unknown[]
      suggested_edits: unknown[]
      confidence: string
      summary: string
    } = {
      suggested_additions: [],
      suggested_removals: [],
      suggested_edits: [],
      confidence: 'low',
      summary: '',
    }

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0])
    } catch {
      continue
    }

    if (
      analysis.suggested_additions.length === 0 &&
      analysis.suggested_removals.length === 0 &&
      analysis.suggested_edits.length === 0
    ) continue

    // Check if an improvement spec already exists for this template recently
    const { data: existingSpec } = await supabase
      .from('improvement_specs')
      .select('id')
      .eq('category', 'workflow_optimization')
      .contains('metadata', { deliverable_type: deliverableType, template_id: templateId })
      .eq('status', 'draft')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .single()

    if (existingSpec) continue // Don't create duplicate within 30 days

    const additions = analysis.suggested_additions.length
    const removals = analysis.suggested_removals.length
    const edits = analysis.suggested_edits.length

    const changeCount = additions + removals + edits
    const proposedSolution = [
      additions > 0 ? `Add ${additions} item(s): ${(analysis.suggested_additions as Array<{title: string}>).map((a) => a.title).join(', ')}` : '',
      removals > 0 ? `Remove ${removals} item(s): ${(analysis.suggested_removals as Array<{item_title: string}>).map((r) => r.item_title).join(', ')}` : '',
      edits > 0 ? `Update ${edits} item(s)` : '',
    ].filter(Boolean).join('. ')

    await supabase.from('improvement_specs').insert({
      title: `Template improvement: ${templateName}`,
      problem_statement: `Pattern detected across ${instances.length} projects using the "${templateName}" template. ${changeCount} change(s) applied consistently.`,
      evidence: analysis.summary,
      proposed_solution: proposedSolution,
      category: 'workflow_optimization',
      priority: analysis.confidence === 'high' ? 'medium' : 'low',
      status: 'draft',
      metadata: {
        deliverable_type: deliverableType,
        template_id: templateId,
        template_name: templateName,
        instances_analyzed: instances.length,
        analysis,
        source: 'template_improvement_suggester',
      },
    })

    console.log(`[agent-template-improvement-suggester] Created spec for ${deliverableType} template: ${templateName}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-template-improvement-suggester')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const supabase = createClient(supabaseUrl(), serviceKey())

    const analyses = [
      analyzeDivergences(supabase, 'checklist', 'checklist_instances', 'template_id', 'checklist_templates', 'name'),
      analyzeDivergences(supabase, 'scope', 'sub_scopes', 'scope_template_id', 'scope_templates', 'name'),
      analyzeDivergences(supabase, 'proposal', 'proposals', 'proposal_template_id', 'proposal_templates', 'name'),
    ]

    await Promise.allSettled(analyses)

    return new Response(JSON.stringify({ ok: true, message: 'Template improvement analysis complete' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[agent-template-improvement-suggester]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
