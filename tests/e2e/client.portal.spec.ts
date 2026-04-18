import { test, expect } from '@playwright/test'

test.describe('Client — portal flows', () => {
  test('client home loads', async ({ page }) => {
    await page.goto('/client')
    await expect(page).toHaveURL(/\/client/)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|500/i)
  })

  test('client invoices page renders', async ({ page }) => {
    await page.goto('/client/invoices')
    await expect(page).toHaveURL(/invoices/)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|500/i)
  })

  test('client messages page renders', async ({ page }) => {
    await page.goto('/client/messages')
    await expect(page).toHaveURL(/messages/)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|500/i)
  })

  test('client cannot reach /admin or /employee routes', async ({ page }) => {
    for (const path of ['/admin', '/employee']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
      const url = page.url()
      const body = await page.locator('body').textContent()
      const blocked =
        !url.includes(path) ||
        /forbidden|unauthor|access denied|403|not allowed/i.test(body ?? '')
      expect(blocked, `client reached ${path}`).toBe(true)
    }
  })
})
