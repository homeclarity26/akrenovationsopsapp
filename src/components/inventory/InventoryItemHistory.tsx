// PR 18 — Inventory item history timeline modal.
//
// Shows "who counted what when, across locations" for a single
// inventory_item. Opens from the Items tab via a clock icon on each row.
// Pattern: bottom-sheet on mobile, centered modal on desktop — reusing the
// layout idioms from PhotoStocktakeModal so we don't introduce a new
// component family just for this sheet.

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Camera, X, User as UserIcon, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { LocationTypePill, type LocationType } from './LocationTypePill'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Confidence = 'exact' | 'rough' | 'estimate'

export interface InventoryItemHistoryProps {
  open: boolean
  onClose: () => void
  item: {
    id: string
    name: string
    unit: string
  } | null
  /**
   * Optional "total across all locations right now" — shown in the header.
   * Passed in from the caller so we don't have to refetch it here.
   */
  totalOnHand?: number
}

interface StocktakeRow {
  id: string
  created_at: string
  location_id: string
  counted_by: string | null
  quantity_before: number | null
  quantity_after: number
  delta: number | null
  confidence: Confidence
  notes: string | null
  source: string
  photo_url: string | null
  inventory_locations: {
    name: string
    type: LocationType
  } | null
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
    email: string | null
  } | null
}

const PAGE_SIZE = 50

// Pills per confidence — mirrors PhotoStocktakeModal's AI_CONF_STYLES.
const CONF_STYLES: Record<Confidence, string> = {
  exact:    'bg-[var(--success-bg)] text-[var(--success)]',
  rough:    'bg-[var(--warning-bg)] text-[var(--warning)]',
  estimate: 'bg-[var(--rust)]/10 text-[var(--rust)]',
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function groupByDay(rows: StocktakeRow[]): Array<{ label: string; rows: StocktakeRow[] }> {
  const buckets = new Map<string, StocktakeRow[]>()
  for (const r of rows) {
    const d = new Date(r.created_at)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const existing = buckets.get(key)
    if (existing) {
      existing.push(r)
    } else {
      buckets.set(key, [r])
    }
  }
  // Maintain inserted order (rows come back sorted DESC already).
  return Array.from(buckets.values()).map(group => ({
    label: formatDayHeader(group[0].created_at),
    rows: group,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function InventoryItemHistory({
  open,
  onClose,
  item,
  totalOnHand,
}: InventoryItemHistoryProps) {
  const [page, setPage] = useState(0)
  const [allRows, setAllRows] = useState<StocktakeRow[]>([])

  // Reset pagination whenever a new item is opened or the modal is reopened.
  useEffect(() => {
    if (!open) return
    setPage(0)
    setAllRows([])
  }, [open, item?.id])

  const itemId = item?.id ?? null

  const { data: pageRows, isLoading, isFetching, error } = useQuery<StocktakeRow[]>({
    queryKey: ['inventory_item_history', itemId, page],
    enabled: open && !!itemId,
    queryFn: async () => {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error: qErr } = await supabase
        .from('inventory_stocktakes')
        .select(
          'id, created_at, location_id, counted_by, quantity_before, quantity_after, delta, confidence, notes, source, photo_url, inventory_locations(name, type), profiles(id, full_name, avatar_url, email)',
        )
        .eq('item_id', itemId!)
        .order('created_at', { ascending: false })
        .range(from, to)
      if (qErr) throw qErr
      return (data ?? []) as unknown as StocktakeRow[]
    },
  })

  // Append each newly-fetched page into the visible list.
  useEffect(() => {
    if (!pageRows) return
    setAllRows(prev => {
      if (page === 0) return pageRows
      // Guard against double-append if the same page arrives twice (e.g.
      // react-query cache revalidation). Key off the stocktake id.
      const seen = new Set(prev.map(r => r.id))
      const append = pageRows.filter(r => !seen.has(r.id))
      return append.length === 0 ? prev : [...prev, ...append]
    })
  }, [pageRows, page])

  const hasMore = (pageRows?.length ?? 0) === PAGE_SIZE

  const grouped = useMemo(() => groupByDay(allRows), [allRows])

  async function openPhoto(photoUrl: string) {
    // photo_url is stored as "bucket/path" (see PhotoStocktakeModal); make a
    // fresh signed URL and open it in a new tab. Legacy rows may contain a
    // raw URL — in that case just open it directly.
    if (photoUrl.startsWith('http')) {
      window.open(photoUrl, '_blank', 'noopener,noreferrer')
      return
    }
    const firstSlash = photoUrl.indexOf('/')
    if (firstSlash === -1) return
    const bucket = photoUrl.slice(0, firstSlash)
    const path = photoUrl.slice(firstSlash + 1)
    const { data, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 5)
    if (signErr || !data?.signedUrl) return
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (!open || !item) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-2 min-w-0">
            <Clock size={18} className="text-[var(--navy)] flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-[18px] text-[var(--navy)] truncate">
                {item.name}
              </h2>
              <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                Stocktake history
                {typeof totalOnHand === 'number' && (
                  <>
                    {' · '}
                    <span className="font-mono text-[var(--text-secondary)]">
                      {totalOnHand} {item.unit}
                    </span>
                    {' on hand'}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4">
              <Card className="border-[var(--rust)]/40 bg-[var(--rust)]/5">
                <p className="text-[12px] text-[var(--rust)]">
                  Couldn't load history: {error instanceof Error ? error.message : String(error)}
                </p>
              </Card>
            </div>
          )}

          {isLoading && allRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
              <Loader2 size={20} className="text-[var(--navy)] animate-spin" />
              <p className="text-[12px] text-[var(--text-tertiary)]">Loading history…</p>
            </div>
          ) : allRows.length === 0 && !isLoading ? (
            <div className="p-6">
              <Card>
                <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                  No stocktake history yet for this item.
                </p>
              </Card>
            </div>
          ) : (
            <div className="p-3 space-y-4">
              {grouped.map(group => (
                <section key={group.label} className="space-y-2">
                  <div className="sticky top-0 z-10 bg-white/95 backdrop-blur py-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {group.label}
                    </p>
                  </div>
                  {group.rows.map(row => {
                    const delta = row.delta ?? (row.quantity_before !== null
                      ? row.quantity_after - Number(row.quantity_before)
                      : null)
                    const deltaSign = delta === null ? null : delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'zero'
                    const counter = row.profiles
                    const location = row.inventory_locations
                    return (
                      <Card key={row.id} padding="sm" className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-semibold text-sm text-[var(--text)] truncate">
                              {location?.name ?? 'Unknown location'}
                            </span>
                            {location?.type && <LocationTypePill type={location.type} />}
                          </div>
                          <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
                            {formatTime(row.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-[var(--text-secondary)]">
                            {row.quantity_before ?? '—'}
                            <span className="mx-1 text-[var(--text-tertiary)]">→</span>
                            <span className="font-semibold text-[var(--text)]">
                              {row.quantity_after}
                            </span>
                            <span className="text-[10px] text-[var(--text-tertiary)] ml-1">{item.unit}</span>
                          </span>
                          {delta !== null && (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                deltaSign === 'pos' && 'bg-[var(--success-bg)] text-[var(--success)]',
                                deltaSign === 'neg' && 'bg-[var(--warning-bg)] text-[var(--warning)]',
                                deltaSign === 'zero' && 'bg-[var(--bg)] text-[var(--text-tertiary)]',
                              )}
                            >
                              {delta > 0 ? '+' : ''}{delta}
                            </span>
                          )}
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                              CONF_STYLES[row.confidence],
                            )}
                          >
                            {row.confidence}
                          </span>
                          {row.photo_url && (
                            <button
                              type="button"
                              onClick={() => openPhoto(row.photo_url!)}
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-[var(--navy)]/10 text-[var(--navy)] hover:bg-[var(--navy)]/20"
                              aria-label="View photo for this count"
                              title="Open source photo"
                            >
                              <Camera size={10} />
                              photo
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                          {counter?.avatar_url ? (
                            <img
                              src={counter.avatar_url}
                              alt=""
                              className="w-4 h-4 rounded-full object-cover"
                            />
                          ) : (
                            <UserIcon size={11} />
                          )}
                          <span className="truncate">
                            {counter?.full_name ?? counter?.email ?? 'Unknown counter'}
                          </span>
                        </div>

                        {row.notes && (
                          <p className="text-[11px] text-[var(--text-secondary)] italic leading-snug">
                            {row.notes}
                          </p>
                        )}
                      </Card>
                    )
                  })}
                </section>
              ))}

              {hasMore && (
                <div className="flex justify-center pt-2 pb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={isFetching}
                  >
                    {isFetching ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border-light)] flex items-center gap-2 bg-white">
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
