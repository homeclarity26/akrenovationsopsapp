# E2E tests (Playwright)

Multi-persona end-to-end smoke across admin / employee / client. Built out during the 2026-04-18 floor rebuild.

## Running locally

```bash
# 1. Ensure seed users exist in the scratch Supabase
node /tmp/seed_scratch_users.mjs  # (one-off; idempotent)

# 2. Run Playwright
PLAYWRIGHT_SUPABASE_URL=https://wczlhyhnqzrnvjwleinc.supabase.co \
PLAYWRIGHT_SUPABASE_ANON_KEY="<anon_key_from_akr_scratch_creds.env>" \
npx playwright test
```

Playwright spins up `npm run dev` on port 5173 pointed at the scratch Supabase, then auths each persona once (`auth.setup.ts` saves the storage state), then runs the per-persona specs.

## CI

`.github/workflows/playwright.yml` wires this into PR checks. Requires GitHub secrets:
- `PLAYWRIGHT_SUPABASE_URL`
- `PLAYWRIGHT_SUPABASE_ANON_KEY`

(Set alongside the existing `GOLDEN_SUPABASE_*` secrets.)

## Layout

- `auth.setup.ts` — authenticates the 3 personas and saves storage state under `.auth/`.
- `admin.*.spec.ts` — admin flows (dashboard, projects, agent bar).
- `employee.*.spec.ts` — employee flows (time clock, notes) + can't-reach-admin check.
- `client.*.spec.ts` — client portal + can't-reach-admin-or-employee check.

## What's covered today

- Admin dashboard loads with real data.
- Admin projects list renders.
- Admin can create a project via quick-add.
- Agent bar is present (not full behavior — just presence).
- Employee home / time clock / notes pages render without 500s.
- Employee can't access `/admin`.
- Client portal pages render.
- Client can't access `/admin` or `/employee`.

## What's NOT covered (future passes)

- Every individual agent's semantic output.
- Deep UI interactions (modals, voice flows, AttachmentSheet).
- Edge-function end-to-end input/output validation.
- Visual regression.
- Mobile viewports (currently Desktop Chrome only).
