import { useState } from 'react'
import { Check, Circle, PenLine } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { MOCK_PUNCH_LIST } from '@/data/mock'

export function ClientPunchList() {
  const [items, setItems] = useState(MOCK_PUNCH_LIST.filter(p => p.project_id === 'proj-1'))
  const [signed, setSigned] = useState(false)

  const open = items.filter(i => i.status === 'open')
  const complete = items.filter(i => i.status === 'complete')
  const allDone = open.length === 0

  const markComplete = (id: string) => {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'complete' as const } : i
    ))
  }

  return (
    <div className="p-4 space-y-5">
      {/* Status bar */}
      <div className={`p-4 rounded-2xl ${allDone ? 'bg-[var(--success-bg)]' : 'bg-[var(--warning-bg)]'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${allDone ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`}>
            {allDone ? <Check size={20} className="text-white" /> : <Circle size={20} className="text-white" />}
          </div>
          <div>
            <p className={`font-semibold text-sm ${allDone ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
              {allDone ? 'All items complete!' : `${open.length} item${open.length !== 1 ? 's' : ''} remaining`}
            </p>
            <p className={`text-xs ${allDone ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
              {complete.length} of {items.length} complete
            </p>
          </div>
        </div>
      </div>

      {/* Open items */}
      {open.length > 0 && (
        <Card padding="none">
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Open Items</p>
          </div>
          {open.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3.5 border-t border-[var(--border-light)]">
              <button
                onClick={() => markComplete(item.id)}
                className="w-6 h-6 rounded-full border-2 border-[var(--border)] flex items-center justify-center flex-shrink-0 hover:border-[var(--navy)] transition-colors"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)]">{item.description}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{item.location}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Complete items */}
      {complete.length > 0 && (
        <Card padding="none">
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Completed</p>
          </div>
          {complete.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3.5 border-t border-[var(--border-light)]">
              <div className="w-6 h-6 rounded-full bg-[var(--success)] flex items-center justify-center flex-shrink-0">
                <Check size={13} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm line-through text-[var(--text-tertiary)]">{item.description}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{item.location}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Final sign-off */}
      {allDone && !signed && (
        <Card>
          <div className="flex items-start gap-3 mb-4">
            <PenLine size={18} className="text-[var(--navy)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--text)]">Final Sign-Off</p>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                All punch list items are complete. Tap below to officially sign off on the project.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSigned(true)}
            className="w-full py-4 rounded-xl bg-[var(--navy)] text-white font-semibold text-sm flex items-center justify-center gap-2"
          >
            <PenLine size={16} />
            Sign Off on Project
          </button>
        </Card>
      )}

      {signed && (
        <div className="text-center p-6">
          <div className="w-16 h-16 rounded-full bg-[var(--success-bg)] flex items-center justify-center mx-auto mb-3">
            <Check size={28} className="text-[var(--success)]" />
          </div>
          <p className="font-display text-xl text-[var(--success)]">Project Signed Off</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Thank you — we appreciate your business!</p>
        </div>
      )}
    </div>
  )
}
