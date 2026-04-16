import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  query: z.string().min(1, 'query required'),
  company_id: z.string().uuid('company_id must be a UUID'),
})

interface ItemWithTotal {
  id: string
  name: string
  unit: string
  vendor: string | null
  pack_size: number | null
  min_stock_alert: number | null
  total: number
}

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_CONFIG.PRIMARY_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return {
    text: data.content?.[0]?.text ?? '',
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth || (auth.role !== 'admin' && auth.role !== 'super_admin' && auth.role !== 'employee')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'ai-inventory-query')
  if (!rl.allowed) return rateLimitResponse(rl)

  const started = Date.now()
  try {
    const body = await req.json()
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { query, company_id } = parsed.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ── Build a compact inventory snapshot ─────────────────────────────
    const { data: itemsData, error: itemsErr } = await supabase
      .from('inventory_items')
      .select('id, name, unit, vendor, pack_size, min_stock_alert')
      .eq('company_id', company_id)
      .eq('is_active', true)
    if (itemsErr) throw itemsErr
    const items = (itemsData ?? []) as Array<{
      id: string
      name: string
      unit: string
      vendor: string | null
      pack_size: number | null
      min_stock_alert: number | null
    }>

    // Location ids for this company (used to scope stock totals).
    const { data: locData, error: locErr } = await supabase
      .from('inventory_locations')
      .select('id')
      .eq('company_id', company_id)
    if (locErr) throw locErr
    const locationIds = ((locData ?? []) as Array<{ id: string }>).map(l => l.id)

    const stockTotals = new Map<string, number>()
    if (locationIds.length > 0) {
      const { data: stockData, error: stockErr } = await supabase
        .from('inventory_stock')
        .select('item_id, quantity')
        .in('location_id', locationIds)
      if (stockErr) throw stockErr
      for (const row of (stockData ?? []) as Array<{ item_id: string; quantity: number }>) {
        stockTotals.set(
          row.item_id,
          (stockTotals.get(row.item_id) ?? 0) + Number(row.quantity ?? 0),
        )
      }
    }

    const withTotals: ItemWithTotal[] = items.map(i => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      vendor: i.vendor,
      pack_size: i.pack_size,
      min_stock_alert: i.min_stock_alert !== null ? Number(i.min_stock_alert) : null,
      total: stockTotals.get(i.id) ?? 0,
    }))

    // Cap at 100 items — sort by total asc so low-stock / zero items make the cut.
    withTotals.sort((a, b) => a.total - b.total)
    const capped = withTotals.slice(0, 100)

    // Open alerts for this company.
    const { data: alertsData, error: alertsErr } = await supabase
      .from('inventory_alerts')
      .select('item_id, alert_type, summary, recommendation')
      .eq('company_id', company_id)
      .eq('status', 'open')
    if (alertsErr) throw alertsErr
    const openAlerts = (alertsData ?? []) as Array<{
      item_id: string
      alert_type: string
      summary: string
      recommendation: string | null
    }>

    const snapshot = {
      items: capped.map(i => ({
        name: i.name,
        unit: i.unit,
        vendor: i.vendor,
        pack_size: i.pack_size,
        min_stock_alert: i.min_stock_alert,
        current_total: i.total,
      })),
      open_alerts: openAlerts.map(a => ({
        alert_type: a.alert_type,
        summary: a.summary,
        recommendation: a.recommendation,
      })),
      total_items: items.length,
      shown_items: capped.length,
    }

    const systemPrompt =
      "You are the inventory assistant for a construction company. Answer concisely using the data below. If information isn't in the data, say so."
    const userPrompt = `User question: ${query}\n\nInventory snapshot (JSON):\n${JSON.stringify(snapshot, null, 2)}`

    const { text, usage } = await callClaude(systemPrompt, userPrompt, 1024)

    await logAiUsage({
      company_id,
      function_name: 'ai-inventory-query',
      model_provider: 'anthropic',
      model_name: AI_CONFIG.PRIMARY_MODEL,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      duration_ms: Date.now() - started,
      status: 'success',
    })

    return new Response(JSON.stringify({ answer: text }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    await logAiUsage({
      function_name: 'ai-inventory-query',
      model_provider: 'anthropic',
      model_name: AI_CONFIG.PRIMARY_MODEL,
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: Date.now() - started,
      status: 'error',
      error_message: err instanceof Error ? err.message : String(err),
    })
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
