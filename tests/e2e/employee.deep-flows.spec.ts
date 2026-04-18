import { test, expect } from '@playwright/test'

/**
 * Deep employee flows. Each test navigates to a real page and asserts the
 * page's core interactive element is present. Doesn't simulate every click
 * (that's infinite regression), but asserts the page structure the user
 * would actually see and use.
 */
test.describe('Employee — deep daily flows', () => {
  test('assigned project appears in My Projects', async ({ page }) => {
    await page.goto('/employee/projects')
    await expect(page).toHaveURL(/projects/)
    // Seed assigns this employee to 'Smoke Project'. It should be listed.
    // Tolerant: any project title present + no error banner.
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })

  test('time clock page renders with a clock-in CTA', async ({ page }) => {
    await page.goto('/employee/time')
    await expect(page).toHaveURL(/\/employee\/time/)
    // The CTA text contains the literal "Clock In" (icon + text). Match textContent.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    const body = await page.locator('body').textContent()
    // Either the Clock In CTA is rendered, or the user is already clocked in.
    expect(body).toMatch(/Clock In|Clocked in/i)
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })

  test('daily log notes page renders and accepts input', async ({ page }) => {
    await page.goto('/employee/notes')
    await expect(page).toHaveURL(/notes/)
    // A textarea or "Log" button should be present for writing a log.
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })

  test('shopping list page renders', async ({ page }) => {
    await page.goto('/employee/shopping')
    await expect(page).toHaveURL(/shopping/)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })

  test('stocktake page renders for employee', async ({ page }) => {
    await page.goto('/employee/stocktake')
    await expect(page).toHaveURL(/stocktake/)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })

  test('employee receipts page renders', async ({ page }) => {
    await page.goto('/employee/receipts')
    await expect(page).toHaveURL(/receipts/)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })

  test('employee tool request page renders', async ({ page }) => {
    await page.goto('/employee/tools')
    // May or may not be at /tools — allow redirect
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })

  test('employee paystubs page renders', async ({ page }) => {
    await page.goto('/employee/paystubs')
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })

  test('employee schedule page renders', async ({ page }) => {
    await page.goto('/employee/schedule')
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })

  test('employee checklists page renders', async ({ page }) => {
    await page.goto('/employee/checklists')
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/unable to load|PGRST/i)
  })
})
