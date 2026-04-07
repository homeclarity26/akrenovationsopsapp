// H23: agent-compliance-monitor — runs daily, flags expiring compliance items
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
        user_id: 'system',
        user_role: 'admin',
        agent_name: agentName,
        capability_required: 'monitor_compliance',
        query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch { return null }
}

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Assemble context first per Phase H rules
    await callAssembleContext('agent-compliance-monitor', 'daily compliance expiry check')

    const in60 = addDaysIso(60)
    const in30 = addDaysIso(30)
    const in7 = addDaysIso(7)

    const { data: expiring60 } = await supabase
      .from('compliance_items')
      .select('id, title, expiry_date, priority, category, status')
      .lte('expiry_date', in60)
      .gte('expiry_date', addDaysIso(0))
      .neq('status', 'completed')
      .neq('status', 'not_applicable')
      .order('expiry_date')

    const items = expiring60 ?? []
    const critical: typeof items = []
    const urgent: typeof items = []
    const warning: typeof items = []

    for (const it of items) {
      if (!it.expiry_date) continue
      if (it.expiry_date <= in7) critical.push(it)
      else if (it.expiry_date <= in30) urgent.push(it)
      else warning.push(it)
    }

    // Write agent_outputs entries for alerts
    const outputs: Array<Record<string, unknown>> = []

    if (critical.length) {
      outputs.push({
        agent_name: 'agent-compliance-monitor',
        output_type: 'compliance_alert',
        title: `Critical: ${critical.length} compliance item(s) expire within 7 days`,
        content: critical.map((i) => `- ${i.title} (expires ${i.expiry_date})`).join('\n'),
        metadata: { urgency: 'critical', item_ids: critical.map((i) => i.id) },
        requires_approval: false,
      })
    }
    if (urgent.length) {
      outputs.push({
        agent_name: 'agent-compliance-monitor',
        output_type: 'compliance_alert',
        title: `Urgent: ${urgent.length} compliance item(s) expire within 30 days`,
        content: urgent.map((i) => `- ${i.title} (expires ${i.expiry_date})`).join('\n'),
        metadata: { urgency: 'urgent', item_ids: urgent.map((i) => i.id) },
        requires_approval: false,
      })
    }
    if (warning.length) {
      outputs.push({
        agent_name: 'agent-compliance-monitor',
        output_type: 'compliance_alert',
        title: `Renewing Soon: ${warning.length} compliance item(s) expire within 60 days`,
        content: warning.map((i) => `- ${i.title} (expires ${i.expiry_date})`).join('\n'),
        metadata: { urgency: 'warning', item_ids: warning.map((i) => i.id) },
        requires_approval: false,
      })
    }

    if (outputs.length) {
      await supabase.from('agent_outputs').insert(outputs)
    }

    // Also flip anything past expiry to needs_renewal
    await supabase
      .from('compliance_items')
      .update({ status: 'needs_renewal' })
      .lt('expiry_date', addDaysIso(0))
      .eq('status', 'completed')

    return new Response(
      JSON.stringify({
        scanned: items.length,
        critical: critical.length,
        urgent: urgent.length,
        warning: warning.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
