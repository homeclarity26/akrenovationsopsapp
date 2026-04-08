// backup-daily — Phase M3
// Daily JSON backup runner. Exports every critical table to a single JSON file
// and uploads to Google Drive. Scheduled nightly via pg_cron (see m5_backup_crons).
//
// SETUP: Requires GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_BACKUP_FOLDER_ID
// in Supabase secrets. If missing, the backup is still logged with status='partial'
// and the Drive upload is skipped — the function never throws on missing secrets.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_VERSION = '1.0.0'
const RETENTION_DAYS = 30

const TABLES = [
  'profiles', 'leads', 'lead_activities',
  'projects', 'project_phases', 'project_assignments',
  'estimates', 'proposals', 'contracts',
  'invoices', 'expenses', 'purchase_orders',
  'time_entries', 'work_type_rates',
  'payroll_records', 'pay_periods', 'compensation_components', 'benefits_enrollment',
  'payroll_adjustments', 'mileage_logs', 'payroll_ytd',
  'budget_trades', 'budget_quotes', 'budget_settings',
  'sub_scopes', 'sub_contracts', 'contract_templates',
  'compliance_items', 'compliance_notes',
  'client_selections', 'change_orders',
  'punch_list_items', 'warranty_claims',
  'subcontractors', 'project_subcontractors', 'suppliers',
  'estimate_templates', 'estimate_line_items', 'estimate_template_actuals', 'labor_benchmarks',
  'material_specs', 'tool_requests',
  'checklist_templates', 'checklist_template_items', 'checklist_instances', 'checklist_instance_items',
  'communication_log', 'messages', 'client_progress_updates',
  'improvement_specs',
  'agent_history', 'operational_memory', 'business_context', 'learning_insights',
]

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

// ── Drive upload / delete helpers ────────────────────────────────────────────

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

async function deleteDriveFile(fileId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

// ── Main serve ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rl = await checkRateLimit(req, 'backup-daily')
  if (!rl.allowed) return rateLimitResponse(rl)

  // Project rule: every agent calls assemble-context first
  await callAssembleContext('backup-daily', 'Run daily JSON backup of all critical tables')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const startedAt = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const fileName = `ak-ops-backup-${today}.json`

  // Start a backup_logs row
  const { data: logRow, error: logErr } = await supabase
    .from('backup_logs')
    .insert({
      type: 'daily_json',
      status: 'started',
      file_name: fileName,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (logErr) {
    console.error('Failed to create backup_logs row:', logErr)
    return new Response(JSON.stringify({ error: 'Failed to create backup log', details: logErr }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const backupLogId = logRow.id

  try {
    // Export all tables
    const data: Record<string, unknown[]> = {}
    const tablesExported: string[] = []
    let totalRecords = 0

    for (const table of TABLES) {
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

    // Build metadata wrapper
    const backup = {
      exported_at: new Date().toISOString(),
      app_version: APP_VERSION,
      tables_exported: tablesExported,
      total_records: totalRecords,
      data,
    }

    const jsonContent = JSON.stringify(backup)
    const fileSizeBytes = new TextEncoder().encode(jsonContent).length

    // Check Drive configuration
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const backupFolderId = Deno.env.get('GOOGLE_DRIVE_BACKUP_FOLDER_ID')

    if (!serviceAccountJson || !backupFolderId) {
      // Graceful degrade — log as partial, skip Drive upload
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
      await supabase.from('backup_logs').update({
        status: 'partial',
        file_size_bytes: fileSizeBytes,
        records_exported: totalRecords,
        duration_seconds: durationSeconds,
        completed_at: new Date().toISOString(),
        error_message: 'Drive upload skipped: GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_BACKUP_FOLDER_ID not set',
      }).eq('id', backupLogId)

      return new Response(JSON.stringify({
        success: true,
        partial: true,
        reason: 'Drive upload skipped — secrets not configured',
        records_exported: totalRecords,
        file_size_bytes: fileSizeBytes,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Upload to Drive
    const accessToken = await getAccessToken()
    const upload = await uploadJsonToDrive(fileName, jsonContent, backupFolderId, accessToken)

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000)

    // Mark completed
    await supabase.from('backup_logs').update({
      status: 'completed',
      file_size_bytes: upload.file_size_bytes,
      records_exported: totalRecords,
      duration_seconds: durationSeconds,
      drive_url: upload.drive_url,
      drive_file_id: upload.file_id,
      completed_at: new Date().toISOString(),
    }).eq('id', backupLogId)

    // Clean up old backups (best-effort)
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data: oldLogs } = await supabase
      .from('backup_logs')
      .select('id, drive_file_id')
      .eq('type', 'daily_json')
      .lt('created_at', cutoff)
      .not('drive_file_id', 'is', null)

    let deletedCount = 0
    for (const old of oldLogs ?? []) {
      if (!old.drive_file_id) continue
      const ok = await deleteDriveFile(old.drive_file_id, accessToken)
      if (ok) {
        deletedCount++
        await supabase.from('backup_logs').update({ drive_file_id: null }).eq('id', old.id)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      records_exported: totalRecords,
      file_size_bytes: upload.file_size_bytes,
      drive_url: upload.drive_url,
      duration_seconds: durationSeconds,
      old_backups_cleaned: deletedCount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('backup-daily error:', err)

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
    await supabase.from('backup_logs').update({
      status: 'failed',
      error_message: errorMessage,
      duration_seconds: durationSeconds,
      completed_at: new Date().toISOString(),
    }).eq('id', backupLogId)

    // Alert via agent_outputs
    try {
      await supabase.from('agent_outputs').insert({
        agent_name: 'backup-daily',
        output_type: 'alert',
        title: 'Daily backup failed',
        content: `The nightly JSON backup failed: ${errorMessage}`,
        metadata: { backup_log_id: backupLogId, error: errorMessage },
        requires_approval: false,
      })
    } catch (alertErr) {
      console.error('Failed to write alert:', alertErr)
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
