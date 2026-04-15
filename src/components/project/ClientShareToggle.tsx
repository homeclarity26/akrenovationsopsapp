import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Tables that carry a per-row visible_to_client flag. Keep this list in
// sync with the 20260415000400_per_item_client_visibility.sql migration.
export type ClientShareTable =
  | 'shopping_list_items'
  | 'project_photos'
  | 'change_orders'
  | 'punch_list_items'
  | 'daily_logs'
  | 'warranty_claims'

interface Props {
  table: ClientShareTable
  rowId: string
  visible: boolean
  className?: string
}

/**
 * Tiny admin-only toggle that flips `visible_to_client` on a row. Realtime
 * (PR 2) pushes the updated row back to every open tab, so we don't need
 * manual query-cache invalidation.
 */
export function ClientShareToggle({ table, rowId, visible, className }: Props) {
  const [pending, setPending] = useState(false)
  // Optimistic local state so the icon flips instantly; realtime confirms.
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const current = optimistic ?? visible

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (pending) return
    setPending(true)
    const next = !current
    setOptimistic(next)
    const { error } = await supabase
      .from(table)
      .update({ visible_to_client: next })
      .eq('id', rowId)
    if (error) {
      console.warn('[client-share] toggle failed:', error.message)
      setOptimistic(current) // revert
    }
    setPending(false)
  }

  const Icon = current ? Eye : EyeOff
  const title = current
    ? 'Visible in client portal — click to hide'
    : 'Hidden from client — click to share'

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors flex-shrink-0',
        current
          ? 'text-[var(--success)] hover:bg-[var(--success-bg)]'
          : 'text-[var(--text-tertiary)] hover:bg-[var(--bg)] hover:text-[var(--text-secondary)]',
        pending && 'opacity-50 cursor-wait',
        className,
      )}
    >
      <Icon size={14} />
    </button>
  )
}
