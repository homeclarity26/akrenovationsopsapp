/**
 * Hook: search the React Query cache for projects, contacts, and items.
 *
 * Uses `lib/entityIndex.ts` under the hood. Debounced to avoid re-scanning
 * on every keystroke.
 */

import { useMemo, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { searchEntityCache, type EntityHit } from '@/lib/entityIndex'

export function useEntitySearch(debounceMs = 200) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs)
    return () => clearTimeout(timer)
  }, [query, debounceMs])

  const results: EntityHit[] = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return []
    return searchEntityCache(queryClient, debouncedQuery)
  }, [debouncedQuery, queryClient])

  return { query, setQuery, results }
}
