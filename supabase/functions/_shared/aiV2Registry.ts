// _shared/aiV2Registry.ts
//
// Central tool registry. Phase 0 ships with one canary tool (clock_in).
// Phase 1 adds the other 11 employee tools. Phase 2 adds 17 admin tools.
// Phase 3 adds 5 client tools.

import type { ToolDef } from './aiV2Tools.ts'

// ─── Tool: clock_in (canary, Phase 0) ────────────────────────────────
const clock_in: ToolDef = {
  name: 'clock_in',
  description:
    "Start a time entry for the user on a specific project. If the user is " +
    "assigned to multiple active projects and didn't specify which, return " +
    "quick_replies asking which project. Returns the new time entry's id and " +
    "a confirmation line with the project name and clock-in time.",
  input_schema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'The UUID of the project to clock in to. Omit if unknown.',
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

    // 1. If they have an open time entry, refuse (use clock_out first).
    const { data: open } = await ctx.asUser
      .from('time_entries')
      .select('id, project_id, clock_in')
      .eq('user_id', ctx.user_id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (open) {
      // Look up project name for the message.
      const { data: openProject } = await ctx.asUser
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

    // 2. Resolve project_id. If not provided, look at assignments.
    let project_id = args.project_id as string | undefined
    if (!project_id) {
      const { data: assigns } = await ctx.asUser
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

      if (activeProjects.length === 0) {
        return {
          message: "You're not assigned to any active projects. Ask Adam to assign you, or pick from your company's projects.",
        }
      }
      if (activeProjects.length === 1) {
        project_id = activeProjects[0].id
      } else {
        // Ask back via quick replies.
        return {
          message: 'Which project are you clocking in to?',
          quick_replies: {
            options: activeProjects.map((p) => ({ label: p.title, value: `project:${p.id}` })),
            custom_placeholder: 'Or type the project name…',
          },
        }
      }
    }

    // 3. Insert the time entry.
    const clock_in_iso = new Date().toISOString()
    const { data: inserted, error } = await ctx.asUser
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
