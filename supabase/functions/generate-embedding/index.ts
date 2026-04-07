// generate-embedding — A7
// Shared utility edge function. Wraps OpenAI text-embedding-3-small.
// Called by assemble-context, update-operational-memory, and any agent
// that needs to embed text for semantic search.
//
// Input:  { text: string }
// Output: { embedding: number[] }   (1536-dimension vector)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'text is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set')
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8191), // max tokens for this model
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI embedding error: ${err}`)
    }

    const result = await response.json()
    const embedding: number[] = result.data?.[0]?.embedding

    if (!embedding) {
      throw new Error('No embedding returned from OpenAI')
    }

    return new Response(
      JSON.stringify({ embedding }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('generate-embedding error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
