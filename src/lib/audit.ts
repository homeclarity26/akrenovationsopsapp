// Client-side audit logging utility (M15)
//
// Database-level audit triggers (installed in M14) capture all row-level
// changes. This utility is for the "application actions" that don't produce
// row changes: logins, logouts, PDF exports, viewing sensitive screens,
// calling external APIs, etc.
//
// Never throws — audit logging is best-effort. A failure here must not break
// the action the user is trying to take.

import { supabase } from './supabase'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view_sensitive'
  | 'export'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'permission_denied'
  | 'api_call'

export interface AuditDetails {
  table_name?: string
  record_id?: string
  description?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an audit event. Best-effort — swallows errors silently.
 */
export async function logAuditEvent(
  action: AuditAction,
  details: AuditDetails = {}
): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id ?? null

    // Look up the user's role for richer audit context (best effort)
    let userRole: string | null = null
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      userRole = (profile?.role as string) ?? null
    }

    await supabase.from('audit_log').insert({
      user_id: userId,
      user_role: userRole,
      action,
      table_name: details.table_name ?? null,
      record_id: details.record_id ?? null,
      new_values: {
        description: details.description ?? null,
        ...(details.metadata ?? {}),
      },
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      session_id: getSessionId(),
    })
  } catch (err) {
    // Never throw — audit must never block the real action
    if (typeof console !== 'undefined') {
      console.warn('[audit] Failed to log event:', err)
    }
  }
}

/**
 * Convenience shortcuts
 */

export const auditLogin = (description = 'User logged in') =>
  logAuditEvent('login', { description })

export const auditLogout = (description = 'User logged out') =>
  logAuditEvent('logout', { description })

export const auditLoginFailed = (email: string) =>
  logAuditEvent('login_failed', {
    description: `Failed login attempt for ${email}`,
    metadata: { email },
  })

export const auditExport = (what: string, recordCount?: number) =>
  logAuditEvent('export', {
    description: `Exported ${what}`,
    metadata: { record_count: recordCount },
  })

export const auditViewSensitive = (tableName: string, recordId?: string, description?: string) =>
  logAuditEvent('view_sensitive', {
    table_name: tableName,
    record_id: recordId,
    description: description ?? `Viewed ${tableName}`,
  })

export const auditApiCall = (apiName: string, description?: string) =>
  logAuditEvent('api_call', {
    description: description ?? `Called ${apiName}`,
    metadata: { api: apiName },
  })

export const auditPermissionDenied = (what: string) =>
  logAuditEvent('permission_denied', {
    description: `Permission denied: ${what}`,
  })

/**
 * Session id stored in sessionStorage so all audit events within the same
 * browser tab session share an id.
 */
function getSessionId(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  let id = sessionStorage.getItem('audit_session_id')
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    sessionStorage.setItem('audit_session_id', id)
  }
  return id
}
