// useSuggestions — fetches context-aware quick-action suggestions for
// the chat home. Refetches every 5 minutes while mounted, and on
// pathname change.

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSuggestions } from './client'
import type { SuggestionItem } from './types'

const REFRESH_MS = 5 * 60 * 1000

export function useSuggestions(opts?: { pathname?: string; enabled?: boolean }): {
  suggestions: SuggestionItem[]
  isLoading: boolean
  refresh: () => Promise<void>
} {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const lastRunRef = useRef(0)

  const refresh = useCallback(async () => {
    if (opts?.enabled === false) return
    setIsLoading(true)
    try {
      const items = await fetchSuggestions({ pathname: opts?.pathname })
      setSuggestions(items)
      lastRunRef.current = Date.now()
    } finally {
      setIsLoading(false)
    }
  }, [opts?.enabled, opts?.pathname])

  useEffect(() => {
    if (opts?.enabled === false) return
    refresh()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, REFRESH_MS)
    return () => clearInterval(t)
  }, [refresh, opts?.enabled])

  return { suggestions, isLoading, refresh }
}
