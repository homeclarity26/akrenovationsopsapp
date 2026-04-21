#!/usr/bin/env node
/**
 * smoke-ai-v2-tools.mjs — exercises each Phase 1 employee tool via
 * agent-tool-call. Each call goes through the full chat round-trip
 * (Claude tool-use → dispatcher → DB write → audit log → ai_messages).
 *
 * Strategy: fire 12 natural-language asks, verify the corresponding
 * row landed in its target table. Cleans state between tools so each
 * tool's expected side effect is isolated.
 *
 *   node scripts/smoke-ai-v2-tools.mjs
 */

import fs from 'node:fs'

const SUPABASE_URL = 'https://mebzqfeeiciayxdetteb.supabase.co'
const PAT = fs.readFileSync('/Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md', 'utf-8').match(/sbp_[a-zA-Z0-9]{40,}/)[0]
const TEST_EMP_EMAIL = 'test.employee@ak-renovations.test'
const TEST_EMP_ID = '3b3e5b36-209c-4dda-a67b-debb6b28d5c9'
const PROJECT_ID = 'c4667c34-87ac-47f5-b682-155fff3e93f3'

async function srKey() {
  return (await (await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'Mozilla/5.0' } })).json()).find(k => k.name === 'service_role' && k.type === 'legacy').api_key
}
async function anonKey() {
  return (await (await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'Mozilla/5.0' } })).json()).find(k => k.name === 'anon' && k.type === 'legacy').api_key
}
async function getJwt(sr) {
  const link = (await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: { apikey: sr, Authorization: `Bearer ${sr}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', email: TEST_EMP_EMAIL }) })).json()).action_link
  const res = await fetch(link, { redirect: 'manual' })
  return decodeURIComponent((res.headers.get('location') || '').match(/access_token=([^&]+)/)[1])
}
async function sql(query) {
  return (await (await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: JSON.stringify({ query }) })).json())
}

const results = []
function ok(label, cond, detail = '') {
  results.push({ label, ok: !!cond, detail })
  console.log(`${cond ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${detail ? ' — ' + detail : ''}`)
}

async function call({ jwt, anon, message, idem, thread = null }) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/agent-tool-call`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id: thread, message, idempotency_key: idem, context: { pathname: '/employee' } }),
  })
  const text = await r.text()
  let body; try { body = JSON.parse(text) } catch { body = { raw: text } }
  return { status: r.status, body }
}
function lastTool(body) {
  return [...(body.messages || [])].reverse().find(m => m.role === 'tool')
}

;(async () => {
  console.log('[smoke] booting')
  const sr = await srKey(); const anon = await anonKey()
  // Reset state
  await sql(`DELETE FROM time_entries WHERE user_id = '${TEST_EMP_ID}'`)
  await sql(`DELETE FROM daily_logs WHERE employee_id = '${TEST_EMP_ID}'`)
  await sql(`DELETE FROM project_photos WHERE uploaded_by = '${TEST_EMP_ID}' AND caption LIKE 'aiv2-smoke%'`)
  await sql(`DELETE FROM shopping_list_items WHERE added_by = '${TEST_EMP_ID}'`)
  await sql(`DELETE FROM change_orders WHERE flagged_by = '${TEST_EMP_ID}'`)
  await sql(`DELETE FROM tool_requests WHERE requested_by = '${TEST_EMP_ID}'`)
  await sql(`DELETE FROM messages WHERE sender_id = '${TEST_EMP_ID}'`)
  await sql(`DELETE FROM expenses WHERE entered_by = '${TEST_EMP_ID}'`)
  await sql(`DELETE FROM ai_messages WHERE thread_id IN (SELECT id FROM ai_threads WHERE user_id = '${TEST_EMP_ID}')`)
  await sql(`DELETE FROM ai_tool_calls WHERE user_id = '${TEST_EMP_ID}'`)
  await sql(`DELETE FROM ai_threads WHERE user_id = '${TEST_EMP_ID}'`)
  console.log('[smoke] state reset')

  const jwt = await getJwt(sr)
  let thread = null

  // 1. clock_in
  console.log('\n── clock_in ──')
  let r = await call({ jwt, anon, message: 'Clock me in to Overnight Test Project', idem: crypto.randomUUID() })
  thread = r.body.thread_id
  ok('clock_in HTTP 200', r.status === 200, `status=${r.status}`)
  const open = await sql(`SELECT id FROM time_entries WHERE user_id = '${TEST_EMP_ID}' AND clock_out IS NULL`)
  ok('clock_in inserted open time_entry', Array.isArray(open) && open.length === 1)

  // 2. clock_out
  console.log('\n── clock_out ──')
  r = await call({ jwt, anon, message: 'Clock me out', idem: crypto.randomUUID(), thread })
  ok('clock_out HTTP 200', r.status === 200)
  const closed = await sql(`SELECT clock_out FROM time_entries WHERE user_id = '${TEST_EMP_ID}' ORDER BY clock_in DESC LIMIT 1`)
  ok('clock_out closed the entry', closed?.[0]?.clock_out !== null, JSON.stringify(closed?.[0]))

  // 3. add_daily_log
  console.log('\n── add_daily_log ──')
  r = await call({ jwt, anon, message: 'Save a daily log for Overnight Test Project: framed the south wall today, no issues, sunny 65', idem: crypto.randomUUID(), thread })
  ok('add_daily_log HTTP 200', r.status === 200)
  const dl = await sql(`SELECT id, summary FROM daily_logs WHERE employee_id = '${TEST_EMP_ID}'`)
  ok('add_daily_log row exists', Array.isArray(dl) && dl.length >= 1, dl?.[0]?.summary?.slice(0, 60))

  // 4. add_shopping_item
  console.log('\n── add_shopping_item ──')
  r = await call({ jwt, anon, message: 'Add a box of 3 inch deck screws to the shopping list for Overnight Test Project', idem: crypto.randomUUID(), thread })
  ok('add_shopping_item HTTP 200', r.status === 200)
  const sli = await sql(`SELECT item_name FROM shopping_list_items WHERE added_by = '${TEST_EMP_ID}'`)
  ok('shopping item inserted', Array.isArray(sli) && sli.length >= 1, sli?.[0]?.item_name)

  // 5. check_shopping_list
  console.log('\n── check_shopping_list ──')
  r = await call({ jwt, anon, message: 'What is on the shopping list?', idem: crypto.randomUUID(), thread })
  ok('check_shopping_list HTTP 200', r.status === 200)
  const sl = lastTool(r.body)
  ok('check_shopping_list returned items', sl && /shopping/i.test(sl.content || ''), sl?.content?.slice(0, 100))

  // 6. flag_change_order
  console.log('\n── flag_change_order ──')
  r = await call({ jwt, anon, message: 'Flag a change for Overnight Test Project: client wants a recessed light over the kitchen sink', idem: crypto.randomUUID(), thread })
  ok('flag_change_order HTTP 200', r.status === 200)
  const co = await sql(`SELECT title FROM change_orders WHERE flagged_by = '${TEST_EMP_ID}'`)
  ok('change_order flagged', Array.isArray(co) && co.length >= 1, co?.[0]?.title?.slice(0, 60))

  // 7. add_tool_request
  console.log('\n── add_tool_request ──')
  r = await call({ jwt, anon, message: 'Request a 12-foot extension ladder, normal urgency', idem: crypto.randomUUID(), thread })
  ok('add_tool_request HTTP 200', r.status === 200)
  const tr = await sql(`SELECT tool_name FROM tool_requests WHERE requested_by = '${TEST_EMP_ID}'`)
  ok('tool_request inserted', Array.isArray(tr) && tr.length >= 1, tr?.[0]?.tool_name)

  // 8. my_schedule
  console.log('\n── my_schedule ──')
  r = await call({ jwt, anon, message: "What's on my schedule this week?", idem: crypto.randomUUID(), thread })
  ok('my_schedule HTTP 200', r.status === 200)
  const sch = lastTool(r.body)
  ok('my_schedule returned content', sch && (sch.content || '').length > 5, sch?.content?.slice(0, 100))

  // 9. message_admin
  console.log('\n── message_admin ──')
  r = await call({ jwt, anon, message: 'Tell the admin: I will be 30 minutes late tomorrow', idem: crypto.randomUUID(), thread })
  ok('message_admin HTTP 200', r.status === 200)
  const msg = await sql(`SELECT message FROM messages WHERE sender_id = '${TEST_EMP_ID}'`)
  ok('message inserted', Array.isArray(msg) && msg.some(m => /late/i.test(m.message)), JSON.stringify(msg?.map(m => m.message)?.slice(0, 2)))

  // 10. submit_receipt (voice/text mode)
  console.log('\n── submit_receipt (voice) ──')
  r = await call({ jwt, anon, message: 'Add a $42.18 Home Depot receipt for materials on Overnight Test Project, dated today', idem: crypto.randomUUID(), thread })
  ok('submit_receipt HTTP 200', r.status === 200)
  const exp = await sql(`SELECT amount, vendor FROM expenses WHERE entered_by = '${TEST_EMP_ID}'`)
  ok('expense inserted', Array.isArray(exp) && exp.length >= 1, JSON.stringify(exp?.[0]))

  // 11. take_photo (skipped — needs upload, validated via UI flow in real testing)
  console.log('\n── take_photo (server-side schema-only check) ──')
  // Just verify schema accepts our pre-uploaded URL pattern.
  r = await call({ jwt, anon, message: 'Save this photo to Overnight Test Project: https://example.com/test.jpg', idem: crypto.randomUUID(), thread })
  ok('take_photo HTTP 200', r.status === 200)
  const ph = await sql(`SELECT id FROM project_photos WHERE uploaded_by = '${TEST_EMP_ID}'`)
  ok('photo row inserted', Array.isArray(ph) && ph.length >= 1)

  // 12. mark_checklist_item — skipped because there's no test checklist instance.
  //     Validated separately when Adam sets up a real checklist template.
  console.log('\n── mark_checklist_item: SKIP (needs a real checklist instance) ──')

  // Cost summary
  const usage = await sql(`SELECT SUM(cost_usd) AS total, COUNT(*) AS n FROM ai_usage_ledger WHERE user_id = '${TEST_EMP_ID}' AND created_at > now() - INTERVAL '10 minutes'`)
  console.log(`\n[smoke] AI cost this run: $${Number(usage?.[0]?.total || 0).toFixed(4)} across ${usage?.[0]?.n} calls`)

  const pass = results.filter(r => r.ok).length
  const fail = results.filter(r => !r.ok).length
  console.log(`\n── Summary ── ${pass}/${results.length} passed, ${fail} failed`)
  if (fail > 0) {
    console.log('Failures:')
    for (const r of results.filter(r => !r.ok)) console.log(`  ${r.label} — ${r.detail}`)
    process.exit(1)
  }
})().catch(e => { console.error('[smoke] fatal:', e); process.exit(2) })
