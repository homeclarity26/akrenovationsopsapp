// github-webhook — Phase M (M25)
// Receives GitHub webhook events for auto-PR lifecycle.
// Public endpoint: auth IS the HMAC-SHA256 signature using GITHUB_WEBHOOK_SECRET.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false
  const secret = Deno.env.get('GITHUB_WEBHOOK_SECRET') ?? ''
  if (!secret) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const sigArray = Array.from(new Uint8Array(sigBuffer))
  const expectedHex = sigArray.map(b => b.toString(16).padStart(2, '0')).join('')
  const expected = `sha256=${expectedHex}`

  // Constant-time compare
  if (expected.length !== signatureHeader.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
  }
  return mismatch === 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const rl = await checkRateLimit(req, 'github-webhook')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    // We need the raw body to verify the signature; parse after.
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256')

    const ok = await verifyWebhookSignature(rawBody, signature)
    if (!ok) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Assemble context — per project rules
    try {
      await fetch(`${supabaseUrl()}/functions/v1/assemble-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey()}`,
        },
        body: JSON.stringify({
          user_id: 'system',
          user_role: 'admin',
          agent_name: 'github-webhook',
          query: 'github webhook event',
        }),
      })
    } catch (err) {
      console.warn('[github-webhook] assemble-context failed:', err)
    }

    const action = payload.action as string | undefined
    const pullRequest = payload.pull_request as Record<string, unknown> | undefined
    if (action !== 'closed' || !pullRequest) {
      return new Response(
        JSON.stringify({ ok: true, ignored: 'not a closed PR event' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const prNumber = pullRequest.number as number | undefined
    const merged = Boolean(pullRequest.merged)
    const mergeSha = (pullRequest.merge_commit_sha as string | null) ?? null

    if (!prNumber) {
      return new Response(
        JSON.stringify({ ok: true, ignored: 'no pr number' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl(), serviceKey())

    // Look up our PR row
    const { data: prRow, error: prErr } = await supabase
      .from('improvement_prs')
      .select('*')
      .eq('pr_number', prNumber)
      .maybeSingle()

    if (prErr) {
      console.error('[github-webhook] failed to look up improvement_prs:', prErr)
    }
    if (!prRow) {
      // Not one of ours — acknowledge so GitHub stops retrying.
      return new Response(
        JSON.stringify({ ok: true, ignored: 'not an improvement PR' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    if (merged) {
      const nowIso = new Date().toISOString()
      await supabase
        .from('improvement_prs')
        .update({
          status: 'merged',
          github_sha: mergeSha,
          deployed_at: nowIso,
        })
        .eq('id', prRow.id)

      await supabase
        .from('improvement_specs')
        .update({ status: 'deployed' })
        .eq('id', prRow.improvement_spec_id)

      // Record a learning insight (best effort)
      try {
        await supabase.from('learning_insights').insert({
          insight_type: 'improvement_signal',
          title: `Improvement deployed: ${prRow.pr_title}`,
          insight: `Auto-PR #${prNumber} merged and deployed. Category: ${prRow.change_category}. Files: ${JSON.stringify(prRow.files_changed)}`,
          actioned: true,
          action_taken: 'Auto-PR merged and deployed',
        })
      } catch (err) {
        console.warn('[github-webhook] learning_insights insert failed:', err)
      }
    } else {
      // Closed without merging
      await supabase
        .from('improvement_prs')
        .update({ status: 'closed' })
        .eq('id', prRow.id)

      await supabase
        .from('improvement_specs')
        .update({ status: 'dismissed' })
        .eq('id', prRow.improvement_spec_id)
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('github-webhook error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
