import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-invoice-aging')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const basePrompt = await callAssembleContext('agent-invoice-aging', 'draft collection messages for overdue invoices')
    const systemPrompt =
      (basePrompt ??
        'You are an AI assistant for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio.') +
      `

INVOICE COLLECTION MESSAGE TASK
Write as Adam Kilgore sending a payment reminder to a client.
Tone scales with days overdue:
- 7 days: warm, friendly, assume it slipped through the cracks
- 14 days: professional and direct, note the payment is now 2 weeks late
- 30+ days: firm and formal, reference possible next steps if needed
Always include the invoice number, amount, and how to pay.
Keep it under 5 sentences. No em dashes.`

    const today = new Date().toISOString().split('T')[0]

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id,invoice_number,title,total,balance_due,due_date,status,project_id')
      .eq('status', 'overdue')
      .lte('due_date', today)

    if (error) throw error

    // Get project/client info for each invoice
    const projectIds = [...new Set((invoices ?? []).map((i) => i.project_id))]
    const { data: projects } = await supabase
      .from('projects')
      .select('id,title,client_name,client_email,client_phone')
      .in('id', projectIds)

    const projectMap = new Map((projects ?? []).map((p) => [p.id, p]))

    const actionsCreated: string[] = []

    for (const invoice of invoices ?? []) {
      const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000)
      if (daysOverdue < 7) continue

      const project = projectMap.get(invoice.project_id)
      if (!project) continue

      let tone = '7-day polite reminder'
      let riskLevel = 'medium'
      if (daysOverdue >= 30) {
        tone = '30+ day formal demand'
        riskLevel = 'high'
      } else if (daysOverdue >= 14) {
        tone = '14-day firm reminder'
        riskLevel = 'high'
      }

      const messageDraft = await callClaude(
        systemPrompt,
        `Client: ${project.client_name}
Project: ${project.title}
Invoice: ${invoice.invoice_number}
Invoice Title: ${invoice.title}
Amount Due: $${invoice.balance_due.toLocaleString()}
Due Date: ${invoice.due_date}
Days Overdue: ${daysOverdue}
Tone: ${tone}

Draft the collection message.`,
        350,
      )

      await supabase.from('ai_actions').insert({
        request_text: `Invoice ${invoice.invoice_number} collection — ${project.client_name}, $${invoice.balance_due.toLocaleString()}, ${daysOverdue} days overdue`,
        action_type: 'send_sms_or_email',
        action_data: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          project_id: invoice.project_id,
          client_name: project.client_name,
          client_email: project.client_email,
          client_phone: project.client_phone,
          amount_due: invoice.balance_due,
          days_overdue: daysOverdue,
          message: messageDraft,
          tone,
        },
        requires_approval: true,
        risk_level: riskLevel,
        status: 'pending',
      })

      actionsCreated.push(`${invoice.invoice_number} — ${project.client_name} ($${invoice.balance_due.toLocaleString()}, ${daysOverdue}d overdue)`)
    }

    return new Response(
      JSON.stringify({ success: true, actions_created: actionsCreated.length, invoices: actionsCreated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-invoice-aging error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
