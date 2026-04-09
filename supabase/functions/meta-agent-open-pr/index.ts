// meta-agent-open-pr — Phase M (M24)
// Opens a GitHub pull request for a given improvement spec.
// Flow: classify -> generate changes -> branch -> commit files -> open PR -> record.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  improvement_spec_id: z.string().uuid('improvement_spec_id must be a valid UUID'),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

interface GeneratedFile {
  path: string
  description: string
  new_content: string
}

interface GeneratedChanges {
  files: GeneratedFile[]
  sql_migrations?: string[]
}

// ─── Claude helper ─────────────────────────────────────────────────────────
async function callClaude(system: string, user: string, maxTokens = 2000): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

// ─── GitHub helper ─────────────────────────────────────────────────────────
async function githubRequest(
  endpoint: string,
  method = 'GET',
  body?: unknown,
): Promise<Response> {
  const token = Deno.env.get('GITHUB_TOKEN') ?? ''
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://api.github.com${endpoint}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'ak-ops-meta-agent',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

// ─── Utilities ─────────────────────────────────────────────────────────────
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function base64Encode(input: string): string {
  // Deno supports btoa, but content may contain non-ASCII — go via bytes.
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function tryParseJson<T>(text: string): T | null {
  try {
    // Extract first {...} block if the model wrapped it in code fences.
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'meta-agent-open-pr')
  if (!rl.allowed) return rateLimitResponse(rl)

  // Validate required secrets up front
  const missing: string[] = []
  if (!Deno.env.get('ANTHROPIC_API_KEY')) missing.push('ANTHROPIC_API_KEY')
  if (!Deno.env.get('GITHUB_TOKEN')) missing.push('GITHUB_TOKEN')
  if (!Deno.env.get('GITHUB_REPO')) missing.push('GITHUB_REPO')
  if (missing.length) {
    return new Response(
      JSON.stringify({ error: 'Missing required env vars', missing }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { improvement_spec_id } = parsedInput.data

    const supabase = createClient(supabaseUrl(), serviceKey())

    // Assemble context (per project rules — every agent calls this first)
    let baseSystemPrompt = 'You are the meta agent for AK Ops, working on improvement PRs.'
    try {
      const contextRes = await fetch(`${supabaseUrl()}/functions/v1/assemble-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey()}`,
        },
        body: JSON.stringify({
          user_id: 'system',
          user_role: 'admin',
          agent_name: 'meta-agent-open-pr',
          query: 'open improvement pull request',
        }),
      })
      if (contextRes.ok) {
        const ctx = await contextRes.json()
        if (ctx?.system_prompt) baseSystemPrompt = ctx.system_prompt
      }
    } catch (err) {
      console.warn('[meta-agent-open-pr] assemble-context failed:', err)
    }

    // Fetch the improvement spec row
    const { data: spec, error: specErr } = await supabase
      .from('improvement_specs')
      .select('*')
      .eq('id', improvement_spec_id)
      .single()
    if (specErr || !spec) {
      return new Response(
        JSON.stringify({ error: 'improvement_spec not found', details: specErr?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── Step 1: classify change category ──────────────────────────────
    const classifySystem = `${baseSystemPrompt}\n\nClassify this improvement as one of: 'data_insert' (adds new rows to config tables like checklist_template_items, compliance_items, labor_benchmarks, material_specs), 'data_update' (updates existing rows in config tables), 'copy_change' (only changes text in demo data files), or 'claude_code' (requires actual code changes, schema changes, new files, or logic changes). Return only the classification string.`
    const classifyRaw = await callClaude(classifySystem, JSON.stringify(spec), 50)
    const category = (classifyRaw.trim().toLowerCase().match(/(data_insert|data_update|copy_change|claude_code)/)?.[1] ?? 'claude_code') as
      | 'data_insert' | 'data_update' | 'copy_change' | 'claude_code'

    // Short-circuit for claude_code: mark the spec and return
    if (category === 'claude_code') {
      await supabase
        .from('improvement_specs')
        .update({
          adam_notes: 'This improvement requires Claude Code. Copy the spec and paste it to Claude Code to build.',
        })
        .eq('id', improvement_spec_id)

      return new Response(
        JSON.stringify({ needs_claude_code: true, change_category: category }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── Step 2: generate the actual changes ───────────────────────────
    const genSystem = `${baseSystemPrompt}\n\nYou are generating code changes for an AK Ops improvement. Generate the minimal, precise changes needed. For data_insert/data_update: generate SQL INSERT/UPDATE statements AND the equivalent migration file content. For copy_change: generate the exact file content changes. Format as JSON: { files: [{ path, description, new_content }], sql_migrations: string[] }`
    const genRaw = await callClaude(
      genSystem,
      `Improvement spec: ${JSON.stringify(spec)}\nCategory: ${category}`,
      4000,
    )
    const changes = tryParseJson<GeneratedChanges>(genRaw) ?? { files: [], sql_migrations: [] }
    if (!changes.files?.length && !changes.sql_migrations?.length) {
      throw new Error('Claude returned no files or migrations to apply')
    }

    // If we have sql_migrations but no files, synthesize a migration file
    if ((!changes.files || changes.files.length === 0) && changes.sql_migrations?.length) {
      const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
      changes.files = [{
        path: `supabase/migrations/${ts}_improvement_${slugify(spec.title ?? 'change')}.sql`,
        description: 'Auto-generated migration from improvement spec',
        new_content: changes.sql_migrations.join('\n\n'),
      }]
    }

    // ─── Step 3: create branch ─────────────────────────────────────────
    const repo = Deno.env.get('GITHUB_REPO') ?? ''
    const shortId = String(spec.id).replace(/-/g, '').slice(0, 8)
    const branchName = `improvement/${shortId}-${slugify(spec.title ?? 'change')}`

    const mainRefRes = await githubRequest(`/repos/${repo}/git/ref/heads/main`)
    if (!mainRefRes.ok) throw new Error(`Failed to fetch main ref: ${await mainRefRes.text()}`)
    const mainRef = await mainRefRes.json()
    const mainSha: string = mainRef?.object?.sha
    if (!mainSha) throw new Error('main SHA missing from GitHub response')

    const createRefRes = await githubRequest(`/repos/${repo}/git/refs`, 'POST', {
      ref: `refs/heads/${branchName}`,
      sha: mainSha,
    })
    if (!createRefRes.ok && createRefRes.status !== 422) {
      // 422 = ref already exists; tolerate so we can retry
      throw new Error(`Failed to create branch: ${await createRefRes.text()}`)
    }

    // ─── Step 4: commit each file ──────────────────────────────────────
    const committedFiles: { path: string; description: string }[] = []
    for (const file of changes.files) {
      // Check existing file
      let existingSha: string | undefined
      const getRes = await githubRequest(
        `/repos/${repo}/contents/${encodeURIComponent(file.path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branchName)}`
      )
      if (getRes.ok) {
        const existing = await getRes.json()
        if (existing && typeof existing.sha === 'string') existingSha = existing.sha
      }

      const putBody: Record<string, unknown> = {
        message: `[Auto] ${file.description || spec.title}`,
        content: base64Encode(file.new_content),
        branch: branchName,
      }
      if (existingSha) putBody.sha = existingSha

      const putRes = await githubRequest(
        `/repos/${repo}/contents/${encodeURIComponent(file.path).replace(/%2F/g, '/')}`,
        'PUT',
        putBody,
      )
      if (!putRes.ok) {
        throw new Error(`Failed to commit ${file.path}: ${await putRes.text()}`)
      }
      committedFiles.push({ path: file.path, description: file.description })
    }

    // ─── Step 5: generate PR body ──────────────────────────────────────
    const prBodySystem = `${baseSystemPrompt}\n\nWrite a clear, concise GitHub pull request description for a contractor (not a developer). Explain what problem this solves, what changed as bullet points, and how to verify. Under 200 words.`
    const prBody = await callClaude(
      prBodySystem,
      `Improvement spec: ${JSON.stringify(spec)}\nFiles changed: ${JSON.stringify(committedFiles)}`,
      800,
    )

    // ─── Step 6: open PR ───────────────────────────────────────────────
    const prTitle = `[Auto] ${spec.title ?? 'Improvement'}`
    const openPrRes = await githubRequest(`/repos/${repo}/pulls`, 'POST', {
      title: prTitle,
      body: prBody,
      head: branchName,
      base: 'main',
      draft: false,
    })
    if (!openPrRes.ok) throw new Error(`Failed to open PR: ${await openPrRes.text()}`)
    const pr = await openPrRes.json()
    const prNumber: number = pr?.number
    const prUrl: string = pr?.html_url

    // ─── Step 7: record in improvement_prs + update spec ───────────────
    await supabase.from('improvement_prs').insert({
      improvement_spec_id,
      pr_number: prNumber,
      pr_url: prUrl,
      pr_title: prTitle,
      pr_body: prBody,
      branch_name: branchName,
      files_changed: committedFiles,
      change_category: category,
      status: 'pr_opened',
    })

    await supabase
      .from('improvement_specs')
      .update({ status: 'in_progress' })
      .eq('id', improvement_spec_id)

    return new Response(
      JSON.stringify({
        pr_url: prUrl,
        pr_number: prNumber,
        needs_claude_code: false,
        change_category: category,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('meta-agent-open-pr error:', err)
    // Best-effort: record failure for observability
    try {
      const body = await req.clone().json().catch(() => ({}))
      if (body?.improvement_spec_id) {
        const supabase = createClient(supabaseUrl(), serviceKey())
        await supabase.from('improvement_prs').insert({
          improvement_spec_id: body.improvement_spec_id,
          pr_title: 'Auto-PR failed',
          pr_body: String(err),
          branch_name: 'n/a',
          files_changed: [],
          change_category: 'claude_code',
          status: 'failed',
          error_message: String(err),
        })
      }
    } catch {
      // ignore
    }
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
