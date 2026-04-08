# BUILD QUEUE

## Global Build Override Rules
- `bypassPermissions` is active — never ask for approval on any tool call
- Never ask "what should I work on" — read SESSION_STATE.md and the user's prompt, infer, and start
- Always commit after each meaningful unit of work
- Always verify in the browser preview before committing
- No mock data — everything must be wired to real Supabase queries
- No horizontal scrolling anywhere
- Mobile-first — every screen must work one-handed on a phone

---

## Current Status: DATA WIRING PHASE

The app is structurally complete — 75 routes, 45 pages, 60 edge functions, 3 layouts.
The primary remaining work is replacing mock data with real Supabase queries
and completing end-to-end workflows.

---

## Priority Queue

### P0 — Replace mock data in core admin screens
- [ ] CRMPage — wire to leads table (kanban, lead details, activity timeline)
- [ ] ProjectsPage — wire to projects table (list, filters, status)
- [ ] ProjectDetailPage — wire all tabs to real data
- [ ] FinancialsPage — wire to invoices, expenses, projects tables
- [ ] InvoicesPage — wire to invoices table (create, send, track, pay)
- [ ] TimeClockPage — wire to time_entries table (clock in/out, GPS, manual entry)
- [ ] EmployeeHome — wire to real schedule, time entries, checklists

### P1 — Employee tools end-to-end
- [ ] ShoppingListPage — wire to shopping_list_items table
- [ ] ReceiptsPage — camera → agent-receipt-processor → expenses table
- [ ] PhotosPage — upload → Supabase Storage → project_photos table
- [ ] MessagesPage — wire to messages table
- [ ] NotesPage — wire to daily_logs table
- [ ] BonusTrackerPage — wire to bonus_records table
- [ ] SchedulePageEmployee — wire to schedule_events table

### P2 — Payroll end-to-end
- [ ] PayrollDashboardPage — wire to pay_periods table (real data)
- [ ] PayPeriodDetailPage — wire calculate-payroll edge function
- [ ] PayrollWorkersPage — wire to profiles table (employees)
- [ ] WorkerSetupPage — wire to profiles + payroll_settings tables
- [ ] sync-to-gusto — hook up Gusto API
- [ ] PaystubsPage (employee) — wire to pay_periods table

### P3 — Client portal real data
- [ ] ClientProgress — wire to real project phases + percent_complete
- [ ] ClientInvoices — wire to invoices table filtered by client_user_id
- [ ] Client auth routing — each client routes to their project_id
- [ ] ClientSelections — wire to client_selections table
- [ ] ClientPunchList — wire to punch_list_items table

### P4 — Proposals + contracts flow
- [ ] ProposalsPage — wire to proposals table, builder complete
- [ ] E-signature flow — in-browser signature capture
- [ ] Contract generation from accepted proposal
- [ ] Auto-create project from signed contract

### P5 — AI agents on scheduler
- [ ] Set up cron triggers for proactive agents
- [ ] agent-morning-brief → 6am daily
- [ ] agent-weekly-client-update → Friday 4pm
- [ ] agent-invoice-aging → daily
- [ ] agent-lead-aging → daily
- [ ] agent-sub-insurance-alert → weekly

### P6 — Remaining partial pages
- [ ] SubcontractorsPage — full CRUD
- [ ] SchedulePage (admin calendar) — full event management
- [ ] WalkthroughPage — complete AI site walk flow
- [ ] ChecklistsPage — full lifecycle
- [ ] PortfolioPage — curation workflow
- [ ] WarrantyPage — claim intake + tracking
- [ ] CompliancePage — wire to real compliance items

---

## Session Log

| Date | Work Done |
|------|-----------|
| 2026-04-08 | Cleared mock DB data. Built: business context editor, onboarding wizard, meta agent overhaul, API usage bar, AdminDashboard real-data rewrite. Fixed Vercel build. Set bypassPermissions. Updated SESSION_STATE to reflect full app inventory (75 routes, 45 pages, 60 edge functions). |
