// update-operational-memory — A9
// Called by database triggers when key data changes.
// Receives the event, fetches entity state, generates a plain-English memory entry,
// embeds it, and upserts to operational_memory.
//
// Input:  { entity_type, entity_id, event, old_value?, new_value?, metadata? }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  entity_type: z.enum(['project', 'client', 'lead', 'subcontractor', 'employee', 'vendor']),
  entity_id: z.string(),
  event: z.string(),
  old_value: z.string().optional(),
  new_value: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

interface MemoryUpdateEvent {
  entity_type: 'project' | 'client' | 'lead' | 'subcontractor' | 'employee' | 'vendor'
  entity_id: string
  event: string          // e.g. 'status_change', 'invoice_paid', 'proposal_accepted'
  old_value?: string
  new_value?: string
  metadata?: Record<string, unknown>
}

// Maps event types to memory_type values
function classifyMemoryType(event: string): string {
  if (event.includes('status') || event.includes('change')) return 'fact'
  if (event.includes('paid') || event.includes('payment')) return 'outcome'
  if (event.includes('accepted') || event.includes('signed')) return 'outcome'
  if (event.includes('pattern') || event.includes('repeat')) return 'pattern'
  if (event.includes('warning') || event.includes('late') || event.includes('over')) return 'warning'
  return 'fact'
}

const TABLE_MAP: Record<string, string> = {
  project:       'projects',
  client:        'profiles',
  lead:          'leads',
  subcontractor: 'subcontractors',
  employee:      'profiles',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'update-operational-memory')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const event: MemoryUpdateEvent = parsedInput.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. FETCH CURRENT STATE OF ENTITY
    const table = TABLE_MAP[event.entity_type]
    let entityData: Record<string, unknown> = {}

    if (table) {
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('id', event.entity_id)
        .single()
      entityData = data ?? {}
    }

    // 2. GENERATE PLAIN-ENGLISH MEMORY USING CLAUDE
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',  // Use Haiku — this runs on every DB change
        max_tokens: 150,
        system: 'Convert this business event into a concise, plain-English memory entry. Maximum 2 sentences. Be specific with names, amounts, and dates. No filler words.',
        messages: [{
          role: 'user',
          content: `Event: ${event.event} on ${event.entity_type} (ID: ${event.entity_id}).${event.old_value ? ` Changed from: ${event.old_value}.` : ''}${event.new_value ? ` Changed to: ${event.new_value}.` : ''} Entity data: ${JSON.stringify(entityData).slice(0, 1000)}`,
        }],
      }),
    })

    let memoryContent: string
    if (claudeResponse.ok) {
      const claudeResult = await claudeResponse.json()
      memoryContent = claudeResult.content?.[0]?.text ?? `${event.entity_type} ${event.event}: ${event.new_value ?? ''}`
    } else {
      // Fallback: plain text if Claude fails
      memoryContent = `${event.entity_type} (${entityData['title'] ?? entityData['full_name'] ?? event.entity_id}) ${event.event}${event.old_value ? ` from ${event.old_value}` : ''}${event.new_value ? ` to ${event.new_value}` : ''}.`
    }

    // 3. GENERATE EMBEDDING
    let embedding: number[] | null = null
    try {
      const embRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embedding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ text: memoryContent }),
      })
      if (embRes.ok) {
        const embData = await embRes.json()
        embedding = embData.embedding
      }
    } catch {
      // Non-fatal — memory still stored, just not searchable by vector
    }

    // 4. UPSERT TO OPERATIONAL MEMORY
    const memoryRow: Record<string, unknown> = {
      entity_type:  event.entity_type,
      entity_id:    event.entity_id,
      memory_type:  classifyMemoryType(event.event),
      content:      memoryContent,
      source:       'database_trigger',
      confidence:   1.0,
    }
    if (embedding) memoryRow.embedding = JSON.stringify(embedding)

    const { error: insertError } = await supabase
      .from('operational_memory')
      .insert(memoryRow)

    if (insertError) {
      throw new Error(`Failed to insert memory: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, memory: memoryContent }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('update-operational-memory error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
