/**
 * Hook: context-aware action chips for the Agent Overlay.
 *
 * Returns a list of quick-action chips based on the current route,
 * user role, time of day, and urgency signals. Chips are ranked by
 * relevance so the most useful actions appear first.
 */

import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { type Command, getVisibleCommands, type CommandContext, type CommandRole } from '@/lib/commands'
import { useMode } from '@/context/ModeContext'

export interface ContextChip {
  id: string
  label: string
  icon: string
  commandId: string
}

/** Maximum chips shown in the quick-actions row. */
const MAX_CHIPS = 8

/** Get the current hour (0-23). Extracted for testability. */
function currentHour(): number {
  return new Date().getHours()
}

export function useContextChips(): ContextChip[] {
  const { pathname } = useLocation()
  const params = useParams()
  const { user } = useAuth()
  const { currentMode } = useMode()

  return useMemo(() => {
    const ctx: CommandContext = {
      pathname,
      user,
      params: params as Record<string, string | undefined>,
      currentMode,
    }

    const visible = getVisibleCommands(ctx)
    // Effective role for scoring follows the same rule as getVisibleCommands.
    const rawRole = user?.role
    if (!rawRole) return []
    const role: CommandRole = (rawRole === 'admin' || rawRole === 'super_admin') && currentMode === 'field'
      ? 'employee'
      : rawRole

    // Score each command for contextual relevance
    const scored = visible.map((cmd) => ({
      cmd,
      score: scoreCommand(cmd, pathname, role, currentHour()),
    }))

    // Sort by score descending, take top MAX_CHIPS
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, MAX_CHIPS)

    return top.map(({ cmd }) => ({
      id: cmd.id,
      label: cmd.label,
      icon: cmd.icon,
      commandId: cmd.id,
    }))
  }, [pathname, params, user, currentMode])
}

// ---------------------------------------------------------------------------
// Scoring logic
// ---------------------------------------------------------------------------

function scoreCommand(
  cmd: Command,
  pathname: string,
  role: CommandRole,
  hour: number,
): number {
  let score = 0

  // --- Time-of-day boosts ---
  const isMorning = hour >= 5 && hour < 11
  const isEndOfDay = hour >= 16 && hour < 20

  if (isMorning && cmd.id === 'morning_brief') score += 50
  if (isMorning && cmd.id === 'clock_in') score += 40
  if (isEndOfDay && cmd.id === 'clock_out') score += 45
  if (isEndOfDay && cmd.id === 'log_daily') score += 40

  // --- Route-aware boosts ---

  // Project detail page
  const onProjectDetail =
    /^\/admin\/projects\/[^/]+/.test(pathname) ||
    /^\/employee\/projects\/[^/]+/.test(pathname)

  if (onProjectDetail) {
    const projectCmds = [
      'add_task', 'complete_task', 'assign_crew', 'update_progress',
      'send_client_update', 'create_change_order', 'generate_progress_reel',
      'view_project_status', 'archive_project',
    ]
    if (projectCmds.includes(cmd.id)) score += 30
  }

  // CRM page
  if (pathname.includes('/crm')) {
    const crmCmds = ['add_lead', 'move_lead_stage', 'send_followup', 'view_pipeline', 'log_conversation']
    if (crmCmds.includes(cmd.id)) score += 30
  }

  // Inventory / stocktake
  if (pathname.includes('/inventory') || pathname.includes('/stocktake')) {
    const invCmds = ['check_stock', 'add_inventory_item', 'view_alerts', 'reorder_item', 'submit_stocktake', 'photo_stocktake']
    if (invCmds.includes(cmd.id)) score += 30
  }

  // Time clock page
  if (pathname.includes('/time')) {
    const timeCmds = ['clock_in', 'clock_out', 'add_past_time', 'approve_time_entries']
    if (timeCmds.includes(cmd.id)) score += 30
  }

  // Financials / invoices
  if (pathname.includes('/financials') || pathname.includes('/invoices') || pathname.includes('/payroll')) {
    const finCmds = ['generate_invoice', 'send_invoice', 'mark_invoice_paid', 'view_ar_outstanding', 'view_margins', 'run_payroll']
    if (finCmds.includes(cmd.id)) score += 30
  }

  // Schedule page
  if (pathname.includes('/schedule')) {
    const schedCmds = ['schedule_consultation', 'view_schedules', 'view_my_schedule']
    if (schedCmds.includes(cmd.id)) score += 30
  }

  // Settings page
  if (pathname.includes('/settings')) {
    const settingsCmds = ['configure_branding', 'manage_integrations', 'ai_agent_settings', 'manage_users', 'manage_roles']
    if (settingsCmds.includes(cmd.id)) score += 30
  }

  // Photos page
  if (pathname.includes('/photos')) {
    const photoCmds = ['take_photo', 'generate_progress_reel', 'generate_reel']
    if (photoCmds.includes(cmd.id)) score += 30
  }

  // Messages page
  if (pathname.includes('/messages')) {
    const msgCmds = ['send_message', 'send_update', 'draft_email', 'client_send_message']
    if (msgCmds.includes(cmd.id)) score += 30
  }

  // Client portal pages
  if (pathname.startsWith('/client')) {
    const clientCmds = ['check_progress', 'view_photos', 'ask_about_project', 'client_send_message', 'pay_invoice']
    if (clientCmds.includes(cmd.id)) score += 10
  }

  // --- Role-based urgency boosts ---

  // Admins always want quick access to risk + suggestions
  if ((role === 'admin' || role === 'super_admin') && cmd.id === 'whats_at_risk') score += 15
  if ((role === 'admin' || role === 'super_admin') && cmd.id === 'review_suggestions') score += 10

  // Employee home page — surface most common field actions
  if (role === 'employee' && pathname === '/employee') {
    const homeCmds = ['clock_in', 'view_my_tasks', 'log_daily', 'view_my_schedule']
    if (homeCmds.includes(cmd.id)) score += 25
  }

  // Client home — surface key portal actions
  if (role === 'client' && pathname === '/client') {
    const clientHomeCmds = ['check_progress', 'ask_about_project', 'view_photos', 'client_send_message']
    if (clientHomeCmds.includes(cmd.id)) score += 25
  }

  // Admin dashboard — surface daily drivers
  if ((role === 'admin' || role === 'super_admin') && pathname === '/admin') {
    const dashCmds = ['morning_brief', 'whats_at_risk', 'create_project', 'view_pipeline', 'review_suggestions']
    if (dashCmds.includes(cmd.id)) score += 20
  }

  // Super admin boosts on admin pages
  if (role === 'super_admin') {
    const platformCmds = ['list_companies', 'platform_stats', 'manage_users']
    if (platformCmds.includes(cmd.id)) score += 8
  }

  return score
}
