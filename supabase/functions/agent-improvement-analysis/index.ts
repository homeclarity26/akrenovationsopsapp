// agent-improvement-analysis — Phase E
// Runs weekly Sunday night. Analyzes usage data and agent history.
// Generates improvement specs for the top 3 friction points found.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-improvement-analysis')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const supabase = createClient(supabaseUrl(), serviceKey())
    const company = await getCompanyProfile(supabase, 'system');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Pull usage data
    const [{ data: usageEvents }, { data: agentOutputs }, { data: learningInsights }] = await Promise.all([
      supabase.from('app_usage_events').select('screen,action,target,time_on_screen_seconds,created_at').gte('created_at', sevenDaysAgo).limit(500),
      supabase.from('agent_outputs').select('agent_name,requires_approval,approved_at,dismissed_at,created_at').gte('created_at', sevenDaysAgo),
      supabase.from('learning_insights').select('insight_type,content,confidence_score').eq('actioned', false).limit(20),
    ])

    // Analyze usage patterns
    const screenTimeMap: Record<string, number[]> = {}
    const navigateAwayMap: Record<string, number> = {}
    const aiCommandMap: Record<string, number> = {}

    for (const event of usageEvents ?? []) {
      if (!screenTimeMap[event.screen]) screenTimeMap[event.screen] = []
      if (event.time_on_screen_seconds) screenTimeMap[event.screen].push(event.time_on_screen_seconds)
      if (event.action === 'navigate_away') navigateAwayMap[event.screen] = (navigateAwayMap[event.screen] ?? 0) + 1
      if (event.target === 'ai_command_bar') aiCommandMap[event.screen] = (aiCommandMap[event.screen] ?? 0) + 1
    }

    const avgTimePerScreen = Object.fromEntries(
      Object.entries(screenTimeMap).map(([screen, times]) => [screen, Math.round(times.reduce((a, b) => a + b, 0) / times.length)])
    )

    // Agent performance
    const agentRejectionRates: Record<string, number> = {}
    const agentNameSet = new Set((agentOutputs ?? []).map(o => o.agent_name))
    for (const name of agentNameSet) {
      const agentOuts = (agentOutputs ?? []).filter(o => o.agent_name === name)
      const dismissed = agentOuts.filter(o => o.dismissed_at).length
      agentRejectionRates[name] = agentOuts.length > 0 ? dismissed / agentOuts.length : 0
    }

    // Ask Claude to identify top improvements
    const contextRes = await fetch(`${supabaseUrl()}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey()}` },
      body: JSON.stringify({ user_id: 'system', user_role: 'admin', agent_name: 'agent-improvement-analysis', query: 'identify app improvements' }),
    })
    const ctx = contextRes.ok ? await contextRes.json() : {}
    const basePrompt = ctx.system_prompt ?? buildSystemPrompt(company, 'business analyst')

    const analysisRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: AI_CONFIG.PRIMARY_MODEL,
        max_tokens: 2000,
        system: basePrompt + `\n\nYou are the improvement analysis engine for AK Ops. Identify the top 3 improvements that would have the highest impact on Adam's daily workflow.

For each improvement, return a JSON object with:
{
  "title": "short title",
  "problem": "what the problem is (1-2 sentences)",
  "evidence": "specific data that shows this problem",
  "solution": "what should change (1 paragraph)",
  "priority": "high|medium|low",
  "category": "ux_friction|missing_feature|agent_improvement|workflow_optimization|data_quality|performance"
}

Return as JSON array: { "improvements": [...] }`,
        messages: [{
          role: 'user',
          content: `Analyze this usage data and identify improvements:\n\nScreen time averages: ${JSON.stringify(avgTimePerScreen)}\nNavigate-away counts: ${JSON.stringify(navigateAwayMap)}\nAI command bar usage by screen: ${JSON.stringify(aiCommandMap)}\nAgent rejection rates: ${JSON.stringify(agentRejectionRates)}\nLearning insights: ${JSON.stringify((learningInsights ?? []).map(l => l.content))}`
        }],
      }),
    })

    if (!analysisRes.ok) throw new Error(`Claude error: ${await analysisRes.text()}`)
    const analysisData = await analysisRes.json()
    const rawText = analysisData.content?.[0]?.text ?? '{}'

    let improvements: { title: string; problem: string; evidence: string; solution: string; priority: string; category: string }[] = []
    try {
      const parsed = JSON.parse(rawText)
      improvements = parsed.improvements ?? []
    } catch {
      improvements = []
    }

    // For each improvement, generate a full spec and save
    for (const improvement of improvements) {
      // Generate spec via generate-improvement-spec function
      const specRes = await fetch(`${supabaseUrl()}/functions/v1/generate-improvement-spec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey()}` },
        body: JSON.stringify({ improvement }),
      })
      const specData = specRes.ok ? await specRes.json() : {}
      const specContent = specData.spec_content ?? null

      await supabase.from('improvement_specs').insert({
        title: improvement.title,
        problem_statement: improvement.problem,
        evidence: improvement.evidence,
        proposed_solution: improvement.solution,
        spec_content: specContent,
        priority: improvement.priority,
        category: improvement.category,
        status: 'draft',
      })
    }

    // Write summary to agent_outputs
    await supabase.from('agent_outputs').insert({
      agent_name: 'agent-improvement-analysis',
      output_type: 'report',
      title: `Weekly Improvement Analysis — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      content: `Found ${improvements.length} improvement opportunities:\n${improvements.map((i, n) => `${n + 1}. **${i.title}** (${i.priority}) — ${i.problem}`).join('\n')}`,
      metadata: { improvement_count: improvements.length, categories: improvements.map(i => i.category) },
      requires_approval: false,
    })

    return new Response(JSON.stringify({ success: true, improvements_generated: improvements.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('agent-improvement-analysis error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
