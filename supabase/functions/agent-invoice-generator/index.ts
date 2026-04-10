import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
  milestone_name: z.string().optional(),
})

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

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 9000) + 1000
  return `INV-${year}-${random}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-invoice-generator')
  if (!rl.allowed) return rateLimitResponse(rl)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const parsed = InputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { project_id, milestone_name } = parsed.data

    const basePrompt = await callAssembleContext('agent-invoice-generator', 'generate invoice from project payment schedule')
    const systemPrompt =
      (basePrompt ?? 'You are an AI billing assistant for AK Renovations.') +
      ` Write a concise invoice description line for this milestone payment. 1-2 sentences. No em dashes.`

    // Get project details
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id,title,project_type,client_name,contract_value')
      .eq('id', project_id)
      .single()

    if (projError || !project) throw projError ?? new Error('Project not found')

    // Get contract for payment schedule
    const { data: contract } = await supabase
      .from('contracts')
      .select('id,total_value,payment_schedule')
      .eq('project_id', project_id)
      .eq('status', 'signed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const paymentSchedule = (contract?.payment_schedule as Array<{
      milestone: string
      amount: number
      description?: string
      percent?: number
    }>) ?? []

    // Find the milestone being invoiced
    let milestoneData: { milestone: string; amount: number; description?: string } | null = null
    if (milestone_name && paymentSchedule.length > 0) {
      milestoneData = paymentSchedule.find(
        (m) => m.milestone?.toLowerCase().includes(milestone_name.toLowerCase()),
      ) ?? null
    }

    // If no milestone match, create a generic milestone invoice
    if (!milestoneData) {
      // Check how many invoices already exist to determine which milestone this is
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('id,total')
        .eq('project_id', project_id)
        .not('status', 'eq', 'voided')

      const totalInvoiced = (existingInvoices ?? []).reduce((sum, i) => sum + (i.total ?? 0), 0)
      const remaining = (project.contract_value ?? 0) - totalInvoiced
      const milestoneName = milestone_name ?? `Progress Payment ${(existingInvoices?.length ?? 0) + 1}`

      milestoneData = {
        milestone: milestoneName,
        amount: remaining > 0 ? Math.min(remaining, project.contract_value * 0.25) : 0,
        description: `Progress payment for ${project.project_type} remodel`,
      }
    }

    const _t0 = Date.now()

    const { text: descriptionText, usage: _u } = await callClaude(
      systemPrompt,
      `Project: ${project.title} (${project.project_type} remodel for ${project.client_name})

    logAiUsage({ function_name: 'agent-invoice-generator', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _u.input_tokens, output_tokens: _u.output_tokens, duration_ms: Date.now() - _t0, status: 'success' })
Milestone: ${milestoneData.milestone}
Amount: $${milestoneData.amount.toLocaleString()}

Write the invoice line item description.`,
      150,
    )

    const invoiceNumber = generateInvoiceNumber()
    const amount = milestoneData.amount
    const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

    const lineItems = [
      {
        type: 'milestone',
        label: milestoneData.milestone,
        desc: descriptionText.trim(),
        qty: 1,
        unitPrice: amount,
        amount,
      },
    ]

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        project_id,
        proposal_id: null,
        invoice_number: invoiceNumber,
        title: `${milestoneData.milestone} — ${project.title}`,
        description: descriptionText.trim(),
        line_items: lineItems,
        subtotal: amount,
        tax_rate: 0,
        tax_amount: 0,
        total: amount,
        payment_mode: 'milestone',
        deposit_label: milestoneData.milestone,
        deposit_paid: 0,
        balance_due: amount,
        status: 'draft',
        due_date: dueDate,
      })
      .select()
      .single()

    if (invError) throw invError

    await writeOutput(
      supabase,
      'agent-invoice-generator',
      'draft',
      `Invoice Draft: ${invoiceNumber} — ${project.title}`,
      `Invoice ${invoiceNumber} created for milestone: ${milestoneData.milestone}\nAmount: $${amount.toLocaleString()}\nDue: ${dueDate}`,
      {
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        project_id,
        milestone: milestoneData.milestone,
        amount,
      },
      true,
    )

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        amount,
        milestone: milestoneData.milestone,
        due_date: dueDate,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-invoice-generator error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
