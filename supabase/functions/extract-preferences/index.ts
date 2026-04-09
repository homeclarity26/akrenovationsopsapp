// extract-preferences — Phase E (overhaul)
// Called async (fire-and-forget) after every meta-agent-chat turn.
// Analyzes the exchange for preferences, patterns, and business facts worth remembering.
// Writes to meta_agent_preferences and operational_memory tables.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  session_id: z.string(),
  user_message: z.string(),
  assistant_reply: z.string(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractInput {
  session_id: string
  user_message: string
  assistant_reply: string
}

interface ExtractedPreference {
  key: string
  value: string
  preference_type: 'communication' | 'workflow' | 'financial' | 'operational'
}

interface ExtractedFact {
  content: string
  memory_type: 'fact' | 'pattern' | 'preference'
}

interface ExtractionResult {
  preferences: ExtractedPreference[]
  facts: ExtractedFact[]
  nothing_worth_saving: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'extract-preferences')
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
    const { session_id, user_message, assistant_reply } = parsedInput.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Load existing preference keys to avoid re-extracting known things
    const { data: existingPrefs } = await supabase
      .from('meta_agent_preferences')
      .select('key,preference_type')
      .limit(100)

    const existingKeys = new Set((existingPrefs ?? []).map(p => `${p.preference_type}/${p.key}`))

    // Call Claude Haiku for fast extraction
    const extractionPrompt = `You are analyzing a conversation between Adam Kilgore (AK Renovations owner) and his AI chief of staff.

Extract ONLY non-obvious, durable information worth remembering for future conversations. Skip pleasantries, skip things any business would do.

User message: ${user_message}
AI reply: ${assistant_reply}

Return JSON:
{
  "preferences": [{"key": "string", "value": "string", "preference_type": "communication|workflow|financial|operational"}],
  "facts": [{"content": "string", "memory_type": "fact|pattern|preference"}],
  "nothing_worth_saving": boolean
}

Rules:
- If nothing interesting was said, set nothing_worth_saving: true and return empty arrays
- preferences: things about HOW Adam likes to work ("prefers bullet points over paragraphs", "wants AR follow-up after 14 days not 7")
- facts: things ABOUT the business ("Henderson client is price sensitive", "Martinez project is a referral from Thompson")
- Max 3 items total — quality over quantity
- Skip generic things ("Adam wants invoices paid") — only extract specific, non-obvious signals
- preference_type must be exactly one of: communication, workflow, financial, operational`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',
        max_tokens: 600,
        system: 'You extract structured preference and fact data from conversations. Always return valid JSON.',
        messages: [{ role: 'user', content: extractionPrompt }],
      }),
    })

    if (!res.ok) {
      console.error('Haiku extraction error:', await res.text())
      return new Response(JSON.stringify({ success: false, reason: 'claude_error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const data = await res.json()
    const rawText = (data.content?.[0]?.text ?? '').trim()

    // Parse the JSON response, stripping markdown code fences if present
    let result: ExtractionResult = { preferences: [], facts: [], nothing_worth_saving: true }
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse extraction JSON:', rawText)
      return new Response(JSON.stringify({ success: false, reason: 'parse_error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (result.nothing_worth_saving) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'nothing_worth_saving' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let prefsWritten = 0
    let factsWritten = 0

    // Write preferences — skip keys we already know
    for (const pref of result.preferences ?? []) {
      if (!pref.key || !pref.value || !pref.preference_type) continue
      const compositeKey = `${pref.preference_type}/${pref.key}`
      if (existingKeys.has(compositeKey)) continue

      const { error } = await supabase
        .from('meta_agent_preferences')
        .upsert({
          preference_type: pref.preference_type,
          key: pref.key,
          value: pref.value,
          inferred_at: new Date().toISOString(),
        }, { onConflict: 'preference_type,key', ignoreDuplicates: false })

      if (!error) {
        prefsWritten++
        existingKeys.add(compositeKey)
      } else {
        console.error('Pref upsert error:', error)
      }
    }

    // Write facts/patterns to operational_memory
    for (const fact of result.facts ?? []) {
      if (!fact.content || !fact.memory_type) continue

      const { error } = await supabase
        .from('operational_memory')
        .insert({
          memory_type: fact.memory_type,
          content: fact.content,
          source: 'meta_agent_conversation',
          session_id,
          created_at: new Date().toISOString(),
        })

      if (!error) {
        factsWritten++
      } else {
        console.error('Fact insert error:', error)
      }
    }

    return new Response(
      JSON.stringify({ success: true, preferences_written: prefsWritten, facts_written: factsWritten }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('extract-preferences error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
