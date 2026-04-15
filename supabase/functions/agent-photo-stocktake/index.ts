// PR 12 — photo-based stocktake: Gemini vision proposes item counts from a
// photo of a shelf / truck compartment / bin. The function ONLY proposes
// counts — it never writes inventory_stocktakes. The caller (frontend modal
// in EmployeeStocktakePage) reviews, edits, and submits inserts itself.
//
// Input:
//   photo_url         — full URL (or storage path) to the uploaded photo
//   location_id       — the inventory_locations.id being counted
//   expected_items?   — optional pre-loaded item catalog. When absent, the
//                       function loads all active items in the location's
//                       company, biasing toward items that already have stock
//                       at this location.
//
// Output:
//   proposals: Array<{
//     item_id: string,
//     estimated_quantity: number,
//     confidence: 'low'|'medium'|'high',
//     reasoning: string,
//   }>
//
// Error handling: Gemini's JSON responses are not guaranteed to parse. We
// retry ONCE with a tighter "respond with valid JSON only — no markdown, no
// prose" reinforcement. If still unparseable, we 502 so the client can
// fall back to manual entry.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const ExpectedItemSchema = z.object({
  item_id: z.string().uuid(),
  name: z.string().min(1),
  unit: z.string().min(1),
  pack_size: z.number().nullable().optional(),
})

const InputSchema = z.object({
  photo_url: z.string().min(1, 'photo_url is required'),
  location_id: z.string().uuid('location_id must be a valid UUID'),
  expected_items: z.array(ExpectedItemSchema).optional(),
})

// Gemini's output must match this after parsing. `item_id` may be missing if
// the AI hallucinated a name it didn't recognize — we drop those server-side.
const ProposalSchema = z.object({
  item_id: z.string().uuid().optional().nullable(),
  name: z.string().optional().nullable(),
  estimated_quantity: z.number().nonnegative(),
  confidence: z.enum(['low', 'medium', 'high']),
  reasoning: z.string().optional().default(''),
})
const ProposalsEnvelope = z.object({
  proposals: z.array(ProposalSchema),
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      // @ts-ignore — Deno TS doesn't like subarray here, but it works.
      bytes.subarray(i, i + chunkSize) as unknown as number[],
    )
  }
  return btoa(binary)
}

// Accepts either a full URL or a storage path (bucket/key) and returns image
// bytes + detected MIME type. For storage-path inputs we mint a signed URL
// via the service-role client, then fetch it.
async function resolveAndFetchImage(
  supabase: ReturnType<typeof createClient>,
  photoUrl: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  let url = photoUrl

  // If the caller passed a "bucket/path.jpg" storage key, sign a URL for it.
  if (!photoUrl.startsWith('http://') && !photoUrl.startsWith('https://')) {
    const slashIdx = photoUrl.indexOf('/')
    if (slashIdx <= 0) {
      throw new Error(`Invalid storage path: ${photoUrl}`)
    }
    const bucket = photoUrl.slice(0, slashIdx)
    const key = photoUrl.slice(slashIdx + 1)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(key, 60)
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to sign ${photoUrl}: ${error?.message ?? 'no url'}`)
    }
    url = data.signedUrl
  }

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch photo: ${res.status} ${res.statusText}`)
  }
  const bytes = await res.arrayBuffer()
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
  return { bytes, mimeType }
}

interface GeminiResult {
  text: string
  usage: { input_tokens: number; output_tokens: number }
}

async function callGeminiVision(
  imageBase64: string,
  imageMime: string,
  systemInstructions: string,
  userPrompt: string,
  maxOutputTokens: number,
): Promise<GeminiResult> {
  const key = Deno.env.get('GEMINI_API_KEY') ?? ''
  if (!key) throw new Error('GEMINI_API_KEY is not configured')

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.VISION_MODEL}:generateContent?key=` +
    key

  const body = {
    systemInstruction: { parts: [{ text: systemInstructions }] },
    contents: [
      {
        parts: [
          { text: userPrompt },
          { inline_data: { mime_type: imageMime, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json',
      maxOutputTokens,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Gemini vision error ${res.status}: ${txt.slice(0, 400)}`)
  }

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts ?? []
  let text = ''
  for (const p of parts) {
    if (typeof p.text === 'string' && p.text.trim()) {
      text = p.text
      break
    }
  }
  const usage = {
    input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
    output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  }
  if (!text) throw new Error('Gemini vision returned no text')
  return { text, usage }
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]+\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('no JSON object found')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface KnownItem {
  item_id: string
  name: string
  unit: string
  pack_size: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }

  // Only employees + admins can propose stocktake counts. Same boundary as
  // the inventory_stocktakes INSERT policy.
  const role = auth.role
  if (role !== 'employee' && role !== 'admin' && role !== 'super_admin') {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }

  const rl = await checkRateLimit(req, 'agent-photo-stocktake')
  if (!rl.allowed) return rateLimitResponse(rl)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(rawBody)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { photo_url, location_id, expected_items } = parsed.data

    // Resolve the location so we can pull items + the company_id for usage logs.
    const { data: location, error: locErr } = await supabase
      .from('inventory_locations')
      .select('id, company_id, name, type')
      .eq('id', location_id)
      .single()
    if (locErr || !location) {
      return new Response(
        JSON.stringify({ error: 'Location not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Build the catalog the AI will match against.
    let knownItems: KnownItem[]
    if (expected_items && expected_items.length > 0) {
      knownItems = expected_items.map((it) => ({
        item_id: it.item_id,
        name: it.name,
        unit: it.unit,
        pack_size: it.pack_size ?? null,
      }))
    } else {
      // Fetch all active items for the company. Bias order by existing stock
      // rows at this location so the top of the list is most likely to match
      // what's actually in the photo.
      const [itemsRes, stockRes] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('id, name, unit, pack_size')
          .eq('company_id', location.company_id)
          .eq('is_active', true)
          .limit(200),
        supabase
          .from('inventory_stock')
          .select('item_id')
          .eq('location_id', location_id),
      ])
      if (itemsRes.error) throw itemsRes.error
      if (stockRes.error) throw stockRes.error
      const stockedIds = new Set(
        (stockRes.data ?? []).map((r: { item_id: string }) => r.item_id),
      )
      const all = (itemsRes.data ?? []) as Array<{
        id: string
        name: string
        unit: string
        pack_size: number | null
      }>
      all.sort((a, b) => {
        const aStocked = stockedIds.has(a.id) ? 0 : 1
        const bStocked = stockedIds.has(b.id) ? 0 : 1
        if (aStocked !== bStocked) return aStocked - bStocked
        return a.name.localeCompare(b.name)
      })
      knownItems = all.map((i) => ({
        item_id: i.id,
        name: i.name,
        unit: i.unit,
        pack_size: i.pack_size,
      }))
    }

    if (knownItems.length === 0) {
      return new Response(
        JSON.stringify({
          proposals: [],
          note: 'No catalog items found for this location. Add items first.',
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Fetch the image bytes.
    const { bytes, mimeType } = await resolveAndFetchImage(supabase, photo_url)
    const imageBase64 = arrayBufferToBase64(bytes)

    // ── Gemini prompt ──────────────────────────────────────────────────────
    const catalogJson = JSON.stringify(
      knownItems.map((i) => ({
        item_id: i.item_id,
        name: i.name,
        unit: i.unit,
        pack_size: i.pack_size,
      })),
    )

    const systemInstructions =
`You are a construction-supply inventory assistant. The user will send you a photo of a shelf, truck compartment, bin, or shop rack. Your job is to count visible quantities of items and match each visually-detected item to the closest entry in the provided catalog.

Rules:
- Only propose items that you are reasonably confident are visible in the photo.
- NEVER guess an item_id. If you recognize the item, use its exact item_id from the catalog. If you can't match it, omit item_id and put the visual name in "name" — the caller will discard unmatched items.
- Units matter. If the catalog says a 5lb box, estimate the number of BOXES visible, not pounds. Use pack_size only for intuition, not math.
- Partial packages count: an opened box is still one box. If you see half-used, say so in reasoning and mark confidence 'low'.
- Confidence: 'high' = you clearly see the item and can count it, 'medium' = likely but occluded / fuzzy, 'low' = you're guessing from shape or label.
- Respond with ONLY a JSON object matching the user's schema. No markdown, no prose outside the JSON.`

    const userPrompt =
`Catalog (match exact item_id when you recognize an item):
${catalogJson}

Location: ${location.name} (${location.type})

Return a JSON object with this exact shape:
{
  "proposals": [
    {
      "item_id": "<uuid from catalog, or omit if not matched>",
      "name": "<short label for what you saw — include even when item_id is present>",
      "estimated_quantity": <number, use the catalog's unit>,
      "confidence": "low" | "medium" | "high",
      "reasoning": "one short sentence explaining what you counted and any caveats"
    }
  ]
}

If the photo is too blurry or doesn't show inventory, return {"proposals": []}.`

    // ── Call Gemini, with one JSON-only retry on parse failure ────────────
    const _t0 = Date.now()
    let raw: GeminiResult
    let parsedResp: unknown
    try {
      raw = await callGeminiVision(
        imageBase64,
        mimeType,
        systemInstructions,
        userPrompt,
        AI_CONFIG.VISION_MAX_TOKENS,
      )
      parsedResp = extractJson(raw.text)
    } catch (firstErr) {
      // Retry once with a JSON-only reinforcement. Log the first attempt.
      await logAiUsage({
        company_id: location.company_id,
        function_name: 'agent-photo-stocktake',
        model_provider: 'gemini',
        model_name: AI_CONFIG.VISION_MODEL,
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - _t0,
        status: 'error',
        error_message: String(firstErr).slice(0, 400),
      })

      const retryPrompt =
        userPrompt +
        `\n\nYour previous response could not be parsed as JSON. Respond with ONLY a valid JSON object. Do not include any explanation, markdown fence, or prose outside the JSON.`

      try {
        raw = await callGeminiVision(
          imageBase64,
          mimeType,
          systemInstructions,
          retryPrompt,
          AI_CONFIG.VISION_MAX_TOKENS,
        )
        parsedResp = extractJson(raw.text)
      } catch (secondErr) {
        await logAiUsage({
          company_id: location.company_id,
          function_name: 'agent-photo-stocktake',
          model_provider: 'gemini',
          model_name: AI_CONFIG.VISION_MODEL,
          input_tokens: 0,
          output_tokens: 0,
          duration_ms: Date.now() - _t0,
          status: 'error',
          error_message: String(secondErr).slice(0, 400),
        })
        return new Response(
          JSON.stringify({
            error: 'AI response could not be parsed — fall back to manual entry.',
            details: String(secondErr).slice(0, 400),
          }),
          { status: 502, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
        )
      }
    }

    // Validate the envelope shape. If the outer wrapper is missing, try to
    // coerce: some models return a bare array.
    let envelope: { proposals: unknown[] }
    if (Array.isArray(parsedResp)) {
      envelope = { proposals: parsedResp }
    } else if (parsedResp && typeof parsedResp === 'object' && 'proposals' in parsedResp) {
      envelope = parsedResp as { proposals: unknown[] }
    } else {
      envelope = { proposals: [] }
    }

    const validation = ProposalsEnvelope.safeParse(envelope)
    const rawProposals = validation.success ? validation.data.proposals : []

    // Drop proposals without a matching known item. Clamp quantity to zero+.
    const knownIds = new Set(knownItems.map((i) => i.item_id))
    const matched = rawProposals
      .filter((p) => p.item_id && knownIds.has(p.item_id))
      .map((p) => ({
        item_id: p.item_id as string,
        estimated_quantity: Math.max(0, Number(p.estimated_quantity) || 0),
        confidence: p.confidence,
        reasoning: (p.reasoning ?? '').slice(0, 500),
      }))

    await logAiUsage({
      company_id: location.company_id,
      function_name: 'agent-photo-stocktake',
      model_provider: 'gemini',
      model_name: AI_CONFIG.VISION_MODEL,
      input_tokens: raw.usage.input_tokens,
      output_tokens: raw.usage.output_tokens,
      duration_ms: Date.now() - _t0,
      status: 'success',
    })

    return new Response(
      JSON.stringify({
        proposals: matched,
        unmatched_count: rawProposals.length - matched.length,
        location_id,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-photo-stocktake error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
