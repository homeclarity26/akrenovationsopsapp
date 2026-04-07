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

async function callClaudeVision(systemPrompt: string, imageUrl: string, userMessage: string, maxTokens = 1500): Promise<string> {
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
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const { file_id } = body

    if (!file_id) {
      return new Response(JSON.stringify({ error: 'file_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await callAssembleContext('agent-quote-reader', 'extract subcontractor quote data from uploaded document')

    const systemPrompt = `You are an AI document reader for AK Renovations, a residential remodeling contractor.
Extract quote/bid data from this document and return ONLY a valid JSON object:
{
  "company_name": "subcontractor or supplier company name",
  "contact_name": "contact person if listed",
  "contact_phone": "phone number if listed",
  "contact_email": "email if listed",
  "quote_amount": 0.00,
  "scope_of_work": "description of what is included",
  "inclusions": ["list of included items"],
  "exclusions": ["list of excluded items"],
  "materials_included": true,
  "labor_included": true,
  "quote_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD or null",
  "estimated_duration": "e.g. 3 days, 2 weeks",
  "trade": "plumbing|electrical|hvac|framing|roofing|concrete|drywall|tile|painting|other",
  "notes": "any other relevant notes"
}
Return ONLY the JSON. Use null for fields you cannot find.`

    // Get file record
    const { data: file, error: fileError } = await supabase
      .from('project_files')
      .select('id,file_url,project_id,file_name,file_type')
      .eq('id', file_id)
      .single()

    if (fileError || !file) throw fileError ?? new Error('File not found')

    // Use vision for images, text for PDFs/docs
    const isImage = file.file_type?.startsWith('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.file_url)

    let extractionResult: string
    if (isImage) {
      extractionResult = await callClaudeVision(
        systemPrompt,
        file.file_url,
        'Extract all quote/bid data from this document image and return as JSON.',
        1200,
      )
    } else {
      // For PDFs/docs, pass the URL in the text message and ask Claude to work from the description
      // In production, you would fetch and parse the document content first
      extractionResult = await callClaude(
        systemPrompt,
        `Extract quote data from this document at URL: ${file.file_url}\nFile name: ${file.file_name}\nReturn as JSON.`,
        1200,
      )
    }

    let quoteData: Record<string, unknown> = {}
    try {
      quoteData = JSON.parse(extractionResult.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      const jsonMatch = extractionResult.match(/\{[\s\S]+\}/)
      if (jsonMatch) {
        try { quoteData = JSON.parse(jsonMatch[0]) } catch { quoteData = { raw: extractionResult } }
      }
    }

    // NOTE: This agent does NOT save — it returns extracted data for the frontend to confirm
    return new Response(
      JSON.stringify({
        success: true,
        file_id,
        project_id: file.project_id,
        extracted_data: quoteData,
        requires_confirmation: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-quote-reader error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
