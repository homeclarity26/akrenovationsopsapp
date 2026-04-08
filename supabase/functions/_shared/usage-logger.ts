// Shared utility for logging API usage to api_usage_log table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Pricing as of 2025 (USD per million tokens unless noted)
const PRICING = {
  'claude-sonnet-4-20250514':  { input: 3.00,  output: 15.00  },
  'claude-opus-4-20250514':    { input: 15.00, output: 75.00  },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00   },
  'claude-haiku-4-20250307':   { input: 0.80,  output: 4.00   },
  'gemini-2.5-flash':          { input: 0.15,  output: 0.60   },
  'gemini-2.5-pro':            { input: 1.25,  output: 10.00  },
  'gemini-embedding-001':      { input: 0.00,  output: 0.00   }, // free tier
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model as keyof typeof PRICING]
  if (!pricing) return 0
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

export async function logUsage(params: {
  service: 'anthropic' | 'gemini' | 'resend' | 'supabase' | 'stripe' | 'twilio' | 'other'
  model?: string
  agentName: string
  inputTokens?: number
  outputTokens?: number
  units?: number
  costUsd?: number
  metadata?: Record<string, unknown>
}) {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const inputTokens = params.inputTokens ?? 0
    const outputTokens = params.outputTokens ?? 0
    const cost = params.costUsd ?? (params.model
      ? calculateCost(params.model, inputTokens, outputTokens)
      : 0)

    await supabase.from('api_usage_log').insert({
      service: params.service,
      model: params.model,
      agent_name: params.agentName,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      units: params.units ?? 0,
      cost_usd: cost,
      metadata: params.metadata ?? null,
    })
  } catch (err) {
    // Non-blocking — never let logging failure break the main function
    console.error('usage-logger error:', err)
  }
}
