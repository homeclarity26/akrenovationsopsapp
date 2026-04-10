// K17: Portfolio curator agent (weekly cron)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callAssembleContext(agentName: string, query: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system', user_role: 'admin', agent_name: agentName,
        capability_required: 'curate_photos', query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch { return null }
}

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 2048): Promise<string> {
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
  return data.content?.[0]?.text ?? ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-portfolio-curator')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const company = await getCompanyProfile(supabase, 'system');

    const basePrompt = await callAssembleContext('agent-portfolio-curator', 'select recent photos for portfolio')
    const systemPrompt = (basePrompt ??
      buildSystemPrompt(company, 'portfolio manager'))
      + `\n\nPORTFOLIO CURATOR\nSelect best photos for ${company.name} portfolio. Look for completed clean work, good lighting, variety.`

    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data: recent } = await supabase
      .from('project_photos')
      .select('id, image_url, category, ai_description, taken_at, project_id')
      .eq('in_portfolio', false)
      .gte('taken_at', cutoff)
      .limit(50)

    if (!recent || recent.length === 0) {
      return new Response(JSON.stringify({ message: 'no photos to review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const suggestions = await callClaude(systemPrompt, `Review these recent photos and suggest 5-10 for the portfolio.
Photos: ${JSON.stringify(recent)}
Return: [{photo_id, reason, suggested_caption, portfolio_category}]`)

    await supabase.from('ai_actions').insert({
      request_text: 'Weekly portfolio curation',
      action_type: 'portfolio_suggestion',
      action_data: { suggestions, photos_reviewed: recent.length },
      requires_approval: true,
      risk_level: 'low',
      status: 'pending',
    })

    return new Response(JSON.stringify({ suggestions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
