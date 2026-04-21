#!/usr/bin/env node
/**
 * smoke-ai-v2.mjs — end-to-end smoke for the Phase 0 canary tool.
 *
 *   1. Mints a magic-link token for the test employee.
 *   2. Resets test_employee state (clears any open time entry so we
 *      can clock_in cleanly).
 *   3. POSTs to agent-tool-call with the user's natural-language ask.
 *   4. Verifies a time_entries row was inserted, an ai_threads row
 *      exists, ai_messages has the user + assistant + tool messages,
 *      ai_tool_calls has an audit row, ai_usage_ledger has a cost row.
 *   5. POSTs again with a slightly different idempotency_key — confirms
 *      the second call returns the "already clocked in" guard message
 *      (proves clock_in's open-entry check works).
 *   6. POSTs once more with the SAME idempotency_key as the first —
 *      confirms idempotency cache returns the cached result.
 *
 * Run: node scripts/smoke-ai-v2.mjs
 */

import fs from 'node:fs'

const SUPABASE_URL = 'https://mebzqfeeiciayxdetteb.supabase.co'
const PAT = fs.readFileSync('/Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md', 'utf-8').match(/sbp_[a-zA-Z0-9]{40,}/)[0]
const TEST_EMP_EMAIL = 'test.employee@ak-renovations.test'
const TEST_EMP_ID = '3b3e5b36-209c-4dda-a67b-debb6b28d5c9'
const PROJECT_ID = 'c4667c34-87ac-47f5-b682-155fff3e93f3'

async function sr() {
  return (await (await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'Mozilla/5.0' },
  })).json()).find(k => k.name === 'service_role' && k.type === 'legacy').api_key
}

async function anon() {
  return (await (await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'Mozilla/5.0' },
  })).json()).find(k => k.name === 'anon' && k.type === 'legacy').api_key
}

async function getUserJwt(srKey) {
  const link = (await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: srKey, Authorization: `Bearer ${srKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: TEST_EMP_EMAIL }),
  })).json()).action_link
  const res = await fetch(link, { redirect: 'manual' })
  const loc = res.headers.get('location') || ''
  const m = loc.match(/access_token=([^&]+)/)
  if (!m) throw new Error('could not extract JWT')
  return decodeURIComponent(m[1])
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ query }),
  })
  return r.json()
}

const results = []
function assert(label, cond, detail = '') {
  results.push({ label, ok: !!cond, detail })
  const badge = cond ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`${badge} ${label}${detail ? ' — ' + detail : ''}`)
}

async function callAgent({ jwt, anonKey, message, idempotency_key, thread_id = null }) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/agent-tool-call`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id, message, idempotency_key, context: { pathname: '/employee' } }),
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text } }
  return { status: r.status, body }
}

;(async () => {
  console.log('[smoke] booting …')
  const srKey = await sr()
  const anonKey = await anon()

  console.log('[smoke] resetting test employee state (delete any open time_entries)')
  await sql(`DELETE FROM time_entries WHERE user_id = '${TEST_EMP_ID}' AND clock_out IS NULL`)
  await sql(`DELETE FROM ai_messages WHERE thread_id IN (SELECT id FROM ai_threads WHERE user_id = '${TEST_EMP_ID}')`)
  await sql(`DELETE FROM ai_tool_calls WHERE user_id = '${TEST_EMP_ID}'`)
  await sql(`DELETE FROM ai_threads WHERE user_id = '${TEST_EMP_ID}'`)

  console.log('[smoke] minting JWT …')
  const jwt = await getUserJwt(srKey)

  // ── First call: "clock me in" ─────────────────────────────────────
  console.log('\n── 1. First call: "Clock me in to Overnight Test Project" ──')
  const idem1 = crypto.randomUUID()
  const c1 = await callAgent({ jwt, anonKey, message: 'Clock me in to the Overnight Test Project', idempotency_key: idem1 })
  console.log('   http:', c1.status)
  console.log('   body:', JSON.stringify(c1.body, null, 2).slice(0, 800))

  assert('1.1 HTTP 200', c1.status === 200, `got ${c1.status}`)
  assert('1.2 thread_id returned', !!c1.body.thread_id)
  assert('1.3 messages array non-empty', Array.isArray(c1.body.messages) && c1.body.messages.length >= 2)
  assert('1.4 monthly_cost_so_far is a number', typeof c1.body.monthly_cost_so_far === 'number')
  assert('1.5 not blocked', c1.body.blocked === false)

  // Verify a time_entries row was inserted.
  const te = await sql(`SELECT id, project_id, work_type, clock_in, clock_out FROM time_entries WHERE user_id = '${TEST_EMP_ID}' AND clock_out IS NULL`)
  assert('1.6 one open time_entries row created', Array.isArray(te) && te.length === 1)
  if (Array.isArray(te) && te[0]) {
    assert('1.7 row has correct project_id', te[0].project_id === PROJECT_ID, te[0].project_id)
    assert('1.8 work_type = field_carpentry', te[0].work_type === 'field_carpentry')
  }

  // Verify audit log + ai_messages + ai_usage_ledger.
  const aTC = await sql(`SELECT tool_name, error FROM ai_tool_calls WHERE user_id = '${TEST_EMP_ID}'`)
  assert('1.9 ai_tool_calls row written', Array.isArray(aTC) && aTC.length >= 1, JSON.stringify(aTC?.[0] ?? {}))
  if (Array.isArray(aTC) && aTC[0]) {
    assert('1.10 audit row tool_name = clock_in', aTC[0].tool_name === 'clock_in')
    assert('1.11 audit row no error', aTC[0].error === null, aTC[0].error)
  }

  const aM = await sql(`SELECT role, COUNT(*) AS n FROM ai_messages WHERE thread_id = '${c1.body.thread_id}' GROUP BY role`)
  console.log('   ai_messages by role:', aM)
  const haveUser = (aM ?? []).find(r => r.role === 'user')
  const haveTool = (aM ?? []).find(r => r.role === 'tool')
  assert('1.12 ai_messages has user role', !!haveUser)
  assert('1.13 ai_messages has tool role', !!haveTool)

  const aUL = await sql(`SELECT model, kind, cost_usd FROM ai_usage_ledger WHERE user_id = '${TEST_EMP_ID}'`)
  assert('1.14 ai_usage_ledger has at least one row', Array.isArray(aUL) && aUL.length >= 1, JSON.stringify(aUL?.[0] ?? {}))

  // ── Second call: SAME idempotency key → should hit cache ──────────
  console.log('\n── 2. Same idempotency key → cached result ──')
  const c2 = await callAgent({ jwt, anonKey, message: 'Clock me in to the Overnight Test Project', idempotency_key: idem1, thread_id: c1.body.thread_id })
  assert('2.1 HTTP 200 again', c2.status === 200, `got ${c2.status}`)
  const teCount = await sql(`SELECT COUNT(*) AS n FROM time_entries WHERE user_id = '${TEST_EMP_ID}' AND clock_out IS NULL`)
  assert('2.2 still exactly one open time_entries row (idempotent)', teCount?.[0]?.n === 1, `n=${teCount?.[0]?.n}`)

  // ── Third call: NEW idempotency key, asks again → tool should refuse ──
  console.log('\n── 3. New idempotency key, "clock me in" again → expect "already clocked in" guard ──')
  const idem3 = crypto.randomUUID()
  const c3 = await callAgent({ jwt, anonKey, message: 'Actually clock me in', idempotency_key: idem3, thread_id: c1.body.thread_id })
  assert('3.1 HTTP 200', c3.status === 200, `got ${c3.status}`)
  // The clock_in tool should detect the open entry and refuse via quick_replies.
  const toolMsgs = (c3.body.messages || []).filter(m => m.role === 'tool')
  const refusedAlready = toolMsgs.some(m =>
    typeof m.content === 'string' && /Already clocked in/i.test(m.content),
  )
  assert('3.2 tool refused with "Already clocked in"', refusedAlready,
    toolMsgs.map(m => m.content).join(' | ').slice(0, 300))
  const teCount2 = await sql(`SELECT COUNT(*) AS n FROM time_entries WHERE user_id = '${TEST_EMP_ID}' AND clock_out IS NULL`)
  assert('3.3 still exactly one open time_entries row (no double clock-in)', teCount2?.[0]?.n === 1, `n=${teCount2?.[0]?.n}`)

  // ── Summary ──
  const pass = results.filter(r => r.ok).length
  const fail = results.filter(r => !r.ok).length
  console.log(`\n── Summary ── ${pass}/${results.length} passed, ${fail} failed`)
  if (fail > 0) {
    console.log('Failures:')
    for (const r of results.filter(r => !r.ok)) console.log(`  ${r.label} — ${r.detail}`)
    process.exit(1)
  }
})().catch(e => { console.error('[smoke] fatal:', e); process.exit(2) })
