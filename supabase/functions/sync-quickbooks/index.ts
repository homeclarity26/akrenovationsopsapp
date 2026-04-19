// sync-quickbooks — Push invoices + expenses, pull payments from QBO
// Called manually from Settings or daily via cron.
//
// QBO REST API v3. Sandbox vs production controlled by QBO_ENVIRONMENT env var.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { decryptToken, encryptToken } from '../_shared/tokenCrypto.ts'

const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

function qboBaseUrl(): string {
  const env = Deno.env.get('QBO_ENVIRONMENT') ?? 'sandbox'
  return env === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const rl = await checkRateLimit(req, 'sync-quickbooks')
  if (!rl.allowed) return rateLimitResponse(rl)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    // Determine company_id: from body or from JWT profile
    let companyId: string | null = null
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const isCron = body.cron === true

    if (!isCron) {
      const auth = await verifyAuth(req)
      if (!auth || !['admin'].includes(auth.role)) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } },
        )
      }
      // Look up company_id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', auth.user_id)
        .single()
      companyId = profile?.company_id ?? null
    }

    // For cron runs, process all active QBO integrations
    const intQuery = supabase
      .from('integrations')
      .select('*')
      .eq('provider', 'quickbooks')
      .eq('is_active', true)

    if (companyId) intQuery.eq('company_id', companyId)

    const { data: integrations, error: intErr } = await intQuery
    if (intErr || !integrations?.length) {
      return new Response(
        JSON.stringify({ error: 'No active QuickBooks integration found' }),
        { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // Process each integration (usually just one company)
    const allResults = []
    for (const integration of integrations) {
      const result = await syncCompany(supabase, integration)
      allResults.push({ company_id: integration.company_id, ...result })
    }

    // Update last_synced_at
    for (const integration of integrations) {
      await supabase.from('integrations').update({ last_synced_at: new Date().toISOString() })
        .eq('id', integration.id)
    }

    const combined = {
      invoices_synced: allResults.reduce((s, r) => s + r.invoices_synced, 0),
      expenses_synced: allResults.reduce((s, r) => s + r.expenses_synced, 0),
      payments_pulled: allResults.reduce((s, r) => s + r.payments_pulled, 0),
      errors: allResults.flatMap(r => r.errors),
    }

    return new Response(JSON.stringify(combined), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[sync-quickbooks] Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

interface Integration {
  id: string
  company_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  realm_id: string | null
  metadata?: Record<string, unknown>
  last_synced_at?: string
}

async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  integration: Integration,
): Promise<string | null> {
  const isEncrypted = (integration.metadata as Record<string, unknown>)?.tokens_encrypted === true

  // Check if current token is still valid (with 5 min buffer)
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at)
    if (expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return isEncrypted ? await decryptToken(integration.access_token) : integration.access_token
    }
  }

  // Token expired — refresh
  if (!integration.refresh_token) return null
  const plainRefresh = isEncrypted ? await decryptToken(integration.refresh_token) : integration.refresh_token

  const clientId = Deno.env.get('QBO_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('QBO_CLIENT_SECRET') ?? ''

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
    console.error('[sync-quickbooks] Token refresh failed:', await tokenRes.text())
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

  return tokens.access_token
}

// ---------------------------------------------------------------------------
// QBO API helpers
// ---------------------------------------------------------------------------

async function qboRequest(
  method: string,
  path: string,
  token: string,
  realmId: string,
  bodyData?: Record<string, unknown>,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const url = `${qboBaseUrl()}/v3/company/${realmId}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: bodyData ? JSON.stringify(bodyData) : undefined,
  })

  if (!res.ok) {
    const errText = await res.text()
    return { ok: false, error: `QBO ${method} ${path}: ${res.status} — ${errText}` }
  }

  const data = await res.json()
  return { ok: true, data }
}

// Find or create a QBO Customer by display name
async function findOrCreateCustomer(
  token: string,
  realmId: string,
  displayName: string,
): Promise<string | null> {
  // Query existing
  const query = encodeURIComponent(`DisplayName = '${displayName.replace(/'/g, "\\'")}'`)
  const search = await qboRequest('GET', `/query?query=SELECT * FROM Customer WHERE ${query}`, token, realmId)
  if (search.ok && search.data) {
    const qr = search.data as Record<string, unknown>
    const rows = (qr.QueryResponse as Record<string, unknown>)?.Customer as Array<Record<string, unknown>> | undefined
    if (rows?.length) return String(rows[0].Id)
  }

  // Create new
  const create = await qboRequest('POST', '/customer', token, realmId, { DisplayName: displayName })
  if (create.ok && create.data) {
    const cust = (create.data as Record<string, unknown>).Customer as Record<string, unknown> | undefined
    if (cust) return String(cust.Id)
  }
  return null
}

// Find or create a QBO Vendor by display name
async function findOrCreateVendor(
  token: string,
  realmId: string,
  displayName: string,
): Promise<string | null> {
  const query = encodeURIComponent(`DisplayName = '${displayName.replace(/'/g, "\\'")}'`)
  const search = await qboRequest('GET', `/query?query=SELECT * FROM Vendor WHERE ${query}`, token, realmId)
  if (search.ok && search.data) {
    const qr = search.data as Record<string, unknown>
    const rows = (qr.QueryResponse as Record<string, unknown>)?.Vendor as Array<Record<string, unknown>> | undefined
    if (rows?.length) return String(rows[0].Id)
  }

  const create = await qboRequest('POST', '/vendor', token, realmId, { DisplayName: displayName })
  if (create.ok && create.data) {
    const vendor = (create.data as Record<string, unknown>).Vendor as Record<string, unknown> | undefined
    if (vendor) return String(vendor.Id)
  }
  return null
}

// Find or create a QBO expense Account (default "Job Materials")
async function findOrCreateExpenseAccount(
  token: string,
  realmId: string,
): Promise<string | null> {
  const query = encodeURIComponent("Name = 'Job Materials'")
  const search = await qboRequest('GET', `/query?query=SELECT * FROM Account WHERE ${query}`, token, realmId)
  if (search.ok && search.data) {
    const qr = search.data as Record<string, unknown>
    const rows = (qr.QueryResponse as Record<string, unknown>)?.Account as Array<Record<string, unknown>> | undefined
    if (rows?.length) return String(rows[0].Id)
  }

  // Create the account
  const create = await qboRequest('POST', '/account', token, realmId, {
    Name: 'Job Materials',
    AccountType: 'Expense',
    AccountSubType: 'SuppliesMaterials',
  })
  if (create.ok && create.data) {
    const acct = (create.data as Record<string, unknown>).Account as Record<string, unknown> | undefined
    if (acct) return String(acct.Id)
  }
  return null
}

// ---------------------------------------------------------------------------
// Main sync logic per company
// ---------------------------------------------------------------------------

interface SyncResult {
  invoices_synced: number
  expenses_synced: number
  payments_pulled: number
  errors: string[]
}

async function syncCompany(
  supabase: ReturnType<typeof createClient>,
  integration: Integration,
): Promise<SyncResult> {
  const result: SyncResult = { invoices_synced: 0, expenses_synced: 0, payments_pulled: 0, errors: [] }
  const realmId = integration.realm_id
  if (!realmId) {
    result.errors.push('No realm_id on integration record')
    return result
  }

  const token = await getValidToken(supabase, integration)
  if (!token) {
    result.errors.push('Unable to obtain valid QBO access token — re-authorize required')
    return result
  }

  // --- Push invoices ---
  await syncInvoices(supabase, integration.company_id, token, realmId, result)

  // --- Push expenses ---
  await syncExpenses(supabase, integration.company_id, token, realmId, result)

  // --- Pull payments ---
  await pullPayments(supabase, integration, token, realmId, result)

  return result
}

// ---------------------------------------------------------------------------
// Push invoices
// ---------------------------------------------------------------------------

async function syncInvoices(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  token: string,
  realmId: string,
  result: SyncResult,
) {
  // Get unsynced invoices for this company (join through projects)
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, title, total, client_name, project_id, projects!inner(company_id)')
    .is('qb_invoice_id', null)
    .eq('projects.company_id', companyId)
    .limit(50)

  if (error) {
    result.errors.push(`Invoice fetch error: ${error.message}`)
    return
  }
  if (!invoices?.length) return

  for (const inv of invoices) {
    try {
      const customerName = inv.client_name || 'Unknown Client'
      const customerId = await findOrCreateCustomer(token, realmId, customerName)
      if (!customerId) {
        result.errors.push(`Invoice ${inv.id}: could not find/create QBO customer "${customerName}"`)
        continue
      }

      const qboInvoice = {
        CustomerRef: { value: customerId },
        Line: [
          {
            Amount: inv.total ?? 0,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              ItemRef: { value: '1', name: 'Services' },
            },
            Description: inv.title || 'Invoice',
          },
        ],
      }

      const res = await qboRequest('POST', '/invoice', token, realmId, qboInvoice)
      if (!res.ok) {
        result.errors.push(`Invoice ${inv.id}: QBO create failed — ${res.error}`)
        continue
      }

      const qbId = String((res.data as Record<string, unknown>)?.Invoice
        ? ((res.data as Record<string, unknown>).Invoice as Record<string, unknown>).Id
        : null)

      if (qbId && qbId !== 'null') {
        await supabase.from('invoices').update({
          qb_invoice_id: qbId,
          qb_synced_at: new Date().toISOString(),
        }).eq('id', inv.id)
        result.invoices_synced++
      }
    } catch (err) {
      result.errors.push(`Invoice ${inv.id}: ${String(err)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Push expenses
// ---------------------------------------------------------------------------

async function syncExpenses(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  token: string,
  realmId: string,
  result: SyncResult,
) {
  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('id, vendor, amount, category, description, company_id')
    .is('qb_expense_id', null)
    .eq('company_id', companyId)
    .limit(50)

  if (error) {
    result.errors.push(`Expense fetch error: ${error.message}`)
    return
  }
  if (!expenses?.length) return

  // Get or create the default expense account
  const accountId = await findOrCreateExpenseAccount(token, realmId)

  for (const exp of expenses) {
    try {
      const vendorName = exp.vendor || 'Miscellaneous Vendor'
      const vendorId = await findOrCreateVendor(token, realmId, vendorName)

      const qboPurchase: Record<string, unknown> = {
        PaymentType: 'Cash',
        Line: [
          {
            Amount: exp.amount ?? 0,
            DetailType: 'AccountBasedExpenseLineDetail',
            AccountBasedExpenseLineDetail: {
              AccountRef: { value: accountId ?? '1' },
            },
            Description: exp.description || exp.category || 'Expense',
          },
        ],
      }

      if (vendorId) {
        qboPurchase.EntityRef = { value: vendorId, type: 'Vendor' }
      }

      const res = await qboRequest('POST', '/purchase', token, realmId, qboPurchase)
      if (!res.ok) {
        result.errors.push(`Expense ${exp.id}: QBO create failed — ${res.error}`)
        continue
      }

      const qbId = String((res.data as Record<string, unknown>)?.Purchase
        ? ((res.data as Record<string, unknown>).Purchase as Record<string, unknown>).Id
        : null)

      if (qbId && qbId !== 'null') {
        await supabase.from('expenses').update({
          qb_expense_id: qbId,
          qb_synced_at: new Date().toISOString(),
        }).eq('id', exp.id)
        result.expenses_synced++
      }
    } catch (err) {
      result.errors.push(`Expense ${exp.id}: ${String(err)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Pull payments (mark invoices paid)
// ---------------------------------------------------------------------------

async function pullPayments(
  supabase: ReturnType<typeof createClient>,
  integration: Integration,
  token: string,
  realmId: string,
  result: SyncResult,
) {
  // Query payments since last sync (or last 30 days)
  const since = integration.last_synced_at
    ? new Date(integration.last_synced_at).toISOString().split('T')[0]
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const query = encodeURIComponent(`SELECT * FROM Payment WHERE MetaData.LastUpdatedTime >= '${since}'`)
  const res = await qboRequest('GET', `/query?query=${query}`, token, realmId)

  if (!res.ok) {
    result.errors.push(`Payment query failed: ${res.error}`)
    return
  }

  const qr = res.data as Record<string, unknown>
  const payments = ((qr.QueryResponse as Record<string, unknown>)?.Payment ?? []) as Array<Record<string, unknown>>

  for (const payment of payments) {
    try {
      // Each payment can reference multiple invoice lines
      const lines = (payment.Line ?? []) as Array<Record<string, unknown>>
      for (const line of lines) {
        const linkedTxns = (line.LinkedTxn ?? []) as Array<Record<string, string>>
        for (const txn of linkedTxns) {
          if (txn.TxnType === 'Invoice') {
            const qbInvoiceId = txn.TxnId
            // Find our invoice by qb_invoice_id
            const { data: inv } = await supabase
              .from('invoices')
              .select('id, status')
              .eq('qb_invoice_id', qbInvoiceId)
              .single()

            if (inv && inv.status !== 'paid') {
              await supabase.from('invoices').update({
                status: 'paid',
                qb_synced_at: new Date().toISOString(),
              }).eq('id', inv.id)
              result.payments_pulled++
            }
          }
        }
      }
    } catch (err) {
      result.errors.push(`Payment processing: ${String(err)}`)
    }
  }
}
