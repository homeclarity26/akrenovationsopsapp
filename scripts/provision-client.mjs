#!/usr/bin/env node
/**
 * provision-client.mjs — one-shot CLI to create a client (homeowner)
 * account, link them to a specific project via projects.client_user_id,
 * and print a magic link they can open on their phone to land on
 * /client/progress.
 *
 * Usage:
 *   node scripts/provision-client.mjs <email> "<Full Name>" <project_id> [phone]
 *
 * Example:
 *   node scripts/provision-client.mjs jane.homeowner@example.com \
 *     "Jane Homeowner" c4667c34-87ac-47f5-b682-155fff3e93f3 3305550123
 *
 * The magic link works once — re-run if it expires before the client
 * opens it. Email delivery via Resend is best-effort; the link is
 * always printed in stdout regardless, so you can text or iMessage it.
 */

import fs from 'node:fs'

const SUPABASE_URL = 'https://mebzqfeeiciayxdetteb.supabase.co'
const COMPANY_ID = '1e62cd50-c5a5-447d-a981-a47829c634e6' // AK Renovations
const MEMORY = '/Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md'
const PAT = fs.readFileSync(MEMORY, 'utf-8').match(/sbp_[a-zA-Z0-9]{40,}/)?.[0]
if (!PAT) { console.error('No Supabase PAT found in', MEMORY); process.exit(2) }

const [, , email, fullName, projectId, phone] = process.argv
if (!email || !fullName || !projectId) {
  console.error('Usage: node scripts/provision-client.mjs <email> "<Full Name>" <project_id> [phone]')
  console.error('Find project_id: node -e "require(\\\'fs\\\').readdirSync(\\\'/tmp\\\')" or check /admin/projects in the app')
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

  // Sanity-check the project exists + belongs to AK Renovations
  const projectRows = await sqlQuery(
    `SELECT id, title, company_id, client_user_id, client_name FROM projects WHERE id = '${projectId}' LIMIT 1`,
  )
  if (!Array.isArray(projectRows) || projectRows.length === 0) {
    console.error(`[provision] project ${projectId} not found`)
    process.exit(3)
  }
  const project = projectRows[0]
  if (project.company_id !== COMPANY_ID) {
    console.error(`[provision] project belongs to another company (${project.company_id})`)
    process.exit(3)
  }
  console.log(`[provision] project: "${project.title}"`)
  if (project.client_user_id) {
    console.log(`[provision] WARNING: project already has a linked client (${project.client_user_id}). Replacing with ${normalized}.`)
  }

  // Look up existing profile by email
  const existing = await sqlQuery(
    `SELECT id, role, company_id FROM profiles WHERE email = '${normalized.replace(/'/g, "''")}' LIMIT 1`,
  )
  let userId = existing?.[0]?.id ?? null

  // Create auth user if new
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
      process.exit(4)
    }
    userId = body.id
    console.log(`[provision] auth user created: ${userId}`)
  } else {
    console.log(`[provision] existing account: ${userId} (role=${existing[0].role})`)
  }

  // Upsert the profile as a client
  const phoneClean = phone ? phone.replace(/'/g, '') : null
  const profileSql = `
    INSERT INTO profiles (id, email, role, full_name, company_id, ${phoneClean ? 'phone,' : ''} platform_onboarding_complete, company_onboarding_complete, field_onboarding_complete, is_active)
    VALUES ('${userId}', '${normalized}', 'client', '${fullName.replace(/'/g, "''")}', '${COMPANY_ID}', ${phoneClean ? `'${phoneClean}',` : ''} true, true, true, true)
    ON CONFLICT (id) DO UPDATE SET
      role='client',
      company_id='${COMPANY_ID}',
      full_name='${fullName.replace(/'/g, "''")}'
      ${phoneClean ? `, phone='${phoneClean}'` : ''}
    RETURNING id, role, full_name, email;
  `
  const profileRes = await sqlQuery(profileSql)
  if (!Array.isArray(profileRes)) {
    console.error('[provision] profile upsert error:', profileRes)
    process.exit(5)
  }

  // Link the project to this client
  console.log(`[provision] linking project.client_user_id → ${userId} …`)
  const linkRes = await sqlQuery(`
    UPDATE projects
    SET client_user_id = '${userId}',
        client_email = '${normalized}',
        client_name = COALESCE(client_name, '${fullName.replace(/'/g, "''")}')
    WHERE id = '${projectId}'
    RETURNING id, title, client_user_id, client_email, client_name;
  `)
  if (!Array.isArray(linkRes)) {
    console.error('[provision] project link error:', linkRes)
    process.exit(6)
  }

  // Generate magic link pointing at /client/progress
  console.log('[provision] generating magic link …')
  const mlRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: srKey, Authorization: `Bearer ${srKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'magiclink',
      email: normalized,
      options: { redirect_to: 'https://akrenovationsopsapp.vercel.app/client/progress' },
    }),
  })
  const mlBody = await mlRes.json()
  const link = mlBody?.action_link
  if (!link) {
    console.error('[provision] failed to generate magic link:', mlBody)
    process.exit(7)
  }

  console.log('\n───────────────────────────────────────────────────────────────')
  console.log(`  Magic link for ${fullName} (${normalized})`)
  console.log(`  Project: ${project.title}`)
  console.log('───────────────────────────────────────────────────────────────')
  console.log(`\n  ${link}\n`)
  console.log('───────────────────────────────────────────────────────────────')
  console.log('  Copy and paste into iMessage / Text. They open it on their')
  console.log('  iPhone and land on their project progress page.')
  console.log('  Single-use; re-run if it expires before they click.')
  console.log('───────────────────────────────────────────────────────────────')
})().catch(e => { console.error(e); process.exit(8) })
