// generate-embedding — A7 (updated to support Gemini primary, OpenAI fallback)
//
// Shared utility edge function. Produces a 1536-dimension vector for the
// given text, which matches the pgvector column spec in operational_memory
// and learning_insights. Called by assemble-context, update-operational-memory,
// and any agent that needs to embed text for semantic search.
//
// Provider priority:
//   1. Gemini (gemini-embedding-001) if GEMINI_API_KEY is set
//   2. OpenAI (text-embedding-3-small) if OPENAI_API_KEY is set
//   3. Error 500 if neither is configured
//
// Both models produce a 1536-dim vector (Gemini via output_dimensionality,
// OpenAI natively). The database schema and all downstream consumers are
// identical regardless of provider.
//
// Input:  { text: string }
// Output: { embedding: number[], provider: 'gemini' | 'openai' }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  text: z.string(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TARGET_DIMS = 1536

// ── Gemini embedding call ──────────────────────────────────────────────────

async function embedWithGemini(text: string, apiKey: string): Promise<number[]> {
  // The embedding models accept a max of ~2048 tokens. Cap by character count
  // as a safe proxy (models like gemini-embedding-001 cap around 2048 tokens
  // which is roughly 8000 characters for English prose).
  const input = text.slice(0, 8000)

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=' +
    apiKey

  const body = {
    content: { parts: [{ text: input }] },
    output_dimensionality: TARGET_DIMS,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Gemini embedding error ${res.status}: ${msg.slice(0, 300)}`)
  }

  const data = await res.json()
  const values: number[] | undefined = data.embedding?.values
  if (!values || !Array.isArray(values)) {
    throw new Error('Gemini returned no embedding values: ' + JSON.stringify(data).slice(0, 300))
  }
  if (values.length !== TARGET_DIMS) {
    throw new Error(
      `Gemini returned ${values.length}-dim vector, expected ${TARGET_DIMS}. ` +
        'Check output_dimensionality support for this model.'
    )
  }
  return values
}

// ── OpenAI embedding call (fallback) ───────────────────────────────────────

async function embedWithOpenAI(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8191),
    }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`OpenAI embedding error ${res.status}: ${msg.slice(0, 300)}`)
  }
  const result = await res.json()
  const values: number[] | undefined = result.data?.[0]?.embedding
  if (!values) throw new Error('OpenAI returned no embedding')
  return values
}

// ── Handler ────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const rl = await checkRateLimit(req, 'generate-embedding')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { text } = parsedInput.data

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')

    let embedding: number[]
    let provider: 'gemini' | 'openai'

    if (geminiKey) {
      embedding = await embedWithGemini(text, geminiKey)
      provider = 'gemini'
    } else if (openaiKey) {
      embedding = await embedWithOpenAI(text, openaiKey)
      provider = 'openai'
    } else {
      throw new Error(
        'No embedding provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.'
      )
    }

    return new Response(
      JSON.stringify({ embedding, provider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('generate-embedding error:', err)
    return new Response(
      JSON.stringify({ error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
