// assemble-context — A8
// THE most important edge function in the system.
// Every agent call passes through this. It builds a rich, role-appropriate,
// entity-specific prompt context from the memory layer automatically.
//
// Input:  AssembleContextInput
// Output: AssembledContext (system_prompt + allowed_capabilities + entity_data)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile } from '../_shared/companyProfile.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'

const InputSchema = z.object({
  user_id: z.string(),
  user_role: z.enum(['admin', 'employee', 'client']),
  agent_name: z.string(),
  capability_required: z.string().optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  query: z.string().optional(),
  include_sections: z.array(z.string()).optional(),
})

// ── Types ────────────────────────────────────────────────────────────────────

interface AssembleContextInput {
  user_id: string
  user_role: 'admin' | 'employee' | 'client'
  agent_name: string
  capability_required?: string
  entity_type?: string
  entity_id?: string
  query?: string
  include_sections?: string[]
}

interface AssembledContext {
  system_prompt: string
  allowed_capabilities: string[]
  entity_data?: object
  denied: boolean
  deny_reason?: string
}

// ── Role-scoped filters ───────────────────────────────────────────────────────

const ROLE_BUSINESS_CONTEXT_CATEGORIES: Record<string, string[]> = {
  admin:    ['identity', 'preferences', 'brand_voice', 'pricing_rules', 'workflow_rules', 'employee_profiles', 'sub_profiles', 'client_patterns', 'meta_rules'],
  employee: ['identity', 'brand_voice'],
  client:   ['identity'],
}

const ROLE_MEMORY_TYPES: Record<string, string[]> = {
  admin:    ['fact', 'pattern', 'preference', 'warning', 'relationship', 'outcome'],
  employee: ['fact', 'pattern'],
  client:   [],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return null
    const { embedding } = await res.json()
    return embedding
  } catch {
    return null
  }
}

async function fetchEntityData(
  supabase: ReturnType<typeof createClient>,
  entityType: string,
  entityId: string,
  role: string
): Promise<{ type: string; data: object } | null> {
  const tableMap: Record<string, string> = {
    project:       'projects',
    client:        'profiles',
    lead:          'leads',
    subcontractor: 'subcontractors',
    employee:      'profiles',
  }
  const table = tableMap[entityType]
  if (!table) return null

  let query = supabase.from(table).select('*').eq('id', entityId).single()

  // Employees only see their assigned projects
  if (role === 'employee' && entityType === 'project') {
    query = supabase
      .from('projects')
      .select('id, title, status, project_type, address, client_name, client_phone, current_phase, percent_complete, estimated_start_date, target_completion_date')
      .eq('id', entityId)
      .single()
  }

  const { data, error } = await query
  if (error || !data) return null
  return { type: entityType, data }
}

// ── Main assembler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'assemble-context')
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
    const input: AssembleContextInput = parsedInput.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const company = await getCompanyProfile(supabase, 'system')

    // 1. CHECK PERMISSIONS
    if (input.capability_required) {
      const { data: perm } = await supabase
        .from('ai_role_permissions')
        .select('allowed_roles, scope_restriction')
        .eq('capability', input.capability_required)
        .single()

      if (!perm || !perm.allowed_roles.includes(input.user_role)) {
        return new Response(
          JSON.stringify({
            denied: true,
            deny_reason: `Role '${input.user_role}' does not have permission for '${input.capability_required}'`,
            system_prompt: '',
            allowed_capabilities: [],
          } satisfies AssembledContext),
          { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }
    }

    // 2. GET USER'S ALLOWED CAPABILITIES
    const { data: permRows } = await supabase
      .from('ai_role_permissions')
      .select('capability')
      .contains('allowed_roles', [input.user_role])

    const capabilities = (permRows ?? []).map((r: { capability: string }) => r.capability)

    // 3. GENERATE EMBEDDING FOR SEMANTIC SEARCH
    const queryText = [input.agent_name, input.query ?? '', input.entity_type ?? ''].join(' ')
    const queryEmbedding = await generateEmbedding(queryText)

    // 4. FETCH BUSINESS CONTEXT (semantic search if embedding available, else category filter)
    let businessContextRows: { key: string; value: string; category: string }[] = []
    const allowedCategories = ROLE_BUSINESS_CONTEXT_CATEGORIES[input.user_role] ?? []

    if (queryEmbedding) {
      const { data } = await supabase.rpc('search_business_context', {
        query_embedding: queryEmbedding,
        allowed_categories: allowedCategories,
        match_count: 15,
      })
      businessContextRows = data ?? []
    } else {
      const { data } = await supabase
        .from('business_context')
        .select('key, value, category')
        .in('category', allowedCategories)
        .limit(15)
      businessContextRows = data ?? []
    }

    // 5. FETCH OPERATIONAL MEMORY
    let operationalMemory: { memory_type: string; content: string }[] = []
    const allowedMemoryTypes = ROLE_MEMORY_TYPES[input.user_role] ?? []

    if (input.entity_id && allowedMemoryTypes.length > 0) {
      if (queryEmbedding) {
        const { data } = await supabase.rpc('search_operational_memory', {
          query_embedding: queryEmbedding,
          entity_type_filter: input.entity_type ?? null,
          entity_id_filter: input.entity_id,
          allowed_types: allowedMemoryTypes,
          match_count: 20,
        })
        operationalMemory = data ?? []
      } else {
        const { data } = await supabase
          .from('operational_memory')
          .select('memory_type, content')
          .eq('entity_type', input.entity_type ?? '')
          .eq('entity_id', input.entity_id)
          .in('memory_type', allowedMemoryTypes)
          .order('created_at', { ascending: false })
          .limit(20)
        operationalMemory = data ?? []
      }
    }

    // 6. FETCH LEARNING INSIGHTS (admin only)
    let learningInsights: { insight_type: string; insight: string }[] = []
    if (input.user_role === 'admin' && queryEmbedding) {
      const { data } = await supabase.rpc('search_learning_insights', {
        query_embedding: queryEmbedding,
        entity_type_filter: input.entity_type ?? null,
        match_count: 5,
      })
      learningInsights = data ?? []
    }

    // 7. GET RECENT AGENT HISTORY FOR THIS AGENT
    const { data: recentHistory } = await supabase
      .from('agent_history')
      .select('output_summary, admin_action, edit_distance, rejection_reason')
      .eq('agent_name', input.agent_name)
      .order('run_at', { ascending: false })
      .limit(5)

    // 8. FETCH LIVE ENTITY DATA
    let entityData: { type: string; data: object } | null = null
    if (input.entity_id && input.entity_type) {
      entityData = await fetchEntityData(supabase, input.entity_type, input.entity_id, input.user_role)
    }

    // 9. BUILD SYSTEM PROMPT
    const systemPrompt = buildSystemPrompt({
      agent: input.agent_name,
      role: input.user_role,
      capabilities,
      businessContext: businessContextRows,
      operationalMemory,
      learningInsights,
      recentHistory: recentHistory ?? [],
      entityData,
      query: input.query,
      company,
    })

    const result: AssembledContext = {
      system_prompt: systemPrompt,
      allowed_capabilities: capabilities,
      entity_data: entityData ?? undefined,
      denied: false,
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('assemble-context error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})

// ── Prompt builder ────────────────────────────────────────────────────────────

interface PromptContext {
  agent: string
  role: string
  capabilities: string[]
  businessContext: { key: string; value: string }[]
  operationalMemory: { memory_type: string; content: string }[]
  learningInsights: { insight_type: string; insight: string }[]
  recentHistory: { output_summary: string; admin_action: string | null; edit_distance: number | null; rejection_reason: string | null }[]
  entityData: { type: string; data: object } | null
  query?: string
  company: { name: string; location: string }
}

function buildSystemPrompt(ctx: PromptContext): string {
  const roleDescription = ctx.role === 'admin'
    ? 'This is Adam Kilgore, the owner. He has full access to everything.'
    : ctx.role === 'employee'
    ? 'This is a field employee. Scope responses to their assigned projects only. Never expose financials, other employees\' data, or full client records.'
    : 'This is a homeowner client. Scope responses to their project only, and only data marked visible_to_client.'

  const businessContextBlock = ctx.businessContext.length > 0
    ? `BUSINESS CONTEXT\n${ctx.businessContext.map(m => `${m.key}: ${m.value}`).join('\n')}`
    : ''

  const entityBlock = ctx.entityData
    ? `CURRENT CONTEXT — ${ctx.entityData.type.toUpperCase()}\n${JSON.stringify(ctx.entityData.data, null, 2)}`
    : ''

  const memoryBlock = ctx.operationalMemory.length > 0
    ? `RELEVANT MEMORY\n${ctx.operationalMemory.map(m => `[${m.memory_type}] ${m.content}`).join('\n')}`
    : ''

  const insightsBlock = ctx.learningInsights.length > 0
    ? `PATTERNS AND INSIGHTS\n${ctx.learningInsights.map(i => `[${i.insight_type}] ${i.insight}`).join('\n')}`
    : ''

  const historyBlock = ctx.recentHistory.length > 0
    ? `YOUR RECENT OUTPUTS FOR THIS TASK\n${ctx.recentHistory.map(h =>
        `- ${h.output_summary} → ${h.admin_action ?? 'pending'}${(h.edit_distance ?? 0) > 0 ? ' (edited heavily)' : ''}${h.rejection_reason ? ` Rejection reason: ${h.rejection_reason}` : ''}`
      ).join('\n')}`
    : ''

  const sections = [businessContextBlock, entityBlock, memoryBlock, insightsBlock, historyBlock].filter(Boolean)

  return `You are the AI operating system for ${ctx.company.name}, a high-end residential renovation contractor in ${ctx.company.location}.

CURRENT USER
Role: ${ctx.role}
${roleDescription}

${sections.join('\n\n')}

WHAT YOU CAN DO FOR THIS USER
${ctx.capabilities.join(', ')}

CRITICAL RULES
- Never expose data outside this user's role scope
- Never send any client-facing communication without admin approval
- Match ${ctx.company.name} brand voice: professional, confident, approachable, never corporate
- Use specific details — never generic placeholder language
- All financial numbers use monospace formatting
- You are operating as the business's AI — you represent ${ctx.company.name}
`.trim()
}
