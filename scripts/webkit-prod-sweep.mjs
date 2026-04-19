#!/usr/bin/env node
/**
 * webkit-prod-sweep.mjs
 *
 * One-shot Safari (WebKit) cold-start sweep against the live prod app.
 * Logs in via a Supabase admin-generated magic link, then deep-links into
 * every meaningful route and asserts:
 *   (a) the root ErrorBoundary's "Something went wrong" heading is not rendered
 *   (b) no console error or pageerror mentions the Safari-specific
 *       "WebSocket not available: The operation is insecure" string
 *
 * Runs in ~3 min. Emits a summary table at the end.
 */

import { webkit } from 'playwright'
import fs from 'node:fs'

const APP = 'https://akrenovationsopsapp.vercel.app'
const SUPABASE_URL = 'https://mebzqfeeiciayxdetteb.supabase.co'
const EMAIL = 'akrenovations01@gmail.com'

// PAT lookup (same pattern as smoke-edge.sh)
const MEMORY = '/Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md'
const PAT = fs.readFileSync(MEMORY, 'utf-8').match(/sbp_[a-zA-Z0-9]{40,}/)?.[0]
if (!PAT) { console.error('[sweep] no Supabase PAT in memory'); process.exit(2) }

const ADMIN_ROUTES = [
  '/admin',
  '/admin/crm',
  '/admin/projects',
  '/admin/inventory',
  '/admin/financials',
  '/admin/schedule',
  '/admin/invoices',
  '/admin/proposals',
  '/admin/walkthrough',
  '/admin/subs',
  '/admin/payroll',
  '/admin/compliance',
  '/admin/ai',
  '/admin/reminders',
  '/admin/settings',
  '/admin/settings/context',
  '/admin/settings/branding',
  '/admin/settings/rates',
  '/admin/settings/approvals',
  '/admin/settings/notifications',
  '/admin/settings/templates',
  '/admin/settings/estimate-templates',
  '/admin/settings/checklists',
  '/admin/settings/materials',
  '/admin/settings/tool-requests',
  '/admin/settings/agents',
  '/admin/settings/memory',
  '/admin/settings/health',
  '/admin/settings/backups',
  '/admin/settings/security',
  '/admin/settings/integrations',
]

const EMPLOYEE_ROUTES = [
  '/employee',
  '/employee/time',
  '/employee/shopping',
  '/employee/stocktake',
  '/employee/schedule',
  '/employee/messages',
  '/employee/receipts',
  '/employee/photos',
  '/employee/bonus',
  '/employee/notes',
  '/employee/client-info',
  '/employee/paystubs',
  '/employee/checklists',
  '/employee/tool-request',
  '/employee/projects',
  '/employee/change-order',
]

const PLATFORM_ROUTES = [
  '/platform',
  '/platform/companies',
  '/platform/users',
]

async function getMagicLink() {
  // Get service-role key
  const keysRes = await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${PAT}` },
  })
  const keys = await keysRes.json()
  const sr = keys.find(k => k.name === 'service_role' && k.type === 'legacy')?.api_key
  if (!sr) throw new Error('no service_role key')

  const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: sr, Authorization: `Bearer ${sr}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: EMAIL }),
  })
  const j = await linkRes.json()
  return j.action_link
}

const results = []

async function sweepRoute(page, route) {
  const errors = []
  const onPageError = e => errors.push(`pageerror: ${e.message}`)
  const onConsole = m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 280)}`) }
  page.on('pageerror', onPageError)
  page.on('console', onConsole)
  let url = APP + route
  let crashed = false
  let sawWs = false
  let sawCsp = false
  let stuckLoading = false
  let splash = false
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 })
    await page.waitForTimeout(3000) // let realtime subscribes fire + first data paint
    splash = await page.locator('h2', { hasText: /Something went wrong/i }).count() > 0
    sawWs = errors.some(e => /WebSocket not available: The operation is insecure/i.test(e))
    // CSP violation catches: "Refused to connect ..." from Safari, also "Content Security Policy".
    sawCsp = errors.some(e => /Refused to (connect|load)|Content Security Policy/i.test(e))
    // Stuck-loading heuristic: page text contains "Loading" but no actual content past the header,
    // and has been sitting past the 3s settle window.
    const bodyLen = await page.evaluate(() => document.body.innerText.length)
    const hasLoading = await page.evaluate(() => /\bLoading\b/.test(document.body.innerText))
    stuckLoading = hasLoading && bodyLen < 400
  } catch (e) {
    crashed = true
    errors.push(`goto: ${e.message}`)
  } finally {
    page.off('pageerror', onPageError)
    page.off('console', onConsole)
  }
  const status = splash || sawWs || sawCsp || crashed || stuckLoading ? 'FAIL' : 'PASS'
  const detail =
    splash ? 'ErrorBoundary splash' :
    sawWs ? 'Safari WebSocket-insecure' :
    sawCsp ? 'CSP violation' :
    stuckLoading ? 'Stuck on Loading…' :
    crashed ? 'navigation threw' : ''
  const firstRelevant = errors.find(e => /Refused|WebSocket|pageerror|goto:/.test(e))?.substring(0, 220) ?? ''
  results.push({ route, status, detail, firstError: firstRelevant })
  const badge = status === 'PASS' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`  ${badge} ${route}${detail ? ' — ' + detail : ''}${status === 'FAIL' && firstRelevant ? '\n        ' + firstRelevant : ''}`)
}

(async () => {
  console.log('[sweep] generating magic link …')
  const link = await getMagicLink()
  console.log('[sweep] launching webkit …')
  const browser = await webkit.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, // iPhone-ish
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()

  console.log('[sweep] logging in via magic link …')
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 25_000 })
  await page.waitForTimeout(3500)
  const loggedIn = !/\/login/.test(page.url())
  if (!loggedIn) {
    console.error('[sweep] login did not redirect to app; aborting. URL =', page.url())
    await browser.close(); process.exit(3)
  }
  console.log('[sweep] logged in, url =', page.url())

  console.log('\n── Admin routes (super_admin) ──')
  for (const r of ADMIN_ROUTES) await sweepRoute(page, r)

  console.log('\n── Platform routes ──')
  for (const r of PLATFORM_ROUTES) await sweepRoute(page, r)

  console.log('\n── Employee / Field routes ──')
  // Same user is super_admin so has employee mode access via ModeToggle; direct-URL works.
  for (const r of EMPLOYEE_ROUTES) await sweepRoute(page, r)

  // Project-detail routes — these mount ProjectPresenceBar + ProjectBalanceCard
  // which the list-level routes don't. Fetch the first project id from the DB
  // and sweep its admin + employee detail pages.
  console.log('\n── Project detail routes ──')
  const keysRes2 = await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${PAT}` },
  })
  const sr2 = (await keysRes2.json()).find(k => k.name === 'service_role' && k.type === 'legacy').api_key
  const projs = await (await fetch(`${SUPABASE_URL}/rest/v1/projects?select=id&order=created_at.desc&limit=1`, {
    headers: { apikey: sr2, Authorization: `Bearer ${sr2}` },
  })).json()
  if (projs?.[0]?.id) {
    await sweepRoute(page, `/admin/projects/${projs[0].id}`)
    await sweepRoute(page, `/employee/projects/${projs[0].id}`)
  }

  await browser.close()

  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  console.log(`\n── Summary ── ${pass}/${results.length} passed, ${fail} failed`)
  if (fail > 0) {
    console.log('\nFailures:')
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`  ${r.route} — ${r.detail}${r.firstError ? ' | ' + r.firstError : ''}`)
    }
    process.exit(1)
  }
})().catch(e => { console.error('[sweep] fatal', e); process.exit(4) })
