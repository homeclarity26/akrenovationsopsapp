// sync-google-drive — Final Build
// Syncs project files to Google Drive with organized folder structure:
//   /Company Name/Project Name/Photos, Documents, Invoices
// Uses GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_ROOT_FOLDER_ID.
// Distinct from sync-to-drive (single document upload). This function
// syncs an entire project's file structure.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logUsage } from '../_shared/usage-logger.ts'
import { z } from 'npm:zod@3'

const InputSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
})

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const SUBFOLDER_NAMES = ['Photos', 'Documents', 'Invoices', 'Proposals', 'Change Orders', 'Daily Logs']

// Google Drive auth via service account JWT
async function getAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')

  const serviceAccount = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signingInput = `${headerB64}.${payloadB64}`

  const privateKeyPem = serviceAccount.private_key as string
  const pemContent = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
    .replace(/\n?-----END PRIVATE KEY-----\n?/, '')
    .replace(/\n/g, '')
  const keyData = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sigBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput)
  )
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${sig}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`Failed to get Drive token: ${JSON.stringify(tokenData)}`)
  return tokenData.access_token
}

async function ensureFolder(name: string, parentId: string, accessToken: string): Promise<string> {
  // Check if folder already exists
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
  if (!created.id) throw new Error(`Failed to create folder "${name}": ${JSON.stringify(created)}`)
  return created.id
}

async function uploadFileToDrive(
  fileName: string,
  fileContent: Uint8Array,
  contentType: string,
  folderId: string,
  accessToken: string,
): Promise<{ id: string; webViewLink: string }> {
  const boundary = '-------314159265358979323846'

  // Build multipart body manually for binary data
  const metadataPart = JSON.stringify({ name: fileName, parents: [folderId] })
  const preamble = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
  )
  const epilogue = new TextEncoder().encode(`\r\n--${boundary}--`)

  const body = new Uint8Array(preamble.length + fileContent.length + epilogue.length)
  body.set(preamble, 0)
  body.set(fileContent, preamble.length)
  body.set(epilogue, preamble.length + fileContent.length)

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    },
  )
  const uploadData = await uploadRes.json()
  if (!uploadData.id) throw new Error(`Drive upload failed: ${JSON.stringify(uploadData)}`)
  return { id: uploadData.id, webViewLink: uploadData.webViewLink }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'sync-google-drive')
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
    const { project_id } = parsedInput.data

    // Check Drive configuration
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')
    if (!serviceAccountJson || !rootFolderId) {
      return new Response(JSON.stringify({
        success: false,
        skipped: true,
        reason: 'Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_ROOT_FOLDER_ID.',
      }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl(), serviceKey())

    // Get project data
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, title, client_name, project_type, company_id, created_at')
      .eq('id', project_id)
      .single()
    if (projErr || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Get company name
    let companyName = 'AK Renovations'
    if (project.company_id) {
      const { data: comp } = await supabase
        .from('companies')
        .select('name')
        .eq('id', project.company_id)
        .single()
      if (comp) companyName = comp.name
    }

    const accessToken = await getAccessToken()

    // Create folder structure: /Company Name/Project Name/subfolders
    const companyFolderId = await ensureFolder(companyName, rootFolderId, accessToken)

    const year = new Date(project.created_at).getFullYear()
    const lastName = (project.client_name ?? 'Unknown').split(' ').pop() ?? 'Unknown'
    const projectType = (project.project_type ?? 'Project').charAt(0).toUpperCase() + (project.project_type ?? 'project').slice(1)
    const projectFolderName = `${lastName} ${projectType} ${year}`
    const projectFolderId = await ensureFolder(projectFolderName, companyFolderId, accessToken)

    // Create all subfolders
    const subfolderIds: Record<string, string> = {}
    for (const name of SUBFOLDER_NAMES) {
      subfolderIds[name] = await ensureFolder(name, projectFolderId, accessToken)
    }

    // Sync project photos from Supabase storage
    let photosSynced = 0
    try {
      const { data: photos } = await supabase.storage
        .from('project-photos')
        .list(`${project_id}`, { limit: 100 })

      for (const photo of photos ?? []) {
        const { data: fileData } = await supabase.storage
          .from('project-photos')
          .download(`${project_id}/${photo.name}`)

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer()
          const contentType = photo.metadata?.mimetype ?? 'image/jpeg'
          await uploadFileToDrive(
            photo.name,
            new Uint8Array(arrayBuffer),
            contentType,
            subfolderIds['Photos'],
            accessToken,
          )
          photosSynced++
        }
      }
    } catch (err) {
      console.warn('Photo sync warning:', err)
    }

    // Sync invoices (get drive URLs or create placeholders)
    let invoicesSynced = 0
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, title, status, balance_due')
      .eq('project_id', project_id)

    for (const inv of invoices ?? []) {
      // Create a simple text file as a reference for each invoice
      const content = new TextEncoder().encode(
        `Invoice: ${inv.title}\nStatus: ${inv.status}\nBalance Due: $${inv.balance_due}\nID: ${inv.id}`
      )
      await uploadFileToDrive(
        `${inv.title ?? `Invoice ${inv.id.slice(0, 8)}`}.txt`,
        content,
        'text/plain',
        subfolderIds['Invoices'],
        accessToken,
      )
      invoicesSynced++
    }

    // Log usage
    logUsage({
      service: 'other',
      agentName: 'sync-google-drive',
      units: photosSynced + invoicesSynced,
      metadata: {
        project_id,
        photos_synced: photosSynced,
        invoices_synced: invoicesSynced,
        folders_created: SUBFOLDER_NAMES,
      },
    }).catch(() => {})

    return new Response(JSON.stringify({
      success: true,
      project_id,
      project_folder: projectFolderName,
      subfolders_created: SUBFOLDER_NAMES,
      photos_synced: photosSynced,
      invoices_synced: invoicesSynced,
    }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('sync-google-drive error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
