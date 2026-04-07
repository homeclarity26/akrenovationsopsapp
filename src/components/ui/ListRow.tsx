import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ListRowProps {
  children: React.ReactNode
  onClick?: () => void
  showChevron?: boolean
  className?: string
}

export function ListRow({ children, onClick, showChevron = true, className }: ListRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-4 px-4 border-b border-[var(--border-light)] last:border-0',
        'min-h-[56px]',
        onClick && 'cursor-pointer active:bg-gray-50 transition-colors',
        className
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {onClick && showChevron && (
        <ChevronRight size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
      )}
    </div>
  )
}
