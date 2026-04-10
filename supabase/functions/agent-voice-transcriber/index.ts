// agent-voice-transcriber — rewritten to use Gemini 2.5 Flash audio input.
// Single round-trip: audio in, structured action items out. No Deepgram.
//
// Flow:
//   1. Receive { file_id, project_id?, submitted_by? }
//   2. Look up the project_files row, download the audio
//   3. Base64-encode the bytes, send to Gemini 2.5 Flash with a structured
//      prompt asking for transcript + summary + tasks + shopping items +
//      issues in one shot.
//   4. Insert rows in communication_log, tasks, shopping_list_items
//   5. Return a summary response

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  file_id: z.string().uuid('file_id must be a valid UUID'),
  project_id: z.string().uuid('project_id must be a valid UUID').optional(),
  submitted_by: z.string().uuid('submitted_by must be a valid UUID').optional(),
})

// ─────────────────────────────────────────────────────────────────────────────

async function callAssembleContext(
  agentName: string,
  query: string,
): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_id: 'system',
        user_role: 'admin',
        agent_name: agentName,
        capability_required: 'query_financials',
        query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : ctx.system_prompt ?? null
  } catch {
    return null
  }
}

// Convert an ArrayBuffer to a base64 string (Deno has no Buffer by default)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // Chunk to avoid maximum call stack size with String.fromCharCode.apply
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      // @ts-ignore — subarray returns a Uint8Array which TS doesn't type as number[]
      bytes.subarray(i, i + chunkSize) as unknown as number[],
    )
  }
  return btoa(binary)
}

// Call Gemini 2.5 Flash with an inline audio blob and a structured prompt.
// Returns the raw text response (we then JSON.parse).
async function callGeminiAudio(
  audioBase64: string,
  audioMimeType: string,
  systemInstructions: string,
  userPrompt: string,
): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY') ?? ''
  if (!key) throw new Error('GEMINI_API_KEY is not configured')

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
    key

  const body = {
    systemInstruction: { parts: [{ text: systemInstructions }] },
    contents: [
      {
        parts: [
          { text: userPrompt },
          {
            inline_data: {
              mime_type: audioMimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Gemini audio error ${res.status}: ${txt.slice(0, 400)}`)
  }

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts ?? []
  for (const p of parts) {
    if (typeof p.text === 'string' && p.text.trim()) return p.text
  }
  throw new Error('Gemini returned no text in response')
}

// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedPayload {
  transcript?: string
  summary?: string
  tasks?: Array<{ title: string; priority?: string }>
  shopping_items?: Array<{
    item_name: string
    quantity?: number
    unit?: string
    notes?: string
  }>
  issues?: string[]
  general_notes?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-voice-transcriber')
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
    const { file_id, project_id, submitted_by } = parsed.data

    await callAssembleContext(
      'agent-voice-transcriber',
      'transcribe voice note and extract action items',
    )

    // 1. Look up the project_files row
    const { data: file, error: fileError } = await supabase
      .from('project_files')
      .select('id,file_url,project_id,file_name')
      .eq('id', file_id)
      .single()
    if (fileError || !file) throw fileError ?? new Error('File not found')

    const targetProjectId = project_id ?? file.project_id

    // 2. Download the audio
    const audioRes = await fetch(file.file_url)
    if (!audioRes.ok) throw new Error(`Failed to fetch audio file: ${audioRes.status}`)
    const audioBuffer = await audioRes.arrayBuffer()
    const audioMime = audioRes.headers.get('content-type') ?? 'audio/mpeg'
    const audioBase64 = arrayBufferToBase64(audioBuffer)

    // 3. Single-call Gemini: transcribe + extract action items
    const systemInstructions = `${buildSystemPrompt(company, 'assistant')}

A field worker (like Jeff) or Adam just recorded a voice note. Your job:
1. Transcribe the audio accurately.
2. Summarize it in 1-2 sentences.
3. Extract any action items: tasks to do, shopping items to buy, issues to flag.
4. Return a strict JSON object.`

    const userPrompt = `Listen to this voice note, transcribe it, and return a JSON object with this exact shape (no prose, no markdown):

{
  "transcript": "full verbatim transcription of the audio",
  "summary": "1-2 sentence summary",
  "tasks": [{ "title": "...", "priority": "low|medium|high" }],
  "shopping_items": [{ "item_name": "...", "quantity": 1, "unit": "each|box|sqft|etc", "notes": "optional" }],
  "issues": ["..."],
  "general_notes": "anything that isn't a task or item"
}

If any field has no entries, return it as an empty array (or empty string for transcript/summary/general_notes). Do NOT add any fields not in this schema.`

    const raw = await callGeminiAudio(audioBase64, audioMime, systemInstructions, userPrompt)

    let extracted: ExtractedPayload = {}
    try {
      extracted = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]+\}/)
      if (jsonMatch) {
        try {
          extracted = JSON.parse(jsonMatch[0])
        } catch {
          extracted = { general_notes: raw }
        }
      }
    }

    const transcript = (extracted.transcript ?? '').trim()
    if (!transcript) {
      // Gemini couldn't transcribe (silent audio, corrupted, etc.) — record
      // the attempt in the log but don't fail the request hard.
      await supabase.from('communication_log').insert({
        project_id: targetProjectId ?? null,
        comm_type: 'voice_note',
        direction: 'inbound',
        summary: 'Voice note could not be transcribed',
        transcript: '',
      })
      return new Response(
        JSON.stringify({ warning: 'Empty transcript from Gemini', raw: raw.slice(0, 300) }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // 4. Save to communication_log
    await supabase.from('communication_log').insert({
      project_id: targetProjectId ?? null,
      comm_type: 'voice_note',
      direction: 'inbound',
      summary: extracted.summary ?? transcript.substring(0, 200),
      transcript,
      action_items: {
        tasks: extracted.tasks ?? [],
        shopping_items: extracted.shopping_items ?? [],
      },
    })

    // 5. Create task records
    const tasksCreated: string[] = []
    for (const task of extracted.tasks ?? []) {
      if (!task?.title) continue
      await supabase.from('tasks').insert({
        project_id: targetProjectId ?? null,
        assigned_to: submitted_by ?? null,
        title: task.title,
        priority: task.priority ?? 'medium',
        status: 'todo',
        created_by: submitted_by ?? null,
      })
      tasksCreated.push(task.title)
    }

    // 6. Create shopping list items
    const itemsCreated: string[] = []
    if (targetProjectId) {
      for (const item of extracted.shopping_items ?? []) {
        if (!item?.item_name) continue
        await supabase.from('shopping_list_items').insert({
          project_id: targetProjectId,
          item_name: item.item_name,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? 'each',
          notes: item.notes ?? null,
          added_by: submitted_by ?? null,
          status: 'needed',
        })
        itemsCreated.push(item.item_name)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        provider: 'gemini',
        transcript,
        summary: extracted.summary,
        tasks_created: tasksCreated,
        shopping_items_created: itemsCreated,
        issues: extracted.issues,
        general_notes: extracted.general_notes,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-voice-transcriber error:', err)
    return new Response(
      JSON.stringify({ error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
