# SESSION STATE
_Last updated: 2026-04-08 (session 5)_

## What's Deployed & Working

### Frontend (Vercel → https://akrenovationsopsapp.vercel.app)
- React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- Real Supabase auth (login, signup, session, role-based routing)
- 75 routes across 3 roles (admin, employee, client)
- 45 pages built (UI complete on most, data wiring varies)
- 60 Supabase edge functions deployed
- `.claude/settings.local.json` → `bypassPermissions` active

### Layouts
- **AdminLayout** — sidebar nav, top bar
- **EmployeeLayout** — bottom tab nav, mobile-first
- **ClientLayout** — simple header/footer

---

## Page Inventory by Status

### LIVE (real Supabase data, no mock)
- `AdminDashboard` — projects, invoices, time entries, warranty claims, portfolio count
- `BusinessContextPage` — read/write business_context table
- `OnboardingPage` — inserts profiles, projects, subcontractors
- `SecurityPage` — Supabase auth settings
- `APIUsageBar` — live cost data from api_usage_log via get-usage-stats function
- `CRMPage` — real leads kanban with drag-to-move (@dnd-kit), Add Lead slide-over, activity timeline
- `InvoicesPage` — real invoice list, New Invoice sheet (line items), Send (generate-pdf), Mark Paid
- `FieldLaunchpadPage` — all 9 cards wired: shopping badge, messages unread, pending ai_actions, open time entry, today's schedule
- `TimeClockPage` (employee) — clock in/out persists to time_entries with GPS, manual entry wired
- `ShoppingListPage` — real items grouped by project, add item with project selector, purchased section, clear history
- `PhotosPage` — real Supabase Storage upload (project-photos bucket), project selector, calls agent-photo-tagger
- `ReceiptsPage` — real upload to receipts bucket, project selector, calls agent-receipt-processor, writes to expenses
- `NotesPage` — project selector (localStorage persisted), add daily log writes to daily_logs, change order flags write to change_orders
- `EmployeeChecklistsPage` — real checklist_instance_items from Supabase, mark complete persists

### MOCK DATA (UI complete, needs wiring)
- `ProjectsPage` — MOCK_PROJECTS
- `FinancialsPage` — MOCK_FINANCIALS, MOCK_INVOICES, MOCK_PROJECTS
- `PayrollDashboardPage` — MOCK_PAY_PERIODS, MOCK_PAYROLL_RECORDS
- `ClientProgress` — hardcoded phases + static updates
- `ClientInvoices` — hardcoded inline demo data
- `CompliancePage` — MOCK_COMPLIANCE_ITEMS

### PARTIAL (Supabase wired but incomplete logic)
- ProjectDetailPage, SubcontractorsPage, ProposalsPage, SchedulePage
- WalkthroughPage, ChecklistsPage, PortfolioPage, WarrantyPage
- All payroll sub-pages (PayPeriodDetail, PayrollWorkers, WorkerSetup, etc.)
- All budget components (BudgetSetup, BudgetTab, QuoteCollection, etc.)
- MessagesPage, BonusTrackerPage, SchedulePageEmployee (UI + partial data)
- All client pages (Photos, Selections, Messages, Schedule, PunchList, Docs, Referral)
- Settings pages (Agents, Approvals, MemoryInspector, Materials, ToolRequests, Rates, Checklists, EstimateTemplates, Backups)
- MetaAgentPage, ImprovementQueuePage, AICommandPage

### COMPLETE (demo / no real data needed)
- `EmployeeDemoShell` — interactive demo at /demo/employee
- `HomeownerDemoShell` — homeowner experience at /experience
- `LoginPage` — Supabase auth

---

## Edge Functions (60 deployed)

### Proactive Agents (scheduled)
agent-morning-brief, agent-lead-aging, agent-weekly-client-update,
agent-risk-monitor, agent-daily-log, agent-invoice-aging,
agent-bonus-qualification, agent-cash-flow, agent-weekly-financials,
agent-sub-insurance-alert, agent-review-request, agent-warranty-tracker,
agent-weather-schedule, agent-social-content, agent-compliance-monitor

### Reactive Agents (event-triggered)
agent-receipt-processor, agent-photo-tagger, agent-lead-intake,
agent-change-order-drafter, agent-invoice-generator, agent-document-classifier,
agent-sub-invoice-matcher, agent-punch-list, agent-voice-transcriber,
agent-call-summarizer, agent-quote-reader, agent-portfolio-curator,
agent-referral-intake, agent-warranty-intake, agent-inspection-analyzer,
agent-tool-request, agent-sms-responder, agent-generate-scope,
agent-generate-contract, agent-schedule-optimizer, agent-generate-reel,
agent-conversation-transcriber, agent-calibrate-templates

### Infrastructure
meta-agent-chat, meta-agent-orchestration, meta-agent-open-pr,
assemble-context, generate-embedding, update-operational-memory,
extract-preferences, generate-pdf, get-usage-stats

### Business Logic
calculate-payroll, generate-payroll-register, budget-ai-action,
compare-budget-quotes, process-budget-document, generate-checklists,
generate-improvement-spec, demo-ai, github-webhook, sync-to-drive,
sync-to-gusto, backup-daily, backup-storage-manifest

---

## Supabase Project
- **ID:** mebzqfeeiciayxdetteb
- **URL:** https://mebzqfeeiciayxdetteb.supabase.co
- Full schema deployed (all tables from CLAUDE.md)
- RLS active
- api_usage_log table live
- Secrets: ANTHROPIC_API_KEY, GEMINI_API_KEY, TWILIO_*, RESEND_API_KEY, STRIPE_*

## Database State
- Cleared of all mock/test data (fresh as of 2026-04-08)
- business_context table has Adam's company context
- No live projects, leads, invoices, or employees yet

---

## What Needs Work (Priority Order)

### 1. HIGH — Wire mock pages to real Supabase data
These have complete UIs but display fake data in production:
- CRMPage (leads, kanban, activity)
- ProjectsPage + ProjectDetailPage
- FinancialsPage
- InvoicesPage
- TimeClockPage (clock in/out with real GPS + project assignment)
- EmployeeHome

### 2. HIGH — Employee tools fully functional
Pages exist but data isn't wired end-to-end:
- ShoppingList, Receipts, Photos, Messages, Notes, Bonus, Schedule

### 3. MEDIUM — Payroll system (Gusto sync + real pay periods)
- PayrollDashboard + all sub-pages using mock data
- calculate-payroll + sync-to-gusto edge functions not hooked up

### 4. MEDIUM — Client portal (real project data)
- ClientProgress + ClientInvoices hardcoded — need real project_id routing

### 5. MEDIUM — Proposals + contracts flow end-to-end
- ProposalsPage partial, no e-signature flow yet

### 6. LOW — AI agents hooked to scheduler
- All 40 agents deployed but none are on a cron schedule yet

---

## Recommended Next Sessions

**Wire CRM + Projects to real data:**
> "Read SESSION_STATE.md and BUILD_QUEUE.md. Replace all mock data in CRMPage and ProjectsPage with real Supabase queries. Full kanban pipeline, lead details, activity timeline."

**Wire Financials + Invoices to real data:**
> "Read SESSION_STATE.md and BUILD_QUEUE.md. Replace mock data in FinancialsPage and InvoicesPage with real Supabase queries. Real P&L, invoice creation, payment tracking."

**Wire employee tools end-to-end:**
> "Read SESSION_STATE.md and BUILD_QUEUE.md. Wire all employee pages to real Supabase: time clock (GPS + project selection), shopping list, receipts, photos, messages."

**Payroll end-to-end:**
> "Read SESSION_STATE.md and BUILD_QUEUE.md. Wire payroll dashboard to real Supabase data. Hook up calculate-payroll edge function and sync-to-gusto."

**Client portal real data:**
> "Read SESSION_STATE.md and BUILD_QUEUE.md. Wire client portal (ClientProgress, ClientInvoices) to real project data. Add project_id routing so each client sees their own project."
