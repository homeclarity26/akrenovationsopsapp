import { useState, useRef, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  return (
    <div
      ref={ref}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onTouchStart={() => setOpen(o => !o)}
    >
      {children}
      {open && (
        <div
          ref={tipRef}
          role="tooltip"
          className={cn(
            'absolute z-50 px-2.5 py-1.5 text-xs text-white bg-[var(--navy)] rounded-lg shadow-lg',
            'whitespace-nowrap pointer-events-none animate-in fade-in-0 zoom-in-95',
            'left-1/2 -translate-x-1/2',
            side === 'top' && 'bottom-full mb-2',
            side === 'bottom' && 'top-full mt-2',
          )}
        >
          {content}
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--navy)] rotate-45',
              side === 'top' && '-bottom-1',
              side === 'bottom' && '-top-1',
            )}
          />
        </div>
      )}
    </div>
  )
}
