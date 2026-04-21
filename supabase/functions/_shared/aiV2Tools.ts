// _shared/aiV2Tools.ts
//
// Tool dispatcher for the AI v2 chat-first assistant. Each tool is a single
// async function with a JSON schema for Claude. The dispatcher:
//   1. Looks up the tool by name from the persona-scoped catalog.
//   2. Dedups via idempotency_key (returns cached ai_tool_calls.result on repeat).
//   3. Wraps the executor in a try/catch + latency timer.
//   4. Writes one ai_tool_calls row regardless of outcome.
//   5. Returns a structured ToolResult the caller can render.
//
// Per-persona tool exposure is enforced HERE, not just in the system prompt.
// Even if Claude hallucinates a tool name a client persona shouldn't have,
// dispatch will refuse it.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type Persona = 'admin' | 'employee' | 'client' | 'platform_owner'

export interface ToolContext {
  user_id: string
  persona: Persona
  company_id: string | null
  thread_id: string | null
  /** User's JWT — pass to RLS-scoped clients so policies apply naturally. */
  user_jwt: string
  /** Service-role client for audit-log writes etc. */
  admin: SupabaseClient
  /** RLS-scoped client (acts as the user). */
  asUser: SupabaseClient
}

export interface ToolResult {
  /** Short human-readable confirmation line for the chat. */
  message: string
  /** Optional structured payload for rich rendering (cards, tables). */
  data?: Record<string, unknown>
  /** Optional follow-up quick replies. Renderer always appends "Something else…". */
  quick_replies?: { options: { label: string; value: string }[]; custom_placeholder?: string }
  /** Optional flag to mark the action as needing a confirm before re-executing. */
  needs_confirmation?: { prompt: string; confirm_value: string }
}

export interface ToolDef {
  name: string
  description: string
  /** Anthropic tool-use schema. */
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  personas: Persona[]
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function buildContext(
  user_id: string,
  persona: Persona,
  company_id: string | null,
  thread_id: string | null,
  user_jwt: string,
): ToolContext {
  const url = Deno.env.get('SUPABASE_URL')!
  const sr = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, sr)
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${user_jwt}` } },
  })
  return { user_id, persona, company_id, thread_id, user_jwt, admin, asUser }
}

/**
 * Dispatch a tool call. Honors idempotency, writes ai_tool_calls audit row,
 * enforces persona scoping. Caller passes the full registry so we can swap
 * registries per persona without scattering imports.
 */
export async function dispatchTool(opts: {
  registry: ToolDef[]
  tool_name: string
  args: Record<string, unknown>
  idempotency_key: string
  ctx: ToolContext
}): Promise<{ ok: true; result: ToolResult } | { ok: false; error: string }> {
  const { registry, tool_name, args, idempotency_key, ctx } = opts

  // 1. Persona enforcement.
  const def = registry.find((t) => t.name === tool_name)
  if (!def) return { ok: false, error: `Unknown tool: ${tool_name}` }
  if (!def.personas.includes(ctx.persona)) {
    return { ok: false, error: `Tool '${tool_name}' is not available for persona '${ctx.persona}'` }
  }

  // 2. Idempotency check (10 min window enforced by app convention; the unique
  //    index is on (user_id, idempotency_key) so true duplicates are dedup'd
  //    forever — the client should mint a fresh key per intent).
  const { data: existing } = await ctx.admin
    .from('ai_tool_calls')
    .select('id, result, error')
    .eq('user_id', ctx.user_id)
    .eq('idempotency_key', idempotency_key)
    .maybeSingle()
  if (existing) {
    if (existing.error) return { ok: false, error: existing.error }
    return { ok: true, result: existing.result as ToolResult }
  }

  // 3. Execute with timer + audit log.
  const started = Date.now()
  // Insert pending row first so concurrent retries hit the unique index.
  const { data: pending, error: pendingErr } = await ctx.admin
    .from('ai_tool_calls')
    .insert({
      user_id: ctx.user_id,
      thread_id: ctx.thread_id,
      idempotency_key,
      tool_name,
      args,
    })
    .select('id')
    .maybeSingle()
  if (pendingErr) {
    // Race: another request inserted first. Re-read the result.
    const { data: race } = await ctx.admin
      .from('ai_tool_calls')
      .select('result, error')
      .eq('user_id', ctx.user_id)
      .eq('idempotency_key', idempotency_key)
      .maybeSingle()
    if (race?.error) return { ok: false, error: race.error }
    if (race?.result) return { ok: true, result: race.result as ToolResult }
    return { ok: false, error: 'Failed to register tool call: ' + pendingErr.message }
  }

  try {
    const result = await def.execute(args, ctx)
    await ctx.admin
      .from('ai_tool_calls')
      .update({
        result,
        finished_at: new Date().toISOString(),
        latency_ms: Date.now() - started,
      })
      .eq('id', pending!.id)
    return { ok: true, result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await ctx.admin
      .from('ai_tool_calls')
      .update({
        error: msg,
        finished_at: new Date().toISOString(),
        latency_ms: Date.now() - started,
      })
      .eq('id', pending!.id)
    return { ok: false, error: msg }
  }
}
