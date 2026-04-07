import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--text)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full px-3.5 py-3 rounded-[14px] border-[1.5px] border-[var(--border)]',
          'bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
          'focus:outline-none focus:border-[var(--navy)] transition-colors',
          error && 'border-[var(--danger)] focus:border-[var(--danger)]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  )
}
