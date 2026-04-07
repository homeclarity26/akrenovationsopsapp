import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      model: 'claude-sonnet-4-20250514',
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

interface WeatherForecastItem {
  dt: number
  main: { temp: number }
  weather: Array<{ description: string }>
  pop: number  // probability of precipitation 0-1
  dt_txt: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const basePrompt = await callAssembleContext('agent-weather-schedule', 'check weather impact on scheduled outdoor work')
    const systemPrompt =
      (basePrompt ?? 'You are an AI project manager for AK Renovations.') +
      `

WEATHER ALERT TASK
Write a concise weather alert for Adam Kilgore about project scheduling impacts.
Be specific: which project, what weather, which days are affected, and what action to consider.
No em dashes. 2-3 sentences per project alert.`

    const weatherApiKey = Deno.env.get('OPENWEATHERMAP_API_KEY')
    if (!weatherApiKey) {
      return new Response(JSON.stringify({ error: 'OPENWEATHERMAP_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get active projects with location data
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id,title,client_name,project_type,geofence_lat,geofence_lng')
      .eq('status', 'active')
      .not('geofence_lat', 'is', null)
      .not('geofence_lng', 'is', null)

    if (error) throw error

    // Get upcoming schedule events for these projects
    const projectIds = (projects ?? []).map((p) => p.id)
    const today = new Date().toISOString().split('T')[0]
    const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    const { data: events } = await supabase
      .from('schedule_events')
      .select('id,project_id,title,event_type,start_date')
      .in('project_id', projectIds)
      .gte('start_date', today)
      .lte('start_date', in7Days)
      .in('event_type', ['work_day', 'delivery', 'inspection', 'sub_work'])

    const eventsByProject = new Map<string, typeof events>()
    for (const event of events ?? []) {
      if (!eventsByProject.has(event.project_id)) eventsByProject.set(event.project_id, [])
      eventsByProject.get(event.project_id)!.push(event)
    }

    const alerts: string[] = []
    const alertMeta: Array<{
      project_id: string
      project_title: string
      flagged_dates: string[]
      weather_issues: string[]
    }> = []

    for (const project of projects ?? []) {
      const projectEvents = eventsByProject.get(project.id)
      if (!projectEvents || projectEvents.length === 0) continue

      // Fetch weather forecast
      let forecastItems: WeatherForecastItem[] = []
      try {
        const weatherRes = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${project.geofence_lat}&lon=${project.geofence_lng}&appid=${weatherApiKey}&units=imperial`,
        )
        if (weatherRes.ok) {
          const weatherData = await weatherRes.json()
          forecastItems = weatherData.list ?? []
        }
      } catch (e) {
        console.warn(`Weather fetch failed for project ${project.id}:`, e)
        continue
      }

      // Check each scheduled event date
      const flaggedDates: string[] = []
      const weatherIssues: string[] = []

      for (const event of projectEvents) {
        const eventDate = event.start_date
        // Find forecast items for this date
        const dayForecasts = forecastItems.filter((f) => f.dt_txt.startsWith(eventDate))

        for (const forecast of dayForecasts) {
          const precipChance = (forecast.pop ?? 0) * 100
          const temp = forecast.main?.temp ?? 70

          if (precipChance > 50 || temp < 25) {
            if (!flaggedDates.includes(eventDate)) flaggedDates.push(eventDate)
            if (precipChance > 50) {
              weatherIssues.push(`${eventDate}: ${Math.round(precipChance)}% chance of precipitation (${forecast.weather?.[0]?.description ?? 'precipitation'})`)
            }
            if (temp < 25) {
              weatherIssues.push(`${eventDate}: Temperature ${Math.round(temp)}°F — too cold for most exterior work`)
            }
          }
        }
      }

      if (flaggedDates.length === 0) continue

      const alertText = await callClaude(
        systemPrompt,
        `Project: ${project.title} (${project.client_name})
Scheduled Work Days Being Flagged: ${flaggedDates.join(', ')}
Weather Issues: ${weatherIssues.join('; ')}

Write the weather alert.`,
        250,
      )

      alerts.push(alertText)
      alertMeta.push({
        project_id: project.id,
        project_title: project.title,
        flagged_dates: flaggedDates,
        weather_issues: weatherIssues,
      })
    }

    if (alerts.length > 0) {
      await writeOutput(
        supabase,
        'agent-weather-schedule',
        'alert',
        `Weather Schedule Alert — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
        alerts.join('\n\n---\n\n'),
        { projects_flagged: alertMeta },
        false,
      )
    }

    return new Response(
      JSON.stringify({ success: true, projects_checked: projects?.length ?? 0, alerts_generated: alerts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-weather-schedule error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
