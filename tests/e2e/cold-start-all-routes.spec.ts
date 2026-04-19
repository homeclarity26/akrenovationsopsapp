/**
 * Cold-start sweep — WebKit-only.
 *
 * The 2026-04-19 regression loop existed because the Chrome MCP harness
 * didn't reproduce Safari-specific failures (WebSocket security, back/forward
 * cache, cookie ITP). This spec deep-links to every meaningful app route
 * using the admin, employee, and client storage-state (so auth is hydrated)
 * and asserts that the page:
 *   - returns 200-ish content (not the "Something went wrong" ErrorBoundary)
 *   - doesn't crash with the Sentry diagnostic fallback
 *
 * Why this matters: when a user opens the app in a fresh Safari tab and
 * lands directly on /employee/notes (history empty), any unwrapped
 * supabase .subscribe() call will throw "The operation is insecure" and
 * trigger the root boundary. This test catches it.
 *
 * Run just this spec via:
 *   npx playwright test cold-start-all-routes.spec.ts --project=webkit
 */

import { test, expect } from '@playwright/test'

const ADMIN_ROUTES = [
  '/admin',
  '/admin/crm',
  '/admin/projects',
  '/admin/inventory',
  '/admin/financials',
  '/admin/schedule',
  '/admin/invoices',
  '/admin/proposals',
  '/admin/walkthrough',
  '/admin/subs',
  '/admin/payroll',
  '/admin/compliance',
  '/admin/ai',
  '/admin/reminders',
  '/admin/settings',
  '/admin/settings/context',
  '/admin/settings/branding',
  '/admin/settings/rates',
  '/admin/settings/approvals',
  '/admin/settings/notifications',
  '/admin/settings/templates',
  '/admin/settings/estimate-templates',
  '/admin/settings/checklists',
  '/admin/settings/materials',
  '/admin/settings/tool-requests',
  '/admin/settings/agents',
  '/admin/settings/memory',
  '/admin/settings/health',
  '/admin/settings/backups',
  '/admin/settings/security',
  '/admin/settings/integrations',
]

const EMPLOYEE_ROUTES = [
  '/employee',
  '/employee/time',
  '/employee/shopping',
  '/employee/stocktake',
  '/employee/schedule',
  '/employee/messages',
  '/employee/receipts',
  '/employee/photos',
  '/employee/bonus',
  '/employee/notes',
  '/employee/client-info',
  '/employee/paystubs',
  '/employee/checklists',
  '/employee/tool-request',
  '/employee/projects',
  '/employee/change-order',
]

const CLIENT_ROUTES = [
  '/client',
  '/client/progress',
  '/client/photos',
  '/client/selections',
  '/client/invoices',
  '/client/messages',
  '/client/schedule',
  '/client/punch-list',
  '/client/docs',
  '/client/refer',
]

async function assertNoCrash(page: import('@playwright/test').Page, route: string) {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text().slice(0, 200)}`)
  })

  await page.goto(route, { waitUntil: 'networkidle', timeout: 30_000 })
  // Give realtime subscribe calls a chance to fire and fail if they will.
  await page.waitForTimeout(2500)

  // The ErrorBoundary fallback renders "Something went wrong" as an <h2>.
  // If that's on the page, we crashed.
  const crashHeading = page.locator('h2', { hasText: /Something went wrong/i })
  await expect(crashHeading, `Route ${route} rendered the error boundary fallback`).toHaveCount(0)

  // Fail on the specific WebSocket Safari error too — catches any new ad-hoc
  // subscribe that slipped past the lint rule.
  const sawWsError = errors.some(e => /WebSocket not available: The operation is insecure/i.test(e))
  expect(sawWsError, `Route ${route} threw the Safari WebSocket-insecure error: ${errors.filter(e => e.includes('WebSocket')).join(' | ')}`).toBeFalsy()
}

test.describe('admin cold-start sweep (webkit)', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' })
  for (const route of ADMIN_ROUTES) {
    test(`admin ${route} does not crash on cold-start`, async ({ page }) => {
      await assertNoCrash(page, route)
    })
  }
})

test.describe('employee cold-start sweep (webkit)', () => {
  test.use({ storageState: 'tests/e2e/.auth/employee.json' })
  for (const route of EMPLOYEE_ROUTES) {
    test(`employee ${route} does not crash on cold-start`, async ({ page }) => {
      await assertNoCrash(page, route)
    })
  }
})

test.describe('client cold-start sweep (webkit)', () => {
  test.use({ storageState: 'tests/e2e/.auth/client.json' })
  for (const route of CLIENT_ROUTES) {
    test(`client ${route} does not crash on cold-start`, async ({ page }) => {
      await assertNoCrash(page, route)
    })
  }
})
