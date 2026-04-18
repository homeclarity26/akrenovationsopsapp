#!/usr/bin/env node
/**
 * Extended seed for deep Playwright coverage.
 * Assigns the e2e-employee user to the seed project so employee-home/notes/time-clock
 * have real context, and creates a few invoices + messages for the client flow.
 * Idempotent.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const COMPANY_ID = process.env.SUPABASE_COMPANY_ID
if (!URL || !KEY || !COMPANY_ID) throw new Error('missing env')

const sb = createClient(URL, KEY, { auth: { persistSession: false } })

async function getUserId(email) {
  const { data } = await sb.from('profiles').select('id').eq('email', email).maybeSingle()
  return data?.id ?? null
}

const employeeId = await getUserId('e2e-employee@akr-test.local')
const clientId = await getUserId('e2e-client@akr-test.local')

// Get first project for the primary company.
const { data: project } = await sb.from('projects').select('id').eq('company_id', COMPANY_ID).limit(1).maybeSingle()
if (!project) throw new Error('No project for company — run seed-scratch-users.mjs first')
console.log(`project: ${project.id}`)

// Set client_user_id on project so client sees it
if (clientId) {
  await sb.from('projects').update({ client_user_id: clientId }).eq('id', project.id)
  console.log(`client linked to project: ${clientId}`)
}

// Assign employee to project
if (employeeId) {
  const { data: existing } = await sb.from('project_assignments').select('id').eq('project_id', project.id).eq('employee_id', employeeId).maybeSingle()
  if (!existing) {
    await sb.from('project_assignments').insert({
      project_id: project.id, employee_id: employeeId, role: 'crew', active: true,
    })
  }
  console.log(`employee assigned to project: ${employeeId}`)
}

// Seed an invoice
const { data: invs } = await sb.from('invoices').select('id').eq('project_id', project.id).limit(1)
if (!invs || invs.length === 0) {
  const { error } = await sb.from('invoices').insert({
    project_id: project.id,
    invoice_number: 'E2E-0001',
    title: 'E2E Seed Invoice',
    subtotal: 5000,
    total: 5000,
    status: 'sent',
    due_date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
  })
  if (error) console.warn('invoice seed:', error.message)
  else console.log('invoice seeded')
}

// Seed a message
const { data: msgs } = await sb.from('messages').select('id').eq('project_id', project.id).limit(1)
if (!msgs || msgs.length === 0) {
  const { error } = await sb.from('messages').insert({
    project_id: project.id,
    sender_id: employeeId ?? clientId ?? null,
    message: 'Seed message for E2E testing',
    channel: 'in_app',
  })
  if (error) console.warn('message seed:', error.message)
  else console.log('message seeded')
}

console.log('deep seed complete')
