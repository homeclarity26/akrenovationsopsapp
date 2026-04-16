// quickbooks-auth — OAuth2 flow for QuickBooks Online
// ?action=connect  → redirect to Intuit authorize URL
// ?action=callback → exchange code for tokens, store in integrations table

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { encryptToken } from '../_shared/tokenCrypto.ts'

const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  // Rate limit
  const rl = await checkRateLimit(req, 'quickbooks-auth')
  if (!rl.allowed) return rateLimitResponse(rl)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  try {
    if (action === 'connect') {
      return handleConnect(req, url, cors)
    } else if (action === 'callback') {
      return await handleCallback(req, url, cors)
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use ?action=connect or ?action=callback' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }
  } catch (err) {
    console.error('[quickbooks-auth] Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})

// ---------------------------------------------------------------------------
// Connect: redirect to Intuit OAuth
// ---------------------------------------------------------------------------

async function handleConnect(req: Request, url: URL, cors: Record<string, string>): Promise<Response> {
  const clientId = Deno.env.get('QBO_CLIENT_ID') ?? ''
  const redirectUri = Deno.env.get('QBO_REDIRECT_URI') ?? ''

  if (!clientId || !redirectUri) {
    return new Response(
      JSON.stringify({ error: 'QuickBooks OAuth not configured. Missing QBO_CLIENT_ID or QBO_REDIRECT_URI.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // Generate CSRF state: random UUID + timestamp, store in integrations metadata
  const csrfState = crypto.randomUUID()
  const companyState = url.searchParams.get('state') ?? ''
  let parsedCompanyId: string | undefined
  try {
    parsedCompanyId = JSON.parse(atob(companyState)).company_id
  } catch { /* will be validated on callback */ }

  if (parsedCompanyId) {
    const db = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    await db
      .from('integrations')
      .upsert(
        {
          company_id: parsedCompanyId,
          provider: 'quickbooks',
          metadata: { oauth_state: csrfState, oauth_state_expires: Date.now() + 10 * 60 * 1000, company_state: companyState },
        },
        { onConflict: 'company_id,provider' },
      )
  }

  const combinedState = btoa(JSON.stringify({ orig: companyState, csrf: csrfState }))

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    state: combinedState,
  })

  const authorizeUrl = `${QBO_AUTH_URL}?${params.toString()}`
  return new Response(
    JSON.stringify({ authorize_url: authorizeUrl }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  )
}

// ---------------------------------------------------------------------------
// Callback: exchange code for tokens, store in DB
// ---------------------------------------------------------------------------

async function handleCallback(
  req: Request,
  url: URL,
  cors: Record<string, string>,
): Promise<Response> {
  const code = url.searchParams.get('code')
  const realmId = url.searchParams.get('realmId')
  const state = url.searchParams.get('state')

  if (!code || !realmId) {
    return new Response(
      JSON.stringify({ error: 'Missing code or realmId from Intuit callback' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // Parse combined state: { orig, csrf }
  let companyId: string
  let csrfToken: string
  try {
    const outer = JSON.parse(atob(state ?? ''))
    csrfToken = outer.csrf
    const parsed = JSON.parse(atob(outer.orig))
    companyId = parsed.company_id
    if (!companyId) throw new Error('no company_id')
    if (!csrfToken) throw new Error('no csrf token')
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid state parameter' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // Verify CSRF state against stored value
  const csrfDb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const { data: existing } = await csrfDb
    .from('integrations')
    .select('metadata')
    .eq('company_id', companyId)
    .eq('provider', 'quickbooks')
    .single()

  const meta = existing?.metadata as { oauth_state?: string; oauth_state_expires?: number } | null
  if (!meta?.oauth_state || meta.oauth_state !== csrfToken) {
    return new Response(
      JSON.stringify({ error: 'OAuth state mismatch — possible CSRF attack' }),
      { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
  if (meta.oauth_state_expires && Date.now() > meta.oauth_state_expires) {
    return new Response(
      JSON.stringify({ error: 'OAuth state expired — please retry' }),
      { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  // Exchange code for tokens
  const clientId = Deno.env.get('QBO_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('QBO_CLIENT_SECRET') ?? ''
  const redirectUri = Deno.env.get('QBO_REDIRECT_URI') ?? ''

  const tokenRes = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('[quickbooks-auth] Token exchange failed:', errText)
    return new Response(
      JSON.stringify({ error: 'OAuth flow failed' }),
      { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  const tokens = await tokenRes.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Store in integrations table
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { error: upsertError } = await supabase
    .from('integrations')
    .upsert(
      {
        company_id: companyId,
        provider: 'quickbooks',
        access_token: await encryptToken(tokens.access_token),
        refresh_token: await encryptToken(tokens.refresh_token),
        token_expires_at: expiresAt,
        realm_id: realmId,
        is_active: true,
        metadata: { x_refresh_token_expires_in: tokens.x_refresh_token_expires_in, tokens_encrypted: true },
      },
      { onConflict: 'company_id,provider' },
    )

  if (upsertError) {
    console.error('[quickbooks-auth] Upsert failed:', upsertError)
    return new Response(
      JSON.stringify({ error: 'OAuth flow failed' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ success: true, realm_id: realmId }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  )
}

// ---------------------------------------------------------------------------
// Token refresh helper (exported for sync-quickbooks to use)
// ---------------------------------------------------------------------------

export async function refreshQBOToken(
  supabase: ReturnType<typeof createClient>,
  integration: { id: string; refresh_token: string | null; metadata?: Record<string, unknown> },
): Promise<{ access_token: string } | null> {
  if (!integration.refresh_token) return null

  const clientId = Deno.env.get('QBO_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('QBO_CLIENT_SECRET') ?? ''

  // Decrypt refresh token if encrypted
  const { decryptToken } = await import('../_shared/tokenCrypto.ts')
  const isEncrypted = (integration.metadata as Record<string, unknown>)?.tokens_encrypted === true
  const plainRefresh = isEncrypted ? await decryptToken(integration.refresh_token) : integration.refresh_token

  const tokenRes = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: plainRefresh,
    }),
  })

  if (!tokenRes.ok) {
    console.error('[quickbooks-auth] Token refresh failed:', await tokenRes.text())
    return null
  }

  const tokens = await tokenRes.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase.from('integrations').update({
    access_token: await encryptToken(tokens.access_token),
    refresh_token: await encryptToken(tokens.refresh_token),
    token_expires_at: expiresAt,
    metadata: { ...((integration.metadata as Record<string, unknown>) ?? {}), tokens_encrypted: true },
  }).eq('id', integration.id)

  return { access_token: tokens.access_token }
}
