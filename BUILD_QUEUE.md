# BUILD QUEUE

## Global Build Override Rules
- `bypassPermissions` is active — never ask for approval on any tool call
- Never ask "what should I work on" — read SESSION_STATE.md and the user's prompt, infer, and start
- Always commit after each meaningful unit of work (not after every file — after a feature is complete and working)
- Always verify in the browser preview before committing
- No mock data — everything must be wired to real Supabase queries
- No horizontal scrolling anywhere
- Mobile-first — every screen must work one-handed on a phone

## Phase Checklist

### Phase 1 — Foundation ✅ COMPLETE
- [x] Project setup: Vite + React + TypeScript + Tailwind + shadcn/ui
- [x] Supabase: schema, RLS, auth
- [x] Design system: cards, pills, inputs, nav
- [x] Auth: login, signup, role-based routing
- [x] Admin dashboard (real data, empty states)
- [x] Employee launchpad (9 action cards)
- [x] Time clock with GPS
- [x] Basic project CRUD
- [x] AI command bar (meta agent)
- [x] API usage tracking bar
- [x] Business context editor
- [x] Onboarding wizard (client/employee/sub)

### Phase 2 — Employee Tools 🔴 IN PROGRESS (due July 1)
- [ ] Shopping list
- [ ] Receipt scanner (camera + AI extract)
- [ ] Photo upload with category picker
- [ ] Schedule view (employee)
- [ ] Task management
- [ ] Daily log (AI auto-draft)
- [ ] Messages
- [ ] Notes + change order flagging
- [ ] Client info card
- [ ] Bonus tracker display

### Phase 3 — Financial Core
- [ ] Expense tracking + job costing
- [ ] Invoice CRUD + delivery
- [ ] Purchase orders
- [ ] P&L per project
- [ ] Company financial dashboard
- [ ] Bonus auto-calculation
- [ ] QuickBooks integration

### Phase 4 — CRM + Sales Pipeline
- [ ] Lead kanban + list views
- [ ] Lead detail + activity timeline
- [ ] AI follow-up drafts
- [ ] Website inquiry form
- [ ] Referral tracking

### Phase 5 — Proposals + Contracts
- [ ] AI site walk / walkthrough system
- [ ] Estimate generation
- [ ] Proposal builder + send + tracking
- [ ] Contract + e-signature
- [ ] Template library

### Phase 6 — Client Portal (real data)
- [ ] Client auth wired to real projects
- [ ] Selection checklist from proposal
- [ ] Stripe invoice payments
- [ ] Punch list sign-off

### Phase 7 — Advanced
- [ ] Subcontractor management
- [ ] Permit tracking
- [ ] Change order workflow
- [ ] Warranty tracking
- [ ] Compliance page (real data)

### Phase 8 — Full AI Agent
- [ ] Risk-based action execution
- [ ] Email/SMS on behalf of admin
- [ ] Social media post flow
- [ ] Voice transcription + filing
- [ ] Financial projections

---

## Session Log

| Date | Work Done |
|------|-----------|
| 2026-04-08 | Phase 1 complete. Cleared mock data. Built: business context editor, onboarding wizard, meta agent overhaul, API usage bar, AdminDashboard real-data rewrite. Fixed Vercel build (unused import). Set bypassPermissions. |
