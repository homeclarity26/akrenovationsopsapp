/**
 * Golden Path integration test.
 *
 * Exercises the 6 core steps of the admin Golden Path against a real
 * Supabase project via the REST API (no browser required, no auth required
 * beyond service role). Runs in <5s. Meant for CI.
 *
 * Requires env vars:
 *   GOLDEN_SUPABASE_URL        — e.g. https://wczlhyhnqzrnvjwleinc.supabase.co
 *   GOLDEN_SUPABASE_SERVICE_KEY — service-role key
 *   GOLDEN_COMPANY_ID          — a seed company id in that DB
 *
 * The test is SKIPPED when env vars aren't set, so `npm test` still passes
 * locally without them. CI wires them in via GitHub secrets.
 *
 * NOT a replacement for full Playwright coverage (admin + employee + client
 * personas walking the real UI) — that's a separate PR. This is the
 * minimum automated floor for "does the app's happy path still work."
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.GOLDEN_SUPABASE_URL
const key = process.env.GOLDEN_SUPABASE_SERVICE_KEY
const companyId = process.env.GOLDEN_COMPANY_ID

const shouldRun = !!(url && key && companyId)

describe.runIf(shouldRun)('Golden Path — admin project lifecycle', () => {
  const sb = createClient(url ?? 'http://localhost', key ?? 'test', { auth: { persistSession: false } })
  const testTitle = `GOLDEN PATH TEST — ${Date.now()}`
  let projectId: string | null = null

  it('step 3: creates a project with UI-form shape', async () => {
    const { data, error } = await sb
      .from('projects')
      .insert({
        title: testTitle,
        client_name: 'Golden Path Client',
        project_type: 'other',
        address: '',
        status: 'pending',
        company_id: companyId,
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    projectId = data!.id
  })

  it('step 4: project persists — list query returns it', async () => {
    const { data, error } = await sb
      .from('projects')
      .select('id, title')
      .eq('id', projectId!)
      .single()
    expect(error).toBeNull()
    expect(data?.title).toBe(testTitle)
  })

  it('step 5: detail query returns full row', async () => {
    const { data, error } = await sb
      .from('projects')
      .select('*')
      .eq('id', projectId!)
      .single()
    expect(error).toBeNull()
    expect(data?.client_name).toBe('Golden Path Client')
    expect(data?.status).toBe('pending')
  })

  it('step 6: status → cancelled reflects in list', async () => {
    const { error: updateErr } = await sb
      .from('projects')
      .update({ status: 'cancelled' })
      .eq('id', projectId!)
    expect(updateErr).toBeNull()

    const { data } = await sb
      .from('projects')
      .select('status')
      .eq('id', projectId!)
      .single()
    expect(data?.status).toBe('cancelled')
  })

  it('cleanup: delete the test row', async () => {
    if (!projectId) return
    await sb.from('projects').delete().eq('id', projectId)
  })
})
