// apply-project-suggestion
// -----------------------------------------------------------------------------
// Called by the admin UI when they click Approve on a pending suggestion.
// Loads the row, verifies the caller is an admin, executes the whitelisted
// proposed_action against the project-scoped tables using the service-role
// client, and marks the suggestion as 'applied' (or 'failed' with an error
// message on exception).
//
// Whitelist exists so a malformed/hallucinated proposed_action can't wreak
// havoc — only clearly project-scoped tables are allowed.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

// Tables the apply function is allowed to mutate. Anything else → 400.
const ALLOWED_TABLES = new Set([
  'tasks',
  'daily_logs',
  'shopping_list_items',
  'punch_list_items',
  'change_orders',
  'messages',
  'project_photos',
])

const InputSchema = z.object({
  suggestion_id: z.string().uuid('suggestion_id must be a valid UUID'),
})

interface ProposedAction {
  table: string
  operation: 'insert' | 'update'
  values?: Record<string, unknown>
  id?: string
  patch?: Record<string, unknown>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    if (auth.role !== 'admin' && auth.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const rl = await checkRateLimit(req, 'apply-project-suggestion')
    if (!rl.allowed) return rateLimitResponse(rl)

    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const { suggestion_id } = parsed.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: suggestion, error: loadErr } = await supabase
      .from('ai_project_suggestions')
      .select('id, project_id, status, proposed_action, summary')
      .eq('id', suggestion_id)
      .single()

    if (loadErr || !suggestion) {
      return new Response(
        JSON.stringify({ error: 'Suggestion not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    if (suggestion.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Suggestion is already ${suggestion.status}` }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const action = suggestion.proposed_action as ProposedAction
    if (!action || typeof action !== 'object') {
      return new Response(
        JSON.stringify({ error: 'proposed_action missing or not an object' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    if (!ALLOWED_TABLES.has(action.table)) {
      return new Response(
        JSON.stringify({ error: `Table '${action.table}' is not in the allowed list` }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Execute the action. We force project_id on inserts to the suggestion's
    // project_id so the AI can't insert into a different project by mistake.
    let execError: string | null = null
    let execResult: unknown = null

    try {
      if (action.operation === 'insert') {
        if (!action.values || typeof action.values !== 'object') {
          throw new Error("insert requires 'values'")
        }
        const values = {
          ...action.values,
          project_id: suggestion.project_id,
        }
        const { data, error } = await supabase
          .from(action.table)
          .insert(values)
          .select()
          .single()
        if (error) throw new Error(error.message)
        execResult = data
      } else if (action.operation === 'update') {
        if (!action.id || !action.patch || typeof action.patch !== 'object') {
          throw new Error("update requires 'id' and 'patch'")
        }
        // Scope the UPDATE by the suggestion's project_id so a malformed or
        // malicious proposed_action can't modify a row in another project.
        // All whitelisted tables (tasks, daily_logs, shopping_list_items,
        // punch_list_items, change_orders, messages, project_photos) have
        // a project_id column, so this filter is always safe.
        const { data, error } = await supabase
          .from(action.table)
          .update(action.patch)
          .eq('id', action.id)
          .eq('project_id', suggestion.project_id)
          .select()
          .single()
        if (error) throw new Error(error.message)
        execResult = data
      } else {
        throw new Error(`Unsupported operation: ${(action as { operation: string }).operation}`)
      }
    } catch (err) {
      execError = err instanceof Error ? err.message : String(err)
    }

    const now = new Date().toISOString()
    if (execError) {
      await supabase
        .from('ai_project_suggestions')
        .update({
          status: 'failed',
          error_message: execError,
          reviewed_by: auth.user_id,
          reviewed_at: now,
        })
        .eq('id', suggestion_id)

      return new Response(
        JSON.stringify({ success: false, error: execError }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    await supabase
      .from('ai_project_suggestions')
      .update({
        status: 'applied',
        applied_at: now,
        reviewed_by: auth.user_id,
        reviewed_at: now,
      })
      .eq('id', suggestion_id)

    return new Response(
      JSON.stringify({ success: true, result: execResult }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('apply-project-suggestion error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
