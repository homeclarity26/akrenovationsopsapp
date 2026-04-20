#!/usr/bin/env node
/**
 * provision-employee.mjs — one-shot CLI to create an employee account,
 * link them to AK Renovations, optionally assign them to a project, and
 * print a magic-link they can open on their phone.
 *
 * Usage:
 *   node scripts/provision-employee.mjs <email> "<Full Name>" [phone] [hourly_rate] [project_id]
 *
 * Example:
 *   node scripts/provision-employee.mjs jane@example.com "Jane Smith" 3305550123 42
 *
 * Output: a link you can paste into iMessage / Text app. Link is single-use.
 * If you need a second link later, just run again.
 *
 * Requires the Supabase PAT already on disk (same file the WebKit sweep reads).
 */

import fs from 'node:fs'

const SUPABASE_URL = 'https://mebzqfeeiciayxdetteb.supabase.co'
const COMPANY_ID = '1e62cd50-c5a5-447d-a981-a47829c634e6' // AK Renovations
const MEMORY = '/Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md'
const PAT = fs.readFileSync(MEMORY, 'utf-8').match(/sbp_[a-zA-Z0-9]{40,}/)?.[0]
if (!PAT) { console.error('No Supabase PAT found in', MEMORY); process.exit(2) }

const [, , email, fullName, phone, hourlyRateRaw, projectId] = process.argv
if (!email || !fullName) {
  console.error('Usage: node scripts/provision-employee.mjs <email> "<Full Name>" [phone] [hourly_rate] [project_id]')
  console.error('Example: node scripts/provision-employee.mjs jane@example.com "Jane Smith" 3305550123 42')
  process.exit(1)
}

const normalized = email.trim().toLowerCase()

async function sr() {
  return (await (await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'Mozilla/5.0' },
  })).json()).find(k => k.name === 'service_role' && k.type === 'legacy').api_key
}

async function sqlQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ query }),
  })
  return res.json()
}

;(async () => {
  const srKey = await sr()

  // 1. Check if a user with this email already exists (both auth and profile)
  console.log(`[provision] looking up existing account for ${normalized} …`)
  const existing = await sqlQuery(
    `SELECT id, role, company_id FROM profiles WHERE email = '${normalized.replace(/'/g, "''")}' LIMIT 1`,
  )
  let userId = existing?.[0]?.id ?? null

  // 2. If not found, create the auth user
  if (!userId) {
    console.log('[provision] creating auth user …')
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: srKey, Authorization: `Bearer ${srKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalized,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }),
    })
    const body = await res.json()
    if (!body?.id) {
      console.error('[provision] failed to create auth user:', body)
      process.exit(3)
    }
    userId = body.id
    console.log(`[provision] auth user created: ${userId}`)
  } else {
    console.log(`[provision] existing account found: ${userId} (role=${existing[0].role})`)
  }

  // 3. Upsert the profile as an employee linked to AK Renovations
  const hourlyRate = hourlyRateRaw ? parseFloat(hourlyRateRaw) : null
  const phoneClean = phone ? phone.replace(/'/g, '') : null
  const profileSql = `
    INSERT INTO profiles (id, email, role, full_name, company_id, ${phoneClean ? 'phone,' : ''} ${hourlyRate ? 'hourly_rate,' : ''} platform_onboarding_complete, company_onboarding_complete, field_onboarding_complete, is_active)
    VALUES ('${userId}', '${normalized}', 'employee', '${fullName.replace(/'/g, "''")}', '${COMPANY_ID}', ${phoneClean ? `'${phoneClean}',` : ''} ${hourlyRate ? `${hourlyRate},` : ''} true, true, false, true)
    ON CONFLICT (id) DO UPDATE SET
      role='employee',
      company_id='${COMPANY_ID}',
      full_name='${fullName.replace(/'/g, "''")}'
      ${phoneClean ? `, phone='${phoneClean}'` : ''}
      ${hourlyRate ? `, hourly_rate=${hourlyRate}` : ''}
    RETURNING id, role, full_name, email, company_id, hourly_rate;
  `
  const profileRes = await sqlQuery(profileSql)
  if (Array.isArray(profileRes)) {
    console.log('[provision] profile:', profileRes[0])
  } else {
    console.error('[provision] profile upsert error:', profileRes)
    process.exit(4)
  }

  // 4. Optional project assignment
  if (projectId) {
    console.log(`[provision] assigning to project ${projectId} …`)
    const assignRes = await sqlQuery(
      `INSERT INTO project_assignments (project_id, employee_id, role, active)
       VALUES ('${projectId}', '${userId}', 'worker', true)
       ON CONFLICT DO NOTHING
       RETURNING id, project_id, employee_id;`,
    )
    console.log('[provision] assignment:', assignRes)
  }

  // 5. Generate a magic link. redirect_to=/employee so the first login lands
  //    in Field mode (the rest of the app bounces there anyway for the
  //    employee role).
  console.log('[provision] generating magic link …')
  const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: srKey, Authorization: `Bearer ${srKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'magiclink',
      email: normalized,
      options: { redirect_to: 'https://akrenovationsopsapp.vercel.app/employee' },
    }),
  })
  const linkBody = await linkRes.json()
  const link = linkBody?.action_link
  if (!link) {
    console.error('[provision] failed to generate magic link:', linkBody)
    process.exit(5)
  }

  console.log('\n───────────────────────────────────────────────────────────────')
  console.log(`  Magic link for ${fullName} (${normalized})`)
  console.log('───────────────────────────────────────────────────────────────')
  console.log(`\n  ${link}\n`)
  console.log('───────────────────────────────────────────────────────────────')
  console.log('  Copy and paste the link above into iMessage / Text and send')
  console.log('  to the employee. They open it on their iPhone and they\'re in.')
  console.log('  Single-use; re-run this script if the link expires.')
  console.log('───────────────────────────────────────────────────────────────')
})().catch(e => { console.error(e); process.exit(6) })
