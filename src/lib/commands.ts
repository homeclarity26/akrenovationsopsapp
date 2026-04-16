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

export type CommandRole = 'super_admin' | 'admin' | 'employee' | 'client'

export interface CommandContext {
  /** Current react-router pathname */
  pathname: string
  /** Current user (may be null before auth settles) */
  user: AppUser | null
  /** Route params — e.g. `{ projectId: '...' }` extracted by caller */
  params: Record<string, string | undefined>
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

function stub(label: string): Command['execute'] {
  return async () => {
    // TODO: replace with toast
    console.log(`[command:stub] "${label}" is not yet wired up`)
    return { ok: false, message: `"${label}" coming soon` }
  }
}

/** True when the pathname starts with a project detail route. */
function isOnProject(ctx: CommandContext): boolean {
  return (
    /^\/admin\/projects\/[^/]+/.test(ctx.pathname) ||
    /^\/employee\/projects\/[^/]+/.test(ctx.pathname)
  )
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const COMMANDS: Command[] = [
  // ---- Working (end-to-end) ----
  {
    id: 'create_project',
    label: 'Create project',
    icon: '📁',
    description: 'Start a new project from scratch',
    roles: ['super_admin', 'admin'],
    when: () => true,
    execute: async (_args, _ctx) => {
      // Navigate to project creation — handled by overlay dispatching nav
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agent:navigate', { detail: '/admin/projects?action=new' }),
        )
      }
      // TODO: replace with toast
      console.log('[command] create_project — navigating to project create')
      return { ok: true, message: 'Opening new project form...' }
    },
  },
  {
    id: 'clock_in',
    label: 'Clock in',
    icon: '⏰',
    description: 'Start your shift timer',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: async (_args, _ctx) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agent:navigate', { detail: '/employee/time?action=clock_in' }),
        )
      }
      // TODO: replace with toast
      console.log('[command] clock_in — navigating to time clock')
      return { ok: true, message: 'Opening time clock...' }
    },
  },
  {
    id: 'add_task',
    label: 'Add task',
    icon: '✅',
    description: 'Add a task to the current project',
    roles: ['super_admin', 'admin', 'employee'],
    when: isOnProject,
    execute: async (args, ctx) => {
      const projectId = ctx.params.projectId ?? (args.projectId as string | undefined)
      if (!projectId) {
        return { ok: false, message: 'No project context — navigate to a project first.' }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agent:navigate', {
            detail: `/admin/projects/${projectId}?tab=tasks&action=add`,
          }),
        )
      }
      // TODO: replace with toast
      console.log('[command] add_task — opening task form for project', projectId)
      return { ok: true, message: 'Opening task form...' }
    },
  },
  {
    id: 'send_update',
    label: 'Send update',
    icon: '💬',
    description: 'Send a message or status update',
    roles: ['super_admin', 'admin', 'employee'],
    when: () => true,
    execute: async (_args, ctx) => {
      const target = ctx.user?.role === 'employee' ? '/employee/messages' : '/admin/crm?tab=messages'
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agent:navigate', { detail: target }),
        )
      }
      // TODO: replace with toast
      console.log('[command] send_update — opening messages')
      return { ok: true, message: 'Opening messages...' }
    },
  },
  {
    id: 'whats_at_risk',
    label: "What's at risk?",
    icon: '⚠️',
    description: 'Show projects and items that need attention',
    roles: ['super_admin', 'admin'],
    when: () => true,
    execute: async () => {
      // This fires the meta-agent for a risk summary — the overlay handles
      // the actual Supabase call, so we just return a message-type result.
      return {
        ok: true,
        message: '__agent_query__',
        data: { query: 'What projects or items are at risk right now?' },
      }
    },
  },
  {
    id: 'add_to_shopping',
    label: 'Add to shopping list',
    icon: '🛒',
    description: 'Add a material to the shopping list',
    roles: ['super_admin', 'admin', 'employee'],
    when: () => true,
    execute: async (_args, ctx) => {
      const target = ctx.user?.role === 'employee' ? '/employee/shopping' : '/admin/inventory?tab=shopping'
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agent:navigate', { detail: target }),
        )
      }
      // TODO: replace with toast
      console.log('[command] add_to_shopping — opening shopping list')
      return { ok: true, message: 'Opening shopping list...' }
    },
  },
  {
    id: 'review_pending',
    label: 'Review pending',
    icon: '📋',
    description: 'Review pending suggestions and change orders',
    roles: ['super_admin', 'admin'],
    when: () => true,
    execute: async () => {
      return {
        ok: true,
        message: '__agent_query__',
        data: { query: 'Show me all pending suggestions and change orders.' },
      }
    },
  },
  {
    id: 'check_inventory',
    label: 'Check inventory',
    icon: '📦',
    description: 'See current stock levels and alerts',
    roles: ['super_admin', 'admin', 'employee'],
    when: () => true,
    execute: async (_args, ctx) => {
      const target = ctx.user?.role === 'employee' ? '/employee/stocktake' : '/admin/inventory'
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('agent:navigate', { detail: target }),
        )
      }
      // TODO: replace with toast
      console.log('[command] check_inventory — opening inventory')
      return { ok: true, message: 'Opening inventory...' }
    },
  },

  // ---- Stubs (planned) ----
  {
    id: 'generate_invoice',
    label: 'Generate invoice',
    icon: '🧾',
    description: 'Create a new invoice for a project',
    roles: ['super_admin', 'admin'],
    when: () => true,
    execute: stub('Generate invoice'),
  },
  {
    id: 'write_proposal',
    label: 'Write proposal',
    icon: '📝',
    description: 'Draft a new project proposal',
    roles: ['super_admin', 'admin'],
    when: () => true,
    execute: stub('Write proposal'),
  },
  {
    id: 'schedule_meeting',
    label: 'Schedule meeting',
    icon: '📅',
    description: 'Schedule a client or team meeting',
    roles: ['super_admin', 'admin'],
    when: () => true,
    execute: stub('Schedule meeting'),
  },
  {
    id: 'daily_log',
    label: 'Daily log',
    icon: '📓',
    description: 'Fill out your daily log',
    roles: ['employee'],
    when: (ctx) => ctx.user?.role === 'employee',
    execute: stub('Daily log'),
  },
  {
    id: 'ask_about_project',
    label: 'Ask about your project',
    icon: '❓',
    description: 'Get an update on your renovation',
    roles: ['client'],
    when: (ctx) => ctx.user?.role === 'client',
    execute: stub('Ask about project'),
  },
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Return commands visible to the current user/role. */
export function getVisibleCommands(ctx: CommandContext): Command[] {
  const role = ctx.user?.role
  if (!role) return []
  return COMMANDS.filter(
    (c) => c.roles.includes(role) && c.when(ctx),
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
