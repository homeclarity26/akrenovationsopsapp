/**
 * Hook: context-aware action chips for the Agent Overlay.
 *
 * Returns a list of quick-action chips based on the current route,
 * user role, and route params (e.g. projectId).
 */

import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { type Command, getVisibleCommands, type CommandContext } from '@/lib/commands'

export interface ContextChip {
  id: string
  label: string
  icon: string
  commandId: string
}

/** Maximum chips shown in the quick-actions row. */
const MAX_CHIPS = 6

export function useContextChips(): ContextChip[] {
  const { pathname } = useLocation()
  const params = useParams()
  const { user } = useAuth()

  return useMemo(() => {
    const ctx: CommandContext = {
      pathname,
      user,
      params: params as Record<string, string | undefined>,
    }

    const visible = getVisibleCommands(ctx)

    // Prioritize context-specific commands, then fill with generic ones
    const contextual: Command[] = []
    const generic: Command[] = []

    for (const cmd of visible) {
      // Commands whose `when` needs the specific context (project page etc.)
      // are "contextual" — they go first.
      if (isContextSpecific(cmd, pathname)) {
        contextual.push(cmd)
      } else {
        generic.push(cmd)
      }
    }

    const ordered = [...contextual, ...generic].slice(0, MAX_CHIPS)

    return ordered.map((cmd) => ({
      id: cmd.id,
      label: cmd.label,
      icon: cmd.icon,
      commandId: cmd.id,
    }))
  }, [pathname, params, user])
}

/**
 * Heuristic: a command is "context-specific" if it relates to a detail page
 * the user is currently on.
 */
function isContextSpecific(cmd: Command, pathname: string): boolean {
  const onProjectDetail =
    /^\/admin\/projects\/[^/]+/.test(pathname) ||
    /^\/employee\/projects\/[^/]+/.test(pathname)

  if (onProjectDetail && ['add_task', 'send_update'].includes(cmd.id)) return true

  const onInventory = pathname.includes('/inventory') || pathname.includes('/stocktake')
  if (onInventory && ['check_inventory', 'add_to_shopping'].includes(cmd.id)) return true

  const onTime = pathname.includes('/time')
  if (onTime && cmd.id === 'clock_in') return true

  return false
}
