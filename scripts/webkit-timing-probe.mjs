#!/usr/bin/env node
// One-shot probe: how long does it take from navigation to first interactive
// state on the login page, and on /admin after login? Captures network + console.

import { webkit } from 'playwright'
import fs from 'node:fs'

const APP = 'https://akrenovationsopsapp.vercel.app'
const SUPABASE_URL = 'https://mebzqfeeiciayxdetteb.supabase.co'
const PAT = fs.readFileSync('/Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md', 'utf-8').match(/sbp_[a-zA-Z0-9]{40,}/)[0]

async function sr() {
  return (await (await fetch(`https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${PAT}`, 'User-Agent': 'Mozilla/5.0' },
  })).json()).find(k => k.name === 'service_role' && k.type === 'legacy').api_key
}

async function magicLink(email, srKey) {
  return (await (await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: srKey, Authorization: `Bearer ${srKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })).json()).action_link
}

;(async () => {
  const srKey = await sr()
  const browser = await webkit.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()

  const netLog = []
  page.on('response', r => {
    const u = r.url()
    const t = Date.now()
    netLog.push({ t, status: r.status(), url: u.length > 100 ? u.slice(0, 100) + '…' : u })
  })
  const consoleErrors = []
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 280)) })
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`))

  // ── Cold load /login ─────────────────────────────────────
  console.log('\n── COLD LOAD /login ──')
  const t0 = Date.now()
  await page.goto(APP + '/login', { waitUntil: 'networkidle', timeout: 45_000 })
  const tLogin = Date.now() - t0
  console.log(`  networkidle reached in ${tLogin}ms`)
  const domReady = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd)
  const loadComplete = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.loadEventEnd)
  console.log(`  domContentLoaded: ${domReady?.toFixed(0)}ms`)
  console.log(`  loadComplete:    ${loadComplete?.toFixed(0)}ms`)

  // What resources took the longest?
  const resources = await page.evaluate(() => {
    return performance.getEntriesByType('resource')
      .map(r => ({ name: r.name, duration: r.duration, transferSize: r.transferSize }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(r => ({ ...r, name: r.name.length > 90 ? '…' + r.name.slice(-87) : r.name }))
  })
  console.log(`\n  slowest 10 resources:`)
  resources.forEach(r => console.log(`    ${r.duration.toFixed(0).padStart(6)}ms  ${(r.transferSize/1024).toFixed(1).padStart(6)}kB  ${r.name}`))

  // ── Navigate via magic link + /admin time-to-content ─────
  console.log('\n── LOGIN + /admin TIME TO CONTENT ──')
  const link = await magicLink('akrenovations01@gmail.com', srKey)
  const t1 = Date.now()
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  const tDom = Date.now() - t1
  console.log(`  domcontentloaded after magic link in ${tDom}ms, url = ${page.url()}`)

  // Wait until page has meaningful content
  const waitStart = Date.now()
  let bodyLen = 0
  let hasLoadingSpinner = true
  let waited = 0
  while (waited < 20_000) {
    bodyLen = await page.evaluate(() => document.body.innerText.length)
    hasLoadingSpinner = await page.evaluate(() => /^\s*$/.test(document.body.innerText.trim()))
    if (bodyLen > 200 && !hasLoadingSpinner) break
    await page.waitForTimeout(250)
    waited = Date.now() - waitStart
  }
  console.log(`  first meaningful content: ${waited}ms (bodyLen=${bodyLen})`)

  // Network requests after login that took > 500ms
  const slowNet = netLog.filter(x => x.t > t1).slice(-30)
  console.log(`\n  post-login network (last 30):`)
  const now = Date.now()
  slowNet.forEach(x => console.log(`    +${(x.t-t1).toString().padStart(5)}ms  [${x.status}] ${x.url}`))

  if (consoleErrors.length) {
    console.log(`\n  console errors (${consoleErrors.length}):`)
    consoleErrors.slice(0, 10).forEach(e => console.log(`    ${e.slice(0, 200)}`))
  }

  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
