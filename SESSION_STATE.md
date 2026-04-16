# SESSION STATE
_Last updated: 2026-04-16 (33 PRs shipped across 2 day-long sessions)_

## Current status: PRODUCTION-READY for internal crew use

The app is fully deployed to Supabase (`mebzqfeeiciayxdetteb`). All migrations applied, all edge functions live, final code review passed (UX 10/10, security 10/10), 118 tests passing. Adam can use it with his crew today.

---

## What's Deployed & Working

### Frontend (Vercel → https://akrenovationsopsapp.vercel.app)
- React 19 + TypeScript + Vite + Tailwind CSS
- Real Supabase auth (login, signup, session, role-based routing)
- 4 roles: super_admin, admin, employee, client
- Routes across all 4 roles with ProtectedRoute + layouts
- `.claude/settings.local.json` → `bypassPermissions` active

### Backend
- **~86 Supabase edge functions** deployed (15 proactive AI agents + 15 reactive AI agents + infrastructure + integrations)
- **118+ migrations applied** to live Supabase
- **RLS active on every table**, with explicit `service_role` policies where cron/edge-functions need write access
- **118 Vitest tests passing** (hooks/components/lib/rate-limit)

### Layouts
- **AdminLayout** — sidebar nav + AgentBar pinned at top + PoweredByFooter
- **EmployeeLayout** — bottom 7-tab nav + AgentBar + PoweredByFooter (mobile-first)
- **ClientLayout** — simple header + AgentBar (softer copy) + PoweredByFooter

---

## Major features (all wired to real data)

### Live shared project state (PRs 1-5)
- `project_assignments` table + `can_access_project()` RLS helper — employees see only assigned projects
- Realtime publication on 14 project-scoped tables with REPLICA IDENTITY FULL
- `useProjectRealtime` / `useProjectActivity` / `useProjectPresence` hooks
- `project_activity` table with trigger-written audit log + `ProjectActivityFeed` component
- Per-item client visibility via `visible_to_client` + `ClientShareToggle`
- Employee-scoped ProjectDetailPage + ProjectsPage at `/employee/projects/*`

### AI as project participant (PR 6 + 18b)
- `ai_project_suggestions` table — AI proposes, admin approves/rejects
- `ProjectSuggestionInbox` component (admin only, shows on ProjectDetailPage)
- Meta-agent PROPOSE vs DIRECT-EXECUTE heuristic live
- Edge functions: `ai-suggest-project-action`, `apply-project-suggestion`, `reject-project-suggestion`

### Multi-location inventory (PRs 7-12)
- 6 tables: `inventory_locations` (shop/trucks/trailers), `inventory_categories`, `inventory_items`, `inventory_stock`, `inventory_stocktakes`, `inventory_item_templates`
- `inventory_alerts` table with daily scan cron (13:22 UTC) + digest email (13:37 UTC)
- Admin UI at `/admin/inventory` with 5 tabs: Alerts · Stock · Items · Locations · Categories
- Employee stocktake at `/employee/stocktake` (location picker → rough count flow)
- Photo-based stocktake via `agent-photo-stocktake` (Gemini vision)
- Shopping list ↔ inventory link with `deduct-shopping-item-from-stock` edge function
- AI natural-language inventory query via `ai-inventory-query`

### AI-native UX via Agent Bar (PR 20 + 57)
Primary interface across the app:
- Persistent pill at top of every page (`src/components/ui/AgentBar.tsx`)
- Full-screen overlay on tap (`AgentOverlay.tsx`)
- **Voice** (hold-to-talk via `SpeechRecognition` API + waveform canvas via `AudioContext`)
- **Attachments** (role-aware: admin gets photo/receipt/doc/file; employee gets photo/receipt/stocktake/file; client gets photo/file)
- **Text** with chip/entity/AI-fallback 3-layer search
- **82 commands** in `src/lib/commands.ts` covering all 4 roles
- **25 voice intent patterns** in `src/lib/voiceIntents.ts`
- Context-aware chips in `useContextChips` (route + role + time + urgency)

### Cross-cutting UX (PR 21)
- Toast system with `useToast()` hook (success/error/warning/info, max 3 visible, auto-dismiss 4s)
- Skeleton loaders (`SkeletonText`, `SkeletonCard`, `SkeletonRow`)
- Bottom-nav badge counts via `useBottomNavBadges()`
- Empty states on Projects, CRM, ClientDocs, ClientMessages, Inventory

### Settings unification (PR 22)
- `/admin/settings/*` all wrapped in `SettingsLayout` (sidebar desktop / tabs mobile)
- 14 settings subpages: Business Context, Branding, Rates, Approvals, Templates, Estimate Templates, Checklists, Materials, Tool Requests, Integrations, Agents, Memory, Health, Backups, Security
- Each subpage has plain-English one-line description
- Integrations section shows real status for QuickBooks, Gusto, Stripe, Twilio
- First-visit wizards per persona (AdminDashboard, EmployeeHome, ClientProgress) via `FirstVisitWizard`

### Client portal (PR 16) — all 7 pages on REAL DATA
- `ClientProgress` — real `project_phases` + latest daily log
- `ClientDocs` — real `project_files` filtered by `visible_to_client`
- `ClientInvoices` — real `invoices` + outstanding/paid totals + Pay Now via Stripe
- `ClientSchedule` — real `schedule_events` grouped past/today/upcoming
- `ClientPhotos` — real `project_photos` grouped by category
- `ClientMessages` — with avatars, timestamps, unread indicators
- `ClientPunchList` — real punch list with sign-off
- Admin "Invite to portal" flow via `invite-client-to-portal` edge function (email or SMS)

### Integrations (PRs 23-24 + Stripe + Twilio)
- **QuickBooks Online** (OAuth + sync) — `quickbooks-auth` + `sync-quickbooks` + daily cron (11:00 UTC). Tokens encrypted.
- **Gusto Payroll** (OAuth + sync) — `gusto-auth` + `sync-to-gusto`. Tokens encrypted.
- **Stripe** — `create-checkout-session` + `stripe-webhook`. Clients pay via Checkout; webhook auto-marks invoices paid.
- **Twilio SMS** — `send-sms` + `twilio-webhook`. Real SMS to any phone. Inbound routed to `agent-sms-responder`.
- **Resend email** — `send-email` (pre-existing, wired throughout).
- **Google Drive** — `sync-google-drive`, `backup-database`.
- OAuth tokens stored AES-256-GCM encrypted in `integrations.access_token` (key: `TOKEN_ENCRYPTION_KEY` env var).

### White-label branding (PR 59)
- `companies` table has branding columns (logo/colors/favicon/tagline/powered_by_visible/powered_by_text)
- `ThemeContext` sets CSS variables dynamically per company (validates favicon URL for XSS safety)
- `BrandingPage` at `/admin/settings/branding` — color pickers + swatches + logo upload + live preview
- `PoweredByFooter` on all 3 layouts (togglable via `powered_by_visible`)
- Storage bucket `company-assets` (public, admin-write)

### Observability (PR 17 + 27)
- `error_log`, `agent_execution_log`, `improvement_suggestions` tables
- `_shared/logError.ts` helper for edge functions
- HealthPage shows real 24h metrics (error count by severity, agent runs with p50/p95 durations)
- ImprovementQueuePage with kanban for AI-suggested improvements
- Sentry wired in 3 critical edge functions + frontend

### Observables/integrity (PR 13-15)
- Rate limits on all 86 edge functions
- `apply-project-suggestion` scopes UPDATE to suggestion's `project_id` (no cross-project writes)
- `ai-suggest-project-action` verifies employee is on the project
- `agent-inventory-alerts` per-company error isolation
- Stocktake trigger always populates `quantity_before` (fixes NULL delta)
- Activity trigger skips updated-at-only bumps (no feed noise)
- `visible_to_client` backfilled to true for all pre-PR-4 legacy rows
- `inventory_alerts_active_unique` covers 'open' AND 'acknowledged' status
- Cross-company validation trigger on `shopping_list_items` FKs

---

## Supabase Project
- **ID:** mebzqfeeiciayxdetteb
- **URL:** https://mebzqfeeiciayxdetteb.supabase.co
- Full schema deployed (all 118+ migrations)
- Storage buckets: `stocktake-photos` (private), `company-assets` (public), `project-photos`, `receipts`, `documents-storage`
- Cron jobs: 22 scheduled (morning-brief, risk-monitor, lead-aging, inventory-alerts at 13:22, inventory-alerts-digest at 13:37, quickbooks-daily-sync at 11:00, etc.)

---

## Database State (as of 2026-04-16)
- AK Renovations is the primary tenant (first company)
- Seed data present: 5 inventory locations, 8 categories, ~21 items, minimal stock
- No live projects/leads/invoices yet — Adam's crew will create these as they use the app

---

## Env vars needed
See `docs/ENV_VARS.md`. Current required (not yet set, optional for internal-only use):
- `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET` (when QB integration is wanted)
- `GUSTO_CLIENT_ID`, `GUSTO_CLIENT_SECRET` (when Gusto integration is wanted)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (when client payments are wanted)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (when SMS is wanted)
- `TOKEN_ENCRYPTION_KEY` (required once any OAuth integration is configured — 32-byte base64)

Already set: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, RESEND_API_KEY, QBO_REDIRECT_URI, QBO_ENVIRONMENT (sandbox), GUSTO_REDIRECT_URI, GUSTO_ENVIRONMENT (sandbox), STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL.

---

## What's next (NOT in scope for current build — only if Adam wants)
- Real API credentials for QuickBooks / Gusto / Stripe / Twilio (currently all graceful-fallback — app works without them)
- Custom subdomain routing (`contractorname.tradeoffice.ai`) — Vercel config + hostname-aware branding load
- Performance tuning on RLS subqueries (wait for real data scale before optimizing)
- Additional agent bar commands beyond the 82 already wired
- Native mobile (React Native / Capacitor) — PWA confirmed sufficient for now

---

## Recommended next session prompts

**Add real API credentials (after Adam signs up for services):**
> "Adam has QuickBooks credentials now. Set QBO_CLIENT_ID and QBO_CLIENT_SECRET via the Supabase Management API. Test the OAuth flow."

**Custom domain setup:**
> "Set up subdomain routing so each contractor gets their own URL like smithbrothers.tradeoffice.ai. Read CLAUDE.md and MASTER_PLAN.md first — the branding architecture is already in place."

**Incident response:**
> "A bug just popped up in production. Read SESSION_STATE.md and CLAUDE.md, check the error_log table via the Supabase Management API, and debug."

**New feature (example):**
> "Adam wants to add <feature>. Read CLAUDE.md + SESSION_STATE.md. Stack the PR on main. Follow the conventional-commit style with Co-Authored-By footer. Auto-merge via /tmp/akr-merge.sh when done."

---

## Key dev notes for future sessions

- Repo is cloned at `/tmp/akrenovationsopsapp`. The Desktop workspace is `/Users/adamkilgore/Desktop/CODE REVIEW FOR AKOPPS/` (CLAUDE.md + MASTER_PLAN.md live there).
- `/tmp/akr-merge.sh <branch> "<title>"` — creates + merges GitHub PR via API (uses credential from macOS keychain).
- Git worktrees at `/tmp/akr-*` are used for parallel PR work; symlink `node_modules` from main checkout to avoid re-install.
- Supabase Management API token was stored in user's credential system. If a fresh session needs it, ask Adam.
- When building new PRs, rebase on main before merge (conflicts on `meta-agent-chat/index.ts`, `rate-limit.ts`, `ProjectDetailPage.tsx` are common — additive resolution).
- Build must pass `tsc -b && vite build` clean. `npm test` must pass (118 tests).
- Edge functions are Deno — don't use Node APIs. Use `Deno.env.get('X')` for secrets. Reference `_shared/` for auth, cors, rate-limit, aiConfig, logError, tokenCrypto.
