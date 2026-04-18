import { test, expect } from '@playwright/test'

/**
 * Deep nav coverage — every top-level admin page loads without a 500 / error banner.
 * Catches regressions in queries, layouts, and route-guard logic across the admin surface.
 */
const ADMIN_PAGES = [
  { path: '/admin', label: 'dashboard' },
  { path: '/admin/projects', label: 'projects list' },
  { path: '/admin/crm', label: 'CRM / leads' },
  { path: '/admin/compliance', label: 'compliance' },
  { path: '/admin/proposals', label: 'proposals' },
  { path: '/admin/invoices', label: 'invoices' },
  { path: '/admin/payroll', label: 'payroll dashboard' },
  { path: '/admin/payroll/workers', label: 'payroll workers' },
  { path: '/admin/inventory', label: 'inventory' },
  { path: '/admin/subs', label: 'subcontractors' },
  { path: '/admin/settings', label: 'settings' },
  { path: '/admin/settings/integrations', label: 'integrations settings' },
  { path: '/admin/settings/team', label: 'team settings' },
  { path: '/admin/settings/observability', label: 'observability settings' },
  { path: '/admin/ai', label: 'AI command' },
  { path: '/admin/onboard', label: 'admin-led onboarding' },
]

for (const page of ADMIN_PAGES) {
  test(`${page.label} loads without error banners`, async ({ page: pw }) => {
    await pw.goto(page.path)
    await pw.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    const body = await pw.locator('body').textContent()
    // Allow "Error" used as a benign word. Flag only unhandled-failure text.
    expect(body, `page ${page.path}`).not.toMatch(/unable to load|something went wrong|500 internal|PGRST/i)
  })
}
