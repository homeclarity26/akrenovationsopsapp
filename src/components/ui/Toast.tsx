import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast, type ToastType } from '@/hooks/useToast'

// ── Styling maps ─────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-[var(--success)] text-white',
  error: 'bg-[var(--danger,#dc2626)] text-white',
  warning: 'bg-[var(--warning)] text-white',
  info: 'bg-[var(--navy)] text-white',
}

const TYPE_ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

// ── ToastProvider ────────────────────────────────────────────────────────────

/**
 * Renders the global toast stack.
 * Wrap your app with `<ToastProvider />` (one-line in App.tsx).
 *
 * Position: bottom-center on mobile (<768px), top-right on desktop.
 */
export function ToastProvider() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed z-[9999] flex flex-col gap-2 pointer-events-none
        bottom-20 left-1/2 -translate-x-1/2
        md:bottom-auto md:top-4 md:right-4 md:left-auto md:translate-x-0"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <ToastBubble key={t.id} id={t.id} type={t.type} message={t.message} action={t.action} onDismiss={dismiss} />
      ))}
    </div>
  )
}

// ── Single toast bubble ──────────────────────────────────────────────────────

function ToastBubble({
  id,
  type,
  message,
  action,
  onDismiss,
}: {
  id: string
  type: ToastType
  message: string
  action?: { label: string; onClick: () => void }
  onDismiss: (id: string) => void
}) {
  const [show, setShow] = useState(false)
  const Icon = TYPE_ICONS[type]

  // Slide-in animation
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 shadow-lg text-sm font-medium
        max-w-[90vw] md:max-w-sm transition-all duration-200 ease-out
        ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        ${TYPE_STYLES[type]}`}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate">{message}</span>
      {action && (
        <button
          onClick={() => {
            action.onClick()
            onDismiss(id)
          }}
          className="ml-1 font-semibold underline underline-offset-2 whitespace-nowrap"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(id)}
        className="ml-1 opacity-70 hover:opacity-100 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
