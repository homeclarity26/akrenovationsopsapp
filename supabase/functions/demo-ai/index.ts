// Public Claude Haiku endpoint for the demo AI scenes.
// Used by both /demo/employee and /experience.
//
// Anonymous: no auth, no DB writes, no service-role required.
// Just proxies a single user message to Claude Haiku 4.5 with the
// system prompt provided by the demo and returns the text.
//
// CORS is open so the marketing site (or the SPA itself) can call it.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DemoAIRequest {
  system: string
  message: string
  model?: string
  max_tokens?: number
}

const FALLBACK = {
  text:
    "I can help with that. Give me one second — if I can't reach the AI right now, your contractor's office will see your question and respond directly.",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: DemoAIRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const system = (body.system || '').toString().slice(0, 8000)
  const message = (body.message || '').toString().slice(0, 2000)
  const model = body.model || 'claude-haiku-4-5'
  const maxTokens = Math.min(body.max_tokens || 300, 500)

  if (!system || !message) {
    return new Response(JSON.stringify({ error: 'system and message required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify(FALLBACK), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 12000)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: message }],
      }),
      signal: controller.signal,
    })
    clearTimeout(t)

    if (!res.ok) {
      const errText = await res.text()
      console.error('claude error:', res.status, errText)
      return new Response(JSON.stringify(FALLBACK), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const text =
      Array.isArray(data?.content) && data.content[0]?.text
        ? data.content[0].text.trim()
        : ''

    return new Response(
      JSON.stringify({ text: text || FALLBACK.text }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (e) {
    console.error('demo-ai exception:', e)
    return new Response(JSON.stringify(FALLBACK), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
