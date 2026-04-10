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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system', user_role: 'admin', agent_name: agentName,
        capability_required: 'query_financials', query,
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

async function writeOutput(
  supabase: ReturnType<typeof createClient>,
  agentName: string,
  outputType: string,
  title: string,
  content: string,
  metadata?: Record<string, unknown>,
  requiresApproval = false,
) {
  await supabase.from('agent_outputs').insert({
    agent_name: agentName, output_type: outputType, title, content,
    metadata: metadata ?? null, requires_approval: requiresApproval,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-social-content')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const company = await getCompanyProfile(supabase, 'system');

    const basePrompt = await callAssembleContext('agent-social-content', 'generate social media content from project photos')
    const systemPrompt =
      (basePrompt ??
        buildSystemPrompt(company, 'marketing assistant')) +
      `

SOCIAL MEDIA CONTENT TASK
Write engaging social media captions for the project photos described.
Brand voice: professional, proud of the craft, warm and approachable. Like a master craftsman sharing their work.
Instagram: 150-200 words with 8-12 relevant hashtags at the end. Include a call to action.
Facebook: 100-150 words, no hashtags, slightly more conversational.
Never mention client names or addresses. Use "a Summit County homeowner" or similar.
No em dashes.`

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const { data: photos, error } = await supabase
      .from('project_photos')
      .select('id,project_id,image_url,category,caption,ai_description,taken_at')
      .gte('taken_at', weekAgo)
      .in('category', ['finish', 'before_after', 'progress'])
      .not('ai_description', 'is', null)
      .order('taken_at', { ascending: false })
      .limit(20)

    if (error) throw error

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No qualifying photos found this week' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get project types for context
    const projectIds = [...new Set(photos.map((p) => p.project_id))]
    const { data: projects } = await supabase
      .from('projects')
      .select('id,project_type,current_phase')
      .in('id', projectIds)
    const projectMap = new Map((projects ?? []).map((p) => [p.id, p]))

    // Score photos: finish > before_after > progress, prefer those with good ai_description
    const scored = photos
      .map((photo) => {
        const project = projectMap.get(photo.project_id)
        let score = 0
        if (photo.category === 'finish') score += 30
        if (photo.category === 'before_after') score += 25
        if (photo.category === 'progress') score += 15
        if (photo.ai_description && photo.ai_description.length > 50) score += 20
        if (photo.caption) score += 10
        return { ...photo, score, project_type: project?.project_type ?? 'renovation' }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const photoDescriptions = scored
      .map((p, i) => `Photo ${i + 1}: ${p.category} shot — ${p.ai_description ?? p.caption ?? 'no description'} (Project type: ${p.project_type})`)
      .join('\n\n')

    const content = await callClaude(
      systemPrompt,
      `Generate Instagram and Facebook posts for these ${scored.length} project photo(s) from this week:

${photoDescriptions}

Format your response as:
INSTAGRAM:
[caption]

FACEBOOK:
[caption]`,
      700,
    )

    await writeOutput(
      supabase,
      'agent-social-content',
      'draft',
      `Social Content Draft — Week of ${new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      content,
      {
        photo_ids: scored.map((p) => p.id),
        photo_urls: scored.map((p) => p.image_url),
        photo_count: scored.length,
        categories: scored.map((p) => p.category),
      },
      true,
    )

    return new Response(
      JSON.stringify({ success: true, photos_used: scored.length, content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-social-content error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
