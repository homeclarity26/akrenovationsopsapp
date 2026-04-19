// reject-project-suggestion
// -----------------------------------------------------------------------------
// Tiny sibling of apply-project-suggestion. Admin clicks Reject on a pending
// suggestion; we just stamp status='rejected' with the reviewer + optional
// reason. No mutation to project data happens.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const InputSchema = z.object({
  suggestion_id: z.string().uuid('suggestion_id must be a valid UUID'),
  reason: z.string().max(2000).optional(),
})

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
    if (auth.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const rl = await checkRateLimit(req, 'reject-project-suggestion')
    if (!rl.allowed) return rateLimitResponse(rl)

    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const { suggestion_id, reason } = parsed.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: suggestion, error: loadErr } = await supabase
      .from('ai_project_suggestions')
      .select('id, status')
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

    const now = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('ai_project_suggestions')
      .update({
        status: 'rejected',
        reviewed_by: auth.user_id,
        reviewed_at: now,
        error_message: reason ?? null,
      })
      .eq('id', suggestion_id)

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: 'Update failed', details: updateErr.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('reject-project-suggestion error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
