// SuggestionCards — proactive context-aware quick starts shown on chat open.
// Each card invokes a tool directly via the parent's onPick.

import { ChevronRight } from 'lucide-react'
import type { SuggestionItem } from '@/lib/assistant/types'

interface Props {
  suggestions: SuggestionItem[]
  onPick: (s: SuggestionItem) => void
}

export function SuggestionCards({ suggestions, onPick }: Props) {
  if (suggestions.length === 0) return null
  return (
    <div className="space-y-1.5 px-1">
      <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-2">
        Quick starts
      </p>
      {suggestions.map((s) => (
        <button
          key={s.id}
          onClick={() => onPick(s)}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-2xl bg-white border border-[var(--border-light)] hover:border-[var(--navy)] transition-colors text-left"
        >
          <span className="text-xl">{s.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text)]">{s.label}</p>
            {s.hint && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">{s.hint}</p>}
          </div>
          <ChevronRight size={16} className="text-[var(--text-tertiary)] shrink-0" />
        </button>
      ))}
    </div>
  )
}
