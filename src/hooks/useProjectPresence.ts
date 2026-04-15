import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface PresenceUser {
  user_id: string
  full_name: string
  avatar_url: string | null
  role: string
  online_at: string
}

/**
 * Tracks "who's viewing this project right now" using Supabase's presence
 * primitive. Each connected client broadcasts a small payload identifying
 * themselves; the hook returns the deduplicated list of currently-online
 * users (excluding the caller).
 *
 * Internals:
 *   • Opens a dedicated channel `project-presence:<projectId>` keyed by
 *     auth user id so a single person with multiple tabs shows up once.
 *   • On 'sync' rebuilds the local state from channel.presenceState().
 *   • Untracks on unmount / projectId change.
 *
 * Pass a falsy projectId or skip the hook when no user is logged in and it
 * no-ops.
 */
export function useProjectPresence(projectId: string | undefined | null) {
  const { user } = useAuth()
  const [others, setOthers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!projectId || !user) {
      setOthers([])
      return
    }

    const channel = supabase.channel(`project-presence:${projectId}`, {
      config: { presence: { key: user.id } },
    })

    const sync = () => {
      const state = channel.presenceState() as Record<string, PresenceUser[]>
      const seen = new Set<string>()
      const list: PresenceUser[] = []
      for (const [key, metas] of Object.entries(state)) {
        if (key === user.id) continue
        // A single user may have multiple metas (multiple tabs). Take first.
        const meta = metas?.[0]
        if (!meta) continue
        if (seen.has(meta.user_id)) continue
        seen.add(meta.user_id)
        list.push(meta)
      }
      // Stable order: oldest first by online_at so re-renders don't flicker.
      list.sort((a, b) => a.online_at.localeCompare(b.online_at))
      setOthers(list)
    }

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        await channel.track({
          user_id: user.id,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          role: user.role,
          online_at: new Date().toISOString(),
        } satisfies PresenceUser)
      })

    return () => {
      // untrack is async but we don't need to await — removeChannel will
      // close the socket regardless.
      channel.untrack().catch(() => {})
      supabase.removeChannel(channel)
    }
  }, [projectId, user])

  return others
}
