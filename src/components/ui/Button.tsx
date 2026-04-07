import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'ai'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none'

  const variants = {
    primary:   'bg-[var(--navy)] text-white hover:bg-[var(--navy-light)]',
    secondary: 'bg-white text-[var(--navy)] border border-[var(--border)] hover:bg-gray-50',
    danger:    'bg-[var(--rust)] text-white hover:bg-[var(--rust-light)]',
    ghost:     'text-[var(--text-secondary)] hover:bg-gray-100',
    ai:        'bg-[var(--navy)] text-white hover:bg-[var(--navy-light)] shadow-sm',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-3.5 text-sm',
    lg: 'px-5 py-4 text-base',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {children}
    </button>
  )
}
