/**
 * Full agent semantic matrix.
 *
 * Invokes every user-facing agent edge function as an authenticated admin and
 * asserts the function runs without a 5xx. Most agents return 2xx with a
 * result payload, or 4xx with a clear validation error; both are acceptable.
 * 5xx means the function crashed — that's the bug we're looking for.
 *
 * Gated behind AGENT_SEMANTIC_LIVE=1 because these calls hit real LLM APIs
 * and cost real money per run. Intended for pre-release smoke, not every PR.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.GOLDEN_SUPABASE_URL
const anonKey = process.env.GOLDEN_SUPABASE_ANON_KEY
const shouldRun = !!(url && anonKey) && process.env.AGENT_SEMANTIC_LIVE === '1'

// Agents grouped by invocation shape.
// "empty" — agents that run on their own cadence and accept no body.
// "needs-context" — agents that need a project_id or similar; pass a dummy.
const EMPTY_BODY_AGENTS = [
  'agent-morning-brief',
  'agent-risk-monitor',
  'agent-lead-aging',
  'agent-invoice-aging',
  'agent-compliance-monitor',
  'agent-cash-flow',
  'agent-weekly-financials',
  'agent-weekly-client-update',
  'agent-sub-insurance-alert',
  'agent-warranty-tracker',
  'agent-weather-schedule',
  'agent-social-content',
  'agent-daily-log',
  'agent-improvement-analysis',
  'agent-template-improvement-suggester',
  'agent-calibrate-templates',
  'agent-lead-intake',
  'agent-referral-intake',
  'agent-sub-invoice-matcher',
  'agent-photo-tagger',
  'agent-document-classifier',
  'agent-call-summarizer',
  'agent-conversation-transcriber',
  'agent-voice-transcriber',
  'agent-schedule-optimizer',
  'agent-portfolio-curator',
  'agent-receipt-processor',
  'agent-change-order-drafter',
  'agent-invoice-generator',
  'agent-bonus-qualification',
  'agent-punch-list',
  'agent-sms-responder',
  'agent-review-request',
  'agent-tool-request',
  'agent-warranty-intake',
  'agent-inspection-analyzer',
  'agent-quote-reader',
]

const CONTEXT_AGENTS: Array<{ slug: string; body: Record<string, unknown> }> = [
  { slug: 'ai-inventory-query', body: { query: 'How many tile sets are in the shop right now?' } },
  { slug: 'agent-proposal-writer', body: { project_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'agent-generate-scope', body: { project_id: '00000000-0000-0000-0000-000000000000', trade: 'electrical' } },
  { slug: 'agent-generate-contract', body: { project_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'agent-generate-reel', body: { project_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'generate-progress-reel', body: { project_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'generate-estimate', body: { project_id: '00000000-0000-0000-0000-000000000000', project_type: 'kitchen' } },
  { slug: 'generate-pdf', body: { type: 'invoice', id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'generate-checklists', body: { project_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'generate-payroll-register', body: { pay_period_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'generate-improvement-spec', body: { suggestion_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'calculate-payroll', body: { pay_period_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'budget-ai-action', body: { project_id: '00000000-0000-0000-0000-000000000000', action: 'summarize' } },
  { slug: 'compare-budget-quotes', body: { project_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'process-budget-document', body: { file_url: 'https://example.com/test.pdf', project_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'suggest-deliverable-items', body: { project_type: 'kitchen', scope_summary: 'gut renovation' } },
  { slug: 'ai-suggest-project-action', body: { project_id: '00000000-0000-0000-0000-000000000000', suggestion_type: 'task' } },
  { slug: 'meta-agent-chat', body: { message: 'hello', session_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'meta-agent-orchestration', body: {} },
  { slug: 'assemble-context', body: { user_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'extract-preferences', body: { message_text: 'test' } },
  { slug: 'update-operational-memory', body: { entity_type: 'project', entity_id: '00000000-0000-0000-0000-000000000000', event: 'test' } },
  { slug: 'sync-to-drive', body: { project_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'agent-photo-stocktake', body: { photo_url: 'https://example.com/test.jpg', location_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'generate-embedding', body: { text: 'hello world' } },
  { slug: 'backup-database', body: {} },
  { slug: 'apply-project-suggestion', body: { suggestion_id: '00000000-0000-0000-0000-000000000000' } },
  { slug: 'reject-project-suggestion', body: { suggestion_id: '00000000-0000-0000-0000-000000000000' } },
]

describe.runIf(shouldRun)('Full agent semantic matrix', () => {
  let client: SupabaseClient

  beforeAll(async () => {
    client = createClient(url ?? '', anonKey ?? '', { auth: { persistSession: false } })
    const { error } = await client.auth.signInWithPassword({
      email: 'e2e-admin@akr-test.local',
      password: 'TestAdminPw!2026',
    })
    expect(error).toBeNull()
  })

  for (const slug of EMPTY_BODY_AGENTS) {
    it(`${slug} runs without 5xx`, async () => {
      const { error } = await client.functions.invoke(slug, { body: {} })
      if (error) {
        const status = (error as { context?: { status?: number }; status?: number }).context?.status
          ?? (error as { status?: number }).status ?? 0
        expect(status, `${slug} returned ${status}`).toBeLessThan(500)
      }
    })
  }

  for (const { slug, body } of CONTEXT_AGENTS) {
    it(`${slug} runs without 5xx`, async () => {
      const { error } = await client.functions.invoke(slug, { body })
      if (error) {
        const status = (error as { context?: { status?: number }; status?: number }).context?.status
          ?? (error as { status?: number }).status ?? 0
        expect(status, `${slug} returned ${status}`).toBeLessThan(500)
      }
    })
  }
})
