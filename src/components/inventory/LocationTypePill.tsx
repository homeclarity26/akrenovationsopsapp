import { cn } from '@/lib/utils'

export type LocationType = 'shop' | 'truck' | 'trailer' | 'jobsite' | 'other'

const TYPE_LABELS: Record<LocationType, string> = {
  shop: 'Shop',
  truck: 'Truck',
  trailer: 'Trailer',
  jobsite: 'Jobsite',
  other: 'Other',
}

const TYPE_COLORS: Record<LocationType, { bg: string; text: string }> = {
  shop:    { bg: 'bg-blue-50',                text: 'text-[var(--navy)]' },
  truck:   { bg: 'bg-[var(--success-bg)]',    text: 'text-[var(--success)]' },
  trailer: { bg: 'bg-[var(--warning-bg)]',    text: 'text-[var(--warning)]' },
  jobsite: { bg: 'bg-[var(--cream-light)]',   text: 'text-[var(--text-secondary)]' },
  other:   { bg: 'bg-gray-50',                text: 'text-[var(--text-tertiary)]' },
}

interface Props {
  type: LocationType
  className?: string
}

export function LocationTypePill({ type, className }: Props) {
  const cfg = TYPE_COLORS[type] ?? TYPE_COLORS.other
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
        cfg.bg,
        cfg.text,
        className,
      )}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}
