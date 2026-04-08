# SESSION STATE
_Last updated: 2026-04-08_

## What's Deployed & Working

### Frontend (Vercel → https://akrenovationsopsapp.vercel.app)
- React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- Real Supabase auth (login, signup, session, role-based routing)
- Admin dashboard — fully live data (no mock data), real empty states
- Employee launchpad — Jeff persona, full action card grid
- Client portal — homeowner demo, progress/photos/invoices/messages/docs/schedule/punch list tabs
- API Usage Bar — clickable pill in admin header, live cost breakdown by service/agent, range tabs (Today/7d/30d/MTD)
- Business Context editor — `/admin/settings/context` — inline editing, grouped by category
- Onboarding wizard — `/admin/onboard` — Client / Employee / Subcontractor flows (3-4 steps each)
- Meta agent chat — fully aware of entire app, live DB context, proactive suggestions
- Compliance page (mock data only — not wired to DB yet)
- `.claude/settings.local.json` → `bypassPermissions` — no approval prompts

### Supabase (project: mebzqfeeiciayxdetteb)
- Full schema deployed (all tables from CLAUDE.md)
- RLS policies active
- `api_usage_log` table live (tracks cost per API call by agent/service)
- Edge functions deployed:
  - `meta-agent-chat` — full app knowledge, live DB queries, api_usage_log writes
  - `extract-preferences` — Haiku-based preference extraction → business_context + operational_memory
  - `get-usage-stats` — returns cost breakdown for APIUsageBar
  - `get-daily-brief` — AI morning summary
  - `agent-runner` — dispatches tool calls
  - `generate-proposal` — proposal generation
  - `send-communication` — Twilio/Resend wrapper
  - `process-receipt` — receipt OCR via Gemini
  - `analyze-photo` — photo analysis via Gemini
  - `generate-estimate` — estimate generation from walkthrough data
  - `process-voice` — voice transcription
  - `get-social-caption` — social media post generation
- Supabase secrets set: ANTHROPIC_API_KEY, GEMINI_API_KEY, TWILIO_*, RESEND_API_KEY, STRIPE_*

### Database state
- Cleared of all mock/test data (fresh start as of this session)
- `business_context` table has Adam's company context records
- No projects, leads, invoices, employees, or clients yet — app starts blank

---

## What's NOT Built Yet

### Phase 2 — Employee Tools (MUST HAVE BY JULY 1)
- [ ] Shopping list (add items, check off, grouped by project)
- [ ] Receipt scanner (camera → AI extract → confirm → save)
- [ ] Photo upload with category picker
- [ ] Schedule view (today + this week) — employee-facing
- [ ] Task management (todo list per project)
- [ ] Daily log (AI auto-draft + manual edit)
- [ ] Messages (in-app messaging)
- [ ] Notes (project notes + change order flagging)
- [ ] Client info card
- [ ] Bonus tracker display

### Phase 3 — Financial Core
- [ ] Expense tracking + job costing per project
- [ ] Invoice creation + delivery + payment tracking
- [ ] Purchase orders
- [ ] P&L per project
- [ ] Company financial dashboard
- [ ] Bonus qualification auto-calculation
- [ ] QuickBooks integration

### Phase 4 — CRM + Sales Pipeline
- [ ] Lead management with kanban + list views
- [ ] Lead activity timeline, AI follow-up drafts
- [ ] Website inquiry form
- [ ] Referral tracking

### Phase 5 — Proposals + Contracts
- [ ] AI site walk / walkthrough interview system
- [ ] Estimate generation
- [ ] Proposal builder + send + tracking
- [ ] Contract generation + e-signature
- [ ] Template library

### Phase 6 — Client Portal
- [ ] Client auth + real project data (currently demo only)
- [ ] Selection checklist from proposal
- [ ] Stripe invoice payments
- [ ] Punch list with sign-off

### Phase 7+ — Advanced / AI Agent
- [ ] Subcontractor management
- [ ] Permit tracking
- [ ] Change order workflow
- [ ] Warranty tracking
- [ ] Full AI agent action execution layer
- [ ] Google Calendar sync, Twilio inbound SMS, QuickBooks sync

---

## Known Issues / Tech Debt
- Compliance page still uses MOCK_COMPLIANCE_ITEMS — not wired to DB
- Employee screens (shopping, time, photos, etc.) — UI exists but not fully wired to Supabase
- `api_usage_log` only logs meta-agent-chat calls so far — other edge functions need usage logger added

---

## Recommended Next Sessions

**Option A — Phase 2 employee tools (highest priority, July 1 deadline)**
> "Read SESSION_STATE.md and BUILD_QUEUE.md. Build Phase 2 employee tools. Start with shopping list and receipt scanner — full Supabase integration, no mock data."

**Option B — CRM Pipeline**
> "Read SESSION_STATE.md and BUILD_QUEUE.md. Build the CRM pipeline: lead management with kanban board, lead detail slide-over, activity timeline, and AI follow-up drafts."

**Option C — Financial core**
> "Read SESSION_STATE.md and BUILD_QUEUE.md. Build the financial core: expense tracking, invoice creation, P&L per project."
