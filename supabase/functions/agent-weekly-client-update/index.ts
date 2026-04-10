import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

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

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 2048): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return { text: data.content?.[0]?.text ?? '', usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 } }
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-weekly-client-update')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const basePrompt = await callAssembleContext('agent-weekly-client-update', 'compile weekly client progress updates')
    const systemPrompt =
      (basePrompt ??
        'You are an AI communications assistant for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio.') +
      `

WEEKLY CLIENT UPDATE TASK
Write a warm, professional weekly project update for the homeowner.
Write as Adam Kilgore communicating directly to his client.
Include: what was accomplished this week, what is coming up next week, any decisions needed from the client.
Tone: confident, friendly, like a trusted contractor keeping you in the loop.
Length: 150-250 words. No em dashes. No bullet points — write in paragraphs.`

    const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id,title,client_name,client_email,project_type,percent_complete,current_phase,target_completion_date')
      .eq('status', 'active')

    if (error) throw error

    const updatesCreated: string[] = []

    for (const project of projects ?? []) {
      const [{ data: weekLogs }, { data: weekPhotos }] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('log_date,summary,work_completed,issues')
          .eq('project_id', project.id)
          .gte('log_date', weekStart)
          .order('log_date', { ascending: true }),
        supabase
          .from('project_photos')
          .select('id,image_url,category,caption,ai_description,taken_at')
          .eq('project_id', project.id)
          .gte('taken_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .in('category', ['progress', 'finish', 'before_after', 'rough_in']),
      ])

      const updatePayload = `Project: ${project.title}
Client: ${project.client_name}
Project Type: ${project.project_type}
Current Phase: ${project.current_phase ?? 'Active Construction'}
Percent Complete: ${project.percent_complete}%
Target Completion: ${project.target_completion_date ?? 'TBD'}

Daily Logs This Week:
${(weekLogs ?? []).map((l) => `${l.log_date}: ${l.summary ?? ''} ${l.work_completed ?? ''}`).join('\n') || 'No logs this week'}

Photos Taken This Week: ${weekPhotos?.length ?? 0} photos uploaded
${(weekPhotos ?? []).map((p) => `- ${p.category}: ${p.ai_description ?? p.caption ?? 'no description'}`).join('\n')}

Write the client update.`

      const _t0 = Date.now()

      const { text: updateBody, usage: _u } = await callClaude(systemPrompt, updatePayload, 600)

      logAiUsage({ function_name: 'agent-weekly-client-update', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })
      const subject = `${project.title} — Weekly Update`

      // Write to client_progress_updates
      await supabase.from('client_progress_updates').insert({
        project_id: project.id,
        subject,
        body: updateBody,
        photos: (weekPhotos ?? []).map((p) => p.image_url),
        status: 'draft',
        ai_generated: true,
      })

      await writeOutput(
        supabase,
        'agent-weekly-client-update',
        'draft',
        subject,
        updateBody,
        {
          project_id: project.id,
          client_name: project.client_name,
          client_email: project.client_email,
          photo_count: weekPhotos?.length ?? 0,
          log_count: weekLogs?.length ?? 0,
        },
        true,
      )

      updatesCreated.push(project.title)
    }

    return new Response(
      JSON.stringify({ success: true, updates_created: updatesCreated.length, projects: updatesCreated }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-weekly-client-update error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
