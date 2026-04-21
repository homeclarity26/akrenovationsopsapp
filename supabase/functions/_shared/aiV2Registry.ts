// _shared/aiV2Registry.ts
//
// Central tool registry for the AI v2 chat-first assistant.
// Phase 1: 12 employee tools end-to-end via Claude tool-use.
// Phase 2 will add admin tools; Phase 3 client tools.

import type { ToolDef, ToolResult, ToolContext } from './aiV2Tools.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Shared helpers ─────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${ampm}`
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

interface ProjectStub {
  id: string
  title: string
  status: string
}

/** Pull active project assignments for the user via the admin client.
 *  user_id was already verified from the JWT, RLS adds no safety here. */
async function getUserActiveProjects(ctx: ToolContext): Promise<ProjectStub[]> {
  const { data: assigns } = await ctx.admin
    .from('project_assignments')
    .select('project_id, projects(id, title, status)')
    .eq('employee_id', ctx.user_id)
    .eq('active', true)
  return (assigns ?? [])
    .map((r: Record<string, unknown>) => r.projects as ProjectStub | null)
    .filter((p): p is ProjectStub => !!p && (p.status === 'active' || p.status === 'pending'))
}

/** Resolve a project from { project_id?, project_name? } against the user's
 *  active assignments. Returns the project_id, the matched project, or null
 *  if neither arg yielded a match (caller should ask via quick_replies).
 */
async function resolveProjectFromArgs(
  ctx: ToolContext,
  projectIdArg?: string,
  projectNameArg?: string,
): Promise<{ project_id: string; project: ProjectStub } | { ask: ProjectStub[] }> {
  const projects = await getUserActiveProjects(ctx)

  if (projectIdArg && UUID_RE.test(projectIdArg)) {
    const match = projects.find((p) => p.id === projectIdArg)
    if (match) return { project_id: match.id, project: match }
    return { ask: projects }
  }

  if (projectNameArg) {
    const needle = projectNameArg.trim().toLowerCase()
    const exact = projects.find((p) => p.title.toLowerCase() === needle)
    const sub = projects.find((p) => p.title.toLowerCase().includes(needle))
    const tokens = needle.split(/\s+/).filter(Boolean)
    const overlap = projects.find((p) => {
      const t = p.title.toLowerCase()
      return tokens.length > 0 && tokens.every((tk) => t.includes(tk))
    })
    const match = exact ?? sub ?? overlap
    if (match) return { project_id: match.id, project: match }
    return { ask: projects }
  }

  if (projects.length === 1) return { project_id: projects[0].id, project: projects[0] }
  return { ask: projects }
}

function projectQuickReplies(projects: ProjectStub[], action: string): ToolResult['quick_replies'] {
  return {
    options: projects.map((p) => ({ label: p.title, value: `project:${p.id}|action:${action}` })),
    custom_placeholder: 'Or type the project name…',
  }
}

// ─── Tool: clock_in ─────────────────────────────────────────────────
const clock_in: ToolDef = {
  name: 'clock_in',
  description:
    "Start a time entry for the user on a project. When the user mentions a project " +
    "by name, pass it as project_name — DO NOT invent a project_id slug. project_id " +
    "should only be set when you have a real UUID from a previous tool result. If neither " +
    "is given and the user has multiple active projects, the tool returns quick_replies " +
    "asking which one. Returns a confirmation line with the project name and time.",
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string', description: 'Real project UUID from a previous tool result. Never invent.' },
      project_name: { type: 'string', description: 'Free-text project name the user mentioned.' },
      work_type: {
        type: 'string',
        enum: ['field_carpentry', 'project_management', 'site_visit', 'design', 'administrative', 'travel', 'other'],
        description: "Defaults to 'field_carpentry'.",
      },
    },
    required: [],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const work_type = (args.work_type as string) ?? 'field_carpentry'

    // 1. Refuse if already clocked in.
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
            { label: 'Stay clocked in', value: 'cancel' },
          ],
        },
      }
    }

    // 2. Resolve project.
    const r = await resolveProjectFromArgs(ctx, args.project_id as string | undefined, args.project_name as string | undefined)
    if ('ask' in r) {
      if (r.ask.length === 0) return { message: "You're not assigned to any active projects. Ask the admin to assign you to one." }
      return {
        message: 'Which project are you clocking in to?',
        quick_replies: projectQuickReplies(r.ask, 'clock_in'),
      }
    }

    // 3. Insert.
    const clock_in_iso = new Date().toISOString()
    const { data: inserted, error } = await ctx.admin
      .from('time_entries')
      .insert({
        user_id: ctx.user_id,
        project_id: r.project_id,
        clock_in: clock_in_iso,
        work_type,
        is_billable: true,
        entry_method: 'live',
      })
      .select('id, projects(title)')
      .maybeSingle()
    if (error) throw new Error(`Couldn't clock in: ${error.message}`)

    return {
      message: `✓ Clocked in to ${r.project.title} at ${formatTime(clock_in_iso)}.`,
      data: { time_entry_id: inserted?.id, project_id: r.project_id, clock_in: clock_in_iso },
    }
  },
}

// ─── Tool: clock_out ────────────────────────────────────────────────
const clock_out: ToolDef = {
  name: 'clock_out',
  description:
    "Close the user's currently-open time entry. If they're not clocked in, returns a polite " +
    "message saying so. Optional notes attach to the entry. Returns the project name, total " +
    "time worked, and the close time.",
  input_schema: {
    type: 'object',
    properties: {
      notes: { type: 'string', description: 'Optional note about the day/work done.' },
    },
    required: [],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const { data: open } = await ctx.admin
      .from('time_entries')
      .select('id, project_id, clock_in, projects(title)')
      .eq('user_id', ctx.user_id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!open) return { message: "You're not clocked in right now." }

    const clock_out_iso = new Date().toISOString()
    const totalMin = Math.floor((Date.now() - new Date(open.clock_in).getTime()) / 60000)

    const update: Record<string, unknown> = {
      clock_out: clock_out_iso,
      total_minutes: totalMin,
    }
    if (args.notes) update.notes = String(args.notes)

    const { error } = await ctx.admin.from('time_entries').update(update).eq('id', open.id)
    if (error) throw new Error(`Couldn't clock out: ${error.message}`)

    const projectTitle =
      (open as Record<string, unknown> & { projects?: { title?: string } }).projects?.title ?? 'a project'
    return {
      message: `✓ Clocked out of ${projectTitle} at ${formatTime(clock_out_iso)}. Total ${formatDuration(totalMin)}.`,
      data: { time_entry_id: open.id, total_minutes: totalMin, clock_out: clock_out_iso },
    }
  },
}

// ─── Tool: add_daily_log ────────────────────────────────────────────
const add_daily_log: ToolDef = {
  name: 'add_daily_log',
  description:
    "Add a daily work log to a project. summary is required; optional fields capture work " +
    "completed, issues, weather. Date defaults to today. If project not specified, asks via " +
    "quick_replies.",
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      project_name: { type: 'string' },
      summary: { type: 'string', description: 'Required. Short paragraph of what happened today.' },
      work_completed: { type: 'string' },
      issues: { type: 'string' },
      weather: { type: 'string' },
    },
    required: ['summary'],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const summary = String(args.summary ?? '').trim()
    if (!summary) return { message: 'I need at least a short summary of the day.' }

    const r = await resolveProjectFromArgs(ctx, args.project_id as string | undefined, args.project_name as string | undefined)
    if ('ask' in r) {
      if (r.ask.length === 0) return { message: "You're not assigned to any active projects." }
      return { message: 'Which project is this log for?', quick_replies: projectQuickReplies(r.ask, 'add_daily_log') }
    }

    const { data: inserted, error } = await ctx.admin
      .from('daily_logs')
      .insert({
        project_id: r.project_id,
        employee_id: ctx.user_id,
        log_date: new Date().toISOString().slice(0, 10),
        summary,
        work_completed: args.work_completed ?? null,
        issues: args.issues ?? null,
        weather: args.weather ?? null,
        ai_generated: false,
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`Couldn't save log: ${error.message}`)

    return {
      message: `✓ Daily log saved for ${r.project.title}.`,
      data: { log_id: inserted?.id, project_id: r.project_id },
    }
  },
}

// ─── Tool: take_photo ───────────────────────────────────────────────
// Phase 1 contract: client uploads to project-photos bucket FIRST and passes
// the resulting public URL. Tool just inserts the row + fires agent-photo-tagger.
const take_photo: ToolDef = {
  name: 'take_photo',
  description:
    "Attach a photo to a project. The client UI uploads the image first then calls this with " +
    "image_url + project. Optional caption. Auto-tags via agent-photo-tagger after insert.",
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      project_name: { type: 'string' },
      image_url: { type: 'string', description: 'Public URL of the already-uploaded image.' },
      caption: { type: 'string' },
    },
    required: ['image_url'],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const image_url = String(args.image_url ?? '').trim()
    if (!image_url) return { message: 'I need an image URL — please use the camera/attach button to upload first.' }

    const r = await resolveProjectFromArgs(ctx, args.project_id as string | undefined, args.project_name as string | undefined)
    if ('ask' in r) {
      if (r.ask.length === 0) return { message: "You're not assigned to any active projects." }
      return { message: 'Which project is this photo for?', quick_replies: projectQuickReplies(r.ask, 'take_photo') }
    }

    const { data: inserted, error } = await ctx.admin
      .from('project_photos')
      .insert({
        project_id: r.project_id,
        uploaded_by: ctx.user_id,
        image_url,
        caption: args.caption ?? null,
        taken_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`Couldn't save photo: ${error.message}`)

    // Best-effort fire-and-forget tagging.
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-photo-tagger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        },
        body: JSON.stringify({ photo_id: inserted?.id, image_url }),
      })
    } catch { /* non-blocking */ }

    return {
      message: `✓ Photo saved to ${r.project.title}.`,
      data: { photo_id: inserted?.id, project_id: r.project_id },
    }
  },
}

// ─── Tool: add_shopping_item ────────────────────────────────────────
const add_shopping_item: ToolDef = {
  name: 'add_shopping_item',
  description:
    "Add an item to the company's shopping list. The crew shares one list per project. " +
    "If project not specified and the user has only one active project, defaults to that. " +
    "Otherwise asks. quantity defaults to 1.",
  input_schema: {
    type: 'object',
    properties: {
      item_name: { type: 'string', description: 'What to buy. Required.' },
      quantity: { type: 'integer', minimum: 1 },
      unit: { type: 'string', description: 'e.g. box, ft, lb' },
      notes: { type: 'string' },
      project_id: { type: 'string' },
      project_name: { type: 'string' },
    },
    required: ['item_name'],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const item_name = String(args.item_name ?? '').trim()
    if (!item_name) return { message: 'What should I add to the list?' }
    const quantity = Math.max(1, Math.floor(Number(args.quantity ?? 1)))

    const r = await resolveProjectFromArgs(ctx, args.project_id as string | undefined, args.project_name as string | undefined)
    if ('ask' in r) {
      if (r.ask.length === 0) return { message: "You're not assigned to any active projects." }
      return { message: 'Which project is this for?', quick_replies: projectQuickReplies(r.ask, 'add_shopping_item') }
    }

    const { data: inserted, error } = await ctx.admin
      .from('shopping_list_items')
      .insert({
        project_id: r.project_id,
        item_name,
        quantity,
        unit: args.unit ?? null,
        notes: args.notes ?? null,
        added_by: ctx.user_id,
        status: 'needed',
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`Couldn't add item: ${error.message}`)

    return {
      message: `✓ Added "${item_name}"${quantity > 1 ? ` (×${quantity})` : ''} to ${r.project.title}'s shopping list.`,
      data: { item_id: inserted?.id, project_id: r.project_id },
    }
  },
}

// ─── Tool: check_shopping_list ──────────────────────────────────────
const check_shopping_list: ToolDef = {
  name: 'check_shopping_list',
  description:
    "Read the current open items on the shopping list. If project specified, scoped to that " +
    "project; otherwise returns the most recent 20 across all the user's active projects.",
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      project_name: { type: 'string' },
    },
    required: [],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    let project_id: string | undefined
    if (args.project_id || args.project_name) {
      const r = await resolveProjectFromArgs(ctx, args.project_id as string | undefined, args.project_name as string | undefined)
      if ('project_id' in r) project_id = r.project_id
    }

    let q = ctx.admin
      .from('shopping_list_items')
      .select('id, item_name, quantity, unit, notes, project_id, projects(title), created_at')
      .eq('status', 'needed')
      .order('created_at', { ascending: false })
      .limit(20)
    if (project_id) q = q.eq('project_id', project_id)

    const { data, error } = await q
    if (error) throw new Error(`Couldn't load list: ${error.message}`)

    const items = (data ?? []) as Array<{ id: string; item_name: string; quantity: number; unit: string | null; notes: string | null; projects: { title: string } | null }>
    if (items.length === 0) {
      return { message: project_id ? 'Shopping list is empty for that project.' : 'No open items on the shopping list.' }
    }

    const lines = items.slice(0, 10).map((it) => {
      const qty = it.quantity > 1 ? ` ×${it.quantity}` : ''
      const unit = it.unit ? ` ${it.unit}` : ''
      const proj = !project_id && it.projects?.title ? ` (${it.projects.title})` : ''
      return `• ${it.item_name}${qty}${unit}${proj}`
    })
    const more = items.length > 10 ? `\n…and ${items.length - 10} more.` : ''
    return {
      message: `Shopping list (${items.length} item${items.length === 1 ? '' : 's'}):\n${lines.join('\n')}${more}`,
      data: { items: items.map((i) => ({ id: i.id, name: i.item_name, qty: i.quantity })) },
    }
  },
}

// ─── Tool: flag_change_order ────────────────────────────────────────
const flag_change_order: ToolDef = {
  name: 'flag_change_order',
  description:
    "Flag a potential change order for the admin to price. Use when a client wants something " +
    "added/changed mid-job. description should be one or two sentences capturing what changed. " +
    "Sets status='flagged'. Auto-fires a system message into the project messages thread so " +
    "admin sees it immediately.",
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      project_name: { type: 'string' },
      description: { type: 'string', description: 'What changed. Required.' },
    },
    required: ['description'],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const description = String(args.description ?? '').trim()
    if (!description) return { message: 'What changed? Give me a short description.' }

    const r = await resolveProjectFromArgs(ctx, args.project_id as string | undefined, args.project_name as string | undefined)
    if ('ask' in r) {
      if (r.ask.length === 0) return { message: "You're not assigned to any active projects." }
      return { message: 'Which project is this change for?', quick_replies: projectQuickReplies(r.ask, 'flag_change_order') }
    }

    // Title = first sentence or first 100 chars.
    const title = description.split(/[.!?]/)[0].slice(0, 100) || description.slice(0, 100)

    const { data: inserted, error } = await ctx.admin
      .from('change_orders')
      .insert({
        project_id: r.project_id,
        title,
        description,
        status: 'flagged',
        flagged_by: ctx.user_id,
        flagged_at: new Date().toISOString(),
        cost_change: 0,
        schedule_change_days: 0,
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`Couldn't flag change: ${error.message}`)

    // System message into the project so admin sees it.
    try {
      await ctx.admin.from('messages').insert({
        project_id: r.project_id,
        sender_id: ctx.user_id,
        sender_role: 'employee',
        message: `🚩 Change flagged: ${title}`,
        channel: 'in_app',
        is_ai_generated: false,
      })
    } catch { /* non-blocking */ }

    return {
      message: `✓ Flagged for ${r.project.title}. Admin will price it. (id ${inserted?.id?.slice(0, 8)})`,
      data: { change_order_id: inserted?.id, project_id: r.project_id },
    }
  },
}

// ─── Tool: add_tool_request ─────────────────────────────────────────
const add_tool_request: ToolDef = {
  name: 'add_tool_request',
  description:
    "Request a tool/equipment from the admin. tool_name is required. urgency defaults to " +
    "'normal'. Optional notes for context.",
  input_schema: {
    type: 'object',
    properties: {
      tool_name: { type: 'string' },
      project_id: { type: 'string' },
      project_name: { type: 'string' },
      urgency: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
      notes: { type: 'string' },
      needed_by: { type: 'string', description: 'YYYY-MM-DD if known.' },
    },
    required: ['tool_name'],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const tool_name = String(args.tool_name ?? '').trim()
    if (!tool_name) return { message: 'Which tool do you need?' }
    const urgency = String(args.urgency ?? 'normal')

    let project_id: string | null = null
    if (args.project_id || args.project_name) {
      const r = await resolveProjectFromArgs(ctx, args.project_id as string | undefined, args.project_name as string | undefined)
      if ('project_id' in r) project_id = r.project_id
    }

    const { data: inserted, error } = await ctx.admin
      .from('tool_requests')
      .insert({
        requested_by: ctx.user_id,
        project_id,
        tool_name,
        urgency,
        notes: args.notes ?? null,
        needed_by: args.needed_by ?? null,
        status: 'pending',
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`Couldn't request tool: ${error.message}`)

    return {
      message: `✓ Requested "${tool_name}" (${urgency}). Admin notified.`,
      data: { request_id: inserted?.id },
    }
  },
}

// ─── Tool: my_schedule ──────────────────────────────────────────────
const my_schedule: ToolDef = {
  name: 'my_schedule',
  description:
    "Read the user's upcoming schedule events. when defaults to 'next 7 days'. Returns " +
    "events sorted by start date.",
  input_schema: {
    type: 'object',
    properties: {
      when: { type: 'string', enum: ['today', 'tomorrow', 'this_week', 'next_7_days'] },
    },
    required: [],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const when = String(args.when ?? 'next_7_days')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let from = today.toISOString().slice(0, 10)
    let to: string

    if (when === 'today') to = from
    else if (when === 'tomorrow') {
      const t = new Date(today.getTime() + 86400000)
      from = t.toISOString().slice(0, 10)
      to = from
    } else if (when === 'this_week') {
      const day = today.getDay()
      const sun = new Date(today.getTime() - day * 86400000)
      from = sun.toISOString().slice(0, 10)
      to = new Date(sun.getTime() + 6 * 86400000).toISOString().slice(0, 10)
    } else {
      to = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
    }

    const userProjects = await getUserActiveProjects(ctx)
    const projectIds = userProjects.map((p) => p.id)

    let q = ctx.admin
      .from('schedule_events')
      .select('id, title, event_type, start_date, end_date, start_time, location, project_id, projects(title)')
      .gte('start_date', from)
      .lte('start_date', to)
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(20)
    if (projectIds.length > 0) q = q.in('project_id', projectIds)

    const { data, error } = await q
    if (error) throw new Error(`Couldn't load schedule: ${error.message}`)

    const events = (data ?? []) as Array<{ id: string; title: string; event_type: string | null; start_date: string; start_time: string | null; location: string | null; projects: { title: string } | null }>
    if (events.length === 0) {
      return { message: when === 'today' ? 'Nothing on your schedule today.' : `Nothing scheduled in that range.` }
    }

    const lines = events.map((e) => {
      const time = e.start_time ? ` ${e.start_time.slice(0, 5)}` : ''
      const proj = e.projects?.title ? ` (${e.projects.title})` : ''
      return `• ${e.start_date}${time} — ${e.title}${proj}`
    })
    return {
      message: `Schedule (${events.length}):\n${lines.join('\n')}`,
      data: { events: events.map((e) => ({ id: e.id, title: e.title, when: `${e.start_date} ${e.start_time ?? ''}`.trim() })) },
    }
  },
}

// ─── Tool: message_admin ────────────────────────────────────────────
const message_admin: ToolDef = {
  name: 'message_admin',
  description:
    "Send a message to the project admin (or the company admin if no project specified). " +
    "Goes into the messages thread. message text is required.",
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      project_id: { type: 'string' },
      project_name: { type: 'string' },
    },
    required: ['message'],
  },
  personas: ['employee'],
  async execute(args, ctx) {
    const text = String(args.message ?? '').trim()
    if (!text) return { message: 'What should I tell the admin?' }

    let project_id: string | null = null
    if (args.project_id || args.project_name) {
      const r = await resolveProjectFromArgs(ctx, args.project_id as string | undefined, args.project_name as string | undefined)
      if ('project_id' in r) project_id = r.project_id
    }

    // Find an admin recipient in the same company.
    const { data: profile } = await ctx.admin.from('profiles').select('company_id').eq('id', ctx.user_id).maybeSingle()
    const { data: admin } = await ctx.admin
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'admin')
      .eq('company_id', profile?.company_id ?? '00000000-0000-0000-0000-000000000000')
      .limit(1)
      .maybeSingle()

    const { data: inserted, error } = await ctx.admin
      .from('messages')
      .insert({
        project_id,
        sender_id: ctx.user_id,
        sender_role: 'employee',
        recipient_id: admin?.id ?? null,
        message: text,
        channel: 'in_app',
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`Couldn't send: ${error.message}`)

    return {
      message: `✓ Sent to ${admin?.full_name ?? 'admin'}.`,
      data: { message_id: inserted?.id },
    }
  },
}

// ─── Tool: submit_receipt ───────────────────────────────────────────
const submit_receipt: ToolDef = {
  name: 'submit_receipt',
  description:
    "Submit a receipt as an expense. Two modes: (a) Photo flow — client uploads first, " +
    "passes receipt_image_url + project_id, agent-receipt-processor extracts vendor/amount/date " +
    "automatically. (b) Voice flow — pass vendor + amount + date directly when extracted from " +
    "what the user said (no photo needed).",
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      project_name: { type: 'string' },
      vendor: { type: 'string' },
      amount: { type: 'number' },
      date: { type: 'string', description: 'YYYY-MM-DD' },
      category: { type: 'string', description: 'e.g. materials, fuel, food' },
      receipt_image_url: { type: 'string', description: 'Public URL of the uploaded receipt photo.' },
    },
    required: [],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const r = await resolveProjectFromArgs(ctx, args.project_id as string | undefined, args.project_name as string | undefined)
    if ('ask' in r) {
      if (r.ask.length === 0) return { message: "You're not assigned to any active projects." }
      return { message: 'Which project is this receipt for?', quick_replies: projectQuickReplies(r.ask, 'submit_receipt') }
    }

    // Voice/text flow — direct insert.
    const amount = Number(args.amount ?? 0)
    if (!args.receipt_image_url && (amount <= 0 || !args.vendor)) {
      return {
        message: 'I need either a receipt photo OR vendor + amount. Want to try again?',
      }
    }

    const date = (args.date as string) ?? new Date().toISOString().slice(0, 10)
    const { data: inserted, error } = await ctx.admin
      .from('expenses')
      .insert({
        project_id: r.project_id,
        vendor: args.vendor ?? 'Unknown',
        amount: amount > 0 ? amount : 0,
        date,
        category: args.category ?? null,
        receipt_image_url: args.receipt_image_url ?? null,
        entered_by: ctx.user_id,
        entry_method: args.receipt_image_url ? 'photo' : 'voice',
      })
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`Couldn't save expense: ${error.message}`)

    return {
      message: amount > 0
        ? `✓ Logged $${amount.toFixed(2)} ${args.vendor ? 'at ' + args.vendor : 'expense'} for ${r.project.title}.`
        : `✓ Receipt saved for ${r.project.title}. Admin will review.`,
      data: { expense_id: inserted?.id, project_id: r.project_id },
    }
  },
}

// ─── Tool: mark_checklist_item ──────────────────────────────────────
const mark_checklist_item: ToolDef = {
  name: 'mark_checklist_item',
  description:
    "Update a checklist item's status. Use the item id from a my_checklists query " +
    "(not built yet — Phase 2). Valid statuses: 'pending', 'in_progress', 'complete', 'na'.",
  input_schema: {
    type: 'object',
    properties: {
      checklist_instance_item_id: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'complete', 'na'] },
      completion_note: { type: 'string' },
    },
    required: ['checklist_instance_item_id', 'status'],
  },
  personas: ['employee', 'admin'],
  async execute(args, ctx) {
    const id = String(args.checklist_instance_item_id ?? '')
    const status = String(args.status ?? '')
    if (!UUID_RE.test(id)) return { message: "I need a real checklist item id (UUID), not a name." }

    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
    if (status === 'complete') {
      update.completed_by = ctx.user_id
      update.completed_at = new Date().toISOString()
    }
    if (args.completion_note) update.completion_note = String(args.completion_note)

    const { data: updated, error } = await ctx.admin
      .from('checklist_instance_items')
      .update(update)
      .eq('id', id)
      .select('id, title, status')
      .maybeSingle()
    if (error) throw new Error(`Couldn't update: ${error.message}`)
    if (!updated) return { message: "I couldn't find that checklist item." }

    return {
      message: `✓ "${updated.title}" → ${updated.status}.`,
      data: { item_id: updated.id, status: updated.status },
    }
  },
}

// ─── Registry ────────────────────────────────────────────────────────
export const ALL_TOOLS: ToolDef[] = [
  clock_in,
  clock_out,
  add_daily_log,
  take_photo,
  add_shopping_item,
  check_shopping_list,
  flag_change_order,
  add_tool_request,
  my_schedule,
  message_admin,
  submit_receipt,
  mark_checklist_item,
]

/** Scope the catalog to a persona — Claude only ever sees what the user can do. */
export function toolsForPersona(persona: 'admin' | 'employee' | 'client' | 'platform_owner'): ToolDef[] {
  return ALL_TOOLS.filter((t) => t.personas.includes(persona))
}
