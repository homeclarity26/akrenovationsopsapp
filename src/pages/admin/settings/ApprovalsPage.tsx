import { useState } from 'react'
import { Check, X, Edit2, AlertTriangle, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type RiskLevel = 'low' | 'medium' | 'high'

const RISK_COLORS: Record<RiskLevel, string> = {
  low:    'bg-[var(--success-bg)] text-[var(--success)]',
  medium: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  high:   'bg-[var(--danger-bg)] text-[var(--danger)]',
}

const RISK_ICON: Record<RiskLevel, React.ReactNode> = {
  low:    <Info size={12} />,
  medium: <AlertTriangle size={12} />,
  high:   <AlertTriangle size={12} />,
}

export function ApprovalsPage() {
  const queryClient = useQueryClient()
  const { data: rawActions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['ai-actions-pending'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_actions')
        .select('*')
        .eq('status', 'pending')
        .eq('requires_approval', true)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [mutationError, setMutationError] = useState<string | null>(null)

  const actions = rawActions

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, editedBody }: { id: string; status: 'approved' | 'rejected'; editedBody?: string }) => {
      const patch: Record<string, unknown> = { status }
      if (status === 'approved') {
        patch.approved_at = new Date().toISOString()
        const { data: userData } = await supabase.auth.getUser()
        if (userData?.user?.id) patch.approved_by = userData.user.id
      }
      if (editedBody !== undefined) {
        const original = rawActions.find(a => a.id === id) as Record<string, unknown> | undefined
        const originalData = (original?.action_data ?? {}) as Record<string, unknown>
        patch.action_data = { ...originalData, body: editedBody, edited: true }
      }
      const { error } = await supabase.from('ai_actions').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setMutationError(null)
      queryClient.invalidateQueries({ queryKey: ['ai-actions-pending'] })
    },
    onError: (err: unknown) => {
      setMutationError(err instanceof Error ? err.message : String(err))
    },
  })

  const approve = (id: string) => {
    updateStatus.mutate({ id, status: 'approved' })
  }

  const reject = (id: string) => {
    updateStatus.mutate({ id, status: 'rejected' })
  }

  const startEdit = (action: typeof actions[0]) => {
    const data = (action as Record<string, unknown>).action_data as Record<string, unknown> | null | undefined
    const bodyFromData = data && typeof data.body === 'string' ? (data.body as string) : null
    setEditingId(action.id)
    setEditContent(bodyFromData ?? action.request_text ?? '')
  }

  const approveEdited = (id: string) => {
    updateStatus.mutate({ id, status: 'approved', editedBody: editContent })
    setEditingId(null)
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
        <PageHeader title="Pending Approvals" subtitle="Loading..." />
        <div className="text-sm text-[var(--text-secondary)] text-center py-8">Loading pending approvals...</div>
      </div>
    )
  }

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load approvals. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader title="Pending Approvals" subtitle={`${actions.length} action${actions.length !== 1 ? 's' : ''} waiting for review`} />

      {mutationError && (
        <Card>
          <p className="text-sm text-[var(--danger)]">Couldn't save change: {mutationError}</p>
        </Card>
      )}

      {actions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--success-bg)] flex items-center justify-center mb-3">
              <Check size={22} className="text-[var(--success)]" />
            </div>
            <p className="font-semibold text-[var(--text)] mb-1">All clear</p>
            <p className="text-sm text-[var(--text-secondary)]">No pending approvals. The AI is all caught up.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {actions.map(action => {
            const risk = (action.risk_level ?? 'medium') as RiskLevel
            const isEditing = editingId === action.id

            return (
              <Card key={action.id}>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)]">{action.action_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      {new Date(action.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${RISK_COLORS[risk]}`}>
                    {RISK_ICON[risk]}
                    {risk}
                  </span>
                </div>

                {/* Draft content */}
                <div className="bg-[var(--bg)] rounded-xl p-3 mb-3">
                  {isEditing ? (
                    <textarea
                      className="w-full text-sm text-[var(--text)] bg-transparent focus:outline-none resize-none"
                      rows={4}
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                    />
                  ) : (
                    (() => {
                      const data = (action as Record<string, unknown>).action_data as Record<string, unknown> | null | undefined
                      const body = data && typeof data.body === 'string' ? (data.body as string) : null
                      const request = (action.request_text ?? '').replace(/\bundefined\b/g, '(unnamed)')
                      return (
                        <>
                          <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{request}</p>
                          {body && (
                            <p className="text-xs text-[var(--text-secondary)] mt-2 whitespace-pre-wrap">{body}</p>
                          )}
                        </>
                      )
                    })()
                  )}
                </div>

                {/* Actions */}
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveEdited(action.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold min-h-[44px]"
                    >
                      <Check size={14} />
                      Approve edited
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] min-h-[44px]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(action.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold min-h-[44px]"
                    >
                      <Check size={14} />
                      Approve
                    </button>
                    <button
                      onClick={() => startEdit(action)}
                      className="px-3 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center min-h-[44px]"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => reject(action.id)}
                      className="px-3 py-2.5 rounded-xl border border-[var(--danger)]/30 text-[var(--danger)] flex items-center justify-center min-h-[44px]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
