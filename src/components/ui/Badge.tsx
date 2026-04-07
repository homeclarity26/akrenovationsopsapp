import { cn } from '@/lib/utils'

interface BadgeProps {
  count: number
  className?: string
}

export function Badge({ count, className }: BadgeProps) {
  if (count === 0) return null
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 rounded-full',
        'bg-[var(--rust)] text-white text-[9px] font-bold',
        className
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
