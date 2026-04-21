// agent-tool-call
//
// The brain of the AI v2 chat-first assistant. Receives a user message,
// loads or starts a 24h thread, calls Claude with tool-use, dispatches any
// tool calls, persists the resulting messages, tracks cost, and returns
// the new messages + budget info to the client.
//
// Phase 0 ships the full plumbing with one canary tool (clock_in). Phase 1
// adds the other 11 employee tools through the same code path.
//
// Input  (POST JSON):
//   {
//     thread_id: string | null,        // null = will start or resume <24h thread
//     message: string,                 // user's text or voice transcript
//     idempotency_key: string,         // mint a fresh uuid per send
//     context: {                       // optional client-side hints
//       pathname?: string,
//       geo?: { lat: number, lng: number } | null,
//     },
//   }
//
// Output:
//   {
//     thread_id: string,
//     messages: AIMessage[],           // newly-created messages this turn
//     monthly_cost_so_far: number,     // for client-side "$X / $75" display
//     monthly_cost_cap: number,
//     blocked: boolean,                // true if cap reached
//   }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.30.1'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import {
  buildContext,
  dispatchTool,
  type Persona,
  type ToolResult,
} from '../_shared/aiV2Tools.ts'
import { toolsForPersona } from '../_shared/aiV2Registry.ts'

// Cost per 1M tokens (Sonnet 4 pricing as of 2026-04). Update if Anthropic
// changes pricing. Cached input is 90% off — that's the prompt-caching
// discount applied automatically when we mark blocks ephemeral.
const PRICING = {
  'claude-sonnet-4-20250514': {
    input_per_1m: 3.0,
    cached_input_per_1m: 0.30,
    output_per_1m: 15.0,
  },
} as const

const MONTHLY_COST_CAP = 75 // USD; matches the value Adam set in the design doc.
const THREAD_IDLE_HOURS = 24

const InputSchema = z.object({
  thread_id: z.string().uuid().nullable(),
  message: z.string().min(1).max(10_000),
  idempotency_key: z.string().min(8).max(120),
  context: z
    .object({
      pathname: z.string().optional(),
      geo: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
    })
    .optional(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  // ── 1. Auth + rate limit ──────────────────────────────────────────
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
  const rl = await checkRateLimit(req, 'agent-tool-call')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    // ── 2. Parse + validate ──────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return json({ error: 'Invalid input', details: parsed.error.flatten() }, 400, req)
    }
    const input = parsed.data

    // ── 3. User profile + persona ────────────────────────────────────
    const userJwt = req.headers.get('Authorization')!.replace(/^Bearer\s+/i, '')
    const ctx = buildContext(
      auth.user_id,
      auth.role as Persona,
      null,
      null,
      userJwt,
    )
    const { data: profile } = await ctx.admin
      .from('profiles')
      .select('company_id, full_name, email')
      .eq('id', auth.user_id)
      .maybeSingle()
    const company_id = profile?.company_id ?? null
    ctx.company_id = company_id

    // ── 4. Budget gate ───────────────────────────────────────────────
    let monthly_cost_so_far = 0
    if (company_id) {
      const { data: spend } = await ctx.admin.rpc('ai_spend_this_month', { p_company_id: company_id })
      monthly_cost_so_far = Number(spend ?? 0)
    }
    if (monthly_cost_so_far >= MONTHLY_COST_CAP) {
      return json({
        error: 'Monthly AI budget reached',
        monthly_cost_so_far,
        monthly_cost_cap: MONTHLY_COST_CAP,
        blocked: true,
      }, 429, req)
    }

    // ── 5. Resolve thread (24h-idle rule) ────────────────────────────
    const thread_id = await resolveThread(ctx, input.thread_id, auth.role as Persona, company_id)
    ctx.thread_id = thread_id

    // ── 6. Persist user message ──────────────────────────────────────
    const { data: userMsg } = await ctx.admin
      .from('ai_messages')
      .insert({
        thread_id,
        role: 'user',
        content: input.message,
      })
      .select('id, thread_id, role, content, created_at')
      .maybeSingle()
    await ctx.admin
      .from('ai_threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', thread_id)

    // ── 7. Build Claude conversation ─────────────────────────────────
    const recent = await loadRecentMessages(ctx, thread_id, 20)
    const tools = toolsForPersona(auth.role as Persona).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }))

    const systemPrompt = buildSystemPrompt({
      persona: auth.role as Persona,
      full_name: profile?.full_name ?? 'there',
      pathname: input.context?.pathname,
    })

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return json({ error: 'AI service not configured (ANTHROPIC_API_KEY missing)' }, 500, req)
    }
    const anthropic = new Anthropic({ apiKey })

    // ── 8. Loop: Claude → tools → Claude until no more tool calls ───
    const newMessages: Array<Record<string, unknown>> = []
    let cumCost = 0
    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: unknown }> = recent.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content ?? '',
    }))
    claudeMessages.push({ role: 'user', content: input.message })

    let safety = 0
    while (safety++ < 5) {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        // deno-lint-ignore no-explicit-any
        tools: tools as any,
        messages: claudeMessages as Array<{ role: 'user' | 'assistant'; content: unknown }> as never,
      })

      // Cost accounting.
      const u = resp.usage as { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
      const cost = computeCost(u, 'claude-sonnet-4-20250514')
      cumCost += cost
      await ctx.admin.from('ai_usage_ledger').insert({
        user_id: auth.user_id,
        company_id,
        thread_id,
        model: 'claude-sonnet-4-20250514',
        input_tokens: u.input_tokens ?? 0,
        cached_input_tokens: (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
        output_tokens: u.output_tokens ?? 0,
        cost_usd: cost,
        kind: 'chat',
      })

      // Extract text + tool uses.
      const textParts = resp.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text)
      const toolUses = resp.content.filter((c) => c.type === 'tool_use') as Array<{
        type: 'tool_use'
        id: string
        name: string
        input: Record<string, unknown>
      }>

      if (textParts.length > 0 || toolUses.length === 0) {
        // Persist assistant message (text-only or text-with-tools).
        const text = textParts.join('\n').trim()
        if (text) {
          const { data: aMsg } = await ctx.admin
            .from('ai_messages')
            .insert({
              thread_id,
              role: 'assistant',
              content: text,
              tool_call: toolUses.length > 0 ? { tool_uses: toolUses } : null,
            })
            .select('id, thread_id, role, content, tool_call, quick_replies, created_at')
            .maybeSingle()
          if (aMsg) newMessages.push(aMsg as Record<string, unknown>)
        }
      }

      if (toolUses.length === 0) {
        // No more tools — we're done.
        break
      }

      // Append assistant turn to local convo so next round sees it.
      claudeMessages.push({ role: 'assistant', content: resp.content })

      // Execute tools (sequential — small N, simpler reasoning).
      const toolResultsForClaude: Array<{ type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }> = []

      for (const tu of toolUses) {
        const dispatch = await dispatchTool({
          registry: toolsForPersona(auth.role as Persona),
          tool_name: tu.name,
          args: tu.input ?? {},
          // Per-tool-use idempotency key derived from request key + tool_use id.
          idempotency_key: `${input.idempotency_key}:${tu.id}`,
          ctx,
        })

        let toolResult: ToolResult
        let isError = false
        if (dispatch.ok) {
          toolResult = dispatch.result
        } else {
          isError = true
          toolResult = { message: `Error: ${dispatch.error}` }
        }

        // Persist tool result message.
        const { data: tMsg } = await ctx.admin
          .from('ai_messages')
          .insert({
            thread_id,
            role: 'tool',
            content: toolResult.message,
            tool_result: { tool_name: tu.name, tool_use_id: tu.id, ...toolResult, is_error: isError },
            quick_replies: forceCustomEscape(toolResult.quick_replies),
          })
          .select('id, thread_id, role, content, tool_result, quick_replies, created_at')
          .maybeSingle()
        if (tMsg) newMessages.push(tMsg as Record<string, unknown>)

        toolResultsForClaude.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(toolResult),
          is_error: isError,
        })
      }

      // Feed tool results back so Claude can phrase a final reply or call more.
      claudeMessages.push({ role: 'user', content: toolResultsForClaude })
    }

    // Update thread's last_message_at one final time.
    await ctx.admin
      .from('ai_threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', thread_id)

    return json({
      thread_id,
      messages: [userMsg, ...newMessages].filter(Boolean),
      monthly_cost_so_far: monthly_cost_so_far + cumCost,
      monthly_cost_cap: MONTHLY_COST_CAP,
      blocked: false,
    }, 200, req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[agent-tool-call] fatal:', msg, err)
    return json({ error: msg }, 500, req)
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────

function json(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

async function resolveThread(
  ctx: ReturnType<typeof buildContext>,
  client_thread_id: string | null,
  persona: Persona,
  company_id: string | null,
): Promise<string> {
  const cutoff = new Date(Date.now() - THREAD_IDLE_HOURS * 3600 * 1000).toISOString()

  // Caller passed an explicit thread_id — verify it's theirs and active.
  if (client_thread_id) {
    const { data } = await ctx.admin
      .from('ai_threads')
      .select('id, last_message_at, archived_at, user_id')
      .eq('id', client_thread_id)
      .maybeSingle()
    if (data && data.user_id === ctx.user_id && !data.archived_at && data.last_message_at >= cutoff) {
      return client_thread_id
    }
    // Otherwise fall through to "find or create" logic.
  }

  // Find the user's most-recent active thread within 24h.
  const { data: recent } = await ctx.admin
    .from('ai_threads')
    .select('id, last_message_at, archived_at')
    .eq('user_id', ctx.user_id)
    .is('archived_at', null)
    .gte('last_message_at', cutoff)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recent) return recent.id

  // Need a new thread. (Background: separately, an archive job summarizes
  // the previous thread — Phase 1+ will add that. For now, leave it open.)
  const { data: created } = await ctx.admin
    .from('ai_threads')
    .insert({ user_id: ctx.user_id, persona, company_id })
    .select('id')
    .maybeSingle()
  return created!.id
}

async function loadRecentMessages(
  ctx: ReturnType<typeof buildContext>,
  thread_id: string,
  n: number,
): Promise<Array<{ role: string; content: string | null }>> {
  const { data } = await ctx.admin
    .from('ai_messages')
    .select('role, content')
    .eq('thread_id', thread_id)
    .order('created_at', { ascending: false })
    .limit(n)
  return (data ?? []).reverse() as Array<{ role: string; content: string | null }>
}

function buildSystemPrompt(opts: { persona: Persona; full_name: string; pathname?: string }): string {
  const persona = opts.persona
  const personaIntro: Record<Persona, string> = {
    admin: `You are the AK Renovations admin's AI assistant. You can run tools to create projects, build invoices, send messages, and more. Be brief and decisive.`,
    employee: `You are a field worker's AI assistant for AK Renovations. ${opts.full_name} is on a job site, often on their phone with one hand. Use tools to do things — don't just describe them. Keep responses short.`,
    client: `You are a homeowner's AI assistant for their renovation project with AK Renovations. Be friendly, plain-spoken, never reveal cost margins or internal data.`,
    platform_owner: `You are the platform owner's AI assistant. You manage the multi-tenant platform — companies, users, audit logs. You do NOT have access to any company's tenant data.`,
  }
  // Inject the current date so Claude doesn't hallucinate "today" — the
  // model's training cutoff means it has no clue what year it is otherwise.
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const todayHuman = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return [
    personaIntro[persona],
    ``,
    `Today is ${todayHuman} (${todayIso}). Use this for any "today/tomorrow/this week" reasoning. Never guess the date.`,
    ``,
    `RULES:`,
    `- Prefer tool calls over text answers when the user wants something done.`,
    `- If you need to disambiguate (multiple projects etc.), include quick_replies in your tool result. The renderer always appends a "Something else…" chip — never assume the options are exhaustive.`,
    `- Never reveal cost data, margins, or internal financials to a client.`,
    `- Be concise. One short sentence is usually best.`,
    opts.pathname ? `- The user is currently on the ${opts.pathname} page.` : ``,
  ].filter(Boolean).join('\n')
}

function computeCost(
  usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number },
  model: string,
): number {
  const p = PRICING[model as keyof typeof PRICING]
  if (!p) return 0
  const inp = usage.input_tokens ?? 0
  const cached = (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
  const out = usage.output_tokens ?? 0
  // input_tokens already excludes cached (per Anthropic docs); we bill them separately.
  return (
    (inp / 1_000_000) * p.input_per_1m +
    (cached / 1_000_000) * p.cached_input_per_1m +
    (out / 1_000_000) * p.output_per_1m
  )
}

/** Always appends a "Something else…" escape to any quick_replies payload.
 *  Belt-and-suspenders: the client renderer also enforces this. */
function forceCustomEscape(qr: ToolResult['quick_replies'] | undefined) {
  if (!qr) return null
  return {
    options: qr.options,
    custom_placeholder: qr.custom_placeholder ?? 'Something else…',
    allow_custom: true,
  }
}
