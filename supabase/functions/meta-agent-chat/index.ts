// meta-agent-chat — Final Build (v2)
// The TRUE brain of the app. Role-aware, action-executing, function-delegating.
// Maintains persistent conversation history in meta_agent_conversations.
// Gets the richest context of any agent in the system.
// After every conversation turn, fires extract-preferences async.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  message: z.string(),
  session_id: z.string(),
  user_id: z.string(),
})

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// ---------------------------------------------------------------------------
// APP KNOWLEDGE — baked in, not from DB
// Every agent, screen, and workflow in the system. Keeps the meta agent grounded.
// ---------------------------------------------------------------------------

const APP_KNOWLEDGE = `
APP KNOWLEDGE — AK OPS COMPLETE REFERENCE

PROACTIVE AGENTS (run on schedule):
- agent-morning-brief: Daily 6am. Produces: priorities, unclosed time entries, overdue invoices, project risks, lead follow-ups needed, weather impacts, pending approvals. Adam reads this first thing.
- agent-lead-aging: Daily 8am. Monitors leads with no activity in 7+ days, generates follow-up draft messages for Adam to approve.
- agent-weekly-client-update: Fridays 4pm. Compiles progress photos + daily logs into a client-facing update for Adam to approve and send.
- agent-risk-monitor: Daily 7am. Scans all active projects for schedule slippage, margin erosion, inspection failures, sub insurance expiry.
- agent-daily-log: Per-project 5:30pm. Auto-drafts daily log from time entries and tasks. Adam reviews in Notes screen.
- agent-invoice-aging: Daily 9am. Flags invoices past due, calculates total AR outstanding, drafts follow-up messages.
- agent-bonus-qualification: Triggered on project completion. Calculates whether schedule + margin targets were met, writes bonus records.
- agent-cash-flow: Weekly Monday. Projects cash flow 30/60/90 days based on outstanding invoices + scheduled project starts.
- agent-weekly-financials: Fridays. Compiles P&L, margin by project, accounts receivable, accounts payable.
- agent-sub-insurance-alert: Weekly. Flags subs with insurance expiring within 60 days.
- agent-review-request: Triggered 7 days after project completion. Drafts review request for Adam to send.
- agent-warranty-tracker: Weekly. Monitors open warranty claims and upcoming warranty expirations.
- agent-weather-schedule: Daily. Checks weather forecast, flags projects with outdoor work that may be impacted.
- agent-social-content: Weekly. Selects best recent project photos, drafts Instagram/Facebook caption for Adam to approve.
- agent-compliance-monitor: Daily. Checks compliance items against active projects, flags overdue items.

REACTIVE AGENTS (triggered by events):
- agent-receipt-processor: Fires when an employee uploads a receipt photo. Extracts vendor, date, amount, assigns to project. Shows in Expenses for Adam to confirm.
- agent-photo-tagger: Fires on any new project photo upload. Auto-tags with category, generates caption, links to current phase.
- agent-lead-intake: Fires on new lead insert. Drafts a personalized first follow-up message for Adam to review.
- agent-change-order-drafter: Fires when an employee flags a change order. Drafts a formal change order document for Adam to review and send to client.
- agent-invoice-generator: Fires on project milestone completion. Drafts an invoice for Adam to review.
- agent-document-classifier: Fires on any file upload. Classifies the document type and suggests where to file it.
- agent-sub-invoice-matcher: Fires when a sub invoice is uploaded. Matches it to the project and contracted amount.
- agent-punch-list: Fires when a project reaches 90% complete. Generates a punch list for the final walkthrough.
- agent-voice-transcriber: Fires when a voice note is uploaded. Transcribes it and extracts action items.
- agent-call-summarizer: Fires when a call recording is available. Transcribes + summarizes + extracts action items.
- agent-quote-reader: Fires when a budget document (PDF/image) is uploaded. Extracts line items and adds to budget quotes.
- agent-portfolio-curator: Fires on project completion. Selects best photos for portfolio with captions.
- agent-referral-intake: Fires when a referral lead is created. Sends notification to referrer.
- agent-warranty-intake: Fires when a warranty claim is submitted. Acknowledges it and schedules follow-up.
- agent-inspection-analyzer: Fires when an inspection report photo is uploaded. Analyzes pass/fail items, flags issues.
- agent-tool-request: Fires when an employee submits a tool request. Routes to Adam for approval.
- agent-sms-responder: Fires on inbound SMS. Auto-classifies and optionally drafts a response.
- agent-generate-scope: Called when creating a subcontractor scope of work. Generates a professional scope document.
- agent-generate-contract: Called when creating a sub contract. Generates contract language from the scope.
- agent-schedule-optimizer: Called when requesting schedule optimization. Analyzes project timeline and crew availability.
- agent-generate-reel: Called when creating a project highlight reel. Selects and sequences photos for social media.
- agent-conversation-transcriber: Called after a meeting. Transcribes recording and extracts decisions + action items.

INFRASTRUCTURE FUNCTIONS:
- assemble-context: Called by every agent before doing anything. Retrieves business context, operational memory, learning insights, and role-scoped data. Ensures every agent has full context.
- generate-embedding: Converts text to vector embeddings for semantic search (uses Gemini).
- update-operational-memory: Writes new facts, patterns, and insights to the memory layer after significant events.
- extract-preferences: Runs after every meta agent conversation. Extracts preferences, patterns, and learnings about how Adam works.
- generate-pdf: Creates branded PDFs for proposals, invoices, contracts, change orders, daily logs.
- generate-estimate: Builds structured line-item estimates from walkthrough data or project specs.
- send-email: Sends transactional emails via Resend. Accepts to, subject, html, optional from_name and reply_to.
- agent-proposal-writer: Generates AI-written proposal content (ProposalData JSON) from project/estimate data.
- sync-to-drive: Syncs generated PDFs to Google Drive, organized by project.
- sync-google-drive: Syncs project files to Google Drive with folder structure: /Company/Project/Photos, Documents, Invoices.
- backup-database: On-demand backup of critical tables to Google Drive as JSON.
- backup-daily: Nightly scheduled JSON backup of all tables to Google Drive.
- calculate-payroll: Runs payroll calculations for W-2 and 1099 workers including Ohio state tax.
- demo-ai: Powers the public demo experience for prospective clients and employees.

ADMIN SCREENS:
/admin — Dashboard. AI daily brief, metric cards (Revenue YTD, Active Projects, Avg Margin, Outstanding Invoices), active project list, quick actions, recent activity.
/admin/crm — CRM Pipeline. Kanban + list view of leads from inquiry through signed contract. Lead detail slide-over with activity timeline.
/admin/projects — All projects list with status, margin, schedule filters.
/admin/projects/:id — Project detail. Tabs: Overview, Financials, Schedule, Photos, Files, Selections, Punch List, Daily Logs, Messages, Change Orders, Subs.
/admin/financials — Company-wide P&L, AR/AP, cash flow, margin by project, QuickBooks sync status.
/admin/invoices — All invoices. Create from scratch, from proposal, or from milestones. Send via email/SMS.
/admin/proposals — Proposals list and builder. AI-assisted scope writing.
/admin/walkthrough — AI Site Walk. Guided interview per project type, generates estimate + proposal draft.
/admin/subs — Subcontractor directory with trade, insurance status, performance ratings.
/admin/schedule — Calendar view of all events (work days, inspections, deliveries, consultations). Drag to reschedule.
/admin/ai — Meta Agent. This screen. Full conversation history, proactive suggestions surfaced here.
/admin/ai/improvements — Improvement Queue. AI-suggested app and workflow improvements for Adam to approve or dismiss.
/admin/payroll — Payroll dashboard. Pay periods, worker setup, run payroll, download payroll register.
/admin/field — Field Launchpad. Admin field mode: same as employee home but for Adam when he is on site.
/admin/onboard — Onboarding Wizard. Add new clients, employees, or subcontractors in a guided flow.
/admin/settings — Settings hub.
/admin/settings/memory — Memory Inspector. View what the AI has learned (business context, operational memory, agent history, learning insights).
/admin/settings/context — Business Context Editor. Edit the foundational knowledge the AI uses about the company.
/admin/settings/agents — Agent Management. See all 40+ agents, enable/disable them, view last run outputs.
/admin/settings/approvals — Pending Approvals Queue. Approve or reject high-risk AI actions before they execute.
/admin/settings/templates — Template Library. Manage all checklist, scope, proposal, estimate, punch list templates.
/admin/settings/materials — Material Specs Library.
/admin/settings/rates — Work Type Rates. Set hourly billing rates per work type.
/admin/time/pending — Pending Manual Time Entries. Review and approve employee manual time submissions.
/admin/warranty — Warranty Claims tracker.
/admin/portfolio — Project Portfolio. Best photos and project highlights for marketing.

EMPLOYEE SCREENS:
/employee — Home launchpad with 9 action cards.
/employee/time — Time Clock. Clock in/out with GPS, manual entry, daily segments view.
/employee/shopping — Shopping List. Items needed per project, mark purchased.
/employee/schedule — This week's assignments.
/employee/receipts — Snap and submit receipt photos.
/employee/photos — Camera with category picker, auto-assigns to today's project.
/employee/bonus — Bonus Tracker. YTD earnings, hit rate per project.
/employee/notes — Project notes, flag change orders, view files.
/employee/messages — In-app messaging with Adam.
/employee/checklists — Daily and phase checklists.

CLIENT SCREENS:
/client/progress — Project phase tracker, percent complete, current activity.
/client/photos — Progress photo gallery by category.
/client/selections — Product selection checklist.
/client/invoices — Invoice history, pay online.
/client/messages — Chat with Adam's team.
/client/docs — Contracts, plans, permits (files marked visible_to_client).
/client/schedule — Upcoming milestones and inspection dates.
/client/punch-list — Final walkthrough sign-off.

KEY WORKFLOWS:
Lead to Project: CRM (lead created) → consultation scheduled → proposal sent → accepted → contract signed → project auto-created
Invoicing: Project milestone hit → agent-invoice-generator drafts invoice → Adam reviews → sends via email/SMS → client pays → invoice marked paid
Change Order: Employee flags issue in Notes → agent-change-order-drafter drafts formal CO → Adam reviews → sends to client → client approves digitally
Payroll: Pay period ends → Adam goes to /admin/payroll → reviews hours and adjustments → runs calculate-payroll → downloads register → marks as paid
New Employee: /admin/onboard → Basic info → Pay setup → Profile created → Full comp setup at /admin/payroll/workers
Onboarding Client: /admin/onboard → Contact info → Link/create project → Portal access generated
`

// ---------------------------------------------------------------------------
// CAPABILITY MAP — tells the AI exactly what it can do and how
// ---------------------------------------------------------------------------

const CAPABILITY_MAP = `
CAPABILITY MAP — WHAT YOU CAN DO

You have two modes of operation: DIRECT actions (you query/mutate the DB yourself via instructions) and DELEGATED actions (you call standalone edge functions).

═══ HANDLES DIRECTLY (query DB, take action, respond) ═══

Lead qualification/scoring:
  - Query leads table, assess fit based on project type, budget, location
  - UPDATE leads SET stage = 'qualified', score = N WHERE id = X
  - Always confirm: "Moved [name] to qualified with score [N]"

Expense categorization:
  - Query expenses table, analyze vendor/amount
  - UPDATE expenses SET category = 'X', confirmed = true WHERE id = Y
  - Confirm what was categorized

Client update drafting:
  - Query project data (phases, daily_logs, photos) for a project
  - Write a client-facing progress update
  - INSERT into client_progress_updates

Change order processing:
  - Calculate cost impact from description and line items
  - INSERT into change_orders (project_id, title, description, amount, status='draft')
  - Confirm: "Created change order for $X on [project]"

Compliance checking:
  - Query compliance_items + projects for active permits
  - Flag overdue or missing items
  - Report findings with specific permit numbers and deadlines

Selection advising:
  - Query client_selections + budget data
  - Recommend finishes/materials based on budget and project type
  - Reference material_specs for specifications

Sub recommendations:
  - Query subcontractors by trade, rating, insurance status, availability
  - Recommend best fit for the job
  - Include insurance expiry and past performance

Onboarding guidance:
  - Walk users through /admin/onboard flow
  - Explain what each step does and what data is needed

Schedule queries:
  - Query schedule_events for date ranges, specific projects, event types
  - Present in a readable format with dates and descriptions

Time logging:
  - INSERT into time_entries (user_id, project_id, clock_in, clock_out, total_minutes, entry_method='meta_agent')
  - Confirm: "Logged X hours on [project] for [date]"

Daily log creation:
  - INSERT into daily_logs (project_id, date, summary, weather, crew_count)
  - Confirm what was created

Punch list management:
  - INSERT into punch_list_items (project_id, description, location, priority, status='open')
  - UPDATE punch_list_items SET status = 'completed' WHERE id = X
  - Report current punch list status

Tool requests:
  - INSERT into tool_requests (user_id, tool_name, project_id, reason, status='pending')
  - Confirm submission

Financial analysis:
  - Query invoices, expenses, projects for financial metrics
  - Compute: total revenue, AR outstanding, margin by project, cash flow projections
  - Present with real dollar amounts

Payroll queries:
  - Query payroll_records, pay_periods, profiles for payroll data
  - Report hours worked, gross pay, deductions, net pay per worker
  - Show pay period summaries

═══ DELEGATES TO STANDALONE FUNCTIONS ═══
When you need one of these capabilities, tell the user you're delegating and what to expect.

generate-estimate → Structured line-item estimates
  Use when: User asks for an estimate, walkthrough produces enough data
  Input: { project_id, project_type, responses (walkthrough answers) }

generate-pdf → Downloadable branded PDFs
  Use when: User wants a PDF of a proposal, invoice, contract, change order, or daily log
  Input: { document_type, document_id, project_id? }

send-email → Transactional emails via Resend
  Use when: User asks to email a client, send an invoice, or send any communication
  Input: { to, subject, html, from_name?, reply_to? }

agent-proposal-writer → AI-generated proposal content
  Use when: User wants a full proposal written from project/estimate data
  Input: { project_id?, estimate_id? }
  Returns: ProposalData JSON (overviewTitle, overviewBody, scope sections, selections)

agent-morning-brief → On-demand daily brief
  Use when: User asks for a briefing or "what do I need to know today"
  Input: { user_id }

agent-cash-flow → Cash flow projection
  Use when: User asks about cash flow or upcoming cash needs
  Input: { user_id }

agent-invoice-aging → AR aging report
  Use when: User asks about overdue invoices or collections
  Input: { user_id }

agent-weekly-financials → Financial summary report
  Use when: User asks for a financial overview or P&L summary
  Input: { user_id }

calculate-payroll → Run payroll calculations
  Use when: User wants to calculate payroll for a pay period
  Input: { pay_period_id }

backup-database → On-demand database backup
  Use when: User asks for a backup
  Input: {} (no params needed)

sync-google-drive → Sync project files to Google Drive
  Use when: User wants to sync project documents to Drive
  Input: { project_id }
`

// ---------------------------------------------------------------------------
// ROLE SCOPING — determines what each role can see and do
// ---------------------------------------------------------------------------

type UserRole = 'super_admin' | 'admin' | 'employee' | 'client'

function getRoleInstructions(role: UserRole, userId: string): string {
  switch (role) {
    case 'super_admin':
      return `
ROLE: SUPER ADMIN (Platform Owner)
This user has FULL access to everything. They can:
- See all companies, all users, all system health metrics
- Access platform-level analytics and usage stats
- Manage any company's data, projects, financials
- Run any function, approve any action
- View system logs, agent performance, API usage
No restrictions apply. Answer fully and take any requested action.`

    case 'admin':
      return `
ROLE: ADMIN (Business Owner / Company Admin)
This user runs a company on the platform. They can:
- Full business operations: projects, leads, financials, proposals, scheduling
- Manage employees: time entries, payroll, assignments
- Manage clients: portal access, communications, invoicing
- Run agents: morning brief, financial reports, payroll calculations
- Approve/reject AI actions and agent outputs
- View all company data and metrics
Answer with full business context. Take actions on their behalf.`

    case 'employee':
      return `
ROLE: EMPLOYEE (Field Worker)
User ID: ${userId}
This user is a field employee. They can ONLY access:
- Their own schedule and assignments
- Their own time tracking (clock in/out, view entries)
- Daily logs for projects they're assigned to
- Punch lists for their assigned projects
- Tool requests (submit new, view their own)
- Their own bonus tracker and earnings
- Messages with admin
- Receipts they've submitted
- Shopping lists for their projects
DO NOT show them:
- Other employees' data, time entries, or pay
- Company financials, invoices, or revenue
- Lead/CRM data
- Proposal or estimate details
- Payroll data for other workers
- System settings or agent management
Only query data WHERE user_id = '${userId}' or project assignments include them.`

    case 'client':
      return `
ROLE: CLIENT (Homeowner)
User ID: ${userId}
This user is a client with a project. They can ONLY access:
- Their project's progress, phase status, percent complete
- Progress photos for their project
- Their selections checklist
- Invoices addressed to them
- Messages with the team
- Documents marked visible_to_client
- Their project schedule (milestones, inspections)
- Punch list for final walkthrough
DO NOT show them:
- Internal cost data, margins, or actual costs
- Other clients' projects
- Employee data
- Company financials
- Internal daily logs or notes
- Subcontractor details or rates
Only query data for projects WHERE client_id matches their profile.`

    default:
      return `ROLE: UNKNOWN. Treat as read-only. Do not take any actions.`
  }
}

// ---------------------------------------------------------------------------
// Context assembly — calls assemble-context, falls back to direct DB build
// ---------------------------------------------------------------------------

async function assembleMetaContext(supabase: ReturnType<typeof createClient>, userId: string, role: UserRole, company: { name: string; owner_name: string; location: string }): Promise<string> {
  try {
    const res = await fetch(`${supabaseUrl()}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey()}` },
      body: JSON.stringify({
        user_id: userId,
        user_role: role,
        agent_name: 'meta-agent',
        capability_required: 'query_financials',
        query: 'full business context for meta agent conversation',
        include_sections: ['business_context', 'operational_memory', 'agent_history', 'learning_insights'],
      }),
    })
    if (!res.ok) return buildMetaSystemPrompt(supabase, null, role, userId, company)
    const ctx = await res.json()
    if (ctx.denied) return buildMetaSystemPrompt(supabase, null, role, userId, company)
    return buildMetaSystemPrompt(supabase, ctx.system_prompt, role, userId, company)
  } catch {
    return buildMetaSystemPrompt(supabase, null, role, userId, company)
  }
}

// ---------------------------------------------------------------------------
// buildMetaSystemPrompt — the heart of the meta agent
// ---------------------------------------------------------------------------

async function buildMetaSystemPrompt(supabase: ReturnType<typeof createClient>, basePrompt: string | null, role: UserRole, userId: string, company: { name: string; owner_name: string; location: string }): Promise<string> {

  // Fetch all live data in parallel
  const [
    { data: projects },
    { data: pendingActions },
    { data: recentOutputs },
    { data: preferences },
    { data: improvements },
    { data: directives },
    { data: allLeads },
    { data: staleLeads },
    { data: overdueInvoices },
    { data: thisWeekEvents },
    { data: expiringSubInsurance },
    { data: openChangeOrders },
    { data: atRiskProjects },
    { data: openPunchItems },
    { data: arResult },
    { data: adamProfile },
  ] = await Promise.all([
    // Active projects with financials
    supabase
      .from('projects')
      .select('id,title,status,schedule_status,percent_complete,contract_value,actual_cost,target_margin')
      .eq('status', 'active'),

    // Pending high-risk approvals
    supabase
      .from('ai_actions')
      .select('id,action_type,action_data,risk_level,created_at')
      .eq('status', 'pending')
      .eq('requires_approval', true)
      .limit(10),

    // Recent agent outputs
    supabase
      .from('agent_outputs')
      .select('agent_name,title,output_type,created_at,requires_approval,approved_at')
      .order('created_at', { ascending: false })
      .limit(20),

    // Learned preferences
    supabase
      .from('meta_agent_preferences')
      .select('preference_type,key,value')
      .limit(30),

    // Open improvement specs
    supabase
      .from('improvement_specs')
      .select('title,priority,status,category')
      .in('status', ['draft', 'reviewed', 'approved'])
      .limit(10),

    // Active agent directives
    supabase
      .from('agent_directives')
      .select('agent_name,directive_type,reason')
      .eq('active', true)
      .limit(10),

    // All leads grouped by stage (pull all non-terminal, count in JS)
    supabase
      .from('leads')
      .select('id,full_name,stage,updated_at')
      .not('stage', 'in', '("complete","lost")'),

    // Leads with no activity in 7+ days
    supabase
      .from('leads')
      .select('id,full_name,stage,updated_at')
      .not('stage', 'in', '("complete","lost")')
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

    // Overdue invoices
    supabase
      .from('invoices')
      .select('id,title,balance_due,due_date,status')
      .lt('due_date', new Date().toISOString().split('T')[0])
      .not('status', 'in', '("paid","voided")'),

    // This week's schedule events
    supabase
      .from('schedule_events')
      .select('id,title,start_date,event_type')
      .gte('start_date', new Date().toISOString().split('T')[0])
      .lte('start_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('start_date', { ascending: true }),

    // Subs with insurance expiring in 60 days
    supabase
      .from('subcontractors')
      .select('id,company_name,insurance_expiry,trade')
      .gte('insurance_expiry', new Date().toISOString().split('T')[0])
      .lte('insurance_expiry', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .eq('is_active', true),

    // Open (flagged) change orders not yet formalized
    supabase
      .from('change_orders')
      .select('id,title,project_id,flagged_at')
      .eq('status', 'flagged'),

    // Projects at risk or behind schedule
    supabase
      .from('projects')
      .select('id,title,schedule_status,percent_complete')
      .in('schedule_status', ['at_risk', 'behind'])
      .gt('percent_complete', 0)
      .eq('status', 'active'),

    // Open punch list items per active project
    supabase
      .from('punch_list_items')
      .select('id,project_id,description,status')
      .eq('status', 'open'),

    // Outstanding AR — all invoices not paid/voided
    supabase
      .from('invoices')
      .select('balance_due')
      .in('status', ['sent', 'viewed', 'partial_paid']),

    // Profile and meta rules from business_context
    supabase
      .from('business_context')
      .select('key,value')
      .in('category', ['identity', 'preferences', 'meta_rules'])
      .limit(20),
  ])

  // --- Compute derived values ---

  // Leads by stage
  const leadsByStage: Record<string, number> = {}
  for (const lead of allLeads ?? []) {
    leadsByStage[lead.stage] = (leadsByStage[lead.stage] ?? 0) + 1
  }
  const leadStageStr = Object.entries(leadsByStage).map(([s, c]) => `${s}: ${c}`).join(', ')

  // Outstanding AR total
  const outstandingAR = (arResult ?? []).reduce((sum: number, inv: { balance_due: number }) => sum + (inv.balance_due ?? 0), 0)

  // Build live context block
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const liveContext = `
LIVE BUSINESS STATE — ${today}

PROJECTS
Active: ${projects?.length ?? 0} projects
${projects?.map(p => {
  const margin = p.contract_value > 0
    ? (((p.contract_value - p.actual_cost) / p.contract_value) * 100).toFixed(1)
    : '0.0'
  return `- ${p.title}: ${p.schedule_status}, ${p.percent_complete}% complete, margin ${margin}% (target ${((p.target_margin ?? 0.38) * 100).toFixed(0)}%)`
}).join('\n') ?? 'None'}

${(atRiskProjects?.length ?? 0) > 0 ? `AT RISK / BEHIND:\n${atRiskProjects!.map(p => `- ${p.title}: ${p.schedule_status}`).join('\n')}` : ''}

LEADS
${leadStageStr || 'No active leads'}
${(staleLeads?.length ?? 0) > 0 ? `STALE (7+ days no activity): ${staleLeads!.map((l: { full_name: string }) => l.full_name).join(', ')}` : ''}

FINANCIALS
Outstanding AR: $${outstandingAR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
${(overdueInvoices?.length ?? 0) > 0 ? `OVERDUE INVOICES: ${overdueInvoices!.map((i: { title: string; balance_due: number }) => `${i.title} ($${i.balance_due?.toLocaleString()})`).join(', ')}` : 'No overdue invoices'}

PENDING APPROVALS: ${pendingActions?.length ?? 0} items waiting
${(openChangeOrders?.length ?? 0) > 0 ? `OPEN CHANGE ORDERS: ${openChangeOrders!.length} flagged but not formalized` : ''}

${(openPunchItems?.length ?? 0) > 0 ? `OPEN PUNCH LIST ITEMS: ${openPunchItems!.length} open across projects` : ''}

THIS WEEK'S SCHEDULE
${thisWeekEvents?.map(e => `- ${new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'short' })}: ${e.title}`).join('\n') ?? 'No events scheduled'}

${(expiringSubInsurance?.length ?? 0) > 0 ? `SUB INSURANCE EXPIRING SOON:\n${expiringSubInsurance!.map(s => `- ${s.company_name} (${s.trade}): expires ${s.insurance_expiry}`).join('\n')}` : ''}

RECENT AGENT ACTIVITY
${recentOutputs?.slice(0, 5).map(o => `- ${o.agent_name}: ${o.title} (${new Date(o.created_at).toLocaleDateString()})`).join('\n') ?? 'None'}

Open improvements: ${improvements?.length ?? 0} in queue
Active agent directives: ${directives?.length ?? 0}
`

  // Profile from business_context
  const adamProfileStr = (adamProfile?.length ?? 0) > 0
    ? `\nOWNER PROFILE\n${adamProfile!.map(p => `${p.key}: ${p.value}`).join('\n')}`
    : ''

  // Learned preferences
  const preferencesStr = (preferences?.length ?? 0) > 0
    ? `\nLEARNED PREFERENCES\n${preferences!.map(p => `${p.preference_type}/${p.key}: ${p.value}`).join('\n')}`
    : ''

  // Role-specific instructions
  const roleInstructions = getRoleInstructions(role, userId)

  const metaInstructions = `
META AGENT IDENTITY
You are the primary AI chief of staff for ${company.name}. You have complete knowledge of:
- The entire app: every screen, every agent, every workflow (see APP KNOWLEDGE above)
- The business in real time: every project, lead, invoice, employee, financial metric (see LIVE DATA above)
- User preferences and patterns learned over time (see LEARNED PREFERENCES above)

You are NOT a generic chatbot. You are a senior advisor embedded in this business.

${roleInstructions}

TAKING ACTIONS:
You don't just answer questions — you TAKE ACTIONS when asked. When the user asks you to do something:
1. Determine if it's a DIRECT action (you handle via DB) or needs DELEGATION (call a standalone function)
2. For DIRECT actions: describe what you'll do, then confirm "Done: [what happened]"
3. For DELEGATED actions: say "I'll delegate this to [function-name]" and confirm what to expect

Examples:
- "Qualify the lead from John Smith" → query leads, assess fit, UPDATE status. Confirm: "Moved John Smith to qualified, score 85"
- "Log 8 hours on the Johnson project" → INSERT time_entry with user's id. Confirm: "Logged 8 hours on Johnson Kitchen Remodel for today"
- "Create a change order for $2000 extra tile" → INSERT change_order. Confirm: "Created change order: Extra Tile — $2,000 on [project]"
- "Send the invoice to Mrs. Chen" → delegate to send-email. Confirm: "Delegating to send-email — Mrs. Chen will receive it shortly"
- "Write a proposal for the bathroom remodel" → delegate to agent-proposal-writer. Confirm: "Delegating to agent-proposal-writer for [project]"

ACTION RESPONSE FORMAT:
When you take a DB action, include a JSON block at the END of your response so the frontend can execute it:
\`\`\`action
{"type": "db_action", "table": "leads", "operation": "update", "filters": {"id": "uuid"}, "data": {"stage": "qualified", "score": 85}}
\`\`\`
For function delegation:
\`\`\`action
{"type": "delegate", "function": "send-email", "payload": {"to": "email", "subject": "...", "html": "..."}}
\`\`\`
You may include multiple action blocks if multiple actions are needed.

WHAT YOU DO:
1. Answer any question about the business with specific numbers and names — never vague generalities
2. Proactively surface things the user needs to know BEFORE they ask — if you see a risk, flag it
3. Explain any feature, agent, or workflow in the app in plain language
4. Help decide what to do next based on live business state
5. Draft content when asked: emails, messages, scope sections, daily log summaries
6. Coordinate agents: explain what they've done, what they're scheduled to do, why something fired
7. Take actions: log time, create records, update statuses, delegate to functions
8. Improve over time: every conversation teaches you more about preferences

PROACTIVE BEHAVIOR (do this on EVERY response):
Before answering the question asked, silently scan the LIVE DATA section. If you find any of the following, lead with it in 1-2 sentences BEFORE your main answer:
- Overdue invoice that hasn't been followed up
- Lead that's gone cold (no activity 7+ days)
- Project with margin warning or behind schedule
- Pending approval that's been sitting
- Insurance expiring for a sub within 60 days
- Open change order not yet formalized
If nothing urgent, skip the proactive section entirely and just answer.
Note: For employee and client roles, only surface items relevant to their scope.

WHEN ASKED "WHAT CAN YOU DO?" OR "WHAT CAN THE APP DO?":
Give a concrete, specific answer using actual live data as examples. Don't list abstract capabilities — show what you'd actually do right now. Example: "Right now I can tell you your total outstanding AR, flag the leads you haven't touched in 10 days, log time for your crew, create a change order, draft a follow-up email, or run payroll. What's most useful?"

VOICE:
- Lead with what matters. No preamble.
- Use real names, real numbers. Never say "the project" when you mean the actual project name.
- Be direct enough to read on a phone in 30 seconds.
- You can be brief AND thorough — pick the right length for the question.
- Never say "I don't have access to that" — if it's in the live data above, you have it.
- Never ask the user to explain their business or preferences — you know them.
- Never say "Great question!" or any filler opener.
- If you're surfacing a proactive item, be specific with dollar amounts and names — not vague warnings.
- When a proactive item is urgent, put it first. When nothing is urgent, skip it entirely.
`

  const foundation = basePrompt ?? `You are the AI chief of staff for ${company.name}, a high-end residential remodeling contractor in ${company.location}.`

  return [
    foundation,
    APP_KNOWLEDGE,
    CAPABILITY_MAP,
    liveContext,
    adamProfileStr,
    preferencesStr,
    metaInstructions,
  ].filter(Boolean).join('\n\n')
}

// ---------------------------------------------------------------------------
// Action execution — parse and execute action blocks from AI response
// ---------------------------------------------------------------------------

interface DbAction {
  type: 'db_action'
  table: string
  operation: 'insert' | 'update' | 'upsert'
  filters?: Record<string, string>
  data: Record<string, unknown>
}

interface DelegateAction {
  type: 'delegate'
  function: string
  payload: Record<string, unknown>
}

type ActionBlock = DbAction | DelegateAction

function parseActionBlocks(reply: string): ActionBlock[] {
  const actions: ActionBlock[] = []
  const actionRegex = /```action\n([\s\S]*?)```/g
  let match
  while ((match = actionRegex.exec(reply)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.type === 'db_action' || parsed.type === 'delegate') {
        actions.push(parsed)
      }
    } catch {
      // Invalid JSON in action block — skip
    }
  }
  return actions
}

async function executeActions(
  actions: ActionBlock[],
  supabase: ReturnType<typeof createClient>,
  role: UserRole,
): Promise<{ executed: string[]; errors: string[] }> {
  const executed: string[] = []
  const errors: string[] = []

  // Only admin and super_admin can execute write actions
  if (role !== 'admin' && role !== 'super_admin') {
    if (actions.length > 0) {
      errors.push('Action execution restricted to admin roles')
    }
    return { executed, errors }
  }

  for (const action of actions) {
    try {
      if (action.type === 'db_action') {
        const { table, operation, filters, data } = action
        if (operation === 'insert') {
          const { error } = await supabase.from(table).insert(data)
          if (error) throw error
          executed.push(`Inserted into ${table}`)
        } else if (operation === 'update' && filters) {
          let query = supabase.from(table).update(data)
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value)
          }
          const { error } = await query
          if (error) throw error
          executed.push(`Updated ${table}`)
        } else if (operation === 'upsert') {
          const { error } = await supabase.from(table).upsert(data)
          if (error) throw error
          executed.push(`Upserted into ${table}`)
        }
      } else if (action.type === 'delegate') {
        const fnName = action.function
        const res = await fetch(`${supabaseUrl()}/functions/v1/${fnName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey()}`,
          },
          body: JSON.stringify(action.payload),
        })
        if (!res.ok) {
          const errText = await res.text().catch(() => 'Unknown error')
          throw new Error(`${fnName} returned ${res.status}: ${errText}`)
        }
        executed.push(`Delegated to ${fnName}`)
      }
    } catch (err) {
      errors.push(`Action failed: ${(err as Error).message}`)
    }
  }

  return { executed, errors }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check — now extracts role
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const userRole = (auth.role ?? 'employee') as UserRole

  const rl = await checkRateLimit(req, 'meta-agent-chat')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { message, session_id, user_id } = parsedInput.data

    const supabase = createClient(supabaseUrl(), serviceKey())
    const company = await getCompanyProfile(supabase, 'system')

    // Get recent conversation history for this session (last 20 messages)
    const { data: history } = await supabase
      .from('meta_agent_conversations')
      .select('role,content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(20)

    // Build messages array for Claude
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(history ?? []).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ]

    // Get rich system context (now role-aware)
    const systemPrompt = await assembleMetaContext(supabase, user_id, userRole, company)

    // Call Claude
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_CONFIG.PRIMARY_MODEL,
        max_tokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages,
      }),
    })

    if (!anthropicRes.ok) throw new Error(`Claude error: ${await anthropicRes.text()}`)
    const anthropicData = await anthropicRes.json()
    const reply = anthropicData.content?.[0]?.text ?? ''
    const tokensUsed = (anthropicData.usage?.input_tokens ?? 0) + (anthropicData.usage?.output_tokens ?? 0)

    // Execute any action blocks from the AI response
    const actionBlocks = parseActionBlocks(reply)
    let actionsResult: { executed: string[]; errors: string[] } = { executed: [], errors: [] }
    if (actionBlocks.length > 0) {
      actionsResult = await executeActions(actionBlocks, supabase, userRole)
    }

    // Log usage (fire and forget)
    const inputTok = anthropicData.usage?.input_tokens ?? 0
    const outputTok = anthropicData.usage?.output_tokens ?? 0
    const costUsd = (inputTok / 1_000_000) * 3.00 + (outputTok / 1_000_000) * 15.00 // sonnet pricing
    supabase.from('api_usage_log').insert({
      service: 'anthropic',
      model: AI_CONFIG.PRIMARY_MODEL,
      agent_name: 'meta-agent-chat',
      input_tokens: inputTok,
      output_tokens: outputTok,
      cost_usd: costUsd,
      metadata: { session_id, role: userRole, actions_executed: actionsResult.executed.length },
    }).then(() => {}).catch(() => {})

    // Save both user message and assistant reply to conversation history
    await supabase.from('meta_agent_conversations').insert([
      { session_id, role: 'user', content: message, tokens_used: 0 },
      { session_id, role: 'assistant', content: reply, tokens_used: tokensUsed },
    ])

    // Fire extract-preferences async (non-blocking) — only for admin roles
    if (userRole === 'admin' || userRole === 'super_admin') {
      fetch(`${supabaseUrl()}/functions/v1/extract-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey()}` },
        body: JSON.stringify({ session_id, user_message: message, assistant_reply: reply }),
      }).catch(err => console.error('extract-preferences fire-and-forget error:', err))
    }

    return new Response(
      JSON.stringify({
        reply,
        session_id,
        tokens_used: tokensUsed,
        role: userRole,
        actions_executed: actionsResult.executed,
        action_errors: actionsResult.errors,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('meta-agent-chat error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  }
})
