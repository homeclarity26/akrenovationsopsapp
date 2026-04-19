#!/usr/bin/env node
// Deep debug for a specific route in WebKit.
// Captures all console output + network activity for 15s, then dumps them.
// Usage: node scripts/webkit-debug-route.mjs /employee/shopping

import { webkit } from 'playwright'
import fs from 'node:fs'

const ROUTE = process.argv[2] ?? '/employee/shopping'
const APP = 'https://akrenovationsopsapp.vercel.app'
const MEMORY = '/Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md'
const PAT = fs.readFileSync(MEMORY, 'utf-8').match(/sbp_[a-zA-Z0-9]{40,}/)?.[0]

async function magicLink() {
  const keys = await (await fetch('https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true', {
    headers: { Authorization: `Bearer ${PAT}` },
  })).json()
  const sr = keys.find(k => k.name === 'service_role' && k.type === 'legacy').api_key
  return (await (await fetch('https://mebzqfeeiciayxdetteb.supabase.co/auth/v1/admin/generate_link', {
    method: 'POST',
    headers: { apikey: sr, Authorization: `Bearer ${sr}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: 'akrenovations01@gmail.com' }),
  })).json()).action_link
}

(async () => {
  const browser = await webkit.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()
  const logs = []
  const netFails = []
  const netPending = new Map()

  page.on('console', m => logs.push(`[console.${m.type()}] ${m.text().slice(0, 300)}`))
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
  page.on('request', r => {
    if (r.url().includes('supabase.co') || r.url().includes('vercel.app')) {
      netPending.set(r.url() + '|' + r.method(), { url: r.url(), method: r.method(), started: Date.now() })
    }
  })
  page.on('response', r => {
    const key = r.url() + '|' + r.request().method()
    netPending.delete(key)
    if (r.status() >= 400 && (r.url().includes('supabase.co') || r.url().includes('vercel.app'))) {
      netFails.push(`[net ${r.status()}] ${r.request().method()} ${r.url().slice(0, 160)}`)
    }
  })

  console.log('[debug] logging in …')
  await page.goto(await magicLink(), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  console.log('[debug] post-login url =', page.url())

  console.log(`[debug] navigating to ${ROUTE} …`)
  await page.goto(APP + ROUTE, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(e => logs.push(`[goto] ${e.message}`))

  await page.waitForTimeout(15_000)

  // Probe DOM state
  const state = await page.evaluate(() => {
    const errH2 = Array.from(document.querySelectorAll('h2')).find(h => /Something went wrong/i.test(h.textContent ?? ''))
    const skelCount = document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]').length
    const visibleText = document.body.innerText.slice(0, 800)
    return { errorBoundaryHit: !!errH2, skelCount, visibleText }
  })

  await browser.close()

  console.log('\n── DOM state ──')
  console.log(JSON.stringify(state, null, 2))

  console.log('\n── Pending network (never resolved) ──')
  for (const [, v] of netPending) {
    console.log(`  [pending ${(Date.now() - v.started) / 1000}s] ${v.method} ${v.url.slice(0, 160)}`)
  }

  console.log('\n── Network failures ──')
  for (const l of netFails) console.log(l)

  console.log('\n── Console ──')
  for (const l of logs.slice(-80)) console.log(l)
})().catch(e => { console.error('fatal', e); process.exit(1) })
