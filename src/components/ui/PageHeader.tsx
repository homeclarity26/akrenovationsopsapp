interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 pt-2">
      <div>
        <h1 className="font-display text-[26px] leading-tight text-[var(--navy)]">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 pt-1">{action}</div>}
    </div>
  )
}
