import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { AI_CONFIG } from '../_shared/aiConfig.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  file_id: z.string().uuid('file_id must be a valid UUID'),
  project_id: z.string().uuid('project_id must be a valid UUID').optional(),
  entered_by: z.string().uuid('entered_by must be a valid UUID').optional(),
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
      model: AI_CONFIG.PRIMARY_MODEL,
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

// Download file bytes from Supabase storage (bucket is private) and send to
// Claude as base64. Supports PNG/JPG/WEBP/GIF via `image` blocks and PDF via
// the `document` block (which reads actual PDF pages).
async function callClaudeVision(
  systemPrompt: string,
  fileBase64: string,
  mediaType: string,
  userMessage: string,
  maxTokens = 1024,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const isPdf = mediaType === 'application/pdf'
  // Claude content block shape varies by file type — images go through the
  // `image` block, PDFs through `document` (which reads pages natively).
  const contentBlock: Record<string, unknown> = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }
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
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: userMessage },
          ],
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Claude vision error: ${await res.text()}`)
  const data = await res.json()
  return { text: data.content?.[0]?.text ?? '', usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 } }
}

// Parse a Supabase storage URL into { bucket, path }. Handles both the
// "public" variant (.../storage/v1/object/public/bucket/path) and the plain
// variant (.../storage/v1/object/bucket/path).
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/)
  if (!m) return null
  return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) }
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Build the binary string one chunk at a time to avoid "too many arguments"
  // errors on String.fromCharCode for huge buffers. TextDecoder('latin1') is
  // the simplest way to get a 1-byte-per-char string the btoa call can handle.
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length))
    // Spread a Uint8Array into String.fromCharCode — Deno supports spreading
    // typed arrays into function calls directly; no Array.from needed.
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

function mediaTypeFromNameOrType(fileName: string, storedType: string | null | undefined): string {
  if (storedType && storedType.includes('/')) return storedType
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':  return 'application/pdf'
    case 'png':  return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif':  return 'image/gif'
    default:     return 'image/jpeg'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-receipt-processor')
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
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { file_id, project_id, entered_by } = parsed.data

    await callAssembleContext('agent-receipt-processor', 'extract receipt data and create expense record')

    const systemPrompt = `${buildSystemPrompt(company, 'receipt processor')}
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
      .select('id,file_url,project_id,file_name,file_type')
      .eq('id', file_id)
      .single()

    if (fileError || !file) throw fileError ?? new Error('File not found')

    const targetProjectId = project_id ?? file.project_id
    if (!targetProjectId) throw new Error('project_id required — either pass it in or associate the file with a project')

    // Download file bytes via storage (bucket may be private — .getPublicUrl()
    // is broken for private buckets and Claude can't URL-fetch PDFs anyway).
    const storageRef = parseStorageUrl(file.file_url)
    if (!storageRef) throw new Error(`Cannot parse storage URL: ${file.file_url}`)
    const { data: blob, error: dlErr } = await supabase.storage
      .from(storageRef.bucket)
      .download(storageRef.path)
    if (dlErr || !blob) throw dlErr ?? new Error('storage download failed')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const fileBase64 = uint8ToBase64(bytes)
    const mediaType = mediaTypeFromNameOrType(file.file_name ?? '', blob.type)

    // Call Claude vision to extract receipt data
    const _tv = Date.now()
    const { text: extractionResult, usage: _uv } = await callClaudeVision(
      systemPrompt,
      fileBase64,
      mediaType,
      'Extract all receipt data from this file and return as JSON. If it is a PDF, read every page.',
      800,
    )
    logAiUsage({ function_name: 'agent-receipt-processor', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _uv.input_tokens, output_tokens: _uv.output_tokens, duration_ms: Date.now() - _tv, status: 'success' })

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
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-receipt-processor error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
