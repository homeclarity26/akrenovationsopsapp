import { Briefcase, Hammer } from 'lucide-react'
import { useMode } from '@/context/ModeContext'
import { cn } from '@/lib/utils'

interface ModeToggleProps {
  className?: string
}

export function ModeToggle({ className }: ModeToggleProps) {
  const { currentMode, toggleMode, canToggle } = useMode()

  if (!canToggle) return null

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full bg-[var(--navy)]/10 p-0.5',
        className,
      )}
    >
      <button
        onClick={() => currentMode !== 'admin' && toggleMode()}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200',
          currentMode === 'admin'
            ? 'bg-[var(--navy)] text-white shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--navy)]',
        )}
      >
        <Briefcase size={14} />
        <span className="hidden sm:inline">Admin</span>
      </button>
      <button
        onClick={() => currentMode !== 'field' && toggleMode()}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200',
          currentMode === 'field'
            ? 'bg-[var(--rust)] text-white shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--rust)]',
        )}
      >
        <Hammer size={14} />
        <span className="hidden sm:inline">Field</span>
      </button>
    </div>
  )
}
