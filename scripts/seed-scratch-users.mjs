#!/usr/bin/env node
// Seed three personas (admin, employee, client) + a project in scratch for Playwright E2E.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const COMPANY_ID = process.env.SUPABASE_COMPANY_ID // seed company already exists

const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const PERSONAS = [
  { email: 'e2e-admin@akr-test.local', password: 'TestAdminPw!2026', role: 'admin', full_name: 'E2E Admin' },
  { email: 'e2e-employee@akr-test.local', password: 'TestEmpPw!2026', role: 'employee', full_name: 'E2E Employee' },
  { email: 'e2e-client@akr-test.local', password: 'TestClientPw!2026', role: 'client', full_name: 'E2E Client' },
]

async function ensureUser(p) {
  // Check if exists
  const { data: list } = await sb.auth.admin.listUsers()
  const existing = list.users.find(u => u.email === p.email)
  let userId = existing?.id
  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
      user_metadata: { full_name: p.full_name },
    })
    if (error) throw new Error(`createUser ${p.email}: ${error.message}`)
    userId = data.user.id
  } else {
    // Reset password to known value
    await sb.auth.admin.updateUserById(userId, { password: p.password, email_confirm: true })
  }
  // Upsert profile — mark all onboarding flags complete so the app routes
  // straight to the role home after login, not to an onboarding wizard.
  const { error: pErr } = await sb.from('profiles').upsert(
    {
      id: userId,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      company_id: COMPANY_ID,
      is_active: true,
      platform_onboarding_complete: true,
      company_onboarding_complete: true,
      field_onboarding_complete: true,
    },
    { onConflict: 'id' }
  )
  // Also mark the seed company onboarding_complete so the company-level check passes.
  await sb.from('companies').update({ onboarding_complete: true }).eq('id', COMPANY_ID).then(() => {})
  if (pErr) throw new Error(`upsert profile ${p.email}: ${pErr.message}`)
  console.log(`✅ ${p.role.padEnd(10)} ${p.email} → ${userId}`)
  return userId
}

async function ensureProject(adminId) {
  // Ensure there's at least one project tied to the company
  const { data: existing } = await sb.from('projects').select('id, title').eq('company_id', COMPANY_ID).limit(1).maybeSingle()
  if (existing) {
    console.log(`✅ project already exists: ${existing.title} (${existing.id})`)
    return existing.id
  }
  const { data, error } = await sb.from('projects').insert({
    title: 'E2E Seed Project',
    client_name: 'E2E Seed Client',
    project_type: 'other',
    address: '123 Test St',
    status: 'active',
    company_id: COMPANY_ID,
  }).select('id').single()
  if (error) throw new Error(`create project: ${error.message}`)
  console.log(`✅ project created: E2E Seed Project (${data.id})`)
  return data.id
}

const adminId = await ensureUser(PERSONAS[0])
await ensureUser(PERSONAS[1])
await ensureUser(PERSONAS[2])
await ensureProject(adminId)

console.log('\nSeed complete. Credentials (for storage-state generation):')
for (const p of PERSONAS) {
  console.log(`  ${p.role}: ${p.email} / ${p.password}`)
}
