// backup-storage-manifest — Phase M4
// Weekly storage manifest runner. Enumerates every file in every Supabase
// Storage bucket and uploads the resulting manifest JSON to Google Drive.
// Scheduled weekly via pg_cron (see m5_backup_crons).
//
// SETUP: Requires GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_BACKUP_FOLDER_ID
// in Supabase secrets. If missing, the manifest is still logged with
// status='partial' and the Drive upload is skipped.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const LIST_PAGE_SIZE = 1000

interface ManifestFile {
  name: string
  size: number
  updated_at: string | null
}

interface ManifestBucket {
  name: string
  file_count: number
  total_bytes: number
  files: ManifestFile[]
}

// ── assemble-context (project rule: every agent calls this first) ────────────

async function callAssembleContext(agentName: string, query: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/assemble-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        user_id: 'system', user_role: 'admin', agent_name: agentName,
        capability_required: 'backup_data', query,
      }),
    })
    if (!res.ok) return null
    const ctx = await res.json()
    return ctx.denied ? null : (ctx.system_prompt ?? null)
  } catch { return null }
}

// ── ISO week number (for file name) ──────────────────────────────────────────

function isoWeekLabel(d: Date): string {
  // ISO 8601 week calculation
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// ── Google Drive auth (service account JWT) ──────────────────────────────────

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

// ── Drive folder + upload helpers ────────────────────────────────────────────

async function ensureFolder(name: string, parentId: string, accessToken: string): Promise<string> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const searchData = await searchRes.json()
  if (searchData.files?.length > 0) return searchData.files[0].id

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  const created = await createRes.json()
  return created.id
}

interface DriveUploadResult {
  file_id: string
  drive_url: string
  file_size_bytes: number
}

async function uploadJsonToDrive(
  fileName: string,
  jsonContent: string,
  folderId: string,
  accessToken: string,
): Promise<DriveUploadResult> {
  const boundary = '-------314159265358979323846'
  const contentType = 'application/json'

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: fileName, parents: [folderId], mimeType: contentType }),
    `--${boundary}`,
    `Content-Type: ${contentType}`,
    '',
    jsonContent,
    `--${boundary}--`,
  ].join('\r\n')

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartBody,
    },
  )
  const uploadData = await uploadRes.json()
  if (!uploadData.id) throw new Error(`Drive upload failed: ${JSON.stringify(uploadData)}`)

  return {
    file_id: uploadData.id,
    drive_url: uploadData.webViewLink,
    file_size_bytes: Number(uploadData.size ?? new TextEncoder().encode(jsonContent).length),
  }
}

// ── List every file in a bucket (recursive, paginated) ──────────────────────

async function listBucketFiles(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  prefix = '',
): Promise<ManifestFile[]> {
  const out: ManifestFile[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error || !data) break

    for (const entry of data) {
      // A folder has id === null in Supabase storage list responses
      // deno-lint-ignore no-explicit-any
      const e = entry as any
      const fullPath = prefix ? `${prefix}/${e.name}` : e.name
      if (!e.id && e.name && !e.metadata) {
        // Folder — recurse
        const nested = await listBucketFiles(supabase, bucket, fullPath)
        out.push(...nested)
      } else {
        out.push({
          name: fullPath,
          size: Number(e.metadata?.size ?? 0),
          updated_at: e.updated_at ?? e.created_at ?? null,
        })
      }
    }

    if (data.length < LIST_PAGE_SIZE) break
    offset += LIST_PAGE_SIZE
  }

  return out
}

// ── Main serve ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  // JWT auth check
  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }

  const rl = await checkRateLimit(req, 'backup-storage-manifest')
  if (!rl.allowed) return rateLimitResponse(rl)

  // Project rule: every agent calls assemble-context first
  await callAssembleContext('backup-storage-manifest', 'Run weekly storage manifest backup')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const startedAt = Date.now()
  const weekLabel = isoWeekLabel(new Date())
  const fileName = `ak-ops-storage-manifest-${weekLabel}.json`

  const { data: logRow, error: logErr } = await supabase
    .from('backup_logs')
    .insert({
      type: 'storage_manifest',
      status: 'started',
      file_name: fileName,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (logErr) {
    console.error('Failed to create backup_logs row:', logErr)
    return new Response(JSON.stringify({ error: 'Failed to create backup log', details: logErr }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const backupLogId = logRow.id

  try {
    // Enumerate all buckets
    const { data: bucketList, error: bucketErr } = await supabase.storage.listBuckets()
    if (bucketErr) throw new Error(`listBuckets failed: ${bucketErr.message}`)

    const bucketNames = new Set<string>((bucketList ?? []).map(b => b.name))
    // Ensure the expected core buckets are included even if listBuckets missed them
    for (const core of ['documents', 'project-files', 'project-photos']) {
      bucketNames.add(core)
    }

    const buckets: ManifestBucket[] = []
    let totalFiles = 0
    let totalBytes = 0

    for (const name of bucketNames) {
      try {
        const files = await listBucketFiles(supabase, name)
        const bucketBytes = files.reduce((acc, f) => acc + (f.size || 0), 0)
        buckets.push({
          name,
          file_count: files.length,
          total_bytes: bucketBytes,
          files,
        })
        totalFiles += files.length
        totalBytes += bucketBytes
      } catch (err) {
        console.warn(`Failed to list bucket ${name}:`, err)
        buckets.push({ name, file_count: 0, total_bytes: 0, files: [] })
      }
    }

    const manifest = {
      exported_at: new Date().toISOString(),
      week: weekLabel,
      total_files: totalFiles,
      total_bytes: totalBytes,
      buckets,
    }

    const jsonContent = JSON.stringify(manifest)
    const fileSizeBytes = new TextEncoder().encode(jsonContent).length

    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const backupFolderId = Deno.env.get('GOOGLE_DRIVE_BACKUP_FOLDER_ID')

    if (!serviceAccountJson || !backupFolderId) {
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
      await supabase.from('backup_logs').update({
        status: 'partial',
        file_size_bytes: fileSizeBytes,
        records_exported: totalFiles,
        duration_seconds: durationSeconds,
        completed_at: new Date().toISOString(),
        error_message: 'Drive upload skipped: GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_BACKUP_FOLDER_ID not set',
      }).eq('id', backupLogId)

      return new Response(JSON.stringify({
        success: true,
        partial: true,
        reason: 'Drive upload skipped — secrets not configured',
        total_files: totalFiles,
        total_bytes: totalBytes,
      }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Upload to Drive (in the Weekly subfolder)
    const accessToken = await getAccessToken()
    const weeklyFolderId = await ensureFolder('Weekly', backupFolderId, accessToken)
    const upload = await uploadJsonToDrive(fileName, jsonContent, weeklyFolderId, accessToken)

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000)

    await supabase.from('backup_logs').update({
      status: 'completed',
      file_size_bytes: upload.file_size_bytes,
      records_exported: totalFiles,
      duration_seconds: durationSeconds,
      drive_url: upload.drive_url,
      drive_file_id: upload.file_id,
      completed_at: new Date().toISOString(),
    }).eq('id', backupLogId)

    return new Response(JSON.stringify({
      success: true,
      total_files: totalFiles,
      total_bytes: totalBytes,
      file_size_bytes: upload.file_size_bytes,
      drive_url: upload.drive_url,
      duration_seconds: durationSeconds,
    }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('backup-storage-manifest error:', err)

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
    await supabase.from('backup_logs').update({
      status: 'failed',
      error_message: errorMessage,
      duration_seconds: durationSeconds,
      completed_at: new Date().toISOString(),
    }).eq('id', backupLogId)

    try {
      await supabase.from('agent_outputs').insert({
        agent_name: 'backup-storage-manifest',
        output_type: 'alert',
        title: 'Weekly storage manifest failed',
        content: `The weekly storage manifest backup failed: ${errorMessage}`,
        metadata: { backup_log_id: backupLogId, error: errorMessage },
        requires_approval: false,
      })
    } catch (alertErr) {
      console.error('Failed to write alert:', alertErr)
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
