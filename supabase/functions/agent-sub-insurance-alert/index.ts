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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const basePrompt = await callAssembleContext('agent-sub-insurance-alert', 'draft insurance renewal request emails for subcontractors')
    const systemPrompt =
      (basePrompt ??
        'You are an AI assistant for AK Renovations, a high-end residential remodeling contractor in Summit County, Ohio.') +
      `

SUBCONTRACTOR INSURANCE REQUEST TASK
Draft a professional email to the subcontractor requesting their updated Certificate of Insurance (COI).
Write as Adam Kilgore. Be direct and friendly. Mention the expiry date.
If expiry is within 30 days, add urgency. If already expired, be firm but professional.
Length: 3-4 sentences. No em dashes.`

    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

    const { data: subs, error } = await supabase
      .from('subcontractors')
      .select('id,company_name,contact_name,email,trade,insurance_expiry')
      .eq('is_active', true)
      .lte('insurance_expiry', thirtyDaysFromNow)

    if (error) throw error

    const actionsCreated: string[] = []

    for (const sub of subs ?? []) {
      const expiryDate = sub.insurance_expiry
      const daysUntilExpiry = Math.floor(
        (new Date(expiryDate).getTime() - Date.now()) / 86400000,
      )
      const isExpired = daysUntilExpiry < 0
      const urgency = isExpired ? 'EXPIRED' : daysUntilExpiry <= 7 ? 'urgent (7 days)' : `${daysUntilExpiry} days`

      const emailDraft = await callClaude(
        systemPrompt,
        `Subcontractor: ${sub.company_name}${sub.contact_name ? ` (${sub.contact_name})` : ''}
Trade: ${sub.trade}
Insurance expiry: ${expiryDate} (${urgency})

Draft the email requesting updated COI.`,
        300,
      )

      await supabase.from('ai_actions').insert({
        request_text: `Request updated COI from ${sub.company_name} — insurance ${isExpired ? 'expired' : `expiring in ${daysUntilExpiry} days`}`,
        action_type: 'send_email',
        action_data: {
          subcontractor_id: sub.id,
          company_name: sub.company_name,
          contact_name: sub.contact_name,
          recipient_email: sub.email,
          subject: `Insurance Certificate Renewal Request — AK Renovations`,
          body: emailDraft,
          insurance_expiry: expiryDate,
          days_until_expiry: daysUntilExpiry,
        },
        requires_approval: true,
        risk_level: 'medium',
        status: 'pending',
      })

      actionsCreated.push(`${sub.company_name} (expires ${expiryDate})`)
    }

    return new Response(
      JSON.stringify({ success: true, alerts_created: actionsCreated.length, subs: actionsCreated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-sub-insurance-alert error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
