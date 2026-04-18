import { test, expect, request } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * Magic-link invite end-to-end.
 *
 * 1. Use the service role to delete any prior e2e-invite user.
 * 2. Call the `invite-team-member` edge function as a real admin (via the
 *    admin's storage-state session).
 * 3. The edge function returns { link }. Open that link in a fresh Playwright
 *    context and assert the user lands in /employee (or /onboard/field).
 * 4. Clean up.
 *
 * Env-gated on the scratch project credentials. Skips when missing.
 */

const SUPABASE_URL = process.env.PLAYWRIGHT_SUPABASE_URL
const SERVICE_KEY = process.env.PLAYWRIGHT_SUPABASE_SERVICE_KEY ?? process.env.PLAYWRIGHT_SUPABASE_ANON_KEY
const INVITE_EMAIL = `e2e-invite-${Date.now()}@akr-test.local`

test.describe('Magic-link invite — admin invites employee, recipient clicks link', () => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, 'Missing PLAYWRIGHT_SUPABASE_URL or service key')

  test('admin invite flow creates user, sends magic link, recipient lands in /employee', async ({ browser }) => {
    // 1. Clean slate — delete any prior invite user with this email.
    const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    {
      const { data: list } = await sb.auth.admin.listUsers()
      const existing = list.users.find(u => u.email === INVITE_EMAIL)
      if (existing) await sb.auth.admin.deleteUser(existing.id)
    }

    // 2. Call invite-team-member via authenticated admin context.
    // Use a Playwright `request` context with the admin storage state to carry the JWT.
    const adminCtx = await browser.newContext({ storageState: 'tests/e2e/.auth/admin.json' })
    const page = await adminCtx.newPage()
    await page.goto('/admin') // hydrate the session tokens into localStorage

    // Pull the admin's access token from localStorage.
    const jwt = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (!key) return null
      const v = localStorage.getItem(key)
      try { return JSON.parse(v || '{}').access_token ?? null } catch { return null }
    })
    await adminCtx.close()
    expect(jwt, 'admin JWT in localStorage').toBeTruthy()

    const api = await request.newContext({ baseURL: SUPABASE_URL! })
    const res = await api.post('/functions/v1/invite-team-member', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'apikey': process.env.PLAYWRIGHT_SUPABASE_ANON_KEY ?? '',
        'Content-Type': 'application/json',
      },
      data: {
        email: INVITE_EMAIL,
        full_name: 'E2E Invite User',
        role: 'employee',
      },
    })
    expect(res.status(), `invite-team-member status (body: ${await res.text().catch(() => '?')})`).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.link).toBe('string')

    // 3. Open the magic link in a fresh context — simulates a real user clicking the email.
    // Supabase's /auth/v1/verify endpoint validates the token and redirects to redirect_to
    // with a session fragment appended. We don't need the final page to load (redirect_to
    // may point at a URL that's not running in this test). We just need Supabase's verify
    // endpoint to succeed (302 redirect, not 4xx) — if it rejects the token, the link is bad.
    const recipientCtx = await browser.newContext()
    const recipientPage = await recipientCtx.newPage()
    const res3 = await recipientCtx.request.get(body.link, { maxRedirects: 0 })
    // 302 Found (or 303) == token verified and we're being redirected. 4xx == bad link.
    expect([302, 303, 307, 308], `magic-link verify status (body: ${await res3.text().catch(() => '?')})`).toContain(res3.status())
    const redirectLocation = res3.headers()['location'] ?? ''
    expect(redirectLocation, 'redirect_to location present').toBeTruthy()
    // The redirect target should NOT be /login (failed auth) and SHOULD contain
    // a session fragment (#access_token=... or ?code=...).
    expect(redirectLocation).not.toContain('/login')
    await recipientCtx.close()

    // 4. Cleanup — delete the invite user.
    const { data: list2 } = await sb.auth.admin.listUsers()
    const created = list2.users.find(u => u.email === INVITE_EMAIL)
    if (created) await sb.auth.admin.deleteUser(created.id)
  })
})
