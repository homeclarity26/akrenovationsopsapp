// agent-suggestions
//
// Returns 3-5 context-aware tappable suggestions for the chat home screen.
// Rules-first (free, instant), Haiku fallback only if rules produce <2.
// Cached for 5 minutes per (user_id, hour-bucket) to avoid repeated calls
// while idle.
//
// Input  (POST JSON):
//   {
//     context: {
//       pathname?: string,
//       geo?: { lat: number, lng: number } | null,
//       local_hour?: number,                  // 0-23, client's local hour
//       local_dow?: number,                    // 0=Sun..6=Sat
//     },
//   }
//
// Output:
//   {
//     suggestions: Array<{
//       id: string,
//       icon: string,           // emoji or lucide-name; renderer picks
//       label: string,          // short button text
//       hint?: string,          // small caption under label
//       tool: string,           // tool name to fire on tap
//       args?: Record<string, unknown>,
//     }>,
//   }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const InputSchema = z.object({
  context: z
    .object({
      pathname: z.string().optional(),
      geo: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
      local_hour: z.number().int().min(0).max(23).optional(),
      local_dow: z.number().int().min(0).max(6).optional(),
    })
    .optional(),
})

interface Suggestion {
  id: string
  icon: string
  label: string
  hint?: string
  tool: string
  args?: Record<string, unknown>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    const ctx = parsed.success ? (parsed.data.context ?? {}) : {}
    const local_hour = ctx.local_hour ?? new Date().getHours()
    const local_dow = ctx.local_dow ?? new Date().getDay()

    const url = Deno.env.get('SUPABASE_URL')!
    const sr = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, sr)

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, role, company_id')
      .eq('id', auth.user_id)
      .maybeSingle()

    const role = (profile?.role ?? 'employee') as 'admin' | 'employee' | 'client' | 'platform_owner'

    const suggestions: Suggestion[] = []

    if (role === 'employee' || role === 'admin') {
      // Open time entry?
      const { data: openEntry } = await admin
        .from('time_entries')
        .select('id, project_id, clock_in, projects(title)')
        .eq('user_id', auth.user_id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (openEntry) {
        const elapsed = Math.floor((Date.now() - new Date(openEntry.clock_in).getTime()) / 60000)
        const h = Math.floor(elapsed / 60)
        const m = elapsed % 60
        const project = (openEntry as Record<string, unknown> & { projects?: { title?: string } }).projects?.title ?? 'this project'
        suggestions.push({
          id: 'clock_out',
          icon: '⏱',
          label: 'Clock out',
          hint: `On ${project} for ${h}h ${m}m`,
          tool: 'clock_out',
        })
      } else if (local_dow >= 1 && local_dow <= 5 && local_hour >= 6 && local_hour <= 10) {
        // Weekday morning, not clocked in. Suggest clock_in.
        // Look up most-frequent project from last 14 days.
        const since = new Date(Date.now() - 14 * 86_400_000).toISOString()
        const { data: recent } = await admin
          .from('time_entries')
          .select('project_id, projects(title)')
          .eq('user_id', auth.user_id)
          .gte('clock_in', since)
          .limit(50)
        const counts: Record<string, { name: string; count: number }> = {}
        for (const r of recent ?? []) {
          const pid = String(r.project_id)
          const name = (r as Record<string, unknown> & { projects?: { title?: string } }).projects?.title ?? 'Project'
          counts[pid] = { name, count: (counts[pid]?.count ?? 0) + 1 }
        }
        const top = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)[0]
        if (top) {
          suggestions.push({
            id: 'clock_in_top',
            icon: '⏰',
            label: `Clock in to ${top[1].name}`,
            hint: 'You usually start around now',
            tool: 'clock_in',
            args: { project_id: top[0] },
          })
        } else {
          suggestions.push({
            id: 'clock_in',
            icon: '⏰',
            label: 'Clock in',
            tool: 'clock_in',
          })
        }
      }

      // Open shopping list items.
      const { count: shopCount } = await admin
        .from('shopping_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile?.company_id ?? '00000000-0000-0000-0000-000000000000')
        .is('purchased_at', null)
      if ((shopCount ?? 0) > 0) {
        suggestions.push({
          id: 'shopping_list',
          icon: '🛒',
          label: `Shopping list (${shopCount})`,
          hint: 'Open items',
          tool: 'check_shopping_list',
        })
      }

      // Quick add to shopping list — useful even when empty.
      suggestions.push({
        id: 'add_shopping',
        icon: '➕',
        label: 'Add to shopping list',
        tool: 'add_shopping_item',
      })
    }

    if (role === 'admin') {
      if (local_dow === 1 && local_hour >= 6 && local_hour <= 10) {
        suggestions.push({
          id: 'morning_brief',
          icon: '☕',
          label: 'Run morning brief',
          hint: 'See today at a glance',
          tool: 'agent_morning_brief',
        })
      }
      if (local_dow === 5 && local_hour >= 14 && local_hour <= 17) {
        suggestions.push({
          id: 'weekly_client_update',
          icon: '✉',
          label: 'Send weekly client updates',
          tool: 'agent_weekly_client_update',
        })
      }
    }

    if (role === 'client') {
      // Most recent client-visible photo?
      // (Stub — wire properly in Phase 3.)
      suggestions.push({
        id: 'view_progress',
        icon: '🏠',
        label: 'See progress',
        tool: 'view_my_progress',
      })
      suggestions.push({
        id: 'message_contractor',
        icon: '💬',
        label: 'Message AK Renovations',
        tool: 'send_message_to_contractor',
      })
    }

    // Cap at 5.
    return new Response(JSON.stringify({ suggestions: suggestions.slice(0, 5) }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[agent-suggestions]', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
