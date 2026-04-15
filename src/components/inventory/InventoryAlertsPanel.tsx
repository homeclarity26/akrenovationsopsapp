import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, XCircle, Clock, Check, X, Eye } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

type AlertType = 'low_stock' | 'out_of_stock' | 'stale_count'
type AlertStatus = 'acknowledged' | 'resolved' | 'dismissed'

interface AlertRow {
  id: string
  company_id: string
  item_id: string
  alert_type: AlertType
  current_total: number
  threshold: number | null
  summary: string
  recommendation: string | null
  status: string
  created_at: string
  inventory_items: {
    name: string
    unit: string
    vendor: string | null
  } | null
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))
  if (diffSec < 45) return 'just now'
  if (diffSec < 90) return '1 min ago'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

function alertIcon(type: AlertType) {
  switch (type) {
    case 'out_of_stock':
      return <XCircle size={16} className="text-[var(--danger)]" />
    case 'low_stock':
      return <AlertCircle size={16} className="text-[var(--warning)]" />
    case 'stale_count':
      return <Clock size={16} className="text-[var(--text-tertiary)]" />
  }
}

interface InventoryAlertsPanelProps {
  /**
   * When provided, clicking an alert row (outside the action buttons)
   * calls this with the alert's item_id — used to jump the parent's tab
   * state to the Stock matrix filtered to that item.
   */
  onItemClick?: (itemId: string) => void
}

export function InventoryAlertsPanel({ onItemClick }: InventoryAlertsPanelProps = {}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const companyId = user?.company_id ?? undefined
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: alerts = [], isLoading } = useQuery<AlertRow[]>({
    queryKey: ['inventory_alerts', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_alerts')
        .select(
          'id, company_id, item_id, alert_type, current_total, threshold, summary, recommendation, status, created_at, inventory_items(name, unit, vendor)',
        )
        .eq('company_id', companyId!)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AlertRow[]
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatus }) => {
      const { error } = await supabase
        .from('inventory_alerts')
        .update({
          status,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_alerts'] })
    },
  })

  const handleAction = (id: string, status: AlertStatus) => {
    setBusyId(id)
    updateMutation.mutate(
      { id, status },
      { onSettled: () => setBusyId(null) },
    )
  }

  if (!companyId) {
    return (
      <Card>
        <p className="text-sm text-[var(--text-secondary)] text-center py-4">
          No company loaded.
        </p>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
          Loading alerts…
        </p>
      </Card>
    )
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--text-secondary)] text-center py-6">
          No open inventory alerts — all good.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map(a => {
        const itemName = a.inventory_items?.name ?? 'Unknown item'
        const clickable = !!onItemClick
        return (
          <div
            key={a.id}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `View stock for ${itemName}` : undefined}
            onClick={clickable ? () => onItemClick!(a.item_id) : undefined}
            onKeyDown={
              clickable
                ? e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onItemClick!(a.item_id)
                    }
                  }
                : undefined
            }
            className={cn(
              'rounded-xl',
              clickable && 'cursor-pointer hover:ring-2 hover:ring-[var(--navy)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--navy)] transition-all',
            )}
          >
          <Card padding="md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{alertIcon(a.alert_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text)] truncate">{itemName}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{a.summary}</p>
                    {a.recommendation && (
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                        {a.recommendation}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
                    {formatRelativeTime(a.created_at)}
                  </div>
                </div>
                <div
                  className="flex flex-wrap gap-1.5 mt-2"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    disabled={busyId === a.id}
                    onClick={e => { e.stopPropagation(); handleAction(a.id, 'acknowledged') }}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border',
                      'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)]',
                      busyId === a.id && 'opacity-50 pointer-events-none',
                    )}
                  >
                    <Eye size={11} /> Acknowledge
                  </button>
                  <button
                    disabled={busyId === a.id}
                    onClick={e => { e.stopPropagation(); handleAction(a.id, 'resolved') }}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium',
                      'bg-[var(--navy)] text-white hover:opacity-90',
                      busyId === a.id && 'opacity-50 pointer-events-none',
                    )}
                  >
                    <Check size={11} /> Resolve
                  </button>
                  <button
                    disabled={busyId === a.id}
                    onClick={e => { e.stopPropagation(); handleAction(a.id, 'dismissed') }}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border',
                      'border-[var(--border)] text-[var(--text-tertiary)] hover:bg-[var(--bg)]',
                      busyId === a.id && 'opacity-50 pointer-events-none',
                    )}
                  >
                    <X size={11} /> Dismiss
                  </button>
                </div>
              </div>
            </div>
          </Card>
          </div>
        )
      })}
    </div>
  )
}
