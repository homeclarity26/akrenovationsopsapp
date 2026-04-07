import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      <h2 className="uppercase text-[13px] font-semibold tracking-[0.06em] text-[var(--text)] font-body">
        {title}
      </h2>
      {action}
    </div>
  )
}
