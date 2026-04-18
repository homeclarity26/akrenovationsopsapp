# Golden Path CI

## One-time setup by Adam (the PAT pushing to this repo lacks `workflow` scope)

The workflow file is provided as a template at `scripts/golden-path.workflow.yml.template`. To activate it:

1. Copy the file to `.github/workflows/golden-path.yml` locally (or via the GitHub web UI "Add file").
2. Commit + push (a human user's token can update workflow files).

Once installed, it runs on every push and PR against main:

1. `npm ci`
2. `npm run build` — TypeScript + Vite build must pass clean.
3. `npm test -- --run` — Vitest suite (136 unit tests + integration).

The **Golden Path integration test** (`src/__tests__/golden-path.integration.test.ts`) exercises the admin project lifecycle (create → read → update → delete) against a real Supabase project. It **skips automatically** unless these env vars / GitHub secrets are set:

- `GOLDEN_SUPABASE_URL` — e.g. the scratch project URL.
- `GOLDEN_SUPABASE_SERVICE_KEY` — service-role key for that project.
- `GOLDEN_COMPANY_ID` — a seed company row id in that DB.

## To enable against the scratch project

The `akr-scratch` Supabase project (ref `wczlhyhnqzrnvjwleinc`) was provisioned for this purpose. In the GitHub repo settings → Secrets → Actions:

1. `GOLDEN_SUPABASE_URL = https://wczlhyhnqzrnvjwleinc.supabase.co`
2. `GOLDEN_SUPABASE_SERVICE_KEY = <service-role key from scratch project>`
3. `GOLDEN_COMPANY_ID = b6547214-60f4-4079-bccb-439b648ca0b4`

Once set, every PR fails red if the golden-path lifecycle regresses.

## Not covered here (future work)

- **Playwright coverage of the real UI** across 4 personas (admin / employee / client / super_admin). That's the intended Pass-5 target; this integration test is the minimum floor, not the whole house.
- **Multi-tenant RLS enforcement tests** — need a second seed company + a non-admin user to verify cross-tenant denies.
- **Edge-function end-to-end tests** — each of the 81 auth-guarded functions needs a user-JWT-based smoke call.

See `PASS_5_SUMMARY.md` for the full state of Pass 5.
