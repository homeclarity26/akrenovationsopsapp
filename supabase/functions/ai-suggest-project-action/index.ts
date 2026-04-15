// ai-suggest-project-action
// -----------------------------------------------------------------------------
// Called by the meta-agent (or any internal/admin caller) to record a proactive
// suggestion the AI wants to make on a specific project. The row lands in
// ai_project_suggestions with status='pending'; the admin sees it in the
// Suggestion Inbox on the project page and then approves (apply-project-
// suggestion) or rejects (reject-project-suggestion).
//
// Uses the service-role client so the insert succeeds regardless of caller
// RLS (the caller is usually another edge function with no JWT, or an admin
// making a direct call).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const ProposedActionSchema = z.object({
  table: z.string().min(1),
  operation: z.enum(['insert', 'update']),
  values: z.record(z.unknown()).optional(),
  id: z.string().uuid().optional(),
  patch: z.record(z.unknown()).optional(),
}).refine(
  (v) => (v.operation === 'insert' ? !!v.values : !!v.id && !!v.patch),
  { message: "insert requires 'values'; update requires 'id' and 'patch'" },
)

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
  suggestion_type: z.string().min(1).max(80),
  summary: z.string().min(1).max(500),
  rationale: z.string().max(5000).optional(),
  proposed_action: ProposedActionSchema,
  source: z.string().min(1).max(80).optional(),
  expires_in_hours: z.number().int().positive().max(24 * 30).optional(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    // Caller must be authenticated (meta-agent forwards the user JWT, or an
    // admin calls directly). The function itself writes via service role.
    const auth = await verifyAuth(req)
    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const {
      project_id, suggestion_type, summary, rationale,
      proposed_action, source, expires_in_hours,
    } = parsed.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify the project exists before inserting — avoids leaving orphan
    // suggestions if the AI hallucinates a project_id.
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .single()
    if (projErr || !project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const expires_at = expires_in_hours
      ? new Date(Date.now() + expires_in_hours * 3_600_000).toISOString()
      : null

    const { data: inserted, error: insertErr } = await supabase
      .from('ai_project_suggestions')
      .insert({
        project_id,
        suggestion_type,
        summary,
        rationale: rationale ?? null,
        proposed_action,
        source: source ?? 'meta-agent',
        expires_at,
      })
      .select()
      .single()

    if (insertErr || !inserted) {
      return new Response(
        JSON.stringify({ error: 'Insert failed', details: insertErr?.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true, suggestion: inserted }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('ai-suggest-project-action error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
