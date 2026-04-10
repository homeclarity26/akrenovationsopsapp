// compare-budget-quotes — updated A13
// Triggered when admin taps "Compare all quotes" for a trade.
// NOW calls assemble-context first, then appends trade/quote data.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  trade_id: z.string().uuid('trade_id must be a valid UUID'),
  project_id: z.string().uuid('project_id must be a valid UUID'),
  user_id: z.string().uuid('user_id must be a valid UUID').optional(),
  user_role: z.enum(['admin', 'employee', 'client']).optional(),
})

interface RequestBody {
  trade_id: string
  project_id: string
  user_id?: string
  user_role?: 'admin' | 'employee' | 'client'
}

interface ComparisonResult {
  analysis: string
  recommended_quote_id: string
  reasoning: string
}

async function callAssembleContext(
  user_id: string,
  user_role: string,
  project_id: string,
  tradeName: string
): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_id,
        user_role,
        agent_name: 'compare-budget-quotes',
        capability_required: 'query_financials',
        entity_type: 'project',
        entity_id: project_id,
        query: `compare quotes for ${tradeName}`,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'compare-budget-quotes')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { trade_id, project_id, user_id, user_role = 'admin' } = parsedInput.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const company = await getCompanyProfile(supabase, 'system')

    // Fetch trade and quotes
    const { data: trade, error: tradeError } = await supabase
      .from('budget_trades')
      .select('*')
      .eq('id', trade_id)
      .single()

    if (tradeError) throw new Error(`Failed to fetch trade: ${tradeError.message}`)

    const { data: quotes, error: quotesError } = await supabase
      .from('budget_quotes')
      .select('*')
      .eq('trade_id', trade_id)
      .neq('status', 'declined')

    if (quotesError) throw new Error(`Failed to fetch quotes: ${quotesError.message}`)

    if (!quotes || quotes.length === 0) {
      return new Response(
        JSON.stringify({ analysis: 'No quotes to compare for this trade.', recommended_quote_id: '', reasoning: 'No active quotes found.' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Call assemble-context
    let baseSystemPrompt: string | null = null
    if (user_id) {
      baseSystemPrompt = await callAssembleContext(user_id, user_role, project_id, trade.name)
    }

    const quoteComparisonRules = `
QUOTE COMPARISON TASK
Trade: ${trade.name} (budget target: $${trade.budget_amount?.toLocaleString()})

CRITICAL COMPARISON RULES
1. A "labor only" quote is NOT cheaper than an "includes materials" quote at the same price — true cost of labor-only = labor + materials.
2. Scope exclusions can make a cheaper bid more expensive in total. Check every exclusion.
3. Look for hidden costs: haul-away, structural repairs, material delivery, permits, etc.

QUOTES TO COMPARE
${quotes.map((q: Record<string, unknown>) =>
  `Quote ID: ${q.id}
Company: ${q.company_name}
Amount: $${Number(q.amount).toLocaleString()}
Date: ${q.quote_date}
Includes materials: ${q.includes_materials ? 'Yes' : 'No (labor only)'}
Scope included: ${q.scope_included ?? 'Not specified'}
Scope excluded: ${q.scope_excluded ?? 'Nothing specified'}
Notes: ${q.notes ?? 'None'}`
).join('\n\n---\n\n')}

Respond ONLY with valid JSON:
{ "analysis": "2-4 sentence plain-English comparison with specific dollar amounts", "recommended_quote_id": "the id of the recommended quote", "reasoning": "1-2 sentence explanation" }`

    const systemPrompt = baseSystemPrompt
      ? `${baseSystemPrompt}\n\n${quoteComparisonRules}`
      : `You are a construction bid analysis specialist for ${company.name} in ${company.location}.\n${quoteComparisonRules}`

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_CONFIG.PRIMARY_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Compare the quotes for ${trade.name} and recommend the best value.` }],
      }),
    })

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text()
      throw new Error(`Claude API error: ${err}`)
    }

    const claudeResult = await anthropicResponse.json()
    const rawText = claudeResult.content?.[0]?.text ?? '{}'

    let result: ComparisonResult
    try {
      result = JSON.parse(rawText)
    } catch {
      result = { analysis: rawText.substring(0, 500), recommended_quote_id: quotes[0]?.id ?? '', reasoning: 'Could not parse structured response.' }
    }

    // Store analysis on the recommended quote
    if (result.recommended_quote_id) {
      await supabase
        .from('budget_quotes')
        .update({ ai_analysis: result.analysis })
        .eq('id', result.recommended_quote_id)
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('compare-budget-quotes error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
