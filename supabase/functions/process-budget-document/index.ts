// process-budget-document — updated A13
// Triggered on file upload to budget module.
// NOW calls assemble-context first for memory-enriched base, then runs extraction.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  file_url: z.string().url('file_url must be a valid URL'),
  project_id: z.string().uuid('project_id must be a valid UUID'),
  trade_id: z.string().uuid('trade_id must be a valid UUID').optional(),
  quote_id: z.string().uuid('quote_id must be a valid UUID').optional(),
  user_id: z.string().uuid('user_id must be a valid UUID').optional(),
  user_role: z.enum(['admin', 'employee', 'client']).optional(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  file_url: string
  project_id: string
  trade_id?: string
  quote_id?: string
  user_id?: string
  user_role?: 'admin' | 'employee' | 'client'
}

interface ExtractionResult {
  document_type: 'sub_quote' | 'invoice' | 'receipt' | 'spec_sheet' | 'unknown'
  company_name?: string
  amount?: number
  date?: string
  scope_description?: string
  includes_materials?: boolean
  line_items?: { description: string; amount: number }[]
  confidence: 'high' | 'medium' | 'low'
}

async function callAssembleContext(
  user_id: string,
  user_role: string,
  project_id: string
): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_id,
        user_role,
        agent_name: 'process-budget-document',
        capability_required: 'query_financials',
        entity_type: 'project',
        entity_id: project_id,
        query: 'extract data from subcontractor quote document',
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'process-budget-document')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { file_url, project_id, trade_id, quote_id, user_id, user_role = 'admin' } = parsedInput.data

    // Call assemble-context to get memory-enriched base
    let baseSystemPrompt: string | null = null
    if (user_id) {
      baseSystemPrompt = await callAssembleContext(user_id, user_role, project_id)
    }

    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file_url)

    const extractionInstructions = `
DOCUMENT EXTRACTION TASK
Extract the following fields from this construction document when present:
- document_type: "sub_quote", "invoice", "receipt", "spec_sheet", or "unknown"
- company_name: The company or vendor name
- amount: Total dollar amount (numeric only)
- date: Document date in YYYY-MM-DD format
- scope_description: Brief summary of work or items covered
- includes_materials: true if materials are explicitly included, false if labor-only
- line_items: Array of { description, amount } for each line item if present
- confidence: "high", "medium", or "low" based on how clearly these fields were readable

Context: trade_id=${trade_id ?? 'unknown'}, project_id=${project_id}
File URL: ${file_url}

Respond ONLY with valid JSON matching the schema above. No explanation outside JSON.`

    const systemPrompt = baseSystemPrompt
      ? `${baseSystemPrompt}\n\n${extractionInstructions}`
      : `You are a document extraction specialist for a construction contracting business.\n${extractionInstructions}`

    const userMessage = isImage
      ? `Please extract information from this document image: ${file_url}`
      : `Please extract information from this document (PDF or non-image). File URL: ${file_url}`

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text()
      throw new Error(`Claude API error: ${err}`)
    }

    const claudeResult = await anthropicResponse.json()
    const rawText = claudeResult.content?.[0]?.text ?? '{}'

    let extracted: ExtractionResult
    try {
      extracted = JSON.parse(rawText)
    } catch {
      extracted = { document_type: 'unknown', confidence: 'low' }
    }

    if (!extracted.confidence) extracted.confidence = 'medium'

    return new Response(
      JSON.stringify(extracted),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('process-budget-document error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
