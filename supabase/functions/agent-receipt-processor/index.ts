import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  file_id: z.string().uuid('file_id must be a valid UUID'),
  project_id: z.string().uuid('project_id must be a valid UUID').optional(),
  entered_by: z.string().uuid('entered_by must be a valid UUID').optional(),
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

async function callClaudeVision(systemPrompt: string, imageUrl: string, userMessage: string, maxTokens = 1024): Promise<string> {
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
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            { type: 'text', text: userMessage },
          ],
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Claude vision error: ${await res.text()}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'agent-receipt-processor')
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { file_id, project_id, entered_by } = parsed.data

    await callAssembleContext('agent-receipt-processor', 'extract receipt data and create expense record')

    const systemPrompt = `You are an AI receipt processor for AK Renovations, a remodeling contractor.
Extract data from this receipt image and return ONLY a valid JSON object with these fields:
{
  "vendor": "store/supplier name",
  "date": "YYYY-MM-DD format",
  "total": 0.00,
  "items": [{"description": "item name", "quantity": 1, "unit_price": 0.00, "total": 0.00}],
  "category": "materials|labor|subcontractor|equipment_rental|permit|delivery|misc",
  "tax": 0.00,
  "subtotal": 0.00,
  "payment_method": "credit|debit|cash|check|unknown"
}
If you cannot read a field clearly, use null. Return ONLY the JSON object.`

    // Get file record
    const { data: file, error: fileError } = await supabase
      .from('project_files')
      .select('id,file_url,project_id,file_name')
      .eq('id', file_id)
      .single()

    if (fileError || !file) throw fileError ?? new Error('File not found')

    const targetProjectId = project_id ?? file.project_id
    if (!targetProjectId) throw new Error('project_id required — either pass it in or associate the file with a project')

    // Call Claude vision to extract receipt data
    const extractionResult = await callClaudeVision(
      systemPrompt,
      file.file_url,
      'Extract all receipt data from this image and return as JSON.',
      800,
    )

    let receiptData: Record<string, unknown> = {}
    try {
      receiptData = JSON.parse(extractionResult.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = extractionResult.match(/\{[\s\S]+\}/)
      if (jsonMatch) {
        try { receiptData = JSON.parse(jsonMatch[0]) } catch { receiptData = { raw: extractionResult } }
      }
    }

    // Create expense record
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        project_id: targetProjectId,
        vendor: receiptData.vendor as string ?? null,
        description: `Receipt from ${receiptData.vendor ?? 'unknown vendor'}`,
        category: (receiptData.category as string) ?? 'materials',
        amount: (receiptData.total as number) ?? 0,
        date: (receiptData.date as string) ?? new Date().toISOString().split('T')[0],
        receipt_image_url: file.file_url,
        receipt_data: receiptData,
        entered_by: entered_by ?? null,
        entry_method: 'receipt_scan',
      })
      .select()
      .single()

    if (expenseError) throw expenseError

    await writeOutput(
      supabase,
      'agent-receipt-processor',
      'action',
      `Receipt Processed: ${receiptData.vendor ?? file.file_name}`,
      `Extracted receipt data and created expense record.\nVendor: ${receiptData.vendor ?? 'Unknown'}\nDate: ${receiptData.date ?? 'Unknown'}\nTotal: $${receiptData.total ?? 0}\nCategory: ${receiptData.category ?? 'materials'}`,
      {
        file_id,
        expense_id: expense.id,
        project_id: targetProjectId,
        extracted_data: receiptData,
      },
      false,
    )

    return new Response(
      JSON.stringify({ success: true, expense_id: expense.id, extracted_data: receiptData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-receipt-processor error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
