import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  file_id: z.string().uuid('file_id must be a valid UUID'),
})

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

  const rl = await checkRateLimit(req, 'agent-sub-invoice-matcher')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const company = await getCompanyProfile(supabase, 'system');

    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { file_id } = parsed.data

    await callAssembleContext('agent-sub-invoice-matcher', 'match sub invoice to contracted amount and flag variances')

    const systemPrompt = buildSystemPrompt(company, 'accounting assistant') + `
Write a clear, concise variance alert for Adam Kilgore about a subcontractor invoice that does not match the contracted amount.
Include: sub company name, contracted amount, invoiced amount, variance amount and percentage, and a recommendation.
No em dashes. 2-3 sentences.`

    // Get file and its extraction data
    const { data: file, error: fileError } = await supabase
      .from('project_files')
      .select('id,file_url,project_id,file_name,file_type')
      .eq('id', file_id)
      .single()

    if (fileError || !file) throw fileError ?? new Error('File not found')

    // Get extraction data from project_files — look for budget category
    // We need the invoice amount and company from wherever extraction stored it
    // Check expenses table for a recent sub invoice linked to this file
    const { data: relatedExpense } = await supabase
      .from('expenses')
      .select('id,vendor,amount,category,project_id')
      .eq('receipt_image_url', file.file_url)
      .single()

    if (!relatedExpense) {
      return new Response(
        JSON.stringify({ success: false, message: 'No expense record found for this file. Run receipt-processor first.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (relatedExpense.category !== 'subcontractor') {
      return new Response(
        JSON.stringify({ success: true, message: 'Not a subcontractor expense — no matching needed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const targetProjectId = relatedExpense.project_id ?? file.project_id
    const invoiceAmount = relatedExpense.amount
    const vendorName = relatedExpense.vendor

    if (!targetProjectId || !vendorName) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing project_id or vendor name on expense record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Look for matching project_subcontractors record
    const { data: subs } = await supabase
      .from('project_subcontractors')
      .select('id,contracted_amount,paid_amount,status,subcontractor_id')
      .eq('project_id', targetProjectId)

    const { data: subContractors } = await supabase
      .from('subcontractors')
      .select('id,company_name')
      .in('id', (subs ?? []).map((s) => s.subcontractor_id))

    const subMap = new Map((subContractors ?? []).map((s) => [s.id, s]))

    // Find best match by company name similarity
    let bestMatch: (typeof subs)[0] | null = null
    let bestMatchName = ''
    for (const sub of subs ?? []) {
      const company = subMap.get(sub.subcontractor_id)?.company_name ?? ''
      if (
        company.toLowerCase().includes(vendorName.toLowerCase().substring(0, 5)) ||
        vendorName.toLowerCase().includes(company.toLowerCase().substring(0, 5))
      ) {
        bestMatch = sub
        bestMatchName = company
        break
      }
    }

    if (!bestMatch) {
      return new Response(
        JSON.stringify({ success: false, message: `No matching subcontractor found for vendor: ${vendorName}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const contractedAmount = bestMatch.contracted_amount ?? 0
    const variance = invoiceAmount - contractedAmount
    const variancePct = contractedAmount > 0 ? Math.abs(variance) / contractedAmount : 1

    const hasVariance = Math.abs(variance) > 500 || variancePct > 0.05

    // Create expense record if variance detected
    const { data: project } = await supabase
      .from('projects')
      .select('title')
      .eq('id', targetProjectId)
      .single()

    if (hasVariance) {
      const alertText = await callClaude(
        systemPrompt,
        `Sub company: ${bestMatchName}
Project: ${project?.title ?? targetProjectId}
Contracted amount: $${contractedAmount.toLocaleString()}
Invoice amount: $${invoiceAmount.toLocaleString()}
Variance: $${Math.abs(variance).toLocaleString()} (${(variancePct * 100).toFixed(1)}%) ${variance > 0 ? 'over' : 'under'} contract

Write the variance alert.`,
        250,
      )

      await writeOutput(
        supabase,
        'agent-sub-invoice-matcher',
        'alert',
        `Sub Invoice Variance: ${bestMatchName} on ${project?.title ?? 'Unknown Project'}`,
        alertText,
        {
          file_id,
          project_id: targetProjectId,
          sub_id: bestMatch.subcontractor_id,
          company_name: bestMatchName,
          contracted_amount: contractedAmount,
          invoice_amount: invoiceAmount,
          variance,
          variance_pct: variancePct,
        },
        false,
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        has_variance: hasVariance,
        contracted_amount: contractedAmount,
        invoice_amount: invoiceAmount,
        variance,
        variance_pct: variancePct,
        matched_sub: bestMatchName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-sub-invoice-matcher error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
