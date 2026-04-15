// deduct-shopping-item-from-stock
// -----------------------------------------------------------------------------
// Called by the admin UI (and eventually by the meta-agent) when a shopping
// list item linked to an inventory_item + source_location should be pulled
// off that location's stock. Design mirrors PR 7: stocktakes are the only
// way stock changes, so this function INSERTs an inventory_stocktakes row
// and lets the existing triggers handle the inventory_stock UPSERT.
//
// Idempotent: shopping_list_items.deducted_at guards against double-deduct.
// Underflow-tolerant: if source has less than shopping.quantity on hand, we
// deduct down to 0 and return a warning (per the "enough signal" ethos
// from PR 7 / PR 9 — a rough miscount shouldn't block a real-world move).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { verifyAuth } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const InputSchema = z.object({
  shopping_list_item_id: z.string().uuid('shopping_list_item_id must be a valid UUID'),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
    }
    // This PR keeps the scope tight: admin-only. Employees who need to move
    // stock submit stocktakes directly from the stocktake page (PR 9).
    if (auth.role !== 'admin' && auth.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers },
      )
    }

    const { shopping_list_item_id } = parsed.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ── Load the shopping list row ─────────────────────────────────────────
    const { data: shopping, error: loadErr } = await supabase
      .from('shopping_list_items')
      .select(
        'id, quantity, inventory_item_id, source_location_id, deducted_at, project_id, item_name',
      )
      .eq('id', shopping_list_item_id)
      .single()

    if (loadErr || !shopping) {
      return new Response(JSON.stringify({ error: 'Shopping list item not found' }), { status: 404, headers })
    }

    // ── Idempotency guard ──────────────────────────────────────────────────
    if (shopping.deducted_at) {
      return new Response(
        JSON.stringify({ error: 'Stock has already been deducted for this item' }),
        { status: 409, headers },
      )
    }

    // ── Required links for deduction ───────────────────────────────────────
    if (!shopping.inventory_item_id) {
      return new Response(
        JSON.stringify({ error: 'Shopping item is not linked to an inventory item' }),
        { status: 400, headers },
      )
    }
    if (!shopping.source_location_id) {
      return new Response(
        JSON.stringify({ error: 'Shopping item has no source location set' }),
        { status: 400, headers },
      )
    }
    const qtyToDeduct = Number(shopping.quantity ?? 0)
    if (!Number.isFinite(qtyToDeduct) || qtyToDeduct <= 0) {
      return new Response(
        JSON.stringify({ error: 'Shopping item quantity must be greater than zero' }),
        { status: 400, headers },
      )
    }

    // ── Look up current stock at source ────────────────────────────────────
    const { data: stockRow, error: stockErr } = await supabase
      .from('inventory_stock')
      .select('quantity')
      .eq('location_id', shopping.source_location_id)
      .eq('item_id', shopping.inventory_item_id)
      .maybeSingle()

    if (stockErr) {
      return new Response(JSON.stringify({ error: `Failed to read stock: ${stockErr.message}` }), { status: 500, headers })
    }

    const previousQty = Number(stockRow?.quantity ?? 0)
    const newQty = Math.max(0, previousQty - qtyToDeduct)
    const warning = previousQty < qtyToDeduct
      ? `Source had only ${previousQty} on hand; deducted down to 0 (shorted by ${qtyToDeduct - previousQty}).`
      : null

    // ── Insert stocktake row. BEFORE trigger fills quantity_before; AFTER
    //    trigger UPSERTs the canonical inventory_stock row.
    const { data: stocktake, error: takeErr } = await supabase
      .from('inventory_stocktakes')
      .insert({
        location_id: shopping.source_location_id,
        item_id: shopping.inventory_item_id,
        counted_by: auth.user_id,
        quantity_after: newQty,
        confidence: 'exact',
        notes: `Auto-deducted for project shopping list item ${shopping.id} (${shopping.item_name ?? 'item'})`,
      })
      .select('id')
      .single()

    if (takeErr || !stocktake) {
      return new Response(
        JSON.stringify({ error: `Failed to record stocktake: ${takeErr?.message ?? 'unknown error'}` }),
        { status: 500, headers },
      )
    }

    // ── Mark shopping row as deducted ──────────────────────────────────────
    const now = new Date().toISOString()
    const { error: updErr } = await supabase
      .from('shopping_list_items')
      .update({
        deducted_at: now,
        deducted_stocktake_id: stocktake.id,
      })
      .eq('id', shopping.id)

    if (updErr) {
      // Stocktake already landed — surface the UPDATE error but the audit
      // trail via deducted_stocktake_id can still be reconciled manually.
      return new Response(
        JSON.stringify({
          error: `Stock deducted but shopping row update failed: ${updErr.message}`,
          stocktake_id: stocktake.id,
          previous_qty: previousQty,
          new_qty: newQty,
          warning,
        }),
        { status: 500, headers },
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        previous_qty: previousQty,
        new_qty: newQty,
        stocktake_id: stocktake.id,
        ...(warning ? { warning } : {}),
      }),
      { headers },
    )
  } catch (err) {
    console.error('deduct-shopping-item-from-stock error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers })
  }
})
