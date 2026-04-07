import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export function Card({ children, className, onClick, padding = 'md' }: CardProps) {
  const padMap = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-[var(--border-light)]',
        padMap[padding],
        onClick && 'cursor-pointer active:scale-[0.99] transition-transform',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: string | number
  subtitle?: string
  className?: string
}

export function MetricCard({ label, value, subtitle, className }: MetricCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-[var(--border-light)] p-4', className)}>
      <p className="uppercase text-[10px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] font-body mb-1">
        {label}
      </p>
      <p className="font-display text-2xl text-[var(--text)] leading-tight">{value}</p>
      {subtitle && (
        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}
