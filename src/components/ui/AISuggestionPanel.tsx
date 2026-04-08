/**
 * Phase N — Universal Template System
 * N33: AI Suggestion Panel
 * Displays AI-suggested items below a list. Tap to add, dismiss rest.
 */

import { useState } from 'react'
import { Sparkles, Plus, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface AISuggestion {
  title: string
  description?: string
  rationale?: string
}

interface AISuggestionPanelProps {
  deliverableType: string
  currentItems: Array<Record<string, unknown>>
  projectContext: Record<string, unknown>
  onAdd: (suggestion: AISuggestion) => void
  className?: string
}

export function AISuggestionPanel({
  deliverableType,
  currentItems,
  projectContext,
  onAdd,
  className,
}: AISuggestionPanelProps) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)

  async function fetchSuggestions() {
    setLoading(true)
    setError(null)
    setSuggestions([])
    setDismissed(new Set())

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('suggest-deliverable-items', {
        body: { deliverableType, currentItems, projectContext },
      })

      if (fnErr) throw fnErr
      setSuggestions(data?.suggestions ?? [])
      setFetched(true)
    } catch (err) {
      setError('Could not load suggestions. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleAdd(idx: number) {
    const sug = suggestions[idx]
    if (!sug) return
    onAdd(sug)
    setDismissed((prev) => new Set([...prev, idx]))
  }

  function handleDismiss(idx: number) {
    setDismissed((prev) => new Set([...prev, idx]))
  }

  const visibleSuggestions = suggestions.filter((_, idx) => !dismissed.has(idx))

  return (
    <div className={cn('space-y-2', className)}>
      {!fetched && (
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-[var(--navy)] hover:text-[var(--navy-light)] font-medium disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? 'Getting AI suggestions...' : 'Ask AI to suggest items'}
        </button>
      )}

      {error && (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      )}

      {fetched && visibleSuggestions.length === 0 && (
        <p className="text-xs text-[var(--text-tertiary)]">No more suggestions. All added or dismissed.</p>
      )}

      {visibleSuggestions.length > 0 && (
        <div className="border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-[var(--navy)] flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-white" />
            <span className="text-xs text-white font-medium">AI suggestions — tap to add</span>
          </div>
          <div className="divide-y divide-[var(--border-light)]">
            {suggestions.map((sug, idx) => {
              if (dismissed.has(idx)) return null
              return (
                <div key={idx} className="flex items-start gap-3 p-3 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] leading-snug">{sug.title}</p>
                    {sug.rationale && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{sug.rationale}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleAdd(idx)}
                      className="p-1.5 rounded-lg bg-[var(--navy)] text-white hover:bg-[var(--navy-light)] transition-colors"
                      title="Add this item"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDismiss(idx)}
                      className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 transition-colors"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
