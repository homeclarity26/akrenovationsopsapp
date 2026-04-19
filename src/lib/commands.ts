/**
 * Typed command registry for the Agent Bar.
 *
 * Each command has:
 *   - `id`          unique slug
 *   - `label`       display text
 *   - `icon`        emoji or Lucide icon name
 *   - `description` one-liner shown in search results
 *   - `roles`       which roles can see / invoke the command
 *   - `when`        predicate — is this command relevant right now?
 *   - `execute`     the action. Working commands call Supabase;
 *                   stubs log a placeholder.
 *
 * PR 18b owns the meta-agent-chat edge function. Commands here either
 * do client-side work (navigation, local writes) or fire a Supabase
 * function call and hand the result back to the overlay.
 */

import type { AppUser } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandRole = 'super_admin' | 'admin' | 'employee' | 'client' | 'platform_owner'

export interface CommandContext {
  /** Current react-router pathname */
  pathname: string
  /** Current user (may be null before auth settles) */
  user: AppUser | null
  /** Route params — e.g. `{ projectId: '...' }` extracted by caller */
  params: Record<string, string | undefined>
  /** Current UI mode — admin/super_admin in Field mode should see employee commands */
  currentMode?: 'admin' | 'field'
}

export interface CommandResult {
  ok: boolean
  message: string
  /** Optional structured data for the overlay to render */
  data?: Record<string, unknown>
}

export interface Command {
  id: string
  label: string
  icon: string
  description: string
  roles: CommandRole[]
  /** Return `true` if this command should appear in the current context. */
  when: (ctx: CommandContext) => boolean
  /** Run the command. Stubs resolve with a TODO message. */
  execute: (
    args: Record<string, unknown>,
    ctx: CommandContext,
  ) => Promise<CommandResult>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigation helper — dispatches agent:navigate event. */
function nav(path: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('agent:navigate', { detail: path }),
    )
  }
}

/** Build a navigate-style execute fn. */
function navigateTo(path: string | ((args: Record<string, unknown>, ctx: CommandContext) => string), logLabel?: string): Command['execute'] {
  return async (args, ctx) => {
    const target = typeof path === 'function' ? path(args, ctx) : path
    nav(target)
    console.log(`[command] ${logLabel ?? 'navigate'} — ${target}`)
    return { ok: true, message: '__navigate__', data: { path: target } }
  }
}

/** Build an agent-query execute fn. */
function agentQuery(query: string | ((args: Record<string, unknown>) => string)): Command['execute'] {
  return async (args) => {
    const q = typeof query === 'function' ? query(args) : query
    return { ok: true, message: '__agent_query__', data: { query: q } }
  }
}

/** True when the pathname starts with a project detail route. */
function isOnProject(ctx: CommandContext): boolean {
  return (
    /^\/admin\/projects\/[^/]+/.test(ctx.pathname) ||
    /^\/employee\/projects\/[^/]+/.test(ctx.pathname)
  )
}

// Admin roles shorthand
const ADMINS: CommandRole[] = ['super_admin', 'admin']
const ADMINS_EMP: CommandRole[] = ['super_admin', 'admin', 'employee']

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const COMMANDS: Command[] = [

  // =========================================================================
  // PLATFORM ADMIN (super_admin only)
  // =========================================================================

  {
    id: 'list_companies',
    label: 'List companies',
    icon: '🏢',
    description: 'View all companies on the platform',
    roles: ['super_admin'],
    when: () => true,
    execute: navigateTo('/admin/settings?tab=companies', 'list_companies'),
  },
  {
    id: 'create_company',
    label: 'Create company',
    icon: '🏗️',
    description: 'Register a new company on the platform',
    roles: ['super_admin'],
    when: () => true,
    execute: navigateTo('/admin/settings?tab=companies&action=new', 'create_company'),
  },
  {
    id: 'manage_users',
    label: 'Manage users',
    icon: '👥',
    description: 'View and manage all platform users',
    roles: ['super_admin'],
    when: () => true,
    execute: navigateTo('/admin/settings?tab=team', 'manage_users'),
  },
  {
    id: 'platform_stats',
    label: 'Platform stats',
    icon: '📊',
    description: 'View platform-wide analytics and usage',
    roles: ['super_admin'],
    when: () => true,
    execute: agentQuery('Show me platform-wide statistics: total companies, users, projects, and revenue.'),
  },
  {
    id: 'view_all_tenants',
    label: 'View all tenants',
    icon: '🌐',
    description: 'List all tenant accounts and their status',
    roles: ['super_admin'],
    when: () => true,
    execute: agentQuery('List all tenant companies with their status, user count, and subscription tier.'),
  },

  // =========================================================================
  // ADMIN — PROJECTS
  // =========================================================================

  {
    id: 'create_project',
    label: 'Create project',
    icon: '📁',
    description: 'Start a new project from scratch',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/projects?action=new', 'create_project'),
  },
  {
    id: 'search_projects',
    label: 'Search projects',
    icon: '🔍',
    description: 'Find a project by name, client, or address',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/projects', 'search_projects'),
  },
  {
    id: 'view_project_status',
    label: 'View project status',
    icon: '📋',
    description: 'Check status and progress of a project',
    roles: ADMINS,
    when: isOnProject,
    execute: async (args, ctx) => {
      const projectId = ctx.params.projectId ?? (args.projectId as string | undefined)
      if (!projectId) return { ok: false, message: 'Navigate to a project first.' }
      return { ok: true, message: '__agent_query__', data: { query: `What is the current status of project ${projectId}?` } }
    },
  },
  {
    id: 'assign_crew',
    label: 'Assign crew',
    icon: '👷',
    description: 'Assign team members to a project',
    roles: ADMINS,
    when: isOnProject,
    execute: async (args, ctx) => {
      const projectId = ctx.params.projectId ?? (args.projectId as string | undefined)
      if (!projectId) return { ok: false, message: 'Navigate to a project first.' }
      nav(`/admin/projects/${projectId}?tab=team&action=assign`)
      return { ok: true, message: '__navigate__', data: { path: `/admin/projects/${projectId}?tab=team&action=assign` } }
    },
  },
  {
    id: 'update_progress',
    label: 'Update progress',
    icon: '📈',
    description: 'Update completion percentage or milestones',
    roles: ADMINS,
    when: isOnProject,
    execute: async (args, ctx) => {
      const projectId = ctx.params.projectId ?? (args.projectId as string | undefined)
      if (!projectId) return { ok: false, message: 'Navigate to a project first.' }
      nav(`/admin/projects/${projectId}?tab=progress`)
      return { ok: true, message: '__navigate__', data: { path: `/admin/projects/${projectId}?tab=progress` } }
    },
  },
  {
    id: 'send_client_update',
    label: 'Send client update',
    icon: '💬',
    description: 'Send a progress update to the client',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery((args) => {
      const client = args.clientName ? ` to ${args.clientName}` : ''
      return `Draft a client progress update${client} summarizing recent work and next steps.`
    }),
  },
  {
    id: 'generate_progress_reel',
    label: 'Generate progress reel',
    icon: '🎬',
    description: 'Create a before/after photo reel for the client',
    roles: ADMINS,
    when: isOnProject,
    execute: async (args, ctx) => {
      const projectId = ctx.params.projectId ?? (args.projectId as string | undefined)
      if (!projectId) return { ok: false, message: 'Navigate to a project first.' }
      return { ok: true, message: '__agent_query__', data: { query: `Generate a progress photo reel for project ${projectId}.` } }
    },
  },
  {
    id: 'archive_project',
    label: 'Archive project',
    icon: '🗄️',
    description: 'Archive a completed or cancelled project',
    roles: ADMINS,
    when: isOnProject,
    execute: async (args, ctx) => {
      const projectId = ctx.params.projectId ?? (args.projectId as string | undefined)
      if (!projectId) return { ok: false, message: 'Navigate to a project first.' }
      return { ok: true, message: '__agent_query__', data: { query: `Archive project ${projectId}. Confirm the action.` } }
    },
  },

  // =========================================================================
  // ADMIN — CRM
  // =========================================================================

  {
    id: 'add_lead',
    label: 'Add lead',
    icon: '🎯',
    description: 'Create a new lead in the CRM pipeline',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/crm?action=new_lead', 'add_lead'),
  },
  {
    id: 'move_lead_stage',
    label: 'Move lead stage',
    icon: '➡️',
    description: 'Move a lead to a different pipeline stage',
    roles: ADMINS,
    when: (ctx) => ctx.pathname.includes('/crm'),
    execute: agentQuery((args) => {
      const lead = args.leadName ?? 'the selected lead'
      const stage = args.stage ?? 'the next stage'
      return `Move ${lead} to ${stage} in the CRM pipeline.`
    }),
  },
  {
    id: 'schedule_consultation',
    label: 'Schedule consultation',
    icon: '📅',
    description: 'Schedule a consultation with a prospective client',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/schedule?action=new', 'schedule_consultation'),
  },
  {
    id: 'send_followup',
    label: 'Send follow-up',
    icon: '📧',
    description: 'Send a follow-up email or message to a lead',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery((args) => {
      const lead = args.leadName ?? 'the lead'
      return `Draft a follow-up message for ${lead}.`
    }),
  },
  {
    id: 'view_pipeline',
    label: 'View pipeline',
    icon: '🔄',
    description: 'View the full CRM pipeline',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/crm', 'view_pipeline'),
  },

  // =========================================================================
  // ADMIN — MONEY / FINANCIALS
  // =========================================================================

  {
    id: 'generate_invoice',
    label: 'Generate invoice',
    icon: '🧾',
    description: 'Create a new invoice for a project',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/invoices?action=new', 'generate_invoice'),
  },
  {
    id: 'send_invoice',
    label: 'Send invoice',
    icon: '📤',
    description: 'Send an invoice to a client',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery((args) => {
      const client = args.clientName ?? 'the client'
      return `Send the latest pending invoice to ${client}.`
    }),
  },
  {
    id: 'mark_invoice_paid',
    label: 'Mark invoice paid',
    icon: '✅',
    description: 'Record a payment on an invoice',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery((args) => {
      const invoice = args.invoiceId ?? 'the selected invoice'
      return `Mark invoice ${invoice} as paid.`
    }),
  },
  {
    id: 'view_ar_outstanding',
    label: 'View AR outstanding',
    icon: '💰',
    description: 'Show accounts receivable and outstanding balances',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/financials?tab=ar', 'view_ar_outstanding'),
  },
  {
    id: 'view_margins',
    label: 'View margins',
    icon: '📊',
    description: 'Check profit margins across projects',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/financials?tab=margins', 'view_margins'),
  },
  {
    id: 'run_payroll',
    label: 'Run payroll',
    icon: '💵',
    description: 'Process payroll for the current period',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/payroll', 'run_payroll'),
  },
  {
    id: 'sync_quickbooks',
    label: 'Sync QuickBooks',
    icon: '🔗',
    description: 'Sync financial data with QuickBooks',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery('Sync all recent transactions and invoices with QuickBooks.'),
  },
  {
    id: 'sync_gusto',
    label: 'Sync Gusto',
    icon: '🔗',
    description: 'Sync payroll data with Gusto',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery('Sync payroll data with Gusto for the current pay period.'),
  },

  // =========================================================================
  // ADMIN — INVENTORY
  // =========================================================================

  {
    id: 'check_stock',
    label: 'Check stock',
    icon: '📦',
    description: 'Look up current stock levels for an item',
    roles: ADMINS_EMP,
    when: () => true,
    execute: async (args, ctx) => {
      const item = args.itemName as string | undefined
      if (item) {
        return { ok: true, message: '__agent_query__', data: { query: `What is the current stock level for "${item}"?` } }
      }
      const target = ctx.user?.role === 'employee' ? '/employee/stocktake' : '/admin/inventory'
      nav(target)
      return { ok: true, message: '__navigate__', data: { path: target } }
    },
  },
  {
    id: 'add_inventory_item',
    label: 'Add inventory item',
    icon: '➕',
    description: 'Add a new item to inventory tracking',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/inventory?action=add', 'add_inventory_item'),
  },
  {
    id: 'add_location',
    label: 'Add storage location',
    icon: '📍',
    description: 'Add a new warehouse or storage location',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/inventory?tab=locations&action=add', 'add_location'),
  },
  {
    id: 'view_alerts',
    label: 'View inventory alerts',
    icon: '🚨',
    description: 'Show low-stock and expiry alerts',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/inventory?tab=alerts', 'view_alerts'),
  },
  {
    id: 'reorder_item',
    label: 'Reorder item',
    icon: '🔁',
    description: 'Create a purchase order for a low-stock item',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery((args) => {
      const item = args.itemName ?? 'the selected item'
      return `Create a reorder for ${item} at the standard quantity.`
    }),
  },
  {
    id: 'inventory_report',
    label: 'Inventory report',
    icon: '📑',
    description: 'Generate a full inventory report',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery('Generate a comprehensive inventory report with stock levels, value, and alerts.'),
  },

  // =========================================================================
  // ADMIN — PEOPLE / HR
  // =========================================================================

  {
    id: 'add_employee',
    label: 'Add employee',
    icon: '🧑‍🔧',
    description: 'Invite a new team member',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/settings?tab=team&action=invite', 'add_employee'),
  },
  {
    id: 'assign_to_project',
    label: 'Assign to project',
    icon: '📌',
    description: 'Assign an employee to a project',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery((args) => {
      const person = args.employeeName ?? 'the employee'
      const project = args.projectName ?? 'the project'
      return `Assign ${person} to ${project}.`
    }),
  },
  {
    id: 'approve_time_entries',
    label: 'Approve time entries',
    icon: '✔️',
    description: 'Review and approve pending time entries',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/time?tab=approvals', 'approve_time_entries'),
  },
  {
    id: 'view_schedules',
    label: 'View schedules',
    icon: '🗓️',
    description: 'See team schedules and availability',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/schedule', 'view_schedules'),
  },
  {
    id: 'manage_roles',
    label: 'Manage roles',
    icon: '🔐',
    description: 'Change user roles and permissions',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/settings?tab=team', 'manage_roles'),
  },

  // =========================================================================
  // ADMIN — DOCUMENTS
  // =========================================================================

  {
    id: 'generate_proposal',
    label: 'Generate proposal',
    icon: '📝',
    description: 'Draft a new project proposal',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/proposals?action=new', 'generate_proposal'),
  },
  {
    id: 'create_estimate',
    label: 'Create estimate',
    icon: '🧮',
    description: 'Build a cost estimate for a project',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery((args) => {
      const project = args.projectName ?? 'the project'
      return `Create a detailed cost estimate for ${project}.`
    }),
  },
  {
    id: 'create_change_order',
    label: 'Create change order',
    icon: '📄',
    description: 'Create a change order for scope changes',
    roles: ADMINS,
    when: isOnProject,
    execute: async (args, ctx) => {
      const projectId = ctx.params.projectId ?? (args.projectId as string | undefined)
      if (!projectId) return { ok: false, message: 'Navigate to a project first.' }
      nav(`/admin/projects/${projectId}?tab=changes&action=new`)
      return { ok: true, message: '__navigate__', data: { path: `/admin/projects/${projectId}?tab=changes&action=new` } }
    },
  },
  {
    id: 'log_inspection',
    label: 'Log inspection',
    icon: '🔎',
    description: 'Record an inspection result',
    roles: ADMINS_EMP,
    when: () => true,
    execute: navigateTo('/admin/compliance?action=new_inspection', 'log_inspection'),
  },
  {
    id: 'generate_reel',
    label: 'Generate reel',
    icon: '🎥',
    description: 'Create a marketing reel from project photos',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery('Generate a marketing reel from the latest project photos.'),
  },

  // =========================================================================
  // ADMIN — COMMUNICATIONS
  // =========================================================================

  {
    id: 'send_update',
    label: 'Send update',
    icon: '💬',
    description: 'Send a message or status update',
    roles: ADMINS_EMP,
    when: () => true,
    execute: async (_args, ctx) => {
      const target = ctx.user?.role === 'employee' ? '/employee/messages' : '/admin/crm?tab=messages'
      nav(target)
      return { ok: true, message: '__navigate__', data: { path: target } }
    },
  },
  {
    id: 'invite_to_portal',
    label: 'Invite to portal',
    icon: '🔑',
    description: 'Send a client portal invitation',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery((args) => {
      const client = args.clientName ?? 'the client'
      return `Send a client portal invitation to ${client}.`
    }),
  },
  {
    id: 'log_conversation',
    label: 'Log conversation',
    icon: '📞',
    description: 'Log a phone call or conversation in the CRM',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/crm?action=log_conversation', 'log_conversation'),
  },
  {
    id: 'draft_email',
    label: 'Draft email',
    icon: '✉️',
    description: 'Draft an email to a client or team member',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery((args) => {
      const recipient = args.recipient ?? 'the recipient'
      const topic = args.topic ?? 'the project'
      return `Draft a professional email to ${recipient} about ${topic}.`
    }),
  },

  // =========================================================================
  // ADMIN — AI INSIGHTS
  // =========================================================================

  {
    id: 'review_suggestions',
    label: 'Review suggestions',
    icon: '💡',
    description: 'Review AI-generated suggestions and change orders',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery('Show me all pending AI suggestions and change orders that need review.'),
  },
  {
    id: 'whats_at_risk',
    label: "What's at risk?",
    icon: '⚠️',
    description: 'Show projects and items that need attention',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery('What projects or items are at risk right now? Show deadlines, budget issues, and blockers.'),
  },
  {
    id: 'morning_brief',
    label: 'Morning brief',
    icon: '☀️',
    description: 'Get your AI-powered morning briefing',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery('Give me my morning briefing: schedule, urgent items, project updates, and what needs attention today.'),
  },
  {
    id: 'weekly_financials',
    label: 'Weekly financials',
    icon: '📈',
    description: 'Get a weekly financial summary',
    roles: ADMINS,
    when: () => true,
    execute: agentQuery('Summarize this week\'s financials: revenue, expenses, outstanding invoices, and profit margins.'),
  },
  {
    id: 'improvement_ideas',
    label: 'Improvement ideas',
    icon: '🚀',
    description: 'Get AI suggestions to improve operations',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/improvements', 'improvement_ideas'),
  },

  // =========================================================================
  // ADMIN — SETTINGS
  // =========================================================================

  {
    id: 'configure_branding',
    label: 'Configure branding',
    icon: '🎨',
    description: 'Update company logo, colors, and branding',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/settings?tab=branding', 'configure_branding'),
  },
  {
    id: 'manage_integrations',
    label: 'Manage integrations',
    icon: '🔌',
    description: 'Configure QuickBooks, Gusto, and other integrations',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/settings?tab=integrations', 'manage_integrations'),
  },
  {
    id: 'ai_agent_settings',
    label: 'AI agent settings',
    icon: '🤖',
    description: 'Configure AI agent behavior and preferences',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/settings?tab=ai', 'ai_agent_settings'),
  },

  // =========================================================================
  // EMPLOYEE / FIELD
  // =========================================================================

  {
    id: 'clock_in',
    label: 'Clock in',
    icon: '⏰',
    description: 'Start your shift timer',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/time?action=clock_in', 'clock_in'),
  },
  {
    id: 'clock_out',
    label: 'Clock out',
    icon: '⏱️',
    description: 'End your shift and log hours',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/time?action=clock_out', 'clock_out'),
  },
  {
    id: 'add_past_time',
    label: 'Add past time',
    icon: '🕐',
    description: 'Log hours for a previous day',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/time?action=add_past', 'add_past_time'),
  },
  {
    id: 'log_daily',
    label: 'Daily log',
    icon: '📓',
    description: 'Fill out your daily field log',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/notes?action=daily_log', 'log_daily'),
  },
  {
    id: 'take_photo',
    label: 'Take photo',
    icon: '📸',
    description: 'Upload a jobsite photo',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/photos?action=upload', 'take_photo'),
  },
  {
    id: 'scan_receipt',
    label: 'Scan receipt',
    icon: '🧾',
    description: 'Scan and log a purchase receipt',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/receipts?action=scan', 'scan_receipt'),
  },
  {
    id: 'submit_stocktake',
    label: 'Submit stocktake',
    icon: '📦',
    description: 'Submit an inventory stocktake count',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/stocktake', 'submit_stocktake'),
  },
  {
    id: 'photo_stocktake',
    label: 'Photo stocktake',
    icon: '📷',
    description: 'Use camera to count inventory items',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/stocktake?mode=photo', 'photo_stocktake'),
  },
  {
    id: 'add_to_shopping',
    label: 'Add to shopping list',
    icon: '🛒',
    description: 'Add a material to the shopping list',
    roles: ADMINS_EMP,
    when: () => true,
    execute: async (_args, ctx) => {
      const target = ctx.user?.role === 'employee' ? '/employee/shopping' : '/admin/inventory?tab=shopping'
      nav(target)
      return { ok: true, message: '__navigate__', data: { path: target } }
    },
  },
  {
    id: 'request_tool',
    label: 'Request tool',
    icon: '🔧',
    description: 'Request a tool or equipment',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/tool-request', 'request_tool'),
  },
  {
    id: 'view_my_tasks',
    label: 'View my tasks',
    icon: '✅',
    description: 'See tasks assigned to you',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee', 'view_my_tasks'),
  },
  {
    id: 'add_task',
    label: 'Add task',
    icon: '✅',
    description: 'Add a task to the current project',
    roles: ADMINS_EMP,
    when: isOnProject,
    execute: async (args, ctx) => {
      const projectId = ctx.params.projectId ?? (args.projectId as string | undefined)
      if (!projectId) return { ok: false, message: 'No project context — navigate to a project first.' }
      nav(`/admin/projects/${projectId}?tab=tasks&action=add`)
      return { ok: true, message: '__navigate__', data: { path: `/admin/projects/${projectId}?tab=tasks&action=add` } }
    },
  },
  {
    id: 'complete_task',
    label: 'Complete task',
    icon: '☑️',
    description: 'Mark a task as complete',
    roles: ADMINS_EMP,
    when: isOnProject,
    execute: agentQuery((args) => {
      const task = args.taskName ?? 'the current task'
      return `Mark task "${task}" as complete.`
    }),
  },
  {
    id: 'complete_checklist_item',
    label: 'Complete checklist item',
    icon: '✔️',
    description: 'Check off a checklist item',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/checklists', 'complete_checklist_item'),
  },
  {
    id: 'view_my_schedule',
    label: 'View my schedule',
    icon: '📅',
    description: 'See your upcoming schedule',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/schedule', 'view_my_schedule'),
  },
  {
    id: 'send_message',
    label: 'Send message',
    icon: '💬',
    description: 'Send a message to the team or office',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: navigateTo('/employee/messages', 'send_message'),
  },

  // =========================================================================
  // CLIENT PORTAL
  // =========================================================================

  {
    id: 'check_progress',
    label: 'Check progress',
    icon: '📊',
    description: 'View the latest progress on your project',
    roles: ['client'],
    when: (ctx) => ctx.user?.role === 'client',
    execute: navigateTo('/client/progress', 'check_progress'),
  },
  {
    id: 'view_photos',
    label: 'View photos',
    icon: '📸',
    description: 'See project photos and before/after shots',
    roles: ['client'],
    when: (ctx) => ctx.user?.role === 'client',
    execute: navigateTo('/client/photos', 'view_photos'),
  },
  {
    id: 'view_invoices',
    label: 'View invoices',
    icon: '🧾',
    description: 'See your invoices and payment history',
    roles: ['client'],
    when: (ctx) => ctx.user?.role === 'client',
    execute: navigateTo('/client/invoices', 'view_invoices'),
  },
  {
    id: 'view_documents',
    label: 'View documents',
    icon: '📄',
    description: 'Access contracts, proposals, and documents',
    roles: ['client'],
    when: (ctx) => ctx.user?.role === 'client',
    execute: navigateTo('/client/documents', 'view_documents'),
  },
  {
    id: 'view_schedule',
    label: 'View schedule',
    icon: '📅',
    description: 'See upcoming work schedule and milestones',
    roles: ['client'],
    when: (ctx) => ctx.user?.role === 'client',
    execute: navigateTo('/client/schedule', 'view_schedule'),
  },
  {
    id: 'client_send_message',
    label: 'Send message',
    icon: '💬',
    description: 'Message your project team',
    roles: ['client'],
    when: (ctx) => ctx.user?.role === 'client',
    execute: navigateTo('/client/messages', 'client_send_message'),
  },
  {
    id: 'ask_about_project',
    label: 'Ask about your project',
    icon: '❓',
    description: 'Get an AI-powered update on your renovation',
    roles: ['client'],
    when: (ctx) => ctx.user?.role === 'client',
    execute: agentQuery('Give me a current update on my renovation project including progress, next steps, and timeline.'),
  },
  {
    id: 'pay_invoice',
    label: 'Pay invoice',
    icon: '💳',
    description: 'Make a payment on an outstanding invoice',
    roles: ['client'],
    when: (ctx) => ctx.user?.role === 'client',
    execute: navigateTo('/client/invoices?action=pay', 'pay_invoice'),
  },

  // =========================================================================
  // REMINDERS (all authenticated roles)
  // =========================================================================

  {
    id: 'view_reminders',
    label: 'View reminders',
    icon: '🔔',
    description: 'Open your reminders list',
    roles: ADMINS_EMP,
    when: () => true,
    execute: navigateTo(
      (_, ctx) => (ctx.user?.role === 'employee' ? '/employee/reminders' : '/admin/reminders'),
      'view_reminders',
    ),
  },
  {
    id: 'set_reminder',
    label: 'Set a reminder',
    icon: '⏰',
    description: 'Tell the AI: "remind me at 8am to grab the lights"',
    roles: ADMINS_EMP,
    when: () => true,
    execute: agentQuery('I want to set a reminder — ask me what it is and when.'),
  },
  {
    id: 'notification_settings',
    label: 'Notification settings',
    icon: '⚙️',
    description: 'Channels, sound, and time zone preferences',
    roles: ADMINS,
    when: () => true,
    execute: navigateTo('/admin/settings/notifications', 'notification_settings'),
  },
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Return commands visible to the current user/role.
 * When an admin or super_admin is operating in Field mode, they should see
 * employee commands (and vice-versa they should NOT see super-admin platform
 * commands). Effective role substitutes 'employee' in that case.
 */
export function getVisibleCommands(ctx: CommandContext): Command[] {
  const role = ctx.user?.role
  if (!role) return []
  const effectiveRole: CommandRole =
    (role === 'admin' || role === 'super_admin') && ctx.currentMode === 'field'
      ? 'employee'
      : role
  return COMMANDS.filter(
    (c) => c.roles.includes(effectiveRole) && c.when({ ...ctx, user: ctx.user && { ...ctx.user, role: effectiveRole } }),
  )
}

/** Find a command by exact id. */
export function findCommand(id: string): Command | undefined {
  return COMMANDS.find((c) => c.id === id)
}

/** Search commands by label substring (case-insensitive). */
export function searchCommands(
  query: string,
  ctx: CommandContext,
): Command[] {
  const q = query.toLowerCase()
  return getVisibleCommands(ctx).filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q),
  )
}
