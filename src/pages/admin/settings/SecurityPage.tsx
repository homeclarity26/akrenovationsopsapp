import { useEffect, useMemo, useState } from 'react'
import { Shield, Download, ChevronDown, ChevronRight, RefreshCw, Activity, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'
import { revokeSession, revokeAllSessionsForUser } from '@/lib/session'
import { auditExport } from '@/lib/audit'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

type SecurityTab = 'audit' | 'sessions' | 'rate_limits'

interface AuditRow {
  id: string
  user_id: string | null
  user_role: string | null
  action: string
  table_name: string | null
  record_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  session_id: string | null
  created_at: string
  user_name?: string
}

interface SessionRow {
  id: string
  user_id: string
  session_token: string
  device_info: string | null
  ip_address: string | null
  last_active: string | null
  expires_at: string
  is_active: boolean
  created_at: string
  user_name?: string
  user_role?: string
}

interface RateLimitRow {
  id: string
  identifier: string
  endpoint: string
  request_count: number
  window_start: string
  blocked: boolean
  created_at: string
}

const ENDPOINT_LIMIT = 100 // per hour

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  create:            'bg-[var(--success-bg)] text-[var(--success)]',
  update:            'bg-blue-50 text-blue-700',
  delete:            'bg-[var(--danger-bg)] text-[var(--danger)]',
  login:             'bg-[var(--cream-light)] text-[var(--navy)]',
  logout:            'bg-gray-100 text-gray-700',
  login_failed:      'bg-[var(--danger-bg)] text-[var(--danger)]',
  export:            'bg-[var(--warning-bg)] text-[var(--warning)]',
  view_sensitive:    'bg-purple-50 text-purple-700',
  api_call:          'bg-teal-50 text-teal-700',
  permission_denied: 'bg-[var(--danger-bg)] text-[var(--danger)]',
}

const ROLE_COLORS: Record<string, string> = {
  admin:    'bg-[var(--navy)] text-white',
  employee: 'bg-[var(--rust)] text-white',
  client:   'bg-[var(--success)] text-white',
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function minutesAgo(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / (60 * 1000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function expiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours < 1) return `${Math.floor(ms / (60 * 1000))}m`
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function exportAuditCsv(rows: AuditRow[]) {
  const headers = ['timestamp', 'user', 'role', 'action', 'table', 'record_id', 'ip']
  const lines = [headers.join(',')]
  rows.forEach(r => {
    lines.push([
      r.created_at,
      r.user_name ?? '',
      r.user_role ?? '',
      r.action,
      r.table_name ?? '',
      r.record_id ?? '',
      r.ip_address ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  auditExport('audit log', rows.length)
}

// ── Component ────────────────────────────────────────────────────────────────

export function SecurityPage() {
  const [activeTab, setActiveTab] = useState<SecurityTab>('audit')
  const [loading, setLoading] = useState(true)

  // Audit state
  const [auditRows, setAuditRows] = useState<AuditRow[]>([])
  const [auditExpanded, setAuditExpanded] = useState<string | null>(null)
  const [userFilter, setUserFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('all')
  const [tableSearch, setTableSearch] = useState('')

  // Sessions state
  const [sessions, setSessions] = useState<SessionRow[]>([])

  // Rate limits state
  const [rateLimits, setRateLimits] = useState<RateLimitRow[]>([])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [auditRes, sessionRes, rateRes] = await Promise.all([
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('user_sessions').select('*').eq('is_active', true).gt('expires_at', new Date().toISOString()).order('last_active', { ascending: false }),
        supabase.from('rate_limit_events').select('*').gte('window_start', new Date(Date.now() - 60 * 60 * 1000).toISOString()),
      ])

      setAuditRows(!auditRes.error && auditRes.data ? auditRes.data as AuditRow[] : [])
      setSessions(!sessionRes.error && sessionRes.data ? sessionRes.data as SessionRow[] : [])
      setRateLimits(!rateRes.error && rateRes.data ? rateRes.data as RateLimitRow[] : [])
    } catch (err) {
      console.warn('[security] Failed to load security data:', err)
      setAuditRows([])
      setSessions([])
      setRateLimits([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // ── Filters ────────────────────────────────────────────────────────────────
  const userOptions = useMemo(() => {
    const seen = new Set<string>()
    return auditRows.filter(r => {
      if (!r.user_name || seen.has(r.user_name)) return false
      seen.add(r.user_name)
      return true
    }).map(r => r.user_name ?? '')
  }, [auditRows])

  const actionOptions = useMemo(() => {
    return Array.from(new Set(auditRows.map(r => r.action)))
  }, [auditRows])

  const filteredAudit = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    return auditRows.filter(r => {
      if (userFilter !== 'all' && r.user_name !== userFilter) return false
      if (actionFilter !== 'all' && r.action !== actionFilter) return false
      if (dateRange === 'week' && new Date(r.created_at).getTime() < weekAgo) return false
      if (dateRange === 'month' && new Date(r.created_at).getTime() < monthAgo) return false
      if (tableSearch && !(r.table_name ?? '').toLowerCase().includes(tableSearch.toLowerCase())) return false
      return true
    })
  }, [auditRows, userFilter, actionFilter, dateRange, tableSearch])

  // ── Rate limit aggregation ─────────────────────────────────────────────────
  const rateLimitAgg = useMemo(() => {
    const byEndpoint = new Map<string, { endpoint: string; requests: number; blocked: number }>()
    rateLimits.forEach(r => {
      const existing = byEndpoint.get(r.endpoint) ?? { endpoint: r.endpoint, requests: 0, blocked: 0 }
      existing.requests += r.request_count
      if (r.blocked) existing.blocked += 1
      byEndpoint.set(r.endpoint, existing)
    })
    return Array.from(byEndpoint.values()).sort((a, b) => b.requests - a.requests)
  }, [rateLimits])

  const maxRequests = Math.max(1, ...rateLimitAgg.map(r => r.requests))

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleRevoke = async (sessionId: string) => {
    if (!window.confirm('Revoke this session?')) return
    await revokeSession(sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  const handleRevokeAllForUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Revoke ALL sessions for ${userName}? They will be signed out immediately.`)) return
    await revokeAllSessionsForUser(userId)
    setSessions(prev => prev.filter(s => s.user_id !== userId))
  }

  const handleClearRateLimits = async () => {
    if (!window.confirm('Clear old rate limit records?')) return
    try {
      await supabase.rpc('cleanup_old_rate_limit_events')
    } catch (err) {
      console.warn('[security] Rate limit cleanup failed:', err)
    }
    loadAll()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const TABS: { id: SecurityTab; label: string; count: number }[] = [
    { id: 'audit',       label: 'Audit Log',       count: auditRows.length },
    { id: 'sessions',    label: 'Active Sessions', count: sessions.length },
    { id: 'rate_limits', label: 'Rate Limits',     count: rateLimitAgg.length },
  ]

  return (
    <div className="max-w-2xl mx-auto lg:max-w-4xl px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-display text-xl text-[var(--navy)]">Security</h1>
            <p className="text-xs text-[var(--text-tertiary)]">Audit log, sessions, and rate limiting</p>
          </div>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className={cn('p-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors', loading && 'opacity-60')}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>


      {/* Tabs */}
      <div className="flex gap-0 overflow-x-auto border-b border-[var(--border-light)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'py-2.5 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5',
              activeTab === t.id
                ? 'border-[var(--navy)] text-[var(--navy)]'
                : 'border-transparent text-[var(--text-tertiary)]'
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono',
                activeTab === t.id ? 'bg-[var(--navy)] text-white' : 'bg-[var(--border-light)] text-[var(--text-tertiary)]'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── AUDIT LOG ── */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <Card>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <select
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                className="py-2 px-3 rounded-xl border border-[var(--border)] text-xs bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              >
                <option value="all">All users</option>
                {userOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="py-2 px-3 rounded-xl border border-[var(--border)] text-xs bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              >
                <option value="all">All actions</option>
                {actionOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value as typeof dateRange)}
                className="py-2 px-3 rounded-xl border border-[var(--border)] text-xs bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              >
                <option value="all">All time</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
              </select>
              <input
                type="text"
                placeholder="Table name…"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                className="py-2 px-3 rounded-xl border border-[var(--border)] text-xs bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              />
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={() => exportAuditCsv(filteredAudit)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--navy)] hover:text-[var(--rust)] transition-colors"
              >
                <Download size={13} />
                Export to CSV
              </button>
            </div>
          </Card>

          <Card padding="none">
            {filteredAudit.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No matching events.</div>
            ) : (
              filteredAudit.map(row => {
                const expanded = auditExpanded === row.id
                return (
                  <div key={row.id} className="border-b border-[var(--border-light)] last:border-0">
                    <button
                      onClick={() => setAuditExpanded(expanded ? null : row.id)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left min-h-[44px]"
                    >
                      {expanded
                        ? <ChevronDown size={13} className="text-[var(--text-tertiary)] flex-shrink-0 mt-1" />
                        : <ChevronRight size={13} className="text-[var(--text-tertiary)] flex-shrink-0 mt-1" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full', ACTION_COLORS[row.action] ?? 'bg-gray-100 text-gray-600')}>
                            {row.action}
                          </span>
                          {row.user_role && (
                            <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full', ROLE_COLORS[row.user_role] ?? 'bg-gray-100 text-gray-600')}>
                              {row.user_role}
                            </span>
                          )}
                          <span className="text-xs font-medium text-[var(--text)]">{row.user_name ?? '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] flex-wrap">
                          <span className="font-mono">{formatDateTime(row.created_at)}</span>
                          {row.table_name && <span>· {row.table_name}</span>}
                          {row.record_id && <span className="font-mono">· {row.record_id.slice(0, 8)}</span>}
                        </div>
                      </div>
                    </button>

                    {expanded && (row.old_values || row.new_values) && (
                      <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Old</p>
                          <pre className="text-[11px] font-mono bg-[var(--bg)] rounded-xl p-3 overflow-x-auto text-[var(--text-secondary)] whitespace-pre-wrap break-words">
                            {row.old_values ? JSON.stringify(row.old_values, null, 2) : '—'}
                          </pre>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">New</p>
                          <pre className="text-[11px] font-mono bg-[var(--bg)] rounded-xl p-3 overflow-x-auto text-[var(--text-secondary)] whitespace-pre-wrap break-words">
                            {row.new_values ? JSON.stringify(row.new_values, null, 2) : '—'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </Card>
        </div>
      )}

      {/* ── ACTIVE SESSIONS ── */}
      {activeTab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <Card>
              <p className="text-center text-sm text-[var(--text-tertiary)] py-4">No active sessions.</p>
            </Card>
          ) : (
            sessions.map(s => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-[var(--text)]">{s.user_name ?? s.user_id.slice(0, 8)}</span>
                      {s.user_role && (
                        <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full', ROLE_COLORS[s.user_role] ?? 'bg-gray-100 text-gray-600')}>
                          {s.user_role}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {(s.device_info ?? 'Unknown device').slice(0, 50)}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--text-tertiary)] font-mono">
                      <span>Active {minutesAgo(s.last_active)}</span>
                      <span>· Expires in {expiresIn(s.expires_at)}</span>
                      {s.ip_address && <span>· {s.ip_address}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(s.id)}
                    className="text-xs font-semibold text-[var(--danger)] hover:underline flex-shrink-0"
                  >
                    Revoke
                  </button>
                </div>
                <button
                  onClick={() => handleRevokeAllForUser(s.user_id, s.user_name ?? 'this user')}
                  className="text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors"
                >
                  Revoke all sessions for this user
                </button>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── RATE LIMITS ── */}
      {activeTab === 'rate_limits' && (
        <div className="space-y-4">
          <div>
            <SectionHeader title="Endpoints (last hour)" />
            <Card padding="none">
              {rateLimitAgg.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No rate limit events recorded.</div>
              ) : (
                rateLimitAgg.map(r => {
                  const pct = (r.requests / ENDPOINT_LIMIT) * 100
                  let status: 'ok' | 'warn' | 'danger' = 'ok'
                  if (r.blocked > 0 || pct > 90) status = 'danger'
                  else if (pct >= 50) status = 'warn'

                  const statusStyles = {
                    ok:     'bg-[var(--success-bg)] text-[var(--success)]',
                    warn:   'bg-[var(--warning-bg)] text-[var(--warning)]',
                    danger: 'bg-[var(--danger-bg)] text-[var(--danger)]',
                  }

                  return (
                    <div key={r.endpoint} className="px-4 py-3.5 border-b border-[var(--border-light)] last:border-0">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p className="text-sm font-mono text-[var(--text)] truncate">{r.endpoint}</p>
                        <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0', statusStyles[status])}>
                          {status === 'ok' ? 'OK' : status === 'warn' ? 'Warning' : 'Throttled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)] font-mono">
                        <span>{r.requests} requests</span>
                        {r.blocked > 0 && <span className="text-[var(--danger)]">{r.blocked} blocked</span>}
                      </div>
                    </div>
                  )
                })
              )}
            </Card>
          </div>

          <div>
            <SectionHeader title="Top endpoints" />
            <Card>
              <div className="space-y-2.5">
                {rateLimitAgg.slice(0, 10).map(r => (
                  <div key={r.endpoint}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-mono text-[var(--text-secondary)] truncate">{r.endpoint}</p>
                      <p className="text-[11px] font-mono text-[var(--text-tertiary)] flex-shrink-0 ml-2">{r.requests}</p>
                    </div>
                    <div className="h-2 bg-[var(--border-light)] rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', r.blocked > 0 ? 'bg-[var(--danger)]' : 'bg-[var(--navy)]')}
                        style={{ width: `${(r.requests / maxRequests) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {rateLimitAgg.length === 0 && (
                  <p className="text-center text-sm text-[var(--text-tertiary)] py-2 flex items-center justify-center gap-2">
                    <Activity size={13} /> No endpoint activity
                  </p>
                )}
              </div>
            </Card>
          </div>

          <button
            onClick={handleClearRateLimits}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors min-h-[44px]"
          >
            <Trash2 size={14} />
            Clear old rate limit records
          </button>
        </div>
      )}
    </div>
  )
}
