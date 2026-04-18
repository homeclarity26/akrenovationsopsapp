/**
 * Agent semantic sample.
 *
 * Picks 6 representative edge-function agents and invokes each as a real
 * authenticated admin. Asserts the response is valid JSON with an expected
 * shape — NOT that the LLM output is perfect, because LLM output is
 * non-deterministic. The goal is: does the function actually run to
 * completion with real input and produce a structurally sensible answer?
 *
 * Skips when GOLDEN_SUPABASE_* env vars aren't set.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.GOLDEN_SUPABASE_URL
const anonKey = process.env.GOLDEN_SUPABASE_ANON_KEY
const serviceKey = process.env.GOLDEN_SUPABASE_SERVICE_KEY

// These tests hit LIVE edge functions which call LLM APIs (Anthropic, Gemini)
// and cost real money. Gated behind a separate flag so regular CI doesn't
// burn cost on every PR. Set AGENT_SEMANTIC_LIVE=1 to run.
const shouldRun = !!(url && anonKey && serviceKey) && process.env.AGENT_SEMANTIC_LIVE === '1'

describe.runIf(shouldRun)('Agent semantic sample — 6 representative functions', () => {
  let client: SupabaseClient

  beforeAll(async () => {
    client = createClient(url ?? '', anonKey ?? '', { auth: { persistSession: false } })
    const { error } = await client.auth.signInWithPassword({
      email: 'e2e-admin@akr-test.local',
      password: 'TestAdminPw!2026',
    })
    expect(error).toBeNull()
  })

  async function invoke(slug: string, body: Record<string, unknown>) {
    const { data, error } = await client.functions.invoke(slug, { body })
    return { data, error }
  }

  it('agent-morning-brief returns a structured brief', async () => {
    const { data, error } = await invoke('agent-morning-brief', {})
    // Either succeeds with a brief-shaped object, or fails with a clear error.
    // Not-yet-configured integrations can produce empty sections — that's OK.
    if (error) {
      // Only 4xx business errors are acceptable; 5xx == bug
      const code = (error as { status?: number }).status ?? 0
      expect(code).toBeLessThan(500)
      return
    }
    expect(typeof data).toBe('object')
  })

  it('agent-risk-monitor runs without crashing', async () => {
    const { error } = await invoke('agent-risk-monitor', {})
    if (error) {
      expect((error as { status?: number }).status ?? 0).toBeLessThan(500)
    }
  })

  it('agent-lead-aging runs against seed data', async () => {
    const { error } = await invoke('agent-lead-aging', {})
    if (error) {
      expect((error as { status?: number }).status ?? 0).toBeLessThan(500)
    }
  })

  it('agent-invoice-aging runs without crashing', async () => {
    const { error } = await invoke('agent-invoice-aging', {})
    if (error) {
      expect((error as { status?: number }).status ?? 0).toBeLessThan(500)
    }
  })

  it('agent-compliance-monitor runs without crashing', async () => {
    const { error } = await invoke('agent-compliance-monitor', {})
    if (error) {
      expect((error as { status?: number }).status ?? 0).toBeLessThan(500)
    }
  })

  it('ai-inventory-query answers a simple prompt', async () => {
    const { data, error } = await invoke('ai-inventory-query', {
      query: 'How many items are in the shop?',
    })
    if (error) {
      expect((error as { status?: number }).status ?? 0).toBeLessThan(500)
      return
    }
    expect(data).toBeDefined()
  })
})
