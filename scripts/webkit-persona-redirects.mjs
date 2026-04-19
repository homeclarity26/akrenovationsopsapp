#!/usr/bin/env node
/**
 * webkit-persona-redirects.mjs
 *
 * Verifies the cross-role redirect contract established in Job #1:
 *
 *   platform_owner  → can access /platform/*; /admin, /employee, /client
 *                     all redirect back to /platform.
 *   admin           → can access /admin/*; Admin↔Field goes to /employee.
 *                     /platform redirects to /admin.
 *
 * (Employee + client cases are documented but require seeded accounts to
 * run end-to-end; we defer them to the WEBKIT_DEEP_E2E_2026-04-19 report.)
 *
 * Exits 0 when all expected redirects happen, 1 if any row mismatches.
 */

import { webkit } from 'playwright'
import fs from 'node:fs'

const APP = 'https://akrenovationsopsapp.vercel.app'
const SUPABASE_URL = 'https://mebzqfeeiciayxdetteb.supabase.co'
const MEMORY = '/Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md'
const PAT = fs.readFileSync(MEMORY, 'utf-8').match(/sbp_[a-zA-Z0-9]{40,}/)?.[0]
if (!PAT) { console.error('[redirect] no PAT'); process.exit(2) }

const ADMIN_EMAIL = 'akrenovations01@gmail.com'
const PLATFORM_EMAIL = 'adam@hometownbuildersclub.com'

async function getSR() {
  const r = await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'Mozilla/5.0' },
  })
  const k = await r.json()
  return k.find(x => x.name === 'service_role' && x.type === 'legacy').api_key
}

async function magicLink(email, sr) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: sr, Authorization: `Bearer ${sr}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  return (await r.json()).action_link
}

async function login(page, email, sr) {
  const link = await magicLink(email, sr)
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 25_000 })
  await page.waitForTimeout(3500)
  if (/\/login/.test(page.url())) throw new Error(`login failed for ${email}`)
}

async function visitAndExpectPath(page, path, expectRe, label) {
  await page.goto(APP + path, { waitUntil: 'domcontentloaded', timeout: 25_000 })
  await page.waitForTimeout(2500)
  const url = page.url()
  const ok = expectRe.test(url)
  const badge = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`  ${badge} ${label} — ${path} → ${new URL(url).pathname} ${ok ? '' : `(expected ${expectRe})`}`)
  return ok
}

(async () => {
  const sr = await getSR()
  const browser = await webkit.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()
  let pass = 0, fail = 0

  // ── platform_owner ─────────────────────────────────────────────────
  console.log(`\n── platform_owner (${PLATFORM_EMAIL}) ──`)
  await login(page, PLATFORM_EMAIL, sr)
  const po = [
    ['/platform',          /\/platform$/,            'can access /platform'],
    ['/platform/companies',/\/platform\/companies/,  'can access /platform/companies'],
    ['/platform/users',    /\/platform\/users/,      'can access /platform/users'],
    ['/admin',             /\/platform/,             '/admin redirects back to /platform'],
    ['/admin/projects',    /\/platform/,             '/admin/projects redirects to /platform'],
    ['/employee',          /\/platform/,             '/employee redirects to /platform'],
    ['/employee/time',     /\/platform/,             '/employee/time redirects to /platform'],
    ['/client/progress',   /\/platform/,             '/client/progress redirects to /platform'],
  ]
  for (const [p, re, label] of po) (await visitAndExpectPath(page, p, re, label)) ? pass++ : fail++

  // ── admin ──────────────────────────────────────────────────────────
  console.log(`\n── admin (${ADMIN_EMAIL}) ──`)
  await login(page, ADMIN_EMAIL, sr)
  const ad = [
    ['/admin',             /\/admin$/,              'can access /admin'],
    ['/admin/projects',    /\/admin\/projects/,     'can access /admin/projects'],
    ['/admin/settings',    /\/admin\/settings/,     'can access /admin/settings'],
    ['/employee',          /\/employee/,            '/employee still reachable (Admin↔Field toggle)'],
    ['/employee/time',     /\/employee\/time/,      '/employee/time reachable via Field mode'],
    ['/platform',          /\/admin$/,              '/platform redirects to /admin'],
    ['/platform/companies',/\/admin$/,              '/platform/companies redirects to /admin'],
    ['/platform/users',    /\/admin$/,              '/platform/users redirects to /admin'],
  ]
  for (const [p, re, label] of ad) (await visitAndExpectPath(page, p, re, label)) ? pass++ : fail++

  await browser.close()
  console.log(`\n── Summary ── ${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
})().catch(e => { console.error(e); process.exit(4) })
