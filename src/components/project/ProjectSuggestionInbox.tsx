import { useMemo, useState } from 'react'
import { Sparkles, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  useProjectSuggestions,
  type ProjectSuggestionRow,
} from '@/hooks/useProjectSuggestions'

interface Props {
  projectId: string
  /** How many pending rows to render inline before the "Show N more" link. */
  previewLimit?: number
  className?: string
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

function SuggestionRow({ row }: { row: ProjectSuggestionRow }) {
  const [expanded, setExpanded] = useState(false)
  const [showRejectPrompt, setShowRejectPrompt] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    setBusy('approve')
    setError(null)
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'apply-project-suggestion',
        { body: { suggestion_id: row.id } },
      )
      if (invokeErr) throw invokeErr
      const resp = data as { success?: boolean; error?: string } | null
      if (resp && resp.success === false) {
        throw new Error(resp.error ?? 'Apply failed')
      }
      // Realtime sub will update the list.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleReject = async () => {
    setBusy('reject')
    setError(null)
    try {
      const { error: invokeErr } = await supabase.functions.invoke(
        'reject-project-suggestion',
        { body: { suggestion_id: row.id, reason: rejectReason || undefined } },
      )
      if (invokeErr) throw invokeErr
      setShowRejectPrompt(false)
      setRejectReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
          <Sparkles size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              {row.suggestion_type}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {formatRelativeTime(row.created_at)}
            </span>
          </div>
          <p className="text-sm font-semibold text-[var(--text)] leading-snug">
            {row.summary}
          </p>
          {row.rationale && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              {row.rationale}
            </p>
          )}

          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mt-2"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            View proposed change
          </button>
          {expanded && (
            <pre className="mt-2 p-3 rounded-lg bg-[var(--bg)] text-[11px] font-mono text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(row.proposed_action, null, 2)}
            </pre>
          )}

          {error && (
            <p className="text-xs text-[var(--danger)] mt-2">{error}</p>
          )}

          {showRejectPrompt ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Optional reason…"
                rows={2}
                className="w-full text-sm border border-[var(--border-light)] rounded-lg px-3 py-2 bg-white"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  disabled={busy !== null}
                  className="text-xs font-semibold bg-[var(--danger)] text-white px-3 py-1.5 rounded-lg disabled:opacity-60"
                >
                  {busy === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectPrompt(false)
                    setRejectReason('')
                  }}
                  disabled={busy !== null}
                  className="text-xs font-semibold text-[var(--text-secondary)] px-3 py-1.5 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleApprove}
                disabled={busy !== null}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[var(--navy)] px-3 py-1.5 rounded-lg',
                  'disabled:opacity-60',
                )}
              >
                <Check size={12} />
                {busy === 'approve' ? 'Applying…' : 'Approve'}
              </button>
              <button
                onClick={() => setShowRejectPrompt(true)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                <X size={12} />
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export function ProjectSuggestionInbox({ projectId, previewLimit = 5, className }: Props) {
  const { data = [], isLoading, error } = useProjectSuggestions(projectId, {
    statusFilter: 'pending',
  })
  const [showAll, setShowAll] = useState(false)

  const visible = useMemo(
    () => (showAll ? data : data.slice(0, previewLimit)),
    [data, showAll, previewLimit],
  )
  const hiddenCount = Math.max(0, data.length - previewLimit)

  // Render nothing if there's nothing pending — the parent uses this to gate
  // the whole banner's visibility.
  if (!isLoading && !error && data.length === 0) return null

  return (
    <Card padding="none" className={cn('border-purple-200 bg-purple-50/30', className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-100">
        <Sparkles size={14} className="text-purple-700" />
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-900">
          AI Suggestions
        </p>
        {data.length > 0 && (
          <span className="text-[10px] font-mono text-purple-700">
            {data.length} pending
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="px-4 py-4 text-xs text-[var(--text-tertiary)]">Loading…</div>
      ) : error ? (
        <div className="px-4 py-4 text-xs text-[var(--danger)]">
          Couldn't load suggestions.
        </div>
      ) : data.length === 0 ? (
        <div className="px-4 py-4 text-xs text-[var(--text-tertiary)]">
          No AI suggestions.
        </div>
      ) : (
        <>
          <ul className="divide-y divide-purple-100">
            {visible.map((row) => (
              <SuggestionRow key={row.id} row={row} />
            ))}
          </ul>
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100/50 border-t border-purple-100"
            >
              Show {hiddenCount} more
            </button>
          )}
        </>
      )}
    </Card>
  )
}
