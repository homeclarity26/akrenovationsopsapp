import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

// ──────────────────────────────────────────────────────────────────────────
// agent-inventory-alerts
// Scheduled daily scan of inventory_items across all companies. Inserts
// open alerts for low_stock / out_of_stock / stale_count conditions and
// auto-resolves any existing open alerts whose condition no longer holds.
//
// NO Anthropic calls — recommendation text is deterministic templates so the
// scan is cheap and predictable.
// ──────────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string
  company_id: string
  name: string
  unit: string
  pack_size: number | null
  vendor: string | null
  min_stock_alert: number | null
}

interface ExistingAlert {
  id: string
  item_id: string
  alert_type: 'low_stock' | 'out_of_stock' | 'stale_count'
  status: string
  threshold: number | null
}

type AlertType = 'low_stock' | 'out_of_stock' | 'stale_count'

interface PlannedAlert {
  company_id: string
  item_id: string
  alert_type: AlertType
  current_total: number
  threshold: number | null
  summary: string
  recommendation: string
}

const STALE_DAYS = 90

function buildLowStockRecommendation(
  item: InventoryItem,
  current: number,
): string {
  const threshold = Number(item.min_stock_alert ?? 0)
  const shortfall = Math.max(threshold - current, threshold)
  const reorderQty = Math.max(shortfall, 1)
  const vendorPart = item.vendor ? ` from ${item.vendor}` : ''
  const packPart = item.pack_size ? ` (typical pack ${item.pack_size})` : ''
  return `Reorder at least ${reorderQty} ${item.unit}${vendorPart}${packPart}.`
}

function buildSummary(
  item: InventoryItem,
  alertType: AlertType,
  current: number,
  staleDays: number | null,
): string {
  if (alertType === 'out_of_stock') {
    return `${item.name} is out of stock`
  }
  if (alertType === 'low_stock') {
    const threshold = Number(item.min_stock_alert ?? 0)
    return `${item.name}: ${current} ${item.unit} on hand, below alert of ${threshold}`
  }
  // stale_count
  if (staleDays === null) {
    return `${item.name} has never been counted`
  }
  return `${item.name} hasn't been counted in ${staleDays} days`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const rl = await checkRateLimit(req, 'agent-inventory-alerts')
  if (!rl.allowed) return rateLimitResponse(rl)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const results = {
    scanned_companies: 0,
    new_alerts: 0,
    auto_resolved: 0,
    errors: [] as Array<{ company_id: string; error: string }>,
  }

  try {
    // Global item load — used only to discover the set of distinct companies.
    // Per-company work below re-fetches to keep failure isolation clean.
    const { data: itemsData, error: itemsErr } = await supabase
      .from('inventory_items')
      .select('company_id')
      .eq('is_active', true)
    if (itemsErr) throw itemsErr
    const allItems = (itemsData ?? []) as Array<{ company_id: string }>
    if (allItems.length === 0) {
      return new Response(
        JSON.stringify(results),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    const companies = Array.from(new Set(allItems.map(i => i.company_id)))

    const openKey = (itemId: string, type: AlertType) => `${itemId}::${type}`
    const now = Date.now()

    // ── Per-company scan. One company's failure must NOT halt the rest. ──
    for (const company_id of companies) {
      try {
        // 1. Load active items for this company.
        const { data: cItemsData, error: cItemsErr } = await supabase
          .from('inventory_items')
          .select('id, company_id, name, unit, pack_size, vendor, min_stock_alert')
          .eq('is_active', true)
          .eq('company_id', company_id)
        if (cItemsErr) throw cItemsErr
        const items = (cItemsData ?? []) as InventoryItem[]
        if (items.length === 0) {
          results.scanned_companies++
          continue
        }
        const itemById = new Map(items.map(i => [i.id, i]))
        const itemIds = items.map(i => i.id)

        // 2. Current stock totals per item.
        const { data: stockData, error: stockErr } = await supabase
          .from('inventory_stock')
          .select('item_id, quantity')
          .in('item_id', itemIds)
        if (stockErr) throw stockErr
        const stockTotals = new Map<string, number>()
        for (const row of (stockData ?? []) as Array<{ item_id: string; quantity: number }>) {
          stockTotals.set(
            row.item_id,
            (stockTotals.get(row.item_id) ?? 0) + Number(row.quantity ?? 0),
          )
        }

        // 3. Latest stocktake per item (for stale_count).
        const { data: stocktakeData, error: stocktakeErr } = await supabase
          .from('inventory_stocktakes')
          .select('item_id, created_at')
          .in('item_id', itemIds)
          .order('created_at', { ascending: false })
        if (stocktakeErr) throw stocktakeErr
        const latestStocktake = new Map<string, string>()
        for (const row of (stocktakeData ?? []) as Array<{ item_id: string; created_at: string }>) {
          if (!latestStocktake.has(row.item_id)) {
            latestStocktake.set(row.item_id, row.created_at)
          }
        }

        // 4. Existing open alerts for this company.
        const { data: existingData, error: existingErr } = await supabase
          .from('inventory_alerts')
          .select('id, item_id, alert_type, status, threshold')
          .eq('status', 'open')
          .eq('company_id', company_id)
          .in('item_id', itemIds)
        if (existingErr) throw existingErr
        const existingAlerts = (existingData ?? []) as ExistingAlert[]
        const openAlertMap = new Map<string, ExistingAlert>()
        for (const a of existingAlerts) {
          openAlertMap.set(openKey(a.item_id, a.alert_type as AlertType), a)
        }

        // 5. Decide alerts for this company.
        const planned: PlannedAlert[] = []
        const stillNeeded = new Set<string>()

        for (const item of items) {
          const current = stockTotals.get(item.id) ?? 0
          const threshold = item.min_stock_alert !== null ? Number(item.min_stock_alert) : null

          if (threshold !== null) {
            if (current <= 0) {
              stillNeeded.add(openKey(item.id, 'out_of_stock'))
              planned.push({
                company_id: item.company_id,
                item_id: item.id,
                alert_type: 'out_of_stock',
                current_total: current,
                threshold,
                summary: buildSummary(item, 'out_of_stock', current, null),
                recommendation: buildLowStockRecommendation(item, current),
              })
            } else if (current < threshold) {
              stillNeeded.add(openKey(item.id, 'low_stock'))
              planned.push({
                company_id: item.company_id,
                item_id: item.id,
                alert_type: 'low_stock',
                current_total: current,
                threshold,
                summary: buildSummary(item, 'low_stock', current, null),
                recommendation: buildLowStockRecommendation(item, current),
              })
            }
          }

          const latest = latestStocktake.get(item.id)
          let isStale = false
          let days: number | null = null
          if (!latest) {
            isStale = true
          } else {
            days = Math.floor((now - new Date(latest).getTime()) / 86400000)
            if (days > STALE_DAYS) isStale = true
          }
          if (isStale) {
            stillNeeded.add(openKey(item.id, 'stale_count'))
            planned.push({
              company_id: item.company_id,
              item_id: item.id,
              alert_type: 'stale_count',
              current_total: current,
              threshold: null,
              summary: buildSummary(item, 'stale_count', current, days),
              recommendation: 'Do a count of this item at next stocktake.',
            })
          }
        }

        // 6. Filter + insert new alerts (swallow unique-violation for dedup).
        const toInsert = planned.filter(
          p => !openAlertMap.has(openKey(p.item_id, p.alert_type)),
        )
        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from('inventory_alerts')
            .insert(toInsert)
          if (insertErr) {
            const code = (insertErr as { code?: string }).code
            if (code !== '23505') throw insertErr
          } else {
            results.new_alerts += toInsert.length
          }
        }

        // 7. Auto-resolve open alerts that no longer apply.
        const toResolve: string[] = []
        for (const existing of existingAlerts) {
          const item = itemById.get(existing.item_id)
          if (!item) continue
          if (!stillNeeded.has(openKey(existing.item_id, existing.alert_type as AlertType))) {
            toResolve.push(existing.id)
          }
        }
        if (toResolve.length > 0) {
          const { error: updErr } = await supabase
            .from('inventory_alerts')
            .update({
              status: 'resolved',
              reviewed_at: new Date().toISOString(),
            })
            .in('id', toResolve)
          if (updErr) throw updErr
          results.auto_resolved += toResolve.length
        }

        results.scanned_companies++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`agent-inventory-alerts: company ${company_id} failed:`, message)
        results.errors.push({ company_id, error: message })
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-inventory-alerts error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
