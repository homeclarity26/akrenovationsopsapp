// QuickReplyChips — renders Claude's quick-reply options + ALWAYS appends a
// "Something else…" chip. Two layers of enforcement (server forces
// allow_custom=true on every tool result; this renderer ignores the flag and
// just appends regardless) so a multiple-choice trap can never ship.

import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuickReplies } from '@/lib/assistant/types'

interface Props {
  quick_replies: QuickReplies | null | undefined
  onSelect: (value: string, label: string) => void
  onCustom: (placeholder: string) => void
}

export function QuickReplyChips({ quick_replies, onSelect, onCustom }: Props) {
  if (!quick_replies?.options || quick_replies.options.length === 0) return null
  const placeholder = quick_replies.custom_placeholder || 'Something else…'
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {quick_replies.options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value, opt.label)}
          className={cn(
            'px-3 py-2 rounded-full bg-[var(--cream-light)] hover:bg-[var(--cream)]',
            'text-xs font-semibold text-[var(--text)] border border-[var(--border-light)]',
            'min-h-[36px] transition-colors',
          )}
        >
          {opt.label}
        </button>
      ))}
      {/* Always appended — no UI is allowed to ship without an escape hatch. */}
      <button
        onClick={() => onCustom(placeholder)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-full bg-white hover:bg-gray-50',
          'text-xs font-medium text-[var(--text-secondary)] border border-dashed border-[var(--border)]',
          'min-h-[36px] transition-colors',
        )}
      >
        <Pencil size={12} />
        Something else
      </button>
    </div>
  )
}
