// generate-improvement-spec — Phase E
// Generates a full Claude Code implementation spec for an improvement.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImprovementInput {
  improvement: {
    title: string
    problem: string
    evidence: string
    solution: string
    priority: string
    category: string
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'generate-improvement-spec')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const { improvement }: ImprovementInput = await req.json()

    const systemPrompt = `You are generating a Claude Code improvement spec for AK Ops — a React/TypeScript/Supabase app for a renovation contractor.

The spec must follow these conventions:
- Stack: React 18 + TypeScript + Vite + Supabase (Postgres, Auth, Storage, Edge Functions) + Tailwind CSS
- Design system: "Quiet Craft" — navy (#1B2B4D), rust (#B7410E), cream (#E8DCC4), warm white (#FAFAF8)
- Every table needs RLS. Every screen needs to pass the 3-tap rule.
- Migrations go in /supabase/migrations/. Edge functions go in /supabase/functions/. React components go in /src/pages/ or /src/components/.

The spec format must include:
1. Problem statement
2. Proposed solution
3. Any new database schema (SQL)
4. Any new edge functions (TypeScript pseudocode)
5. UI changes needed
6. Build checklist (checkboxes)

Be implementation-ready — a developer can build from this spec with no additional context.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Generate a complete implementation spec for this improvement:\n\nTitle: ${improvement.title}\nProblem: ${improvement.problem}\nEvidence: ${improvement.evidence}\nProposed solution: ${improvement.solution}\nPriority: ${improvement.priority}\nCategory: ${improvement.category}`
        }],
      }),
    })

    if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
    const data = await res.json()
    const specContent = data.content?.[0]?.text ?? ''

    return new Response(
      JSON.stringify({ success: true, spec_content: specContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('generate-improvement-spec error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
