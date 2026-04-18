import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config.
 *
 * Target: a local `npm run dev` server pointed at the `akr-scratch` Supabase
 * project (so tests can seed + tear down without touching prod). The scratch
 * creds come from env vars PLAYWRIGHT_SUPABASE_URL + PLAYWRIGHT_SUPABASE_ANON_KEY.
 *
 * Auth flow:
 *   tests/e2e/auth.setup.ts logs in as each persona and saves storage-state
 *   JSON to tests/e2e/.auth/. Per-persona specs reuse that state.
 *
 * Seed users (created by /tmp/seed_scratch_users.mjs, rerun is idempotent):
 *   admin    → e2e-admin@akr-test.local    / TestAdminPw!2026
 *   employee → e2e-employee@akr-test.local / TestEmpPw!2026
 *   client   → e2e-client@akr-test.local   / TestClientPw!2026
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Playwright CI sets these from GitHub secrets; locally they come from
      // tests/e2e/.env (not committed).
      VITE_SUPABASE_URL: process.env.PLAYWRIGHT_SUPABASE_URL ?? '',
      VITE_SUPABASE_ANON_KEY: process.env.PLAYWRIGHT_SUPABASE_ANON_KEY ?? '',
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'admin',
      testMatch: /admin\..*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/admin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'employee',
      testMatch: /employee\..*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/employee.json' },
      dependencies: ['setup'],
    },
    {
      name: 'client',
      testMatch: /client\..*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/client.json' },
      dependencies: ['setup'],
    },
    // Mobile viewport — the field crew uses this on phones. Narrow to the
    // two flows most likely to break on small screens: employee daily flow
    // and client portal. Same storage state, Pixel 5 device.
    {
      name: 'employee-mobile',
      testMatch: /employee\..*\.spec\.ts/,
      use: { ...devices['Pixel 5'], storageState: 'tests/e2e/.auth/employee.json' },
      dependencies: ['setup'],
    },
    {
      name: 'client-mobile',
      testMatch: /client\..*\.spec\.ts/,
      use: { ...devices['iPhone 13'], storageState: 'tests/e2e/.auth/client.json' },
      dependencies: ['setup'],
    },
    // Magic-link end-to-end — doesn't reuse any persona's state; creates its
    // own browser contexts for admin and invite-recipient.
    {
      name: 'magic-link',
      testMatch: /magic-link\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
})
