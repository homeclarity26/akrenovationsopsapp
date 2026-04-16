import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Database, HardDrive } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor(diff / 60_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}d ago`
  if (hours >= 1) return `${hours}h ago`
  if (minutes >= 1) return `${minutes}m ago`
  return 'just now'
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '--'
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '--'
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))
  return sorted[idx]
}

interface ErrorRow {
  id: string
  severity: 'info' | 'warn' | 'error' | 'fatal'
  function_name: string | null
  source: string
  message: string
  stack: string | null
  created_at: string
}

interface AgentRunRow {
  id: string
  agent_name: string
  trigger_type: string
  status: 'running' | 'success' | 'failure' | 'partial'
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  error_message: string | null
}

const SEVERITY_STYLE: Record<ErrorRow['severity'], string> = {
  info:  'bg-[var(--bg)] text-[var(--text-secondary)]',
  warn:  'bg-[var(--warning-bg)] text-[var(--warning)]',
  error: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  fatal: 'bg-[var(--danger)] text-white',
}

const STATUS_STYLE: Record<AgentRunRow['status'], string> = {
  running: 'bg-[var(--cream-light)] text-[var(--text-secondary)]',
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  failure: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  partial: 'bg-[var(--warning-bg)] text-[var(--warning)]',
}

export function HealthPage() {
  const navigate = useNavigate()
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null)

  // 24-hour window for observability panels.
  const since24h = useMemo(() => new Date(Date.now() - 24 * 3_600_000).toISOString(), [])

  // Last 7 backup logs
  const { data: backups = [], isLoading: backupsLoading } = useQuery({
    queryKey: ['health-backups'],
    queryFn: async () => {
      const { data } = await supabase
        .from('backup_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(7)
      return data ?? []
    },
  })

  // Last 50 error_log entries (graceful if table missing)
  const { data: errorsData, isLoading: errorsLoading } = useQuery({
    queryKey: ['health-errors', since24h],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_log')
        .select('*')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) return null // null signals table missing
      return (data ?? []) as ErrorRow[]
    },
  })
  const errors: ErrorRow[] | null = errorsData ?? null

  // Agent execution log (graceful if table missing)
  const { data: agentRunsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['health-agents', since24h],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_execution_log')
        .select('*')
        .gte('started_at', since24h)
        .order('started_at', { ascending: false })
        .limit(50)
      if (error) return null
      return (data ?? []) as AgentRunRow[]
    },
  })
  const agentRuns: AgentRunRow[] | null = agentRunsData ?? null

  // Migration count
  const { data: migrationCount } = useQuery({
    queryKey: ['health-migrations'],
    queryFn: async () => {
      const { count } = await supabase
        .from('schema_migrations')
        .select('version', { count: 'exact', head: true })
      return count ?? null
    },
  })

  // ── Derived metrics ───────────────────────────────────────────────────────
  const errorCountBySeverity = useMemo(() => {
    const counts = { info: 0, warn: 0, error: 0, fatal: 0 }
    if (!errors) return counts
    for (const e of errors) counts[e.severity] = (counts[e.severity] ?? 0) + 1
    return counts
  }, [errors])

  const errorCountByFunction = useMemo(() => {
    if (!errors) return [] as { function_name: string; count: number }[]
    const map = new Map<string, number>()
    for (const e of errors) {
      const key = e.function_name || '(unknown)'
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([function_name, count]) => ({ function_name, count }))
      .sort((a, b) => b.count - a.count)
  }, [errors])

  const agentStats = useMemo(() => {
    if (!agentRuns) {
      return {
        total: 0,
        successes: 0,
        failures: 0,
        failureRate: null as number | null,
        p50: null as number | null,
        p95: null as number | null,
        avg: null as number | null,
        byAgent: [] as { agent_name: string; total: number; success: number; failure: number }[],
      }
    }
    const durations = agentRuns
      .map(r => r.duration_ms)
      .filter((d): d is number => typeof d === 'number' && d >= 0)
      .sort((a, b) => a - b)
    const successes = agentRuns.filter(r => r.status === 'success').length
    const failures = agentRuns.filter(r => r.status === 'failure').length
    const total = agentRuns.length
    const failureRate = total > 0 ? (failures / total) * 100 : null
    const avg = durations.length > 0 ? durations.reduce((s, n) => s + n, 0) / durations.length : null
    const byAgentMap = new Map<string, { total: number; success: number; failure: number }>()
    for (const r of agentRuns) {
      const cur = byAgentMap.get(r.agent_name) ?? { total: 0, success: 0, failure: 0 }
      cur.total += 1
      if (r.status === 'success') cur.success += 1
      if (r.status === 'failure') cur.failure += 1
      byAgentMap.set(r.agent_name, cur)
    }
    return {
      total,
      successes,
      failures,
      failureRate,
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      avg,
      byAgent: Array.from(byAgentMap.entries())
        .map(([agent_name, v]) => ({ agent_name, ...v }))
        .sort((a, b) => b.total - a.total),
    }
  }, [agentRuns])

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-3xl lg:px-8 lg:py-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/settings')}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--border-light)] transition-colors"
        >
          <ArrowLeft size={16} className="text-[var(--text)]" />
        </button>
        <div>
          <h1 className="font-display text-2xl text-[var(--navy)]">System Health</h1>
          <p className="text-sm text-[var(--text-secondary)]">Infrastructure status and recent activity</p>
        </div>
      </div>

      {/* Header metric cards (last 24h) */}
      <div>
        <SectionHeader title="Last 24 hours" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Errors (24h)"
            value={errors == null ? '--' : errors.length}
            subtitle={
              errors == null
                ? 'error_log table not available'
                : errorCountBySeverity.fatal > 0
                  ? `${errorCountBySeverity.fatal} fatal`
                  : errorCountBySeverity.error > 0
                    ? `${errorCountBySeverity.error} error`
                    : 'clean'
            }
          />
          <MetricCard
            label="Agent runs (24h)"
            value={agentRuns == null ? '--' : agentStats.total}
            subtitle={
              agentRuns == null
                ? 'agent_execution_log not available'
                : `${agentStats.successes} ok · ${agentStats.failures} failed`
            }
          />
          <MetricCard
            label="Agent failure rate"
            value={
              agentRuns == null || agentStats.failureRate == null
                ? '--'
                : `${agentStats.failureRate.toFixed(1)}%`
            }
            subtitle={agentRuns == null ? '' : `${agentStats.failures} of ${agentStats.total}`}
          />
          <MetricCard
            label="Avg agent duration"
            value={formatDuration(agentStats.avg)}
            subtitle={
              agentStats.p50 != null && agentStats.p95 != null
                ? `p50 ${formatDuration(agentStats.p50)} · p95 ${formatDuration(agentStats.p95)}`
                : ''
            }
          />
        </div>
      </div>

      {/* Errors panel */}
      <div>
        <SectionHeader
          title={`Errors (last 24h${errors ? ` · ${errors.length}` : ''})`}
        />
        <Card padding="none">
          {errorsLoading ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--text-tertiary)]">Loading...</div>
          ) : errors === null ? (
            <div className="py-6 px-4 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">
                Error tracking table not reachable. Migration may not be applied yet.
              </p>
            </div>
          ) : errors.length === 0 ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--success)]">No errors in the last 24 hours.</div>
          ) : (
            <div>
              {/* By-function breakdown */}
              {errorCountByFunction.length > 1 && (
                <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg)] flex flex-wrap gap-2">
                  {errorCountByFunction.slice(0, 6).map(row => (
                    <span key={row.function_name} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-[var(--border-light)] text-[var(--text-secondary)]">
                      {row.function_name} · {row.count}
                    </span>
                  ))}
                </div>
              )}
              {errors.map(e => {
                const isExpanded = expandedErrorId === e.id
                const truncated = e.message.length > 160 ? e.message.slice(0, 160) + '…' : e.message
                return (
                  <button
                    key={e.id}
                    onClick={() => setExpandedErrorId(isExpanded ? null : e.id)}
                    className="w-full text-left p-4 border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg)] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${SEVERITY_STYLE[e.severity]}`}>
                          {e.severity}
                        </span>
                        <span className="text-xs font-medium text-[var(--text)]">{e.function_name ?? '(unknown)'}</span>
                        <span className="text-[10px] text-[var(--text-tertiary)] uppercase">{e.source}</span>
                      </div>
                      <span className="text-[11px] text-[var(--text-tertiary)] flex-shrink-0">{timeAgo(e.created_at)}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] break-words">
                      {isExpanded ? e.message : truncated}
                    </p>
                    {isExpanded && e.stack && (
                      <pre className="mt-2 text-[10px] font-mono text-[var(--text-tertiary)] whitespace-pre-wrap break-all bg-[var(--bg)] rounded p-2 max-h-60 overflow-auto">
                        {e.stack}
                      </pre>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Agent runs panel */}
      <div>
        <SectionHeader
          title={`Agent runs (last 24h${agentRuns ? ` · ${agentRuns.length}` : ''})`}
        />
        <Card padding="none">
          {agentsLoading ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--text-tertiary)]">Loading...</div>
          ) : agentRuns === null ? (
            <div className="py-6 px-4 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">
                Agent execution log not reachable. Migration may not be applied yet.
              </p>
            </div>
          ) : agentRuns.length === 0 ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--text-tertiary)]">No agent runs in the last 24 hours.</div>
          ) : (
            <div>
              {agentStats.byAgent.length > 1 && (
                <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg)] flex flex-wrap gap-2">
                  {agentStats.byAgent.slice(0, 8).map(row => (
                    <span key={row.agent_name} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-[var(--border-light)] text-[var(--text-secondary)]">
                      {row.agent_name} · {row.success}/{row.total}
                    </span>
                  ))}
                </div>
              )}
              {agentRuns.map(r => (
                <div key={r.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                        {r.status}
                      </span>
                      <span className="text-sm font-medium text-[var(--text)] truncate">{r.agent_name}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] uppercase">{r.trigger_type}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[11px] font-mono text-[var(--text-secondary)]">{formatDuration(r.duration_ms)}</span>
                      <span className="text-[11px] text-[var(--text-tertiary)]">{timeAgo(r.started_at)}</span>
                    </div>
                  </div>
                  {r.status === 'failure' && r.error_message && (
                    <p className="mt-2 text-xs text-[var(--danger)] break-words">{r.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Backups */}
      <div>
        <SectionHeader title="Backups" />
        <Card padding="none">
          {backupsLoading ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--text-tertiary)]">Loading...</div>
          ) : backups.length === 0 ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--text-tertiary)]">No backup records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-light)]">
                    <th className="text-left py-2 px-4 text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)] font-semibold">Date</th>
                    <th className="text-left py-2 px-4 text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)] font-semibold">Status</th>
                    <th className="text-left py-2 px-4 text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)] font-semibold">Records</th>
                    <th className="text-left py-2 px-4 text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)] font-semibold">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b: Record<string, unknown>) => (
                    <tr key={b.id as string} className="border-b border-[var(--border-light)] last:border-0">
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        {b.started_at ? timeAgo(b.started_at as string) : '--'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          b.status === 'completed'
                            ? 'bg-[var(--success-bg)] text-[var(--success)]'
                            : 'bg-[var(--danger-bg)] text-[var(--danger)]'
                        }`}>
                          {String(b.status ?? 'unknown')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[var(--text-secondary)]">
                        {b.record_count != null ? Number(b.record_count).toLocaleString() : '--'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[var(--text-secondary)]">
                        {formatBytes(b.file_size_bytes as number | null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Database */}
      <div>
        <SectionHeader title="Database" />
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
              <Database size={14} className="text-[var(--navy)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                {migrationCount != null ? `${migrationCount} migrations applied` : 'Migration count unavailable'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">Supabase project: mebzqfeeiciayxdetteb</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Storage */}
      <div>
        <SectionHeader title="Storage" />
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
              <HardDrive size={14} className="text-[var(--navy)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Supabase Storage</p>
              <p className="text-xs text-[var(--text-tertiary)]">Buckets: project-photos, receipts, documents, project-files</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
