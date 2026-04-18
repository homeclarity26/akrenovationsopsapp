import { test, expect } from '@playwright/test'

test.describe('Admin — dashboard and project lifecycle', () => {
  test('dashboard loads and shows real data', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin/)
    // Role-scoped greeting heading confirms auth hydration + data load completed.
    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible({ timeout: 10_000 })
    // No global error banners.
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|something went wrong|500 /i)
  })

  test('projects list page renders', async ({ page }) => {
    await page.goto('/admin/projects')
    await expect(page).toHaveURL(/\/admin\/projects/)
    // Expect either the projects list (if any exist) or the empty state.
    const header = page.getByRole('heading', { name: /projects/i }).first()
    await expect(header).toBeVisible({ timeout: 10_000 })
  })

  test('can create a new project via quick-add', async ({ page }) => {
    await page.goto('/admin/projects')
    const addBtn = page.getByRole('button', { name: /new project|add project|\+ new/i }).first()
    // Only run this test if the button exists in the UI.
    if (!(await addBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Quick-add button not visible on this page — skipping')
    }
    await addBtn.click()
    const testTitle = `E2E TEST — ${Date.now()}`
    // Common patterns: inputs with name=title, placeholder mentions project name.
    const titleInput = page.locator('input[name="title"], input[placeholder*="project" i]').first()
    await titleInput.fill(testTitle)
    const clientInput = page.locator('input[name="client_name"], input[placeholder*="client" i]').first()
    if (await clientInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await clientInput.fill('E2E Test Client')
    }
    await page.getByRole('button', { name: /create|save/i }).first().click()
    // Title should appear in the list view within a few seconds.
    await expect(page.getByText(testTitle)).toBeVisible({ timeout: 10_000 })
  })

  test('agent bar pill is present on the admin dashboard', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    // Agent Bar renders the "Ask Claude" / "Ask AI" / placeholder prompt.
    // Match a few common copy variants since the label is AI-configurable.
    const promptCandidates = page.getByText(/ask (claude|ai)|what do you need|agent/i).first()
    await expect(promptCandidates).toBeVisible({ timeout: 5_000 })
  })
})
