import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function PasswordInput({ label, error, hint, className, id, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--text)]">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={showPassword ? 'text' : 'password'}
          className={cn(
            'w-full px-3.5 py-3 rounded-[14px] border-[1.5px] border-[var(--border)]',
            'bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
            'focus:outline-none focus:border-[var(--navy)] transition-colors',
            'pr-11',
            error && 'border-[var(--danger)] focus:border-[var(--danger)]',
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  )
}
