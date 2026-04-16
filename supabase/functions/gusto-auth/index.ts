// gusto-auth — OAuth2 flow for Gusto API
// ?action=connect  → redirect to Gusto authorize URL
// ?action=callback → exchange code for tokens, store in integrations table
// POST { action: 'refresh', company_id } → refresh expired token
//
// Env vars: GUSTO_CLIENT_ID, GUSTO_CLIENT_SECRET, GUSTO_REDIRECT_URI, GUSTO_ENVIRONMENT

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { encryptToken, decryptToken } from '../_shared/tokenCrypto.ts'

const gustoBase = () =>
  Deno.env.get('GUSTO_ENVIRONMENT') === 'sandbox'
    ? 'https://api.gusto-demo.com'
    : 'https://api.gusto.com'

const gustoAuthBase = () =>
  Deno.env.get('GUSTO_ENVIRONMENT') === 'sandbox'
    ? 'https://api.gusto-demo.com'
    : 'https://api.gusto.com'

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

/**
 * Exchange authorization code for access + refresh tokens.
 */
async function exchangeCodeForTokens(code: string) {
  const res = await fetch(`${gustoAuthBase()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('GUSTO_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GUSTO_CLIENT_SECRET') ?? '',
      redirect_uri: Deno.env.get('GUSTO_REDIRECT_URI') ?? '',
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gusto token exchange failed: ${res.status} ${text}`)
  }
  return await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    company_uuid?: string
  }
}

/**
 * Refresh an expired Gusto access token.
 */
export async function refreshGustoToken(refreshToken: string) {
  const res = await fetch(`${gustoAuthBase()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('GUSTO_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GUSTO_CLIENT_SECRET') ?? '',
      redirect_uri: Deno.env.get('GUSTO_REDIRECT_URI') ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gusto token refresh failed: ${res.status} ${text}`)
  }
  return await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
}

/**
 * Load the active Gusto integration for a company, refreshing the token
 * if it is within 5 minutes of expiry.
 */
export async function getGustoToken(companyId: string): Promise<{
  access_token: string
  company_uuid: string
} | null> {
  const db = supabaseAdmin()
  const { data: row } = await db
    .from('integrations')
    .select('*')
    .eq('provider', 'gusto')
    .eq('is_active', true)
    .eq('company_id', companyId)
    .single()

  if (!row) return null

  const expiresAt = new Date(row.token_expires_at).getTime()
  const fiveMin = 5 * 60 * 1000

  const isEncrypted = (row.metadata as Record<string, unknown>)?.tokens_encrypted === true

  // Token still valid
  if (Date.now() + fiveMin < expiresAt) {
    return {
      access_token: isEncrypted ? await decryptToken(row.access_token) : row.access_token,
      company_uuid: (row.metadata as { company_uuid?: string })?.company_uuid ?? '',
    }
  }

  // Refresh needed
  const plainRefresh = isEncrypted ? await decryptToken(row.refresh_token) : row.refresh_token
  const refreshed = await refreshGustoToken(plainRefresh)
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  await db
    .from('integrations')
    .update({
      access_token: await encryptToken(refreshed.access_token),
      refresh_token: await encryptToken(refreshed.refresh_token),
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
      metadata: { ...(row.metadata as Record<string, unknown>), tokens_encrypted: true },
    })
    .eq('id', row.id)

  return {
    access_token: refreshed.access_token,
    company_uuid: (row.metadata as { company_uuid?: string })?.company_uuid ?? '',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const rl = await checkRateLimit(req, 'gusto-auth')
  if (!rl.allowed) return rateLimitResponse(rl)

  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? ''

  // ── connect: redirect to Gusto authorize ──────────────────────────
  if (action === 'connect') {
    const auth = await verifyAuth(req)
    if (!auth || (auth.role !== 'admin' && auth.role !== 'super_admin')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const clientId = Deno.env.get('GUSTO_CLIENT_ID') ?? ''
    const redirectUri = Deno.env.get('GUSTO_REDIRECT_URI') ?? ''

    // Generate CSRF state
    const csrfState = crypto.randomUUID()
    const db = supabaseAdmin()
    const { data: profile } = await db
      .from('profiles')
      .select('company_id')
      .eq('id', auth.user_id)
      .single()
    const companyId = (profile?.company_id as string) ?? auth.user_id

    await db
      .from('integrations')
      .upsert(
        {
          company_id: companyId,
          provider: 'gusto',
          metadata: { oauth_state: csrfState, oauth_state_expires: Date.now() + 10 * 60 * 1000 },
        },
        { onConflict: 'company_id,provider' },
      )

    const authorizeUrl = `${gustoAuthBase()}/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(csrfState)}`

    return new Response(JSON.stringify({ authorize_url: authorizeUrl }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  // ── callback: exchange code for tokens ────────────────────────────
  if (action === 'callback') {
    const auth = await verifyAuth(req)
    if (!auth || (auth.role !== 'admin' && auth.role !== 'super_admin')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const code = url.searchParams.get('code')
    const callbackState = url.searchParams.get('state') ?? ''
    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Verify CSRF state
    const csrfDb = supabaseAdmin()
    const { data: csrfProfile } = await csrfDb
      .from('profiles')
      .select('company_id')
      .eq('id', auth.user_id)
      .single()
    const csrfCompanyId = (csrfProfile?.company_id as string) ?? auth.user_id

    const { data: csrfRow } = await csrfDb
      .from('integrations')
      .select('metadata')
      .eq('company_id', csrfCompanyId)
      .eq('provider', 'gusto')
      .single()

    const csrfMeta = csrfRow?.metadata as { oauth_state?: string; oauth_state_expires?: number } | null
    if (!csrfMeta?.oauth_state || csrfMeta.oauth_state !== callbackState) {
      return new Response(JSON.stringify({ error: 'OAuth state mismatch' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (csrfMeta.oauth_state_expires && Date.now() > csrfMeta.oauth_state_expires) {
      return new Response(JSON.stringify({ error: 'OAuth state expired — please retry' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    try {
      const tokens = await exchangeCodeForTokens(code)
      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 7200) * 1000).toISOString()

      // Fetch the company UUID from Gusto if not in token response
      let companyUuid = tokens.company_uuid ?? ''
      if (!companyUuid) {
        const meRes = await fetch(`${gustoBase()}/v1/me`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        if (meRes.ok) {
          const me = await meRes.json()
          // Gusto /me returns roles[].entities[].uuid for companies
          const roles = (me.roles ?? []) as Array<{ entities?: Array<{ uuid: string }> }>
          companyUuid = roles[0]?.entities?.[0]?.uuid ?? ''
        }
      }

      // Look up the user's company_id from profiles
      const db = supabaseAdmin()
      const { data: profile } = await db
        .from('profiles')
        .select('company_id')
        .eq('id', auth.user_id)
        .single()

      const companyId = profile?.company_id as string | undefined

      // Upsert the integration row with encrypted tokens
      await db.from('integrations').upsert(
        {
          company_id: companyId ?? auth.user_id,
          provider: 'gusto',
          access_token: await encryptToken(tokens.access_token),
          refresh_token: await encryptToken(tokens.refresh_token),
          token_expires_at: expiresAt,
          metadata: { company_uuid: companyUuid, tokens_encrypted: true },
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,provider' },
      )

      return new Response(
        JSON.stringify({ success: true, company_uuid: companyUuid }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    } catch (e) {
      console.error('[gusto-auth] callback error:', (e as Error).message)
      return new Response(JSON.stringify({ error: 'OAuth flow failed' }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
  }

  // ── POST: refresh or disconnect ───────────────────────────────────
  if (req.method === 'POST') {
    const auth = await verifyAuth(req)
    if (!auth || (auth.role !== 'admin' && auth.role !== 'super_admin')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const bodyAction = (body as { action?: string }).action

    if (bodyAction === 'disconnect') {
      const db = supabaseAdmin()
      const { data: profile } = await db
        .from('profiles')
        .select('company_id')
        .eq('id', auth.user_id)
        .single()

      await db
        .from('integrations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('provider', 'gusto')
        .eq('company_id', profile?.company_id ?? auth.user_id)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action. Use ?action=connect or ?action=callback' }), {
    status: 400,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
})
