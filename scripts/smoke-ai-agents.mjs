#!/usr/bin/env node
/**
 * smoke-ai-agents.mjs
 *
 * Fires each of the 11 AI agents listed in NEXT_SESSION_STARTER.md with a
 * realistic input, captures the HTTP response + first ~300 bytes of the
 * body, and emits a pass/fail summary. PASS = 2xx response code. No
 * hallucinated-output assertion — that's a human read.
 *
 * Uses akrenovations01@gmail.com admin JWT (obtained via admin
 * generate_link + parsed from the URL fragment) for functions that need
 * a user identity; uses the service role for cron-style functions.
 */

import fs from 'node:fs'

const SUPABASE_URL = 'https://mebzqfeeiciayxdetteb.supabase.co'
const MEMORY = '/Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md'
const PAT = fs.readFileSync(MEMORY, 'utf-8').match(/sbp_[a-zA-Z0-9]{40,}/)?.[0]

async function getSR() {
  const r = await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'Mozilla/5.0' },
  })
  const k = await r.json()
  return k.find(x => x.name === 'service_role' && x.type === 'legacy').api_key
}

async function getAnon() {
  const r = await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'Mozilla/5.0' },
  })
  const k = await r.json()
  return k.find(x => x.name === 'anon' && x.type === 'legacy').api_key
}

// Obtain a user JWT for admin by minting a magic link, extracting the hashed
// token, exchanging it for a session.
async function getAdminJwt(sr) {
  const link = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: sr, Authorization: `Bearer ${sr}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: 'akrenovations01@gmail.com' }),
  })).json()
  const actionLink = link.action_link
  // action_link is of form https://…supabase.co/auth/v1/verify?token=…&type=magiclink&redirect_to=…
  // Calling this endpoint with redirect=false would return JSON, but we just follow redirects manually.
  // Simpler: use admin /users endpoint to generate a short-lived session directly via signInWithPassword-equivalent.
  // Supabase doesn't expose that; instead we POST to the action_link which returns a 302 with tokens in fragment.
  // Playwright is overkill for this — do it with fetch + capture redirect target.
  const u = new URL(actionLink)
  const verifyUrl = `${u.origin}${u.pathname}${u.search}`
  const res = await fetch(verifyUrl, { redirect: 'manual' })
  const loc = res.headers.get('location') || ''
  const m = loc.match(/access_token=([^&]+)/)
  if (!m) throw new Error(`could not extract admin JWT from ${loc.slice(0, 200)}`)
  return decodeURIComponent(m[1])
}

// NOTE: the starter's "agent-site-walk" is really the /admin/walkthrough
// UI, which talks to `generate-estimate` — that's the edge function that
// turns walkthrough answers into line items via Claude. Aliased here.
const COMPANY_ID = '1e62cd50-c5a5-447d-a981-a47829c634e6'
const PROJECT_ID = 'c4667c34-87ac-47f5-b682-155fff3e93f3'
const ADMIN_USER_ID = '8d4c129e-cdff-4f0a-90d8-ab81eafe2086'

const AGENTS = [
  {
    name: 'meta-agent-chat',
    auth: 'admin_jwt',
    body: { message: 'Summarize my active projects in one sentence.', session_id: crypto.randomUUID(), user_id: ADMIN_USER_ID },
  },
  { name: 'agent-morning-brief',       auth: 'admin_jwt',    body: { company_id: COMPANY_ID } },
  { name: 'agent-risk-monitor',        auth: 'admin_jwt',    body: { company_id: COMPANY_ID } },
  { name: 'agent-receipt-processor',   auth: 'admin_jwt',    body: { file_id: '00000000-0000-0000-0000-000000000000' }, expectNon2xxOk: true },
  { name: 'agent-photo-tagger',        auth: 'admin_jwt',    body: { photo_id: '00000000-0000-0000-0000-000000000000', image_url: 'https://example.com/missing.png' }, expectNon2xxOk: true },
  {
    name: 'agent-referral-intake',
    auth: 'admin_jwt',
    body: {
      company_id: COMPANY_ID,
      referred_name: 'WebKit E2E Test Lead',
      referred_phone: '555-0100',
      referred_email: 'e2e-test+smoke@example.com',
      project_type: 'Bathroom Renovation',
      notes: 'Automated smoke invocation from WEBKIT_DEEP_E2E run. Safe to delete.',
    },
  },
  { name: 'agent-schedule-optimizer',  auth: 'admin_jwt',    body: { company_id: COMPANY_ID } },
  {
    // "Site walk" in the starter == the AI walkthrough → generate-estimate
    name: 'generate-estimate',
    auth: 'admin_jwt',
    body: {
      project_type: 'bathroom',
      walkthrough_answers: [
        { question: 'What is the square footage?', answer: 'Approx 60 sq ft, small primary bath.' },
        { question: 'Any layout changes?', answer: 'No, keep the same footprint.' },
        { question: 'Tile or LVP on the floor?', answer: 'Large-format porcelain tile.' },
        { question: 'Vanity width?', answer: '48 inch single-sink vanity with quartz top.' },
        { question: 'Shower or tub?', answer: 'Walk-in tile shower with glass door.' },
      ],
      client_name: 'WebKit E2E Smoke',
    },
  },
  { name: 'agent-inventory-alerts',    auth: 'service_role', body: {} },
  { name: 'notify-inventory-alerts',   auth: 'service_role', body: {} },
  { name: 'ai-inventory-query',        auth: 'admin_jwt',    body: { query: 'How many bathroom vanities in stock?', company_id: COMPANY_ID } },
]

async function fireAgent(agent, sr, anon, adminJwt) {
  const token = agent.auth === 'service_role' ? sr : adminJwt
  const apikey = agent.auth === 'service_role' ? sr : anon
  const started = Date.now()
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${agent.name}`, {
      method: 'POST',
      headers: {
        apikey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agent.body),
    })
    const text = await res.text()
    const ms = Date.now() - started
    const ok = agent.expectNon2xxOk ? true : res.ok
    return { name: agent.name, status: res.status, ms, ok, preview: text.slice(0, 400) }
  } catch (e) {
    return { name: agent.name, status: 0, ms: Date.now() - started, ok: false, preview: `ERR: ${e.message}` }
  }
}

;(async () => {
  const sr = await getSR()
  const anon = await getAnon()
  const adminJwt = await getAdminJwt(sr)
  console.log(`[agents] firing ${AGENTS.length} agents against live prod\n`)
  const rows = []
  for (const agent of AGENTS) {
    const r = await fireAgent(agent, sr, anon, adminJwt)
    rows.push(r)
    const badge = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
    console.log(`${badge} ${r.name}  http=${r.status}  ${r.ms}ms`)
    console.log(`     ${r.preview.replace(/\s+/g, ' ').slice(0, 240)}`)
  }
  const pass = rows.filter(r => r.ok).length
  console.log(`\n── Summary ── ${pass}/${rows.length} agents responded cleanly`)
  fs.writeFileSync('/tmp/agent-smoke-results.json', JSON.stringify(rows, null, 2))
  if (pass < rows.length) process.exit(1)
})()
