# AK Renovations Ops App — Developer Reference

<!-- ADAM-BRAIN CONTEXT — read at session start -->
<!-- Run: python3 ~/Desktop/organize-pipeline/brain/memory.py recall "AKR TradeOffice" -->
<!-- Master context: ~/Desktop/organize-pipeline/brain/master-context.md -->
<!-- Owner: Adam Kilgore, AK Renovations, Summit County OH. 27 years, ~$1.5M revenue. -->
<!-- This app = TradeOffice AI. Internal ops now → SaaS to contractors Q3 2026. -->
<!-- Token efficiency: read this file + SESSION_STATE.md. Don't explore edge functions unless modifying one. -->

**Branch:** `main`
**Deploy:** https://akrenovationsopsapp.vercel.app
**Status:** Production-ready for internal crew use (see SESSION_STATE.md for full feature list)

---

## Hard rules

1. **Run tests before declaring done.** `npm test` must pass all 118 tests. No shipping red tests.
2. **Build must be clean.** `tsc -b && vite build` with zero TypeScript errors. No `// @ts-ignore` unless there's a documented reason.
3. **RLS on every new table.** Every new table needs RLS enabled + explicit policies. Never use `service_role` from the frontend.
4. **Rate-limit every new edge function.** Use `_shared/rateLimit.ts`. No exceptions.
5. **Auth/CORS from shared helpers.** `_shared/auth.ts` + `_shared/cors.ts`. Never hand-roll these.
6. **No em-dashes anywhere** — not in copy, comments, or logs. Use plain dashes or rewrite.
7. **AI actions are PROPOSE by default**, not DIRECT-EXECUTE, unless the action is clearly low-risk (read-only query, draft creation). Follow the meta-agent heuristic already in the codebase.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Supabase (Postgres + ~86 Edge Functions + Realtime) |
| Auth | Supabase Auth, 4 roles: `super_admin` / `admin` / `employee` / `client` |
| AI | Anthropic Claude (most agents), Gemini (photo/vision tasks) |
| Payments | Stripe Checkout + webhooks |
| SMS | Twilio |
| Email | Resend |
| Payroll | Gusto (OAuth) |
| Accounting | QuickBooks Online (OAuth) |
| Tests | Vitest, 118 tests |
| Deploy | Vercel (frontend) + Supabase (backend) |

---

## Supabase project

- **Project ID:** `mebzqfeeiciayxdetteb`
- **URL:** `https://mebzqfeeiciayxdetteb.supabase.co`
- **118+ migrations** applied to live instance
- **Storage buckets:** `stocktake-photos` (private), `company-assets` (public), `project-photos`, `receipts`, `documents-storage`
- **22 cron jobs** scheduled (morning-brief, inventory-alerts 13:22 UTC, digest 13:37 UTC, QB sync 11:00 UTC, etc.)

---

## Edge function conventions

All edge functions live in `supabase/functions/`. Shared utilities in `supabase/functions/_shared/`:

| Helper | Purpose |
|--------|---------|
| `auth.ts` | Verify JWT, extract user + role |
| `cors.ts` | CORS headers — always use this |
| `rateLimit.ts` | Per-user rate limiting — required on every function |
| `aiConfig.ts` | Anthropic client config |
| `logError.ts` | Write to `error_log` table |
| `tokenCrypto.ts` | AES-256-GCM encrypt/decrypt OAuth tokens |

Deploy a single function: `npx supabase functions deploy <name> --project-ref mebzqfeeiciayxdetteb`

---

## Key architecture

- **AgentBar** (`src/components/ui/AgentBar.tsx`) — primary UX across all layouts. Persistent pill + full-screen overlay. Voice (hold-to-talk), attachments, text with chip/entity/AI-fallback 3-layer search.
- **82 commands** in `src/lib/commands.ts`, **25 voice intent patterns** in `src/lib/voiceIntents.ts`
- **3 layouts:** AdminLayout (sidebar + AgentBar), EmployeeLayout (bottom 7-tab + AgentBar, mobile-first), ClientLayout (simple header + AgentBar)
- **Multi-tenant** via `companies` table. White-label branding via `ThemeContext` (CSS variables per company).
- **PROPOSE vs DIRECT-EXECUTE** heuristic in meta-agent. AI proposes → admin approves/rejects via `ProjectSuggestionInbox`.

---

## Roles and access

| Role | Access |
|------|--------|
| `super_admin` | Full cross-company admin (TradeOffice SaaS owner = Adam) |
| `admin` | Full access within their company |
| `employee` | Assigned projects only, mobile-first flows |
| `client` | Client portal — their project only, curated visibility |

RLS enforces these at the database level. The `can_access_project()` function is the primary access gate.

---

## Build commands

```bash
npm install          # install deps
npm test             # run all 118 Vitest tests — must pass before shipping
tsc -b && vite build # full type-check + build — must be clean before shipping
npm run dev          # dev server
```

---

## Env vars

Already set in production: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, and OAuth redirect URIs/environments.

Optional (graceful fallback if missing): `QBO_CLIENT_ID/SECRET`, `GUSTO_CLIENT_ID/SECRET`, `STRIPE_SECRET_KEY/WEBHOOK_SECRET`, `TWILIO_*`, `TOKEN_ENCRYPTION_KEY` (required once any OAuth integration is configured — 32-byte base64).

See `docs/ENV_VARS.md` for the full list.

---

## What this app is NOT

- Not the HCH client platform (that's `home-clarity-hub-04`). AKR Ops is internal construction crew ops.
- Not yet public SaaS — Q3 2026 beta to other contractors. Build for AKR first; SaaS-readiness is in the multi-tenant plumbing already laid.

---

## Session start checklist

1. Read this file
2. Read `SESSION_STATE.md` for current feature inventory and what's already built
3. Run `npm test` to confirm baseline (118 passing)
4. Run `tsc -b && vite build` to confirm clean baseline
5. Then build
