#!/usr/bin/env node
/**
 * Provision a SECOND tenant in scratch so we can write cross-company RLS tests.
 *
 * Creates:
 *   - Company "Rival Renovations" (id stored in the output)
 *   - Admin e2e-admin-rival@akr-test.local
 *   - Employee e2e-emp-rival@akr-test.local
 *   - Client e2e-client-rival@akr-test.local
 *   - One project owned by Rival Renovations
 *
 * Idempotent — safe to re-run.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')

const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const RIVAL_NAME = 'Rival Renovations'

async function ensureCompany() {
  const { data: existing } = await sb.from('companies').select('id').eq('name', RIVAL_NAME).maybeSingle()
  if (existing) { console.log(`✅ company ${RIVAL_NAME} → ${existing.id}`); return existing.id }
  const { data, error } = await sb.from('companies').insert({ name: RIVAL_NAME, onboarding_complete: true }).select('id').single()
  if (error) throw new Error(error.message)
  console.log(`✅ created company ${RIVAL_NAME} → ${data.id}`)
  return data.id
}

const PERSONAS = [
  { email: 'e2e-admin-rival@akr-test.local',  password: 'RivalAdminPw!2026',  role: 'admin',    full_name: 'E2E Rival Admin' },
  { email: 'e2e-emp-rival@akr-test.local',    password: 'RivalEmpPw!2026',    role: 'employee', full_name: 'E2E Rival Employee' },
  { email: 'e2e-client-rival@akr-test.local', password: 'RivalClientPw!2026', role: 'client',   full_name: 'E2E Rival Client' },
]

async function ensureUser(p, companyId) {
  const { data: list } = await sb.auth.admin.listUsers()
  const existing = list.users.find(u => u.email === p.email)
  let userId = existing?.id
  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({ email: p.email, password: p.password, email_confirm: true, user_metadata: { full_name: p.full_name } })
    if (error) throw new Error(error.message)
    userId = data.user.id
  } else {
    await sb.auth.admin.updateUserById(userId, { password: p.password, email_confirm: true })
  }
  const { error: pErr } = await sb.from('profiles').upsert({
    id: userId, email: p.email, full_name: p.full_name, role: p.role,
    company_id: companyId, is_active: true,
    platform_onboarding_complete: true, company_onboarding_complete: true, field_onboarding_complete: true,
  }, { onConflict: 'id' })
  if (pErr) throw new Error(pErr.message)
  console.log(`✅ ${p.role.padEnd(10)} ${p.email} → ${userId}`)
  return userId
}

async function ensureProject(companyId) {
  const { data: existing } = await sb.from('projects').select('id, title').eq('company_id', companyId).limit(1).maybeSingle()
  if (existing) { console.log(`✅ project exists: ${existing.title} (${existing.id})`); return existing.id }
  const { data, error } = await sb.from('projects').insert({
    title: 'Rival Seed Project', client_name: 'Rival Client', project_type: 'other',
    address: '999 Rival Ave', status: 'active', company_id: companyId,
  }).select('id').single()
  if (error) throw new Error(error.message)
  console.log(`✅ project created: ${data.id}`)
  return data.id
}

const companyId = await ensureCompany()
for (const p of PERSONAS) await ensureUser(p, companyId)
const projectId = await ensureProject(companyId)

console.log('\nSeed complete:')
console.log(`  Company: ${RIVAL_NAME} (${companyId})`)
console.log(`  Project: Rival Seed Project (${projectId})`)
for (const p of PERSONAS) console.log(`  ${p.role}: ${p.email} / ${p.password}`)
console.log(`\nGOLDEN_COMPANY_ID_RIVAL=${companyId}`)
console.log(`RIVAL_PROJECT_ID=${projectId}`)
