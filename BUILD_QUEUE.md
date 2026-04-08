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
- [x] CRMPage — real leads kanban, drag-to-move (@dnd-kit), Add Lead, activity timeline ✅ Session 4
- [ ] ProjectsPage — wire to projects table (list, filters, status)
- [ ] ProjectDetailPage — wire all tabs to real data
- [ ] FinancialsPage — wire to invoices, expenses, projects tables
- [x] InvoicesPage — create, send (generate-pdf), mark paid ✅ Session 4
- [x] TimeClockPage — clock in/out to time_entries with GPS, manual entry ✅ Session 4
- [x] EmployeeHome (FieldLaunchpadPage) — all 9 cards real Supabase data ✅ Session 4

### P1 — Employee tools end-to-end
- [x] ShoppingListPage — real items, add with project selector, purchased section ✅ Session 4
- [x] ReceiptsPage — upload to receipts bucket, agent-receipt-processor, writes to expenses ✅ Session 4
- [x] PhotosPage — upload to project-photos bucket, agent-photo-tagger ✅ Session 4
- [ ] MessagesPage — wire to messages table
- [x] NotesPage — daily_logs + change_orders writes, project selector ✅ Session 4
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
| 2026-04-08 | Session 5: Fixed Supabase getSession() deadlock (Promise.race with 6s timeout). Auth context now unblocks within 6s even if token refresh stalls. Committed a6708aa + 1eb4116. |
| 2026-04-08 | Session 4: Wired CRM kanban drag-to-move (@dnd-kit), Add Lead slide-over, InvoicesPage (create/send/markPaid), TimeClockPage DB persistence + GPS, ShoppingList overhaul, Photos/Receipts real upload + AI, NotesPage project selector + daily log writes. Back arrows on all employee pages. All items committed and pushed. |
| 2026-04-08 | Cleared mock DB data. Built: business context editor, onboarding wizard, meta agent overhaul, API usage bar, AdminDashboard real-data rewrite. Fixed Vercel build. Set bypassPermissions. Updated SESSION_STATE to reflect full app inventory (75 routes, 45 pages, 60 edge functions). |
