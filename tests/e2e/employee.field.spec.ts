import { test, expect } from '@playwright/test'

test.describe('Employee — field flows', () => {
  test('employee home loads', async ({ page }) => {
    await page.goto('/employee')
    await expect(page).toHaveURL(/\/employee/)
    // Some heading/greeting should be there.
    const ok = await page.locator('body').textContent()
    expect(ok).not.toMatch(/unable to load|error|500/i)
  })

  test('time clock page renders without errors', async ({ page }) => {
    await page.goto('/employee/time')
    await expect(page).toHaveURL(/\/employee\/time/)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|500/i)
  })

  test('notes / daily log page renders', async ({ page }) => {
    await page.goto('/employee/notes')
    await expect(page).toHaveURL(/notes/)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|500/i)
  })

  test('employee cannot reach /admin routes', async ({ page }) => {
    await page.goto('/admin')
    // Should either 404, be redirected, or show an unauthorized message.
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
    const url = page.url()
    const body = await page.locator('body').textContent()
    // Acceptable outcomes: redirected OUT of /admin, or an explicit forbidden page.
    const blocked =
      !url.includes('/admin') ||
      /forbidden|unauthor|access denied|403|not allowed/i.test(body ?? '')
    expect(blocked).toBe(true)
  })
})
