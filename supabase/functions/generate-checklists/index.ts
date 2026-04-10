// J15: generate-checklists — fires on trigger events to auto-generate checklist instances.
// Per spec:
//   - For project-specific triggers, filter templates by project_type
//   - Resolve assignee per item (admin → admin user; employee → assigned crew)
//   - Snapshot template_name and item content into the instance + items
//   - Never generate the same (template, entity) combo twice while active
//   - After standard SOP items, optionally ask AI for project-specific additions

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  trigger_event: z.string(),
  entity_id: z.string(),
  entity_type: z.enum(['project', 'lead', 'employee', 'subcontractor', 'general']),
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
        user_id: 'system',
        user_role: 'admin',
        agent_name: agentName,
        capability_required: 'generate_checklists',
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

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

interface GenerateRequest {
  trigger_event: string
  entity_id: string
  entity_type: 'project' | 'lead' | 'employee' | 'subcontractor' | 'general'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'generate-checklists')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { trigger_event, entity_id, entity_type } = parsedInput.data
    if (!trigger_event || !entity_id || !entity_type) {
      return new Response(
        JSON.stringify({ error: 'trigger_event, entity_id, entity_type required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    await callAssembleContext(
      'generate-checklists',
      `generate checklists for ${trigger_event} on ${entity_type} ${entity_id}`,
    )

    // Pull templates for this trigger
    const { data: templates, error: tplErr } = await supabase
      .from('checklist_templates')
      .select('*')
      .eq('trigger_event', trigger_event)
      .eq('is_active', true)
      .order('sort_order')

    if (tplErr) {
      return new Response(JSON.stringify({ error: 'failed to load templates', detail: tplErr }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For project triggers, filter by project_type
    let filtered = templates ?? []
    let projectType: string | null = null
    if (entity_type === 'project') {
      const { data: project } = await supabase
        .from('projects')
        .select('project_type')
        .eq('id', entity_id)
        .single()
      projectType = project?.project_type ?? null
      filtered = filtered.filter(
        (t: { project_type: string | null }) => !t.project_type || t.project_type === projectType,
      )
    }

    const instancesCreated: string[] = []

    for (const template of filtered) {
      // Skip if an active instance for this (template, entity) already exists
      const { data: existing } = await supabase
        .from('checklist_instances')
        .select('id')
        .eq('template_id', template.id)
        .eq('entity_type', entity_type)
        .eq('entity_id', entity_id)
        .eq('status', 'active')
        .limit(1)

      if (existing && existing.length > 0) continue

      // Create the instance
      const dueDate = template.due_days_from_trigger
        ? addDaysIso(template.due_days_from_trigger)
        : null

      const { data: instance, error: instErr } = await supabase
        .from('checklist_instances')
        .insert({
          template_id: template.id,
          template_name: template.name,
          entity_type,
          entity_id,
          triggered_by: trigger_event,
          due_date: dueDate,
        })
        .select()
        .single()

      if (instErr || !instance) continue

      // Fetch template items
      const { data: items } = await supabase
        .from('checklist_template_items')
        .select('*')
        .eq('template_id', template.id)
        .order('sort_order')

      // Snapshot items into checklist_instance_items
      const rows = (items ?? []).map(
        (item: {
          id: string
          title: string
          description: string | null
          assigned_role: string
          due_days_from_trigger: number | null
          is_required: boolean
          ai_help_available: boolean
          ai_help_prompt: string | null
          external_link: string | null
          sort_order: number
        }) => ({
          instance_id: instance.id,
          template_item_id: item.id,
          title: item.title,
          description: item.description,
          assigned_role: item.assigned_role,
          assigned_to: null, // left to admin to assign unless a specific employee resolves
          due_date: item.due_days_from_trigger ? addDaysIso(item.due_days_from_trigger) : null,
          is_required: item.is_required,
          ai_help_available: item.ai_help_available,
          ai_help_prompt: item.ai_help_prompt,
          external_link: item.external_link,
          sort_order: item.sort_order,
        }),
      )

      if (rows.length > 0) {
        await supabase.from('checklist_instance_items').insert(rows)
      }

      instancesCreated.push(instance.id)
    }

    return new Response(
      JSON.stringify({ ok: true, instances_created: instancesCreated.length, ids: instancesCreated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
