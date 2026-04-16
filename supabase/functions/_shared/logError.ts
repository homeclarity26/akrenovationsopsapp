/**
 * Shared error logger — inserts into the error_log table from any edge
 * function. Uses the service-role client so RLS doesn't block writes.
 *
 * Swallows all insert failures: logging must never throw.
 *
 * Usage:
 *   import { logError } from '../_shared/logError.ts'
 *   try { ... } catch (e) {
 *     await logError({
 *       source: 'edge_function',
 *       function_name: 'agent-inventory-alerts',
 *       severity: 'error',
 *       message: e instanceof Error ? e.message : String(e),
 *       stack: e instanceof Error ? e.stack : undefined,
 *       company_id,
 *     })
 *   }
 *
 * Retrofitting every edge function to call this is out of scope for PR 17 —
 * the helper is created so future PRs can wire it in.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type ErrorSource = 'edge_function' | 'frontend' | 'pg_trigger' | 'cron' | 'external'
export type ErrorSeverity = 'info' | 'warn' | 'error' | 'fatal'

export interface LogErrorInput {
  source: ErrorSource
  function_name?: string
  severity?: ErrorSeverity
  message: string
  stack?: string
  metadata?: Record<string, unknown>
  user_id?: string
  company_id?: string
}

export async function logError(input: LogErrorInput): Promise<void> {
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return

    const admin = createClient(url, serviceKey)

    await admin.from('error_log').insert({
      source: input.source,
      function_name: input.function_name ?? null,
      severity: input.severity ?? 'error',
      message: input.message,
      stack: input.stack ?? null,
      metadata: input.metadata ?? null,
      user_id: input.user_id ?? null,
      company_id: input.company_id ?? null,
    })
  } catch {
    // Intentional: logging must never throw. If we can't write to error_log
    // there is nothing useful we can do from here.
  }
}
