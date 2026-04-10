// Shared helper to log AI usage to ai_usage_logs table.
// Wrap AI calls in every edge function with logAiUsage() for cost monitoring.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Pricing per million tokens (USD)
const RATES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
  'claude-3-haiku': { input: 1.0, output: 5.0 },
  'claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-pro': { input: 0.5, output: 1.5 },
  'gemini-flash': { input: 0.1, output: 0.4 },
  'gemini-embedding-001': { input: 0.0, output: 0.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
}

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = RATES[model] ?? { input: 3.0, output: 15.0 } // default to Sonnet pricing
  return Math.round(
    ((inputTokens / 1_000_000) * rate.input +
      (outputTokens / 1_000_000) * rate.output) *
      100,
  )
}

export async function logAiUsage(params: {
  company_id?: string
  function_name: string
  model_provider: string
  model_name: string
  input_tokens: number
  output_tokens: number
  duration_ms: number
  status: 'success' | 'error' | 'timeout'
  error_message?: string
}): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const costCents = calculateCost(
      params.model_name,
      params.input_tokens,
      params.output_tokens,
    )

    await supabase.from('ai_usage_logs').insert({
      company_id: params.company_id ?? null,
      function_name: params.function_name,
      model_provider: params.model_provider,
      model_name: params.model_name,
      input_tokens: params.input_tokens,
      output_tokens: params.output_tokens,
      estimated_cost_cents: costCents,
      duration_ms: params.duration_ms,
      status: params.status,
      error_message: params.error_message ?? null,
    })
  } catch (err) {
    // Non-blocking — never let logging failure break the main function
    console.error('ai_usage log error:', err)
  }
}
