import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  file_id: z.string().uuid('file_id must be a valid UUID'),
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

async function callClaudeVision(systemPrompt: string, imageUrl: string, userMessage: string, maxTokens = 800): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
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
  return { text: data.content?.[0]?.text ?? '', usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 } }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-document-classifier')
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
    const { file_id } = parsed.data

    await callAssembleContext('agent-document-classifier', 'classify uploaded document type and update project files record')

    const systemPrompt = `You are an AI document classifier for AK Renovations, a residential remodeling contractor.
Classify the document and return ONLY a valid JSON object:
{
  "document_type": "sub_quote|invoice|receipt|permit|blueprint|contract|spec_sheet|photo|unknown",
  "file_category": "blueprint|spec_sheet|permit|contract|proposal|invoice|insurance|photo|other",
  "budget_category": "materials|labor|subcontractor|equipment_rental|permit|delivery|misc|null",
  "is_permit": true or false,
  "permit_details": {
    "permit_type": "building|electrical|plumbing|mechanical|demo or null",
    "permit_number": "if visible",
    "jurisdiction": "city/county if visible",
    "status": "applied|approved|expired or null"
  },
  "confidence": "high|medium|low",
  "notes": "brief description of what the document appears to be"
}
Return ONLY the JSON.`

    // Get file record
    const { data: file, error: fileError } = await supabase
      .from('project_files')
      .select('id,file_url,project_id,file_name,file_type,category')
      .eq('id', file_id)
      .single()

    if (fileError || !file) throw fileError ?? new Error('File not found')

    const isImage = file.file_type?.startsWith('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.file_url)

    let classificationResult: string
    if (isImage) {
      classificationResult = await callClaudeVision(
        systemPrompt,
        file.file_url,
        `Classify this document. File name: ${file.file_name}. Return JSON.`,
        600,
      )
    } else {
      const _tc1 = Date.now()
      const _cr1 = await callClaude(
        systemPrompt,
        `Classify this document based on its file name and URL.\nFile name: ${file.file_name}\nFile type: ${file.file_type}\nURL: ${file.file_url}\nReturn JSON.`,
        600,
      )
      classificationResult = _cr1.text
      logAiUsage({ function_name: 'agent-document-classifier', model_provider: 'anthropic', model_name: 'claude-sonnet-4-20250514', input_tokens: _cr1.usage.input_tokens, output_tokens: _cr1.usage.output_tokens, duration_ms: Date.now() - _tc1, status: 'success' })
    }

    let classification: Record<string, unknown> = {}
    try {
      classification = JSON.parse(classificationResult.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      const jsonMatch = classificationResult.match(/\{[\s\S]+\}/)
      if (jsonMatch) {
        try { classification = JSON.parse(jsonMatch[0]) } catch { classification = {} }
      }
    }

    // Update project_files record
    const updateData: Record<string, unknown> = {}
    if (classification.file_category) updateData.category = classification.file_category
    if (Object.keys(updateData).length > 0) {
      await supabase.from('project_files').update(updateData).eq('id', file_id)
    }

    // If it's a permit, create/update permit record
    if (classification.is_permit && file.project_id) {
      const permitDetails = classification.permit_details as Record<string, unknown> | undefined
      if (permitDetails) {
        // Check if permit record already exists for this project/type
        const { data: existingPermit } = await supabase
          .from('permits')
          .select('id')
          .eq('project_id', file.project_id)
          .eq('permit_type', permitDetails.permit_type ?? 'building')
          .single()

        if (!existingPermit) {
          await supabase.from('permits').insert({
            project_id: file.project_id,
            permit_type: (permitDetails.permit_type as string) ?? 'building',
            permit_number: (permitDetails.permit_number as string) ?? null,
            jurisdiction: (permitDetails.jurisdiction as string) ?? null,
            status: (permitDetails.status as string) ?? 'needed',
            document_url: file.file_url,
          })
        } else {
          // Update with new document url if we have a permit number now
          if (permitDetails.permit_number) {
            await supabase
              .from('permits')
              .update({
                permit_number: permitDetails.permit_number,
                jurisdiction: permitDetails.jurisdiction ?? null,
                status: (permitDetails.status as string) ?? 'approved',
                document_url: file.file_url,
              })
              .eq('id', existingPermit.id)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_id,
        classification,
        updates_applied: Object.keys(updateData),
        permit_created: classification.is_permit === true,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-document-classifier error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
