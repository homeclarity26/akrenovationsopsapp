/**
 * Entity index — searches the React Query cache by name substring.
 *
 * Used by the Agent Overlay to offer instant entity search without
 * hitting the network. Falls back gracefully if the cache is cold.
 */

import type { QueryClient } from '@tanstack/react-query'

export interface EntityHit {
  id: string
  name: string
  type: 'project' | 'contact' | 'item'
  /** Optional extra info shown as subtitle. */
  subtitle?: string
}

/**
 * Search the React Query cache for projects, contacts, and inventory items
 * whose name includes `query` (case-insensitive).
 *
 * We read directly from `queryClient.getQueryData` — no fetch. If the cache
 * key doesn't exist yet (page never visited), we simply skip that entity type.
 *
 * Returns at most `limit` results, spread across types.
 */
export function searchEntityCache(
  queryClient: QueryClient,
  query: string,
  limit = 10,
): EntityHit[] {
  const q = query.toLowerCase()
  if (!q) return []

  const results: EntityHit[] = []

  // -- Projects (cache key: ['projects', ...]) --
  const projectQueries = queryClient.getQueriesData<
    Array<{ id: string; name: string; status?: string; address?: string }>
  >({ queryKey: ['projects'] })
  for (const [, data] of projectQueries) {
    if (!Array.isArray(data)) continue
    for (const p of data) {
      if (results.length >= limit) break
      if (p.name?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q)) {
        results.push({
          id: p.id,
          name: p.name,
          type: 'project',
          subtitle: p.status ?? p.address,
        })
      }
    }
  }

  // -- Contacts (cache key: ['contacts', ...] or ['crm_contacts', ...]) --
  for (const prefix of ['contacts', 'crm_contacts']) {
    const contactQueries = queryClient.getQueriesData<
      Array<{ id: string; full_name?: string; name?: string; email?: string; company?: string }>
    >({ queryKey: [prefix] })
    for (const [, data] of contactQueries) {
      if (!Array.isArray(data)) continue
      for (const c of data) {
        if (results.length >= limit) break
        const displayName = c.full_name ?? c.name ?? ''
        if (displayName.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)) {
          results.push({
            id: c.id,
            name: displayName,
            type: 'contact',
            subtitle: c.email ?? c.company,
          })
        }
      }
    }
  }

  // -- Inventory items (cache key: ['inventory_items', ...]) --
  const itemQueries = queryClient.getQueriesData<
    Array<{ id: string; name: string; sku?: string; category_name?: string }>
  >({ queryKey: ['inventory_items'] })
  for (const [, data] of itemQueries) {
    if (!Array.isArray(data)) continue
    for (const item of data) {
      if (results.length >= limit) break
      if (item.name?.toLowerCase().includes(q) || item.sku?.toLowerCase().includes(q)) {
        results.push({
          id: item.id,
          name: item.name,
          type: 'item',
          subtitle: item.sku ?? item.category_name,
        })
      }
    }
  }

  return results.slice(0, limit)
}
