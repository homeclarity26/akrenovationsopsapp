import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Map of realtime inventory tables → the React Query cache-key prefixes they
// feed. When a postgres_changes event fires, we invalidate every matching
// cache key so useQuery refetches. Cache keys are structured as
// [prefix, companyId, ...rest] — React Query does prefix matching.
//
// `inventory_location_items` is a composite cache key used by the employee
// stocktake page (items LEFT JOIN stock for the picked location). Any change
// to inventory_stock, inventory_stocktakes, or inventory_items can affect
// that view, so all three also invalidate it.
const TABLE_TO_QUERY_KEYS: Record<string, string[]> = {
  inventory_locations:      ['inventory_locations'],
  inventory_categories:     ['inventory_categories'],
  inventory_items:          ['inventory_items',      'inventory_location_items'],
  inventory_stock:          ['inventory_stock',      'inventory_location_items'],
  inventory_stocktakes:     ['inventory_stocktakes', 'inventory_location_items'],
  inventory_item_templates: ['inventory_item_templates'],
  inventory_alerts:         ['inventory_alerts'],
}

/**
 * Subscribes to realtime changes for every inventory table and invalidates
 * the matching React Query caches so the UI updates live.
 *
 * No project_id/company_id filter on the channel itself — RLS already scopes
 * reads to the current company; clients in other companies won't receive
 * events they can't read. App-level queries add the company_id filter.
 *
 * One channel per hook invocation, with one listener per inventory table.
 * Channels are torn down on unmount.
 */
export function useInventoryRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase.channel(`inventory-realtime`)

    for (const [table, keyPrefixes] of Object.entries(TABLE_TO_QUERY_KEYS)) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
        },
        () => {
          for (const prefix of keyPrefixes) {
            queryClient.invalidateQueries({ queryKey: [prefix] })
          }
        },
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
