import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const rl = await checkRateLimit(req, 'agent-daily-log')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const basePrompt = await callAssembleContext('agent-daily-log', 'auto-draft daily construction logs from time entries and photos')
    const systemPrompt =
      (basePrompt ?? 'You are an AI field log writer for AK Renovations, a residential remodeling contractor.') +
      `

DAILY LOG DRAFTING TASK
Write a concise daily construction log entry based on the data provided.
Format:
- Summary (1-2 sentences): What was accomplished today overall
- Work Completed: Specific tasks done (2-4 bullet points, each a short phrase)
- Issues/Notes: Any problems, delays, or things to flag (if none, say "None")

Write in past tense. Be specific about materials, locations, and tasks. No em dashes.`

    const today = new Date().toISOString().split('T')[0]

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id,title,project_type,client_name,current_phase,percent_complete')
      .eq('status', 'active')

    if (error) throw error

    const logsCreated: string[] = []

    for (const project of projects ?? []) {
      // Check if log already exists for today
      const { data: existingLog } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('project_id', project.id)
        .eq('log_date', today)
        .limit(1)
        .single()

      if (existingLog) continue

      // Read all segments for today per project
      const { data: timeSegments } = await supabase
        .from('time_entries')
        .select('user_id, project_id, work_type, clock_in, clock_out, total_minutes, work_description, notes')
        .eq('project_id', project.id)
        .gte('clock_in', `${today}T00:00:00`)
        .lt('clock_in', `${today}T23:59:59`)
        .not('clock_out', 'is', null) // only closed segments

      if (!timeSegments || timeSegments.length === 0) continue

      // Group segments by user
      const segmentsByUser = (timeSegments ?? []).reduce<Record<string, typeof timeSegments>>((acc, seg) => {
        if (!acc[seg.user_id]) acc[seg.user_id] = []
        acc[seg.user_id]!.push(seg)
        return acc
      }, {})

      // Get user names
      const userIds = Object.keys(segmentsByUser)
      const { data: employees } = await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', userIds)
      const empMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]))

      const totalHours = (timeSegments ?? []).reduce((sum, s) => sum + (s.total_minutes ?? 0), 0) / 60
      const workerNames = Object.keys(segmentsByUser)

      // Build work summary per user for Claude context
      const workerSummaries = Object.entries(segmentsByUser).map(([userId, segs]) => {
        const totalMins = (segs ?? []).reduce((sum, s) => sum + (s?.total_minutes ?? 0), 0)
        const workTypes = [...new Set((segs ?? []).map((s) => s?.work_type).filter(Boolean))]
        const name = empMap.get(userId) ?? userId
        return `${name}: ${(totalMins / 60).toFixed(1)}h total, work types: ${workTypes.join(', ') || 'not specified'}`
      }).join('\n')

      // Get today's photos
      const { data: todayPhotos } = await supabase
        .from('project_photos')
        .select('category,ai_description,caption')
        .eq('project_id', project.id)
        .gte('taken_at', `${today}T00:00:00`)
        .lt('taken_at', `${today}T23:59:59`)

      // Get completed tasks today
      const { data: completedTasks } = await supabase
        .from('tasks')
        .select('title')
        .eq('project_id', project.id)
        .eq('status', 'done')
        .gte('completed_at', `${today}T00:00:00`)

      const logData = `Project: ${project.title} (${project.project_type})
Current Phase: ${project.current_phase ?? 'Active Construction'}
Workers on Site: ${workerNames.map((id) => empMap.get(id) ?? id).join(', ')}
Total Hours Logged: ${totalHours.toFixed(1)}
Photos Taken: ${todayPhotos?.length ?? 0}
Photo Descriptions: ${(todayPhotos ?? []).map((p) => `${p.category}: ${p.ai_description ?? p.caption ?? ''}`).filter(Boolean).join('; ')}
Tasks Completed Today: ${(completedTasks ?? []).map((t) => t.title).join(', ') || 'None recorded'}
Time Entry Notes: ${(timeSegments ?? []).filter((s) => s.notes).map((s) => s.notes).join('; ') || 'None'}

Workers on site today:
${workerSummaries}

Draft the daily log entry.`

      const _t0 = Date.now()

      const { text: logText, usage: _u } = await callClaude(systemPrompt, logData, 500)

      logAiUsage({ function_name: 'agent-daily-log', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })

      // Parse summary from first line/section
      const summaryMatch = logText.match(/^(?:summary[:\s]+)?(.+?)(?:\n|$)/im)
      const summary = summaryMatch?.[1]?.replace(/^[*_#\s-]+|[*_#\s-]+$/g, '').trim() ?? logText.substring(0, 150)

      const primaryUserId = workerNames[0]

      const { error: logError } = await supabase.from('daily_logs').insert({
        project_id: project.id,
        employee_id: primaryUserId, // Primary worker
        log_date: today,
        summary,
        work_completed: logText,
        workers_on_site: workerNames.map((id) => empMap.get(id) ?? id),
        ai_generated: true,
      })

      if (!logError) {
        logsCreated.push(project.title)

        // Create in-app notification (via messages table as system notification)
        await supabase.from('messages').insert({
          project_id: project.id,
          sender_id: null,
          sender_role: 'ai',
          recipient_id: primaryUserId,
          channel: 'in_app',
          message: `Daily log drafted for ${project.title} — please review and edit if needed.`,
          is_ai_generated: true,
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true, logs_created: logsCreated.length, projects: logsCreated }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-daily-log error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
