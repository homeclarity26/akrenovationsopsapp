import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  range: z.string().optional(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const rl = await checkRateLimit(req, 'get-usage-stats')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { range = 'today' } = parsedInput.data

    // Date range calculation
    const now = new Date()
    let since: Date
    if (range === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (range === '7d') {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (range === '30d') {
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1) // month to date
    }

    const { data: rows, error } = await supabase
      .from('api_usage_log')
      .select('service, model, agent_name, input_tokens, output_tokens, units, cost_usd, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error

    // Aggregate by service
    const byService: Record<string, { total_cost: number; calls: number; input_tokens: number; output_tokens: number }> = {}
    // Aggregate by agent
    const byAgent: Record<string, { service: string; total_cost: number; calls: number; input_tokens: number; output_tokens: number }> = {}
    // Aggregate by day (for sparkline)
    const byDay: Record<string, number> = {}

    let totalCost = 0

    for (const row of rows ?? []) {
      const cost = Number(row.cost_usd) || 0
      totalCost += cost

      // By service
      if (!byService[row.service]) byService[row.service] = { total_cost: 0, calls: 0, input_tokens: 0, output_tokens: 0 }
      byService[row.service].total_cost += cost
      byService[row.service].calls += 1
      byService[row.service].input_tokens += row.input_tokens ?? 0
      byService[row.service].output_tokens += row.output_tokens ?? 0

      // By agent
      const agentKey = row.agent_name ?? 'unknown'
      if (!byAgent[agentKey]) byAgent[agentKey] = { service: row.service, total_cost: 0, calls: 0, input_tokens: 0, output_tokens: 0 }
      byAgent[agentKey].total_cost += cost
      byAgent[agentKey].calls += 1
      byAgent[agentKey].input_tokens += row.input_tokens ?? 0
      byAgent[agentKey].output_tokens += row.output_tokens ?? 0

      // By day
      const day = new Date(row.created_at).toLocaleDateString('en-CA') // YYYY-MM-DD
      byDay[day] = (byDay[day] ?? 0) + cost
    }

    // Sort agents by cost descending
    const topAgents = Object.entries(byAgent)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 20)

    return new Response(JSON.stringify({
      total_cost: totalCost,
      range,
      since: since.toISOString(),
      by_service: byService,
      top_agents: topAgents,
      by_day: byDay,
      total_calls: rows?.length ?? 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('get-usage-stats error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
