// _shared/aiV2Registry.ts
//
// Central tool registry. Phase 0 ships with one canary tool (clock_in).
// Phase 1 adds the other 11 employee tools. Phase 2 adds 17 admin tools.
// Phase 3 adds 5 client tools.

import type { ToolDef } from './aiV2Tools.ts'

// ─── Tool: clock_in (canary, Phase 0) ────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clock_in: ToolDef = {
  name: 'clock_in',
  description:
    "Start a time entry for the user on a specific project. " +
    "When the user mentions a project by name (e.g. 'Thompson kitchen'), pass it as " +
    "project_name — DO NOT invent a project_id slug. project_id should only be set " +
    "when you have a real UUID from a previous tool result. If neither is given and " +
    "the user has multiple active projects, the tool returns quick_replies asking " +
    "which one. Returns a confirmation line with the project name and time.",
  input_schema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'A real project UUID from a previous tool result. Omit unless you have a UUID. Never invent a slug.',
      },
      project_name: {
        type: 'string',
        description: 'A free-text project name the user mentioned. The tool fuzzy-matches this against the user\'s active projects.',
      },
      work_type: {
        type: 'string',
        enum: [
          'field_carpentry',
          'project_management',
          'site_visit',
          'design',
          'administrative',
          'travel',
          'other',
        ],
        description: "Defaults to 'field_carpentry' for employees if omitted.",
      },
    },
    required: [],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const work_type = (args.work_type as string) ?? 'field_carpentry'
    const projectIdArg = (args.project_id as string | undefined)?.trim() || undefined
    const projectNameArg = (args.project_name as string | undefined)?.trim() || undefined

    // 1. If they have an open time entry, refuse with quick-reply for clock_out.
    //    Use admin client for safety — we trust ctx.user_id (verified from JWT).
    const { data: open } = await ctx.admin
      .from('time_entries')
      .select('id, project_id, clock_in')
      .eq('user_id', ctx.user_id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (open) {
      const { data: openProject } = await ctx.admin
        .from('projects')
        .select('title')
        .eq('id', open.project_id)
        .maybeSingle()
      return {
        message: `Already clocked in to ${openProject?.title ?? 'a project'} since ${formatTime(open.clock_in)}. Clock out first?`,
        data: { open_entry_id: open.id },
        quick_replies: {
          options: [
            { label: 'Clock out', value: 'clock_out' },
            { label: "Stay clocked in", value: 'cancel' },
          ],
        },
      }
    }

    // 2. Pull the user's active assignments (admin client — RLS bypass is OK
    //    because we already verified user_id from the JWT and we're
    //    explicitly scoping by employee_id).
    const { data: assigns } = await ctx.admin
      .from('project_assignments')
      .select('project_id, projects(id, title, status)')
      .eq('employee_id', ctx.user_id)
      .eq('active', true)
    const activeProjects =
      (assigns ?? [])
        .map((r: Record<string, unknown>) => r.projects as { id: string; title: string; status: string } | null)
        .filter((p): p is { id: string; title: string; status: string } =>
          !!p && (p.status === 'active' || p.status === 'pending'),
        )

    // 3. Resolve which project to clock in to.
    let project_id: string | undefined
    if (projectIdArg && UUID_RE.test(projectIdArg)) {
      // Validate against user's assignments.
      const match = activeProjects.find((p) => p.id === projectIdArg)
      if (!match) {
        return {
          message: "I can't find that project on your active assignments. Pick one?",
          quick_replies: {
            options: activeProjects.map((p) => ({ label: p.title, value: `project:${p.id}` })),
            custom_placeholder: 'Or type the project name…',
          },
        }
      }
      project_id = match.id
    } else if (projectNameArg) {
      // Fuzzy match on title — case-insensitive substring, then word overlap.
      const needle = projectNameArg.toLowerCase()
      const exact = activeProjects.find((p) => p.title.toLowerCase() === needle)
      const sub = activeProjects.find((p) => p.title.toLowerCase().includes(needle))
      const tokens = needle.split(/\s+/).filter(Boolean)
      const overlap = activeProjects.find((p) => {
        const t = p.title.toLowerCase()
        return tokens.length > 0 && tokens.every((tk) => t.includes(tk))
      })
      const match = exact ?? sub ?? overlap
      if (match) {
        project_id = match.id
      } else if (activeProjects.length > 0) {
        return {
          message: `I couldn't match "${projectNameArg}". Did you mean one of these?`,
          quick_replies: {
            options: activeProjects.map((p) => ({ label: p.title, value: `project:${p.id}` })),
            custom_placeholder: 'Or type the project name…',
          },
        }
      }
    }

    if (!project_id) {
      if (activeProjects.length === 0) {
        return {
          message: "You're not assigned to any active projects. Ask the admin to assign you to one.",
        }
      }
      if (activeProjects.length === 1) {
        project_id = activeProjects[0].id
      } else {
        return {
          message: 'Which project are you clocking in to?',
          quick_replies: {
            options: activeProjects.map((p) => ({ label: p.title, value: `project:${p.id}` })),
            custom_placeholder: 'Or type the project name…',
          },
        }
      }
    }

    // 4. Insert the time entry. Use admin client to bypass any RLS quirks —
    //    we set user_id explicitly so the inserted row is correctly attributed.
    const clock_in_iso = new Date().toISOString()
    const { data: inserted, error } = await ctx.admin
      .from('time_entries')
      .insert({
        user_id: ctx.user_id,
        project_id,
        clock_in: clock_in_iso,
        work_type,
        is_billable: true,
        entry_method: 'live',
      })
      .select('id, project_id, clock_in, projects(title)')
      .maybeSingle()

    if (error) throw new Error(`Couldn't clock in: ${error.message}`)

    const projectTitle =
      (inserted as Record<string, unknown> | null)?.projects &&
      typeof (inserted as { projects?: { title?: string } }).projects?.title === 'string'
        ? (inserted as { projects: { title: string } }).projects.title
        : 'this project'

    return {
      message: `✓ Clocked in to ${projectTitle} at ${formatTime(clock_in_iso)}.`,
      data: { time_entry_id: inserted?.id, project_id, clock_in: clock_in_iso },
    }
  },
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${ampm}`
}

// ─── Registry ────────────────────────────────────────────────────────
export const ALL_TOOLS: ToolDef[] = [clock_in]

/** Scope the catalog to a persona — Claude only ever sees what the user can do. */
export function toolsForPersona(persona: 'admin' | 'employee' | 'client' | 'platform_owner'): ToolDef[] {
  return ALL_TOOLS.filter((t) => t.personas.includes(persona))
}
