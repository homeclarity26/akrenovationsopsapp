// Shared rate limit utility for all edge functions.
//
// Call checkRateLimit(req, functionName) at the top of every edge function.
// Returns { allowed: boolean, remaining: number, resetAt: Date }.
// If !allowed, return a 429 response immediately.
//
// Implementation: a simple sliding window over rate_limit_events.
// Identifier is user_id if present in the JWT, otherwise the client IP.
// The table is cleaned up daily via pg_cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Per-endpoint rate limits. Conservative defaults; tightened for expensive
// operations (AI calls) and relaxed for cheap ones (memory writes).
export const RATE_LIMITS: Record<string, { maxRequests: number; windowSeconds: number }> = {
  // ─── AI expensive ───
  'agent-morning-brief':             { maxRequests: 10,  windowSeconds: 3600 },
  'agent-lead-aging':                { maxRequests: 10,  windowSeconds: 3600 },
  'agent-weekly-client-update':      { maxRequests: 5,   windowSeconds: 3600 },
  'agent-risk-monitor':              { maxRequests: 10,  windowSeconds: 3600 },
  'agent-daily-log':                 { maxRequests: 10,  windowSeconds: 3600 },
  'agent-invoice-aging':             { maxRequests: 10,  windowSeconds: 3600 },
  'agent-sub-insurance-alert':       { maxRequests: 10,  windowSeconds: 3600 },
  'agent-bonus-qualification':       { maxRequests: 30,  windowSeconds: 3600 },
  'agent-weekly-financials':         { maxRequests: 5,   windowSeconds: 3600 },
  'agent-cash-flow':                 { maxRequests: 30,  windowSeconds: 3600 },
  'agent-social-content':            { maxRequests: 20,  windowSeconds: 3600 },
  'agent-review-request':            { maxRequests: 20,  windowSeconds: 3600 },
  'agent-warranty-tracker':          { maxRequests: 10,  windowSeconds: 3600 },
  'agent-weather-schedule':          { maxRequests: 20,  windowSeconds: 3600 },
  'agent-generate-scope':            { maxRequests: 20,  windowSeconds: 3600 },
  'agent-generate-contract':         { maxRequests: 20,  windowSeconds: 3600 },
  'agent-generate-reel':             { maxRequests: 20,  windowSeconds: 3600 },
  'agent-compliance-monitor':        { maxRequests: 5,   windowSeconds: 3600 },
  'agent-calibrate-templates':       { maxRequests: 30,  windowSeconds: 3600 },
  'agent-improvement-analysis':      { maxRequests: 5,   windowSeconds: 86400 },
  'meta-agent-chat':                 { maxRequests: 100, windowSeconds: 3600 },
  'meta-agent-orchestration':        { maxRequests: 5,   windowSeconds: 86400 },
  'generate-improvement-spec':       { maxRequests: 10,  windowSeconds: 3600 },
  'generate-estimate':               { maxRequests: 20,  windowSeconds: 3600 },
  'extract-preferences':             { maxRequests: 100, windowSeconds: 3600 },

  // ─── AI moderate ───
  'agent-photo-tagger':              { maxRequests: 100, windowSeconds: 3600 },
  'agent-receipt-processor':         { maxRequests: 100, windowSeconds: 3600 },
  'agent-quote-reader':              { maxRequests: 30,  windowSeconds: 3600 },
  'agent-document-classifier':       { maxRequests: 50,  windowSeconds: 3600 },
  'agent-sub-invoice-matcher':       { maxRequests: 50,  windowSeconds: 3600 },
  'agent-change-order-drafter':      { maxRequests: 30,  windowSeconds: 3600 },
  'agent-invoice-generator':         { maxRequests: 20,  windowSeconds: 3600 },
  'agent-lead-intake':                { maxRequests: 50, windowSeconds: 3600 },
  'agent-sms-responder':              { maxRequests: 100, windowSeconds: 3600 },
  'agent-punch-list':                 { maxRequests: 20, windowSeconds: 3600 },
  'agent-voice-transcriber':          { maxRequests: 50, windowSeconds: 3600 },
  'agent-call-summarizer':            { maxRequests: 30, windowSeconds: 3600 },
  'agent-inspection-analyzer':        { maxRequests: 20, windowSeconds: 3600 },
  'agent-schedule-optimizer':         { maxRequests: 20, windowSeconds: 3600 },
  'agent-tool-request':               { maxRequests: 50, windowSeconds: 3600 },
  'agent-portfolio-curator':          { maxRequests: 10, windowSeconds: 3600 },
  'agent-conversation-transcriber':   { maxRequests: 30, windowSeconds: 3600 },
  'agent-warranty-intake':            { maxRequests: 20, windowSeconds: 3600 },
  'agent-referral-intake':            { maxRequests: 50, windowSeconds: 3600 },

  // ─── Budget / context / shared ───
  'assemble-context':                { maxRequests: 200, windowSeconds: 3600 },
  'budget-ai-action':                { maxRequests: 30,  windowSeconds: 3600 },
  'compare-budget-quotes':           { maxRequests: 30,  windowSeconds: 3600 },
  'process-budget-document':         { maxRequests: 30,  windowSeconds: 3600 },

  // ─── Document generation ───
  'generate-pdf':                    { maxRequests: 50,  windowSeconds: 3600 },
  'sync-to-drive':                   { maxRequests: 100, windowSeconds: 3600 },

  // ─── Payroll (strict) ───
  'calculate-payroll':               { maxRequests: 30,  windowSeconds: 3600 },
  'sync-to-gusto':                   { maxRequests: 10,  windowSeconds: 3600 },
  'gusto-auth':                      { maxRequests: 10,  windowSeconds: 3600 },
  'generate-payroll-register':       { maxRequests: 30,  windowSeconds: 3600 },

  // ─── Memory / embedding ───
  'update-operational-memory':       { maxRequests: 500, windowSeconds: 3600 },
  'generate-embedding':              { maxRequests: 500, windowSeconds: 3600 },
  'generate-checklists':             { maxRequests: 100, windowSeconds: 3600 },

  // ─── Public demo (per IP) ───
  'demo-ai':                         { maxRequests: 60,  windowSeconds: 3600 },

  // ─── Phase M infrastructure ───
  'backup-daily':                    { maxRequests: 3,   windowSeconds: 86400 },
  'backup-storage-manifest':         { maxRequests: 3,   windowSeconds: 86400 },
  'meta-agent-open-pr':              { maxRequests: 10,  windowSeconds: 3600 },
  'github-webhook':                  { maxRequests: 500, windowSeconds: 3600 },

  // ─── Phase N: Universal Template System ───
  'suggest-deliverable-items':            { maxRequests: 60,  windowSeconds: 3600 },
  'agent-template-improvement-suggester': { maxRequests: 5,   windowSeconds: 86400 },

  // ─── Final Build: New standalone functions ───
  'send-email':                      { maxRequests: 50,  windowSeconds: 3600 },
  'agent-proposal-writer':           { maxRequests: 20,  windowSeconds: 3600 },
  'backup-database':                 { maxRequests: 5,   windowSeconds: 86400 },
  'sync-google-drive':               { maxRequests: 30,  windowSeconds: 3600 },

  // ─── Wave A additions: PRs 6 / 10 / 11 / 12 ───
  'ai-suggest-project-action':       { maxRequests: 30,  windowSeconds: 3600 },
  'apply-project-suggestion':        { maxRequests: 10,  windowSeconds: 3600 },
  'reject-project-suggestion':       { maxRequests: 30,  windowSeconds: 3600 },
  'deduct-shopping-item-from-stock': { maxRequests: 50,  windowSeconds: 3600 },
  'ai-inventory-query':              { maxRequests: 30,  windowSeconds: 3600 },
  'agent-inventory-alerts':          { maxRequests: 2,   windowSeconds: 86400 },
  'agent-photo-stocktake':           { maxRequests: 50,  windowSeconds: 3600 },

  // ─── Wave B / PR 19 ───
  'generate-progress-reel':          { maxRequests: 10,  windowSeconds: 3600 },

  // ─── Wave D / PR 23: QuickBooks Online ───
  'sync-quickbooks':                 { maxRequests: 10,  windowSeconds: 3600 },
  'quickbooks-auth':                 { maxRequests: 10,  windowSeconds: 3600 },

  // ─── Stripe payments ───
  'create-checkout-session':         { maxRequests: 30,  windowSeconds: 3600 },

  // ─── Uncategorized / webhooks / utilities ───
  'get-usage-stats':                 { maxRequests: 60,  windowSeconds: 3600 },
  'invite-client-to-portal':        { maxRequests: 30,  windowSeconds: 3600 },
  'notify-inventory-alerts':        { maxRequests: 5,   windowSeconds: 86400 },
  'stripe-webhook':                 { maxRequests: 500, windowSeconds: 3600 },
}

const DEFAULT_LIMIT = { maxRequests: 60, windowSeconds: 3600 }

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  limit: number
}

/**
 * Check rate limit for an incoming request.
 * Never throws — on any internal error, fails OPEN (allows the request) so
 * rate limiting can never take the whole app down.
 */
export async function checkRateLimit(
  req: Request,
  functionName: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[functionName] ?? DEFAULT_LIMIT

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Derive identifier: user_id from JWT if present, else IP
    const identifier = await extractIdentifier(req)
    const windowStart = new Date(Date.now() - config.windowSeconds * 1000)
    const resetAt = new Date(Date.now() + config.windowSeconds * 1000)

    // Count requests in window (HEAD-style count for efficiency)
    const { count } = await supabase
      .from('rate_limit_events')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('endpoint', functionName)
      .gte('created_at', windowStart.toISOString())

    const used = count ?? 0
    const remaining = Math.max(0, config.maxRequests - used - 1)

    if (used >= config.maxRequests) {
      // Log the blocked attempt (fire-and-forget)
      supabase.from('rate_limit_events').insert({
        identifier,
        endpoint: functionName,
        blocked: true,
      }).then(() => {}).catch(() => {})

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit: config.maxRequests,
      }
    }

    // Log this request (fire-and-forget)
    supabase.from('rate_limit_events').insert({
      identifier,
      endpoint: functionName,
      blocked: false,
    }).then(() => {}).catch(() => {})

    return {
      allowed: true,
      remaining,
      resetAt,
      limit: config.maxRequests,
    }
  } catch (err) {
    // Fail open — rate limiter must never break the app
    console.error(`[rate-limit] Check failed for ${functionName}:`, err)
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      limit: config.maxRequests,
    }
  }
}

/**
 * Return a standard 429 response when rate limited.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded. Please try again shortly.',
      limit: result.limit,
      remaining: result.remaining,
      reset_at: result.resetAt.toISOString(),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
        'Retry-After': String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)),
      },
    }
  )
}

/**
 * Extract a stable identifier for rate limit keying.
 * Priority: JWT sub (user_id) > x-forwarded-for (real IP) > "anonymous"
 */
async function extractIdentifier(req: Request): Promise<string> {
  // Try JWT first
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (token) {
    try {
      // JWT middle segment = base64url-encoded JSON payload
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        if (payload.sub) return `user:${payload.sub}`
      }
    } catch {
      // fall through to IP
    }
  }

  // IP fallback — prefer the first hop in x-forwarded-for
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  if (fwd) return `ip:${fwd.split(',')[0].trim()}`

  const realIp = req.headers.get('x-real-ip') ?? ''
  if (realIp) return `ip:${realIp}`

  return 'anonymous'
}
