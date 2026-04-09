import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'

interface HealthData {
  lastBackup: { time: string | null; status: string | null } | null
  errorCount24h: number | null
  agentSummary: string | null
  agentMissing: boolean
  errorMissing: boolean
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor(diff / 60_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}d ago`
  if (hours >= 1) return `${hours}h ago`
  return `${minutes}m ago`
}

export function HealthMonitor() {
  const navigate = useNavigate()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchHealth() {
    const result: HealthData = {
      lastBackup: null,
      errorCount24h: null,
      agentSummary: null,
      agentMissing: false,
      errorMissing: false,
    }

    // Last backup
    const { data: backupRows } = await supabase
      .from('backup_logs')
      .select('status, started_at')
      .order('started_at', { ascending: false })
      .limit(1)
    if (backupRows && backupRows.length > 0) {
      result.lastBackup = { time: backupRows[0].started_at, status: backupRows[0].status }
    }

    // Error count (24h) — table may not exist yet
    const since = new Date(Date.now() - 86_400_000).toISOString()
    const { count: errCount, error: errTableError } = await supabase
      .from('error_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
    if (errTableError) {
      result.errorMissing = true
    } else {
      result.errorCount24h = errCount ?? 0
    }

    // Agent execution log — table may not exist yet
    const { data: agentRows, error: agentTableError } = await supabase
      .from('agent_execution_log')
      .select('agent_name, status, started_at')
      .order('started_at', { ascending: false })
      .limit(10)
    if (agentTableError) {
      result.agentMissing = true
    } else if (agentRows) {
      const total = agentRows.length
      const succeeded = agentRows.filter(r => r.status === 'success').length
      result.agentSummary = total > 0 ? `${succeeded} of ${total} agents ran successfully today` : 'No agent runs recorded today'
    }

    setHealth(result)
    setLoading(false)
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return null

  const hasIssues =
    health?.lastBackup?.status === 'failed' ||
    (health?.errorCount24h ?? 0) > 5

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {hasIssues ? (
            <AlertCircle size={14} className="text-[var(--danger)]" />
          ) : (
            <CheckCircle size={14} className="text-[var(--success)]" />
          )}
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            System Health
          </span>
        </div>
        <button
          onClick={() => navigate('/admin/settings/health')}
          className="text-xs text-[var(--navy)] font-medium hover:opacity-70 transition-opacity"
        >
          View details →
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* Last backup */}
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-[var(--text-tertiary)] flex-shrink-0" />
          <p className="text-xs text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text)]">Last backup: </span>
            {health?.lastBackup
              ? `${timeAgo(health.lastBackup.time!)} — ${health.lastBackup.status === 'completed' ? 'Completed' : health.lastBackup.status}`
              : 'No backups found'}
          </p>
        </div>

        {/* Errors (24h) */}
        <div className="flex items-center gap-2">
          {health?.errorMissing ? (
            <p className="text-xs text-[var(--text-tertiary)]">Error tracking not yet configured</p>
          ) : (
            <>
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  (health?.errorCount24h ?? 0) === 0
                    ? 'bg-[var(--success)]'
                    : (health?.errorCount24h ?? 0) <= 5
                    ? 'bg-[var(--warning)]'
                    : 'bg-[var(--danger)]'
                }`}
              />
              <p className="text-xs text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text)]">Errors (24h): </span>
                {health?.errorCount24h ?? 0}
              </p>
            </>
          )}
        </div>

        {/* Agent health */}
        <div className="flex items-center gap-2">
          {health?.agentMissing ? (
            <p className="text-xs text-[var(--text-tertiary)]">Agent monitoring not yet configured</p>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text)]">Agents: </span>
              {health?.agentSummary}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
