// extract-preferences — Phase E
// Called async after every meta-agent-chat turn.
// Analyzes the exchange for signals about Adam's preferences/patterns.
// Upserts to meta_agent_preferences table.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractInput {
  session_id: string
  user_message: string
  assistant_reply: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'extract-preferences')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const { session_id, user_message, assistant_reply }: ExtractInput = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Only analyze every 3rd message to avoid over-inference
    const { count } = await supabase.from('meta_agent_conversations').select('id', { count: 'exact', head: true }).eq('session_id', session_id)
    if ((count ?? 0) % 3 !== 0) {
      return new Response(JSON.stringify({ skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const systemPrompt = `Analyze this conversation exchange for signals about the user's (Adam's) preferences and patterns.
Return ONLY a JSON object with structure:
{
  "preferences": [
    { "type": "communication_style|decision_pattern|workflow_preference|business_priority|pain_point|time_pattern", "key": "short_key", "value": "what you learned", "confidence": 0.0-1.0, "evidence": "what specifically showed this" }
  ]
}
Only include high-confidence signals (>0.7). Return empty array if no clear signals.
Categories: communication_style, decision_pattern, workflow_preference, business_priority, pain_point, time_pattern`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `User: ${user_message}\nAssistant: ${assistant_reply}` }],
      }),
    })

    if (!res.ok) return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const data = await res.json()
    const rawText = data.content?.[0]?.text ?? '{}'

    let preferences: { type: string; key: string; value: string; confidence: number; evidence: string }[] = []
    try {
      const parsed = JSON.parse(rawText)
      preferences = parsed.preferences ?? []
    } catch { preferences = [] }

    // Upsert detected preferences
    for (const pref of preferences) {
      if (pref.confidence < 0.7) continue
      await supabase.from('meta_agent_preferences').upsert({
        preference_type: pref.type,
        key: pref.key,
        value: pref.value,
        confidence: pref.confidence,
        evidence: pref.evidence,
        inferred_at: new Date().toISOString(),
      }, { onConflict: 'preference_type,key', ignoreDuplicates: false })
    }

    return new Response(
      JSON.stringify({ success: true, preferences_extracted: preferences.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('extract-preferences error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
