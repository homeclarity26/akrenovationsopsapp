// sync-to-drive — Phase C
// Syncs a document (HTML or PDF) to Google Drive.
// Uses a service account — no per-user OAuth required.
// SETUP REQUIRED (one-time, before this function will work):
//   1. Create a Google Cloud project and enable the Google Drive API
//   2. Create a service account, download the JSON key
//   3. Add the key to Supabase secrets as GOOGLE_SERVICE_ACCOUNT_JSON
//   4. Create a root Google Drive folder, share it with the service account email as Editor
//   5. Add the folder ID to Supabase secrets as GOOGLE_DRIVE_ROOT_FOLDER_ID

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { z } from 'npm:zod@3'
import { getCorsHeaders } from '../_shared/cors.ts'

const InputSchema = z.object({
  html_content: z.string().optional(),
  file_name: z.string(),
  document_type: z.string(),
  document_id: z.string(),
  project_id: z.string().uuid('project_id must be a valid UUID').optional(),
  replace_existing: z.boolean().optional(),
})

interface SyncToDriveInput {
  html_content?: string    // HTML string to upload
  file_name: string        // e.g. "Invoice 002 — Rough-In Milestone.pdf"
  document_type: string
  document_id: string
  project_id?: string
  replace_existing?: boolean
}

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// ── Google Drive auth via service account ────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')

  const serviceAccount = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)

  // Build JWT for service account
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const headerB64  = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signingInput = `${headerB64}.${payloadB64}`

  // Import private key and sign
  const privateKeyPem = serviceAccount.private_key as string
  const pemContent = privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----\n?/, '').replace(/\n?-----END PRIVATE KEY-----\n?/, '').replace(/\n/g, '')
  const keyData = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${sig}`

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`Failed to get Drive token: ${JSON.stringify(tokenData)}`)
  return tokenData.access_token
}

// ── Folder management ────────────────────────────────────────────────────────

async function ensureFolder(name: string, parentId: string, accessToken: string): Promise<string> {
  // Check if folder exists
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const searchData = await searchRes.json()
  if (searchData.files?.length > 0) return searchData.files[0].id

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  const created = await createRes.json()
  return created.id
}

async function ensureFolderPath(
  documentType: string,
  projectId: string | undefined,
  accessToken: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')
  if (!rootId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID not set')

  let projectFolder = rootId

  if (projectId) {
    const { data: project } = await supabase.from('projects').select('client_name, project_type, created_at').eq('id', projectId).single()
    if (project) {
      const year = new Date(project.created_at).getFullYear()
      const lastName = project.client_name.split(' ').pop() ?? project.client_name
      const projectType = project.project_type.charAt(0).toUpperCase() + project.project_type.slice(1)
      const folderName = `${lastName} ${projectType} ${year}`
      const projectsRootFolder = await ensureFolder('Projects', rootId, accessToken)
      projectFolder = await ensureFolder(folderName, projectsRootFolder, accessToken)
    }
  }

  const financialsFolder = () => ensureFolder('Financials', rootId, accessToken)

  switch (documentType) {
    case 'proposal':
    case 'contract':
      return projectFolder
    case 'invoice':
      return ensureFolder('Invoices', projectFolder, accessToken)
    case 'change_order':
      return ensureFolder('Change Orders', projectFolder, accessToken)
    case 'daily_log':
      return ensureFolder('Daily Logs', projectFolder, accessToken)
    case 'sub_quote':
      return ensureFolder('Sub Quotes', projectFolder, accessToken)
    case 'pl_report':
      return ensureFolder('P&L Reports', await financialsFolder(), accessToken)
    case 'bonus_summary':
      return ensureFolder('Bonus Records', await financialsFolder(), accessToken)
    default:
      return projectFolder
  }
}

// ── Main serve ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'sync-to-drive')
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const rawBody = await req.json().catch(() => ({}))
    const parsedInput = InputSchema.safeParse(rawBody)
    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsedInput.error.flatten() }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    }
    const { html_content, file_name, document_type, document_id, project_id, replace_existing = true } = parsedInput.data

    // Check if Google Drive is configured
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')
    if (!serviceAccountJson || !rootFolderId) {
      console.log('Google Drive not configured — skipping sync. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_ROOT_FOLDER_ID in Supabase secrets.')
      return new Response(JSON.stringify({
        success: false,
        skipped: true,
        reason: 'Google Drive not configured. Add GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_ROOT_FOLDER_ID to Supabase secrets.'
      }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl(), serviceKey())
    const accessToken = await getAccessToken()

    // Determine target folder
    const folderId = await ensureFolderPath(document_type, project_id, accessToken, supabase)

    // If replace_existing, find and delete existing file with same name
    if (replace_existing) {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${file_name}' and '${folderId}' in parents and trashed=false`)}&fields=files(id)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const searchData = await searchRes.json()
      for (const existingFile of searchData.files ?? []) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      }
    }

    // Upload the file
    // Use HTML content as the file body (Google Drive can store it as PDF via conversion, or as HTML)
    const fileContent = html_content ?? `<!-- ${document_type} ${document_id} -->`
    const boundary = '-------314159265358979323846'
    const contentType = 'text/html' // Store as HTML (renderable in Drive)

    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: file_name.replace('.pdf', '.html'), parents: [folderId], mimeType: contentType }),
      `--${boundary}`,
      `Content-Type: ${contentType}`,
      '',
      fileContent,
      `--${boundary}--`,
    ].join('\r\n')

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartBody,
    })
    const uploadData = await uploadRes.json()

    if (!uploadData.id) throw new Error(`Drive upload failed: ${JSON.stringify(uploadData)}`)

    const driveUrl = uploadData.webViewLink

    // Save drive_url back to the source record
    const updateMap: Record<string, string> = {
      invoice: 'invoices', proposal: 'proposals', contract: 'contracts',
      change_order: 'change_orders', daily_log: 'daily_logs',
    }
    const table = updateMap[document_type]
    if (table) {
      await supabase.from(table).update({ drive_url: driveUrl }).eq('id', document_id)
    }

    return new Response(
      JSON.stringify({ success: true, drive_url: driveUrl, file_id: uploadData.id }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('sync-to-drive error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  }
})
