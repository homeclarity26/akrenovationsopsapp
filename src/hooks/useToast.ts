import { useMemo, useSyncExternalStore } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  action?: ToastAction
}

// ── Store (module-level singleton) ──────────────────────────────────────────

let toasts: ToastItem[] = []
let nextId = 0
const listeners = new Set<() => void>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

const MAX_VISIBLE = 3
const AUTO_DISMISS_MS = 4000

function emit() {
  listeners.forEach((l) => l())
}

function addToast(type: ToastType, message: string, action?: ToastAction) {
  const id = `toast-${++nextId}`
  toasts = [...toasts, { id, type, message, action }]

  // If we exceed max visible, remove the oldest
  if (toasts.length > MAX_VISIBLE) {
    const removed = toasts[0]
    toasts = toasts.slice(1)
    const t = timers.get(removed.id)
    if (t) {
      clearTimeout(t)
      timers.delete(removed.id)
    }
  }

  emit()

  // Auto-dismiss
  timers.set(
    id,
    setTimeout(() => {
      dismiss(id)
    }, AUTO_DISMISS_MS),
  )
}

function dismiss(id: string) {
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

// ── Public API ──────────────────────────────────────────────────────────────

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ToastItem[] {
  return toasts
}

/**
 * Hook: useToast()
 *
 * Returns a `toast` object with `.success()`, `.error()`, `.warning()`, `.info()`.
 * Also exposes `toasts` (current visible list) and `dismiss(id)`.
 *
 * ```ts
 * const { toast } = useToast()
 * toast.success('Clock out saved')
 * toast.error('Failed to save')
 * toast.warning('No items selected')
 * toast.info('Syncing...')
 * ```
 */
export function useToast() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const toast = useMemo(
    () => ({
      success: (msg: string, action?: ToastAction) => addToast('success', msg, action),
      error: (msg: string, action?: ToastAction) => addToast('error', msg, action),
      warning: (msg: string, action?: ToastAction) => addToast('warning', msg, action),
      info: (msg: string, action?: ToastAction) => addToast('info', msg, action),
    }),
    [],
  )

  return { toast, toasts: items, dismiss }
}
