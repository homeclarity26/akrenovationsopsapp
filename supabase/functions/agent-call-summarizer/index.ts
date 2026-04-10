// agent-call-summarizer — rewritten to use Gemini 2.5 Flash audio input.
// Single round-trip: recording in, structured call analysis out. No Deepgram.
//
// Used by the Twilio call-recording webhook in /admin/crm flow.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCompanyProfile, buildSystemPrompt } from '../_shared/companyProfile.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logAiUsage } from '../_shared/ai_usage.ts'

const InputSchema = z.object({
  recording_url: z.string().url('recording_url must be a valid URL'),
  call_duration: z.number().optional(),
  lead_id: z.string().uuid('lead_id must be a valid UUID').optional(),
  project_id: z.string().uuid('project_id must be a valid UUID').optional(),
})

// ── Context / utility ─────────────────────────────────────────────────────

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      // @ts-ignore
      bytes.subarray(i, i + chunkSize) as unknown as number[],
    )
  }
  return btoa(binary)
}

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

// ── Types ──────────────────────────────────────────────────────────────────

interface CallAnalysis {
  transcript?: string
  summary?: string
  key_decisions?: string[]
  action_items_adam?: Array<{ action: string; priority?: string; due?: string }>
  action_items_client?: Array<{ action: string }>
  topics_discussed?: string[]
  next_steps?: string
  call_sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed'
}

// ── Handler ────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'agent-call-summarizer')
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
    const { recording_url, call_duration, lead_id, project_id } = parsed.data

    await callAssembleContext(
      'agent-call-summarizer',
      'transcribe and summarize phone call recording',
    )

    // Download the recording
    const recordingRes = await fetch(recording_url)
    if (!recordingRes.ok) {
      throw new Error(`Failed to fetch recording: ${recordingRes.status}`)
    }
    const recordingBuffer = await recordingRes.arrayBuffer()
    const recordingMime = recordingRes.headers.get('content-type') ?? 'audio/wav'
    const recordingBase64 = arrayBufferToBase64(recordingBuffer)

    // Single Gemini call — transcribe AND analyze
    const systemInstructions = `${buildSystemPrompt(company, 'business assistant')}

Your job: listen to a phone call between Adam (or one of his team) and a client or prospective client, transcribe it, then analyze it and extract decisions, action items, topics, and sentiment.

Return ONLY a JSON object matching the schema in the user prompt. No prose, no markdown.`

    const userPrompt = `Listen to this phone call recording and return a JSON object with this exact shape:

{
  "transcript": "full verbatim transcription of the call. Use speaker labels if you can tell the voices apart: 'Adam:' / 'Client:'",
  "summary": "2-3 sentence summary of the call",
  "key_decisions": ["list of decisions made or agreed upon"],
  "action_items_adam": [{ "action": "what Adam needs to do", "priority": "low|medium|high", "due": "timeframe if mentioned, or empty string" }],
  "action_items_client": [{ "action": "what the client/other party agreed to do" }],
  "topics_discussed": ["list of main topics"],
  "next_steps": "what happens next",
  "call_sentiment": "positive|neutral|negative|mixed"
}

If any list has no entries, return []. If any text field is unclear, return "". Do not add any fields outside this schema.`

    const raw = await callGeminiAudio(
      recordingBase64,
      recordingMime,
      systemInstructions,
      userPrompt,
    )

    let analysis: CallAnalysis = {}
    try {
      analysis = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]+\}/)
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0])
        } catch {
          analysis = { summary: raw.slice(0, 500) }
        }
      }
    }

    const transcript = (analysis.transcript ?? '').trim()
    if (!transcript) {
      return new Response(
        JSON.stringify({ warning: 'Empty transcript from Gemini', raw: raw.slice(0, 300) }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }

    // Save to communication_log
    const { data: commLog } = await supabase
      .from('communication_log')
      .insert({
        lead_id: lead_id ?? null,
        project_id: project_id ?? null,
        comm_type: 'call',
        direction: 'inbound',
        summary: analysis.summary ?? transcript.substring(0, 300),
        transcript,
        recording_url,
        duration_seconds: call_duration ?? null,
        action_items: {
          adam: analysis.action_items_adam ?? [],
          client: analysis.action_items_client ?? [],
        },
      })
      .select()
      .single()

    // Create task records for Adam's action items
    const tasksCreated: string[] = []
    for (const item of analysis.action_items_adam ?? []) {
      if (!item?.action) continue
      await supabase.from('tasks').insert({
        project_id: project_id ?? null,
        title: item.action,
        description: `From call on ${new Date().toLocaleDateString()}`,
        priority: item.priority ?? 'medium',
        status: 'todo',
        due_date: null,
      })
      tasksCreated.push(item.action)
    }

    return new Response(
      JSON.stringify({
        success: true,
        provider: 'gemini',
        comm_log_id: commLog?.id,
        transcript_length: transcript.length,
        summary: analysis.summary,
        key_decisions: analysis.key_decisions,
        action_items_adam: analysis.action_items_adam,
        action_items_client: analysis.action_items_client,
        tasks_created: tasksCreated,
        sentiment: analysis.call_sentiment,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('agent-call-summarizer error:', err)
    return new Response(
      JSON.stringify({ error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  }
})
