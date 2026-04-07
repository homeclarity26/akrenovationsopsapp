import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BudgetStage = 1 | 2 | 3 | 4

interface Props {
  current: BudgetStage
  maxReached: BudgetStage
  onChange: (stage: BudgetStage) => void
}

const STAGES: { n: BudgetStage; label: string }[] = [
  { n: 1, label: 'Setup' },
  { n: 2, label: 'Quotes' },
  { n: 3, label: 'Selections' },
  { n: 4, label: 'Final Price' },
]

export function BudgetStageIndicator({ current, maxReached, onChange }: Props) {
  return (
    <div className="flex items-center gap-0 bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-3">
      {STAGES.map((s, i) => {
        const done    = s.n < current
        const active  = s.n === current
        const reachable = s.n <= maxReached
        const last    = i === STAGES.length - 1

        return (
          <div key={s.n} className="flex items-center flex-1">
            <button
              onClick={() => reachable && onChange(s.n)}
              disabled={!reachable}
              className={cn(
                'flex flex-col items-center gap-1 flex-1 transition-all',
                reachable ? 'cursor-pointer' : 'cursor-default opacity-40'
              )}
            >
              {/* Circle */}
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                done   ? 'bg-[var(--navy)] border-[var(--navy)] text-white'              :
                active ? 'bg-white border-[var(--rust)] text-[var(--rust)]'              :
                         'bg-white border-[var(--border)] text-[var(--text-tertiary)]'
              )}>
                {done ? <Check size={13} /> : s.n}
              </div>
              {/* Label */}
              <span className={cn(
                'text-[10px] font-semibold whitespace-nowrap',
                active  ? 'text-[var(--rust)]'         :
                done    ? 'text-[var(--navy)]'          :
                          'text-[var(--text-tertiary)]'
              )}>
                {s.label}
              </span>
            </button>

            {/* Connector line */}
            {!last && (
              <div className={cn(
                'h-px flex-shrink-0 w-4',
                s.n < current ? 'bg-[var(--navy)]' : 'bg-[var(--border-light)]'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
