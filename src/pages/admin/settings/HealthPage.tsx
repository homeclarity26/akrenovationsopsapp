import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Database, Shield, Activity, HardDrive } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor(diff / 60_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}d ago`
  if (hours >= 1) return `${hours}h ago`
  return `${minutes}m ago`
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '--'
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export function HealthPage() {
  const navigate = useNavigate()

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
  const { data: errors = [], isLoading: errorsLoading } = useQuery({
    queryKey: ['health-errors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) return null // null signals table missing
      return data ?? []
    },
  })

  // Agent execution log (graceful if table missing)
  const { data: agentRuns = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['health-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_execution_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50)
      if (error) return null // null signals table missing
      return data ?? []
    },
  })

  // Migration count (count of rows in schema_migrations or supabase_migrations)
  const { data: migrationCount } = useQuery({
    queryKey: ['health-migrations'],
    queryFn: async () => {
      // Try reading from supabase internal migrations table via pg system
      const { count } = await supabase
        .from('schema_migrations')
        .select('version', { count: 'exact', head: true })
      return count ?? null
    },
  })

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

      {/* Edge Function Errors */}
      <div>
        <SectionHeader title="Edge Function Errors (Last 50)" />
        <Card padding="none">
          {errorsLoading ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--text-tertiary)]">Loading...</div>
          ) : errors === null ? (
            <div className="py-6 px-4 text-center">
              <div className="flex items-center justify-center gap-2 text-[var(--text-tertiary)]">
                <Shield size={14} />
                <p className="text-sm">Error tracking not yet configured. The <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">error_log</code> table does not exist yet.</p>
              </div>
            </div>
          ) : (errors as unknown[]).length === 0 ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--success)]">No errors recorded.</div>
          ) : (
            (errors as Record<string, unknown>[]).map((e) => (
              <div key={e.id as string} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-[var(--danger)]">{String(e.function_name ?? 'unknown')}</p>
                  <p className="text-[11px] text-[var(--text-tertiary)]">{e.created_at ? timeAgo(e.created_at as string) : '--'}</p>
                </div>
                <p className="text-xs text-[var(--text-secondary)] break-words">{String(e.message ?? e.error ?? '')}</p>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Agent Execution */}
      <div>
        <SectionHeader title="Agent Execution" />
        <Card padding="none">
          {agentsLoading ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--text-tertiary)]">Loading...</div>
          ) : agentRuns === null ? (
            <div className="py-6 px-4 text-center">
              <div className="flex items-center justify-center gap-2 text-[var(--text-tertiary)]">
                <Activity size={14} />
                <p className="text-sm">Agent monitoring not yet configured. The <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">agent_execution_log</code> table does not exist yet.</p>
              </div>
            </div>
          ) : (agentRuns as unknown[]).length === 0 ? (
            <div className="py-6 px-4 text-center text-sm text-[var(--text-tertiary)]">No agent runs recorded.</div>
          ) : (
            (agentRuns as Record<string, unknown>[]).map((r) => (
              <div key={r.id as string} className="flex items-center justify-between py-3 px-4 border-b border-[var(--border-light)] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">{String(r.agent_name ?? 'unknown')}</p>
                  <p className="text-[11px] text-[var(--text-tertiary)]">{r.started_at ? timeAgo(r.started_at as string) : '--'}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  r.status === 'success'
                    ? 'bg-[var(--success-bg)] text-[var(--success)]'
                    : 'bg-[var(--danger-bg)] text-[var(--danger)]'
                }`}>
                  {String(r.status ?? 'unknown')}
                </span>
              </div>
            ))
          )}
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
