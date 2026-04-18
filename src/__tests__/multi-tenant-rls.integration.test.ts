/**
 * Multi-tenant RLS enforcement tests.
 *
 * Authenticates as a user in Company A via anon client + password login, then
 * attempts to read/write data owned by Company B. Every attempt must either
 * return zero rows or be denied. Any leak fails the test.
 *
 * Skips cleanly when the required env vars aren't set (same pattern as
 * golden-path.integration.test.ts).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.GOLDEN_SUPABASE_URL
const anonKey = process.env.GOLDEN_SUPABASE_ANON_KEY
const serviceKey = process.env.GOLDEN_SUPABASE_SERVICE_KEY
const primaryCompany = process.env.GOLDEN_COMPANY_ID
const rivalCompany = process.env.GOLDEN_COMPANY_ID_RIVAL

const shouldRun = !!(url && anonKey && serviceKey && primaryCompany && rivalCompany)

describe.runIf(shouldRun)('Multi-tenant RLS — cross-company leakage checks', () => {
  // Use localhost fallbacks so createClient doesn't throw when env vars are
  // unset and describe.runIf skips the block.
  const authed = createClient(url ?? 'http://localhost', anonKey ?? 'test', {
    auth: { persistSession: false, storageKey: 'authed-primary' },
  })
  const svc = createClient(url ?? 'http://localhost', serviceKey ?? 'test', {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'svc' },
    global: { headers: { Authorization: `Bearer ${serviceKey ?? ''}`, apikey: serviceKey ?? '' } },
  })

  let rivalProjectId: string | null = null

  beforeAll(async () => {
    // Log in as primary admin
    const { data: signIn, error: signInErr } = await authed.auth.signInWithPassword({
      email: 'e2e-admin@akr-test.local',
      password: 'TestAdminPw!2026',
    })
    expect(signInErr).toBeNull()
    expect(signIn.user?.id).toBeTruthy()

    // Get rival project id via service role (truth)
    const { data: rivalProj } = await svc
      .from('projects')
      .select('id')
      .eq('company_id', rivalCompany)
      .limit(1)
      .maybeSingle()
    rivalProjectId = rivalProj?.id ?? null
    expect(rivalProjectId).toBeTruthy()
  })

  it('primary admin cannot see rival company in companies list', async () => {
    const { data } = await authed.from('companies').select('id').eq('id', rivalCompany!)
    expect(data ?? []).toHaveLength(0)
  })

  it('primary admin cannot list rival projects', async () => {
    const { data } = await authed.from('projects').select('id').eq('company_id', rivalCompany!)
    expect(data ?? []).toHaveLength(0)
  })

  it('primary admin cannot fetch a specific rival project by id', async () => {
    const { data } = await authed.from('projects').select('id').eq('id', rivalProjectId!)
    expect(data ?? []).toHaveLength(0)
  })

  it('primary admin cannot read rival profiles', async () => {
    const { data } = await authed.from('profiles').select('id').eq('company_id', rivalCompany!)
    expect(data ?? []).toHaveLength(0)
  })

  it('primary admin cannot read rival invoices', async () => {
    // Seed a rival invoice via service role so we have a concrete row to try to leak.
    const { data: ins } = await svc.from('invoices').insert({
      project_id: rivalProjectId, client_name: 'Rival Inv Client', amount_total: 5000, status: 'draft',
    }).select('id').maybeSingle()
    if (ins?.id) {
      const { data } = await authed.from('invoices').select('id').eq('id', ins.id)
      expect(data ?? []).toHaveLength(0)
      // cleanup
      await svc.from('invoices').delete().eq('id', ins.id)
    }
  })

  it('primary admin INSERT into rival project is rejected', async () => {
    // Insert a task scoped to rival project. RLS should reject via can_access_project check.
    const { error } = await authed.from('tasks').insert({
      project_id: rivalProjectId, title: 'Evil task', status: 'pending',
    })
    // Either an explicit RLS error, or the insert is silently blocked and error will be set.
    expect(error).toBeTruthy()
  })

  it('primary admin UPDATE of rival project rejected', async () => {
    const { data } = await authed
      .from('projects')
      .update({ title: 'HACKED' })
      .eq('id', rivalProjectId!)
      .select('id')
    // No rows should have been updated.
    expect(data ?? []).toHaveLength(0)

    // Verify truth: rival project title unchanged
    const { data: truth } = await svc.from('projects').select('title').eq('id', rivalProjectId!).single()
    expect(truth?.title).not.toBe('HACKED')
  })

  it('primary admin DELETE of rival project rejected', async () => {
    await authed.from('projects').delete().eq('id', rivalProjectId!)
    // Verify truth: rival project still exists
    const { data: truth } = await svc.from('projects').select('id').eq('id', rivalProjectId!).maybeSingle()
    expect(truth?.id).toBe(rivalProjectId)
  })
})
