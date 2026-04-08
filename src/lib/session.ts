// Application-level session management (M18)
//
// Complements Supabase Auth by tracking sessions in our own `user_sessions`
// table. Gives us role-specific timeouts, device info, and the ability to
// revoke sessions from the admin Security dashboard.
//
// All methods are best-effort — failures are logged but never thrown, so a
// broken session table cannot lock users out of the app.

import { supabase } from './supabase'
import { auditLogin, auditLogout, logAuditEvent } from './audit'
import type { User } from '@supabase/supabase-js'

// Role-specific timeouts in milliseconds
const SESSION_TIMEOUT: Record<string, number> = {
  admin: 12 * 60 * 60 * 1000,          // 12 hours
  employee: 8 * 60 * 60 * 1000,        // 8 hours
  client: 30 * 24 * 60 * 60 * 1000,    // 30 days
}

export async function createAppSession(userId: string, role: string): Promise<void> {
  const expiresAt = new Date(Date.now() + (SESSION_TIMEOUT[role] ?? SESSION_TIMEOUT.employee))
  try {
    await supabase.from('user_sessions').insert({
      user_id: userId,
      session_token: crypto.randomUUID(),
      device_info: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    })
    await auditLogin(`User logged in as ${role}`)
  } catch (err) {
    console.warn('[session] Failed to create session record:', err)
  }
}

export async function validateAppSession(user: User): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) {
      // No active session — sign out the Supabase session too
      await supabase.auth.signOut()
      return false
    }

    // Touch last_active
    await supabase
      .from('user_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('id', data.id)

    return true
  } catch (err) {
    console.warn('[session] Validation failed:', err)
    // Fail open — don't lock users out if our session table has problems
    return true
  }
}

export async function invalidateAppSession(userId: string): Promise<void> {
  try {
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
    await auditLogout()
  } catch (err) {
    console.warn('[session] Failed to invalidate:', err)
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  try {
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('id', sessionId)
    await logAuditEvent('logout', { description: `Admin revoked session ${sessionId}` })
  } catch (err) {
    console.warn('[session] Failed to revoke:', err)
  }
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  try {
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
    await logAuditEvent('logout', {
      description: `Admin revoked all sessions for user ${userId}`,
      metadata: { target_user_id: userId },
    })
  } catch (err) {
    console.warn('[session] Failed to revoke all:', err)
  }
}
