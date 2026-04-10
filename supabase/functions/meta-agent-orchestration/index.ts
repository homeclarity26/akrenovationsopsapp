// meta-agent-orchestration — Phase E
// Runs weekly (Monday 6am Eastern via pg_cron).
// Monitors all 27 agents: success rates, rejections, conflicts.
// Issues pause/resume directives for underperforming agents.
// Detects agent communication conflicts.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'meta-agent-orchestration')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const supabase = createClient(supabaseUrl(), serviceKey())

    // Gather agent performance data from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: recentOutputs }, { data: recentAiActions }, { data: agentHistory }, { data: existingDirectives }] = await Promise.all([
      supabase.from('agent_outputs').select('agent_name,requires_approval,approved_at,dismissed_at,action_taken,created_at').gte('created_at', thirtyDaysAgo),
      supabase.from('ai_actions').select('action_type,status,approved_at,created_at').gte('created_at', thirtyDaysAgo),
      supabase.from('agent_history').select('agent_name,action,admin_action,created_at').gte('created_at', thirtyDaysAgo).limit(200),
      supabase.from('agent_directives').select('agent_name,directive_type,active').eq('active', true),
    ])

    // Build performance stats per agent
    const agentStats: Record<string, { total: number; approved: number; dismissed: number; rejectionRate: number }> = {}

    for (const output of recentOutputs ?? []) {
      if (!agentStats[output.agent_name]) agentStats[output.agent_name] = { total: 0, approved: 0, dismissed: 0, rejectionRate: 0 }
      agentStats[output.agent_name].total++
      if (output.approved_at) agentStats[output.agent_name].approved++
      if (output.dismissed_at) agentStats[output.agent_name].dismissed++
    }
    for (const name of Object.keys(agentStats)) {
      const s = agentStats[name]
      s.rejectionRate = s.total > 0 ? s.dismissed / s.total : 0
    }

    // Check for agents with high rejection rates (>60% and at least 3 runs)
    const problematicAgents = Object.entries(agentStats).filter(([, s]) => s.rejectionRate > 0.6 && s.total >= 3)
    const currentlyPaused = new Set((existingDirectives ?? []).filter(d => d.directive_type === 'pause').map(d => d.agent_name))

    const directives: string[] = []
    for (const [agentName, stats] of problematicAgents) {
      if (currentlyPaused.has(agentName)) continue
      // Issue pause directive
      await supabase.from('agent_directives').insert({
        agent_name: agentName,
        directive_type: 'pause',
        directive_value: { reason: 'high_rejection_rate', rejection_rate: stats.rejectionRate, total_runs: stats.total },
        reason: `${agentName} rejected ${Math.round(stats.rejectionRate * 100)}% of ${stats.total} recent outputs. Pausing for review.`,
        issued_by: 'meta_agent',
        active: true,
      })
      directives.push(`Paused ${agentName} (${Math.round(stats.rejectionRate * 100)}% rejection rate)`)
    }

    // Check for agents that should be running but haven't produced output in 7+ days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const expectedDailyAgents = ['agent-morning-brief', 'agent-lead-aging', 'agent-risk-monitor']
    const recentAgentNames = new Set((recentOutputs ?? []).filter(o => o.created_at > sevenDaysAgo).map(o => o.agent_name))
    const missingAgents = expectedDailyAgents.filter(a => !recentAgentNames.has(a) && !currentlyPaused.has(a))

    // Compile orchestration report
    const contextRes = await fetch(`${supabaseUrl()}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey()}` },
      body: JSON.stringify({ user_id: 'system', user_role: 'admin', agent_name: 'meta-agent-orchestration', query: 'agent orchestration analysis' }),
    })
    const ctx = contextRes.ok ? await contextRes.json() : {}
    const basePrompt = ctx.system_prompt ?? 'You are the meta agent orchestrator for AK Ops.'

    const analysisRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: AI_CONFIG.PRIMARY_MODEL,
        max_tokens: 1000,
        system: basePrompt + '\nYou are analyzing agent performance for AK Ops. Be concise and direct.',
        messages: [{
          role: 'user',
          content: `Agent stats last 30 days: ${JSON.stringify(agentStats)}
Directives issued this run: ${JSON.stringify(directives)}
Missing agents (no output in 7 days): ${JSON.stringify(missingAgents)}
Summarize the health of the agent system in 3-5 bullet points. Flag any concerns. Be specific.`
        }],
      }),
    })
    const analysisData = analysisRes.ok ? await analysisRes.json() : null
    const analysis = analysisData?.content?.[0]?.text ?? 'Orchestration analysis unavailable.'

    await supabase.from('agent_outputs').insert({
      agent_name: 'meta-agent-orchestration',
      output_type: 'report',
      title: `Agent System Health — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
      content: `${analysis}\n\n**Directives issued:** ${directives.length > 0 ? directives.join(', ') : 'None'}\n**Missing agents:** ${missingAgents.length > 0 ? missingAgents.join(', ') : 'None'}`,
      metadata: { agent_stats: agentStats, directives_issued: directives, missing_agents: missingAgents },
      requires_approval: false,
    })

    // N51: Trigger template improvement analysis as part of weekly orchestration cycle
    fetch(`${supabaseUrl()}/functions/v1/agent-template-improvement-suggester`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey()}`,
      },
      body: '{}',
    }).catch((err: unknown) => console.error('template-improvement-suggester trigger failed:', err))

    return new Response(JSON.stringify({ success: true, directives_issued: directives.length, missing_agents: missingAgents.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('meta-agent-orchestration error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
