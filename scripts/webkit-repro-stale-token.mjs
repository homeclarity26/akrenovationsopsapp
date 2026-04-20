#!/usr/bin/env node
// Simulates Adam's browser state: logs in once (valid token), then manually
// expires the stored token's expires_at, reloads, and measures how long the
// AuthLoadingScreen spinner shows.
//
// If this takes ~12s (the safety-timeout), we've reproduced the bug.

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

  // Step 1: log in cleanly to populate localStorage
  console.log('[repro] fresh login to populate localStorage …')
  const link = await magicLink('akrenovations01@gmail.com', srKey)
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 25_000 })
  await page.waitForTimeout(4000)
  if (/\/login/.test(page.url())) { console.error('login failed'); process.exit(2) }
  console.log(`[repro] logged in, url = ${page.url()}`)

  // Dump stored auth key
  const keys = await page.evaluate(() => {
    const out = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) out.push({ k, v: localStorage.getItem(k) })
    }
    return out
  })
  console.log(`[repro] auth keys in localStorage: ${keys.length}`)

  // Step 2: expire the token
  console.log('\n[repro] artificially expiring the stored token (expires_at → past) …')
  await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const raw = localStorage.getItem(k)
        try {
          const p = JSON.parse(raw)
          p.expires_at = Math.floor(Date.now() / 1000) - 3600 // 1h ago
          localStorage.setItem(k, JSON.stringify(p))
        } catch {}
      }
    }
  })

  // Step 3: navigate to /admin and measure time to content
  console.log('[repro] navigating to /admin with expired token …')
  const t0 = Date.now()
  await page.goto(APP + '/admin', { waitUntil: 'domcontentloaded', timeout: 45_000 })
  const tDom = Date.now() - t0

  // Wait for SPINNER to disappear (AuthLoadingScreen) OR real content to appear
  let bodyLen = 0
  let waited = 0
  const start = Date.now()
  while (waited < 20_000) {
    bodyLen = await page.evaluate(() => document.body.innerText.length)
    if (bodyLen > 200) break
    await page.waitForTimeout(200)
    waited = Date.now() - start
  }
  console.log(`[repro] dom ready ${tDom}ms, spinner cleared after ${waited}ms (bodyLen=${bodyLen}, url=${new URL(page.url()).pathname})`)

  if (waited > 5000) {
    console.log('\n\x1b[31m✗ REPRODUCED:\x1b[0m Spinner hung >5s. This is Adam\'s bug.')
  } else {
    console.log('\n\x1b[32m✓ NOT reproduced:\x1b[0m content appeared quickly.')
  }

  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
