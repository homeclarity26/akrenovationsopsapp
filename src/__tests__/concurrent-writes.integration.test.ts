/**
 * Concurrency smoke — two authenticated admin clients UPDATE the same project
 * row at the same time. Postgres MVCC + Supabase client retries should land
 * both updates cleanly without data corruption.
 *
 * This isn't a stress test. It's a "does the optimistic-write pattern the app
 * uses actually tolerate contention?" check. Real load testing is separate.
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.GOLDEN_SUPABASE_URL
const anonKey = process.env.GOLDEN_SUPABASE_ANON_KEY
const serviceKey = process.env.GOLDEN_SUPABASE_SERVICE_KEY
const companyId = process.env.GOLDEN_COMPANY_ID

const shouldRun = !!(url && anonKey && serviceKey && companyId)

describe.runIf(shouldRun)('Concurrent writes — two clients UPDATE the same row', () => {
  const svc = createClient(url ?? 'http://localhost', serviceKey ?? 'test', {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'svc-cc' },
    global: { headers: { Authorization: `Bearer ${serviceKey ?? ''}`, apikey: serviceKey ?? '' } },
  })

  // Fetch a user JWT via REST (no GoTrue state sharing) and use it to build
  // two independent clients that each carry the token in their default headers.
  async function buildAuthedClient(email: string, password: string): Promise<SupabaseClient> {
    const tokRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': anonKey ?? '' },
      body: JSON.stringify({ email, password }),
    })
    const tok = await tokRes.json()
    if (!tok.access_token) throw new Error(`sign in failed for ${email}: ${JSON.stringify(tok)}`)
    return createClient(url ?? '', anonKey ?? '', {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: `cc-${email}-${Math.random()}` },
      global: { headers: { Authorization: `Bearer ${tok.access_token}` } },
    })
  }

  it('two admins updating the same project do not lose data', async () => {
    const email = 'e2e-admin@akr-test.local'
    const password = 'TestAdminPw!2026'
    const tok = async () => {
      const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey ?? '' },
        body: JSON.stringify({ email, password }),
      })
      return (await r.json()).access_token
    }
    const [tA, tB] = [await tok(), await tok()]

    // Seed a fresh project via service role.
    const { data: project, error: seedErr } = await svc.from('projects').insert({
      title: `CONCURRENCY ${Date.now()}`,
      client_name: 'Concurrency Client',
      project_type: 'other',
      address: '1 Concurrency Way',
      status: 'pending',
      company_id: companyId,
    }).select('id').single()
    expect(seedErr).toBeNull()
    const projectId = project!.id

    const patch = (jwt: string, title: string) => fetch(`${url}/rest/v1/projects?id=eq.${projectId}`, {
      method: 'PATCH',
      headers: {
        'apikey': anonKey ?? '',
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ title }),
    }).then(r => ({ status: r.status }))

    const [rA, rB] = await Promise.all([patch(tA, 'From-A'), patch(tB, 'From-B')])
    // Both must succeed — RLS allowed the write for both.
    expect(rA.status, `adminA patch status`).toBeGreaterThanOrEqual(200)
    expect(rA.status).toBeLessThan(300)
    expect(rB.status, `adminB patch status`).toBeGreaterThanOrEqual(200)
    expect(rB.status).toBeLessThan(300)

    // Final title is whichever committed last.
    const { data: truth } = await svc.from('projects').select('title').eq('id', projectId).single()
    expect(['From-A', 'From-B']).toContain(truth?.title)

    // Cleanup
    await svc.from('projects').delete().eq('id', projectId)
  })

  it('two admins INSERTing projects with same title both succeed', async () => {
    const email = 'e2e-admin@akr-test.local'
    const password = 'TestAdminPw!2026'
    // Get two independent JWTs.
    const tok = async () => {
      const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey ?? '' },
        body: JSON.stringify({ email, password }),
      })
      return (await r.json()).access_token
    }
    const [tA, tB] = [await tok(), await tok()]
    expect(tA).toBeTruthy(); expect(tB).toBeTruthy()

    const title = `DUP-${Date.now()}`
    const payload = {
      title, client_name: 'X', project_type: 'other', address: '2 way', status: 'pending', company_id: companyId,
    }

    // Use raw fetch with return=minimal (matches the UI pattern in
    // ProjectsPage.tsx — INSERT without RETURNING). PostgREST's
    // RETURNING clause re-evaluates RLS in a way that doesn't reflect how
    // supabase-js inserts from the app in practice.
    const postProject = (jwt: string) => fetch(`${url}/rest/v1/projects`, {
      method: 'POST',
      headers: {
        'apikey': anonKey ?? '',
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    }).then(r => ({ status: r.status }))

    const [rA, rB] = await Promise.all([postProject(tA), postProject(tB)])
    expect(rA.status, `adminA status`).toBe(201)
    expect(rB.status, `adminB status`).toBe(201)

    // Both rows should exist.
    const { data: rows } = await svc.from('projects').select('id').eq('title', title)
    expect(rows?.length).toBe(2)

    // Cleanup
    await svc.from('projects').delete().eq('title', title)
  })
})
