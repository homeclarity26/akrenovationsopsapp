import { useEffect, useMemo, useState } from 'react'
import { Database, HardDrive, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Plus, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface BackupLog {
  id: string
  backup_type: string
  status: string
  file_name: string | null
  file_size_bytes: number | null
  drive_url: string | null
  records_exported: number | null
  error_message: string | null
  duration_seconds: number | null
  started_at: string
  completed_at: string | null
}

interface RestorePoint {
  id: string
  label: string
  created_by: string | null
  backup_log_id: string | null
  notes: string | null
  created_at: string
}

// ── Mock data (used when Supabase fetch fails) ───────────────────────────────

const MOCK_BACKUPS: BackupLog[] = [
  { id: 'b1', backup_type: 'full',        status: 'success', file_name: 'akops-full-2026-04-07.sql.gz',       file_size_bytes: 48572431, drive_url: 'https://drive.google.com/file/d/mock1', records_exported: 12843, error_message: null, duration_seconds: 42, started_at: '2026-04-07T03:00:00Z', completed_at: '2026-04-07T03:00:42Z' },
  { id: 'b2', backup_type: 'incremental', status: 'success', file_name: 'akops-incr-2026-04-06.sql.gz',       file_size_bytes: 2183920,  drive_url: 'https://drive.google.com/file/d/mock2', records_exported: 412,   error_message: null, duration_seconds: 11, started_at: '2026-04-06T03:00:00Z', completed_at: '2026-04-06T03:00:11Z' },
  { id: 'b3', backup_type: 'full',        status: 'success', file_name: 'akops-full-2026-04-05.sql.gz',       file_size_bytes: 47821009, drive_url: 'https://drive.google.com/file/d/mock3', records_exported: 12798, error_message: null, duration_seconds: 40, started_at: '2026-04-05T03:00:00Z', completed_at: '2026-04-05T03:00:40Z' },
  { id: 'b4', backup_type: 'incremental', status: 'failed',  file_name: null,                                 file_size_bytes: null,     drive_url: null,                                  records_exported: null,  error_message: 'Drive upload timeout after 120s', duration_seconds: 125, started_at: '2026-04-04T03:00:00Z', completed_at: '2026-04-04T03:02:05Z' },
  { id: 'b5', backup_type: 'full',        status: 'success', file_name: 'akops-full-2026-04-03.sql.gz',       file_size_bytes: 47102389, drive_url: 'https://drive.google.com/file/d/mock5', records_exported: 12703, error_message: null, duration_seconds: 39, started_at: '2026-04-03T03:00:00Z', completed_at: '2026-04-03T03:00:39Z' },
]

const MOCK_RESTORE_POINTS: RestorePoint[] = [
  { id: 'r1', label: 'Before Q2 payroll cutover',   created_by: 'Adam Kilgore', backup_log_id: 'b1', notes: 'Snapshot taken before running April payroll batch.', created_at: '2026-04-07T09:14:00Z' },
  { id: 'r2', label: 'Pre Phase M migration',       created_by: 'Adam Kilgore', backup_log_id: 'b3', notes: 'Pre-audit-log schema changes.',                       created_at: '2026-04-05T08:00:00Z' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours < 1) {
    const mins = Math.floor(ms / (60 * 1000))
    return `${mins}m ago`
  }
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const STATUS_STYLES: Record<string, string> = {
  success:     'bg-[var(--success-bg)] text-[var(--success)]',
  failed:      'bg-[var(--danger-bg)] text-[var(--danger)]',
  in_progress: 'bg-[var(--warning-bg)] text-[var(--warning)]',
}

// ── Component ────────────────────────────────────────────────────────────────

export function BackupsPage() {
  const [backups, setBackups] = useState<BackupLog[]>([])
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)
  const [creatingRestore, setCreatingRestore] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [backupsRes, restoreRes] = await Promise.all([
        supabase
          .from('backup_logs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(30),
        supabase
          .from('restore_points')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (backupsRes.error) throw backupsRes.error
      if (restoreRes.error) throw restoreRes.error

      const backupRows = (backupsRes.data ?? []) as BackupLog[]
      const restoreRows = (restoreRes.data ?? []) as RestorePoint[]

      if (backupRows.length === 0 && restoreRows.length === 0) {
        setBackups(MOCK_BACKUPS)
        setRestorePoints(MOCK_RESTORE_POINTS)
        setUsingMock(true)
      } else {
        setBackups(backupRows)
        setRestorePoints(restoreRows)
        setUsingMock(false)
      }
    } catch (err) {
      console.warn('[backups] Using mock data:', err)
      setBackups(MOCK_BACKUPS)
      setRestorePoints(MOCK_RESTORE_POINTS)
      setUsingMock(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const successful = backups.filter(b => b.status === 'success')
    const lastSuccess = successful[0] ?? null

    const now = Date.now()
    const lastBackupMs = lastSuccess ? now - new Date(lastSuccess.completed_at ?? lastSuccess.started_at).getTime() : Infinity
    const healthStatus: 'healthy' | 'stale' | 'none' =
      !lastSuccess ? 'none' :
      lastBackupMs > 25 * 60 * 60 * 1000 ? 'stale' : 'healthy'

    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)
    thisMonthStart.setHours(0, 0, 0, 0)
    const thisMonthCount = backups.filter(b => new Date(b.started_at).getTime() >= thisMonthStart.getTime()).length

    const failedCount = backups.filter(b => b.status === 'failed').length

    return {
      lastSuccess,
      healthStatus,
      totalCount: backups.length,
      thisMonthCount,
      failedCount,
      totalRecords: lastSuccess?.records_exported ?? 0,
    }
  }, [backups])

  const handleCreateRestorePoint = async () => {
    const label = window.prompt('Label for this restore point:')
    if (!label) return
    setCreatingRestore(true)
    try {
      const { data, error } = await supabase
        .from('restore_points')
        .insert({ label, notes: null, backup_log_id: stats.lastSuccess?.id ?? null })
        .select()
        .single()
      if (error) throw error
      if (data) setRestorePoints(prev => [data as RestorePoint, ...prev])
    } catch (err) {
      console.warn('[backups] Restore point create failed:', err)
      // Optimistic add in mock mode
      const fake: RestorePoint = {
        id: `mock-${Date.now()}`,
        label,
        created_by: 'Adam Kilgore',
        backup_log_id: stats.lastSuccess?.id ?? null,
        notes: null,
        created_at: new Date().toISOString(),
      }
      setRestorePoints(prev => [fake, ...prev])
    } finally {
      setCreatingRestore(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto lg:max-w-4xl px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
            <Database size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-display text-xl text-[var(--navy)]">Backups</h1>
            <p className="text-xs text-[var(--text-tertiary)]">Database backups, restore points, and disaster recovery</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className={cn('p-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors', loading && 'opacity-60')}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {usingMock && (
        <div className="rounded-xl border border-[var(--warning)] bg-[var(--warning-bg)] px-4 py-2.5 text-xs text-[var(--warning)]">
          Showing sample data. Live `backup_logs` not available.
        </div>
      )}

      {/* Health card */}
      <Card>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-1.5">
          Last backup
        </p>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-2xl text-[var(--text)] leading-tight">
              {stats.lastSuccess ? formatDateTime(stats.lastSuccess.completed_at ?? stats.lastSuccess.started_at) : 'No completed backups'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono">
              {stats.lastSuccess ? timeAgo(stats.lastSuccess.completed_at ?? stats.lastSuccess.started_at) : '—'}
            </p>
          </div>
          {stats.healthStatus === 'healthy' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-bg)] text-[var(--success)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
              <CheckCircle2 size={12} />
              Healthy
            </span>
          )}
          {stats.healthStatus === 'stale' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger-bg)] text-[var(--danger)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
              <AlertTriangle size={12} />
              Stale
            </span>
          )}
          {stats.healthStatus === 'none' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger-bg)] text-[var(--danger)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
              <XCircle size={12} />
              None
            </span>
          )}
        </div>
      </Card>

      {/* Metric row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-1">Total backups</p>
          <p className="font-display text-2xl text-[var(--text)] font-mono">{stats.totalCount}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-1">This month</p>
          <p className="font-display text-2xl text-[var(--text)] font-mono">{stats.thisMonthCount}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-1">Failed</p>
          <p className={cn('font-display text-2xl font-mono', stats.failedCount > 0 ? 'text-[var(--danger)]' : 'text-[var(--text)]')}>
            {stats.failedCount}
          </p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-1">Records</p>
          <p className="font-display text-2xl text-[var(--text)] font-mono">{stats.totalRecords.toLocaleString()}</p>
        </Card>
      </div>

      {/* Create restore point */}
      <button
        onClick={handleCreateRestorePoint}
        disabled={creatingRestore}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold min-h-[44px] hover:bg-[var(--navy-light)] transition-colors disabled:opacity-60"
      >
        <Plus size={15} />
        Create Restore Point
      </button>

      {/* Recent backups */}
      <div>
        <SectionHeader title="Recent backups" />
        <Card padding="none">
          {backups.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">
              {loading ? 'Loading…' : 'No backups recorded yet.'}
            </div>
          ) : (
            backups.map(b => (
              <div key={b.id} className="px-4 py-3.5 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">
                      {b.file_name ?? `${b.backup_type} backup`}
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">
                      {formatDateTime(b.started_at)} · {b.backup_type}
                    </p>
                  </div>
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0', STATUS_STYLES[b.status] ?? 'bg-gray-100 text-gray-600')}>
                    {b.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)] flex-wrap">
                  <span className="font-mono">{formatBytes(b.file_size_bytes)}</span>
                  <span className="font-mono">{(b.records_exported ?? 0).toLocaleString()} records</span>
                  <span className="font-mono">{b.duration_seconds ?? 0}s</span>
                  {b.drive_url && (
                    <a
                      href={b.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--navy)] font-semibold"
                    >
                      Drive <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                {b.error_message && (
                  <p className="text-[11px] text-[var(--danger)] mt-1.5">{b.error_message}</p>
                )}
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Restore points */}
      <div>
        <SectionHeader title="Restore points" />
        <Card padding="none">
          {restorePoints.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">
              No restore points yet. Create one before making major changes.
            </div>
          ) : (
            restorePoints.map(r => (
              <div key={r.id} className="px-4 py-3.5 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-start gap-3">
                  <HardDrive size={15} className="text-[var(--navy)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)]">{r.label}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">
                      {r.created_by ?? 'Unknown'} · {formatDateTime(r.created_at)}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{r.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
