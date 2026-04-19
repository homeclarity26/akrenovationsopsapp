// backup-database — Final Build
// On-demand backup of critical tables to Google Drive as a JSON archive.
// Distinct from backup-daily (scheduled nightly). This function is invokable
// by the meta-agent or admin UI for ad-hoc backups.
// Tables: companies, profiles, projects, leads, invoices, estimates,
//         proposals, expenses, time_entries, subcontractors

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { logUsage } from '../_shared/usage-logger.ts'

const CRITICAL_TABLES = [
  'companies',
  'profiles',
  'projects',
  'leads',
  'invoices',
  'estimates',
  'proposals',
  'expenses',
  'time_entries',
  'subcontractors',
]

const supabaseUrl = () => Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey  = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  const auth = await verifyAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  // Only admins can trigger backups
  if (auth.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
      status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const rl = await checkRateLimit(req, 'backup-database')
  if (!rl.allowed) return rateLimitResponse(rl)

  const supabase = createClient(supabaseUrl(), serviceKey())
  const startedAt = Date.now()
  const now = new Date()
  const fileName = `ak-ops-backup-${now.toISOString().replace(/[:.]/g, '-')}.json`

  try {
    // Export all critical tables
    const data: Record<string, unknown[]> = {}
    const tablesExported: string[] = []
    let totalRecords = 0

    for (const table of CRITICAL_TABLES) {
      try {
        const { data: rows, error } = await supabase.from(table).select('*')
        if (error) {
          console.warn(`Skipping ${table}: ${error.message}`)
          data[table] = []
          continue
        }
        data[table] = rows ?? []
        tablesExported.push(table)
        totalRecords += rows?.length ?? 0
      } catch (err) {
        console.warn(`Failed to export ${table}:`, err)
        data[table] = []
      }
    }

    const backup = {
      exported_at: now.toISOString(),
      type: 'on_demand',
      triggered_by: auth.user_id,
      tables_exported: tablesExported,
      total_records: totalRecords,
      data,
    }

    const jsonContent = JSON.stringify(backup)
    const fileSizeBytes = new TextEncoder().encode(jsonContent).length

    // Check if Google Drive is configured
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const backupFolderId = Deno.env.get('GOOGLE_DRIVE_BACKUP_FOLDER_ID')

    if (!serviceAccountJson || !backupFolderId) {
      const durationMs = Date.now() - startedAt
      // Log the backup even without Drive
      logUsage({
        service: 'supabase',
        agentName: 'backup-database',
        units: totalRecords,
        metadata: { file_name: fileName, tables: tablesExported, status: 'partial', drive_skipped: true },
      }).catch(() => {})

      return new Response(JSON.stringify({
        success: true,
        partial: true,
        reason: 'Drive upload skipped — GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_BACKUP_FOLDER_ID not configured',
        records_exported: totalRecords,
        tables_exported: tablesExported,
        file_size_bytes: fileSizeBytes,
        duration_ms: durationMs,
      }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Upload to Google Drive
    const accessToken = await getAccessToken()
    const boundary = '-------314159265358979323846'

    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: fileName, parents: [backupFolderId], mimeType: 'application/json' }),
      `--${boundary}`,
      'Content-Type: application/json',
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

    const durationMs = Date.now() - startedAt

    // Log to backup_logs
    await supabase.from('backup_logs').insert({
      type: 'on_demand',
      status: 'completed',
      file_name: fileName,
      file_size_bytes: Number(uploadData.size ?? fileSizeBytes),
      records_exported: totalRecords,
      duration_seconds: Math.round(durationMs / 1000),
      drive_url: uploadData.webViewLink,
      drive_file_id: uploadData.id,
      started_at: now.toISOString(),
      completed_at: new Date().toISOString(),
    }).catch(err => console.error('Failed to log backup:', err))

    // Log usage
    logUsage({
      service: 'supabase',
      agentName: 'backup-database',
      units: totalRecords,
      metadata: {
        file_name: fileName,
        tables: tablesExported,
        drive_file_id: uploadData.id,
        status: 'completed',
      },
    }).catch(() => {})

    return new Response(JSON.stringify({
      success: true,
      records_exported: totalRecords,
      tables_exported: tablesExported,
      file_size_bytes: Number(uploadData.size ?? fileSizeBytes),
      drive_url: uploadData.webViewLink,
      duration_ms: durationMs,
    }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('backup-database error:', err)

    // Log failure
    await supabase.from('backup_logs').insert({
      type: 'on_demand',
      status: 'failed',
      file_name: fileName,
      error_message: String(err),
      started_at: now.toISOString(),
      completed_at: new Date().toISOString(),
      duration_seconds: Math.round((Date.now() - startedAt) / 1000),
    }).catch(logErr => console.error('Failed to log backup failure:', logErr))

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
