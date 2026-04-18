#!/usr/bin/env node
/**
 * Synthetic-insert smoke script for the AK Renovations schema.
 *
 * For every table, attempts an INSERT with UI-realistic values that satisfy
 * every known NOT NULL + CHECK constraint. Reports success/failure per table.
 *
 * Targets the scratch project by default (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Never cleans up — run against scratch only.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/smoke-inserts.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

// Realistic seed values for tables with NOT NULL constraints.
// Each entry: { table, row } → the minimal row that should pass.
// A company_id is always made up since scratch DB is empty.
const COMPANY_ID = randomUUID()
const PROJECT_ID = randomUUID()
const USER_ID = randomUUID()

// Seed parent rows first so FKs resolve.
const PARENTS = [
  { table: 'companies', row: { id: COMPANY_ID, name: 'Smoke Co' } },
  // profiles has id FK to auth.users which doesn't exist in scratch;
  // skipping profiles — will cause any downstream child row to fail loudly.
  { table: 'projects', row: {
    id: PROJECT_ID,
    company_id: COMPANY_ID,
    title: 'Smoke Project',
    project_type: 'other',
    client_name: 'Smoke Client',
    address: '123 Smoke St',
    status: 'pending',
  } },
]

// Every child write path that was fixed in Pass 1 — make sure each inserts cleanly.
const CHILDREN = [
  { table: 'tool_requests', row: {
    project_id: PROJECT_ID,
    requested_by: USER_ID,
    tool_name: 'Impact driver',
    notes: 'For the bath',
    urgency: 'normal',
    needed_by: new Date().toISOString().slice(0, 10),
    status: 'pending',
  } },
  { table: 'messages', row: {
    project_id: PROJECT_ID,
    sender_id: USER_ID,
    message: 'hello',
    channel: 'in_app',
  } },
  { table: 'time_entries', row: {
    user_id: USER_ID,
    project_id: PROJECT_ID,
    work_type: 'framing',
    clock_in: new Date().toISOString(),
    entry_method: 'live',
  } },
  { table: 'suppliers', row: {
    company_name: 'Smoke Supplies',
    primary_contact_name: 'J. Smoke',
    contact_name: 'J. Smoke',
    category: 'misc',
  } },
  { table: 'proposals', row: {
    title: 'Smoke Proposal',
    client_name: 'Smoke Client',
    project_type: 'kitchen',
    sections: [],
    status: 'draft',
  } },
  { table: 'inspection_reports', row: {
    project_id: PROJECT_ID,
    inspection_type: 'final',
    areas: [],
  } },
]

async function insert({ table, row }) {
  const { error } = await sb.from(table).insert(row)
  if (error) {
    return { table, ok: false, msg: error.message, code: error.code }
  }
  return { table, ok: true }
}

async function main() {
  const results = []
  for (const p of PARENTS) results.push(await insert(p))
  for (const c of CHILDREN) results.push(await insert(c))

  let ok = 0, fail = 0
  for (const r of results) {
    if (r.ok) { ok++; console.log(`✅ ${r.table}`) }
    else { fail++; console.log(`❌ ${r.table} — ${r.code}: ${r.msg}`) }
  }
  console.log(`\n${ok} ok, ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(2) })
