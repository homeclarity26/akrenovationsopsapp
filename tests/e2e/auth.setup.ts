import { test as setup } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PERSONAS = [
  { role: 'admin', email: 'e2e-admin@akr-test.local', password: 'TestAdminPw!2026' },
  { role: 'employee', email: 'e2e-employee@akr-test.local', password: 'TestEmpPw!2026' },
  { role: 'client', email: 'e2e-client@akr-test.local', password: 'TestClientPw!2026' },
] as const

for (const p of PERSONAS) {
  setup(`authenticate ${p.role}`, async ({ page }) => {
    await page.goto('/')
    // The login page shows when unauthenticated. It has email + password inputs
    // and a Sign in button. Wait for the form to be interactive.
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 })
    await page.fill('input[type="email"]', p.email)
    await page.fill('input[type="password"]', p.password)
    // The login screen has a tab-button "Sign in" AND a submit button also
    // labeled "Sign In". Use type=submit to pick the submit, not the tab.
    await page.locator('button[type="submit"]').click()
    // After login the app redirects based on role. Hydration can be slow in
    // dev mode because supabase-js re-fetches the profile.
    const expectedUrl =
      p.role === 'admin' ? '/admin' : p.role === 'employee' ? '/employee' : '/client'
    await page.waitForURL((url) => url.pathname.startsWith(expectedUrl), { timeout: 30_000 })
    await page.context().storageState({
      path: path.join(__dirname, '.auth', `${p.role}.json`),
    })
  })
}
