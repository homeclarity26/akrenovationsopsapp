// useOfflineQueue — IndexedDB-backed queue for tool calls that fire while
// the user is offline (basement job sites, flaky LTE).
//
// Behavior:
//   * enqueue(item) writes the action to IDB with a stable idempotency_key.
//   * On window 'online' event, flush in FIFO order.
//   * Re-running the same idempotency_key on the server is a no-op (cached
//     result returned), so a duplicate flush is safe.
//   * Items that have failed > 3 times are marked dead and surfaced to the
//     UI for retry/dismiss.
//
// Phase 0 ships the hook + IDB plumbing; Phase 1 wires it into the chat send
// path so a clock_in done with no signal queues + syncs when reconnect lands.

import { useCallback, useEffect, useState } from 'react'

const DB_NAME = 'tradeoffice_offline_queue'
const STORE = 'queue'
const VERSION = 1

export interface QueuedItem {
  id: string                  // crypto.randomUUID()
  idempotency_key: string
  kind: 'agent_tool_call'
  payload: {
    thread_id: string | null
    message: string
    context?: Record<string, unknown>
  }
  enqueued_at: number
  attempts: number
  last_error?: string
  dead?: boolean
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('enqueued_at', 'enqueued_at')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | Promise<T>): Promise<T> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const result = fn(store)
    if (result instanceof IDBRequest) {
      result.onsuccess = () => resolve(result.result as T)
      result.onerror = () => reject(result.error)
    } else {
      result.then(resolve).catch(reject)
    }
    tx.oncomplete = () => db.close()
  })
}

export async function enqueueOffline(item: Omit<QueuedItem, 'id' | 'enqueued_at' | 'attempts'>): Promise<QueuedItem> {
  const full: QueuedItem = {
    ...item,
    id: crypto.randomUUID(),
    enqueued_at: Date.now(),
    attempts: 0,
  }
  await withStore('readwrite', (s) => s.add(full))
  return full
}

export async function listQueue(): Promise<QueuedItem[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.index('enqueued_at').getAll()
    req.onsuccess = () => resolve(req.result as QueuedItem[])
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export async function removeQueued(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id))
}

export async function bumpAttempt(id: string, error?: string): Promise<void> {
  const item = await withStore('readonly', (s) => s.get(id) as IDBRequest)
  const cur = item as unknown as QueuedItem | undefined
  if (!cur) return
  const next: QueuedItem = {
    ...cur,
    attempts: cur.attempts + 1,
    last_error: error,
    dead: cur.attempts + 1 >= 3,
  }
  await withStore('readwrite', (s) => s.put(next))
}

/** React hook exposing the current queue + on-/offline state + a manual sync trigger. */
export function useOfflineQueue(opts: {
  /** Caller-provided sync function. Returns true on success. */
  syncOne: (item: QueuedItem) => Promise<boolean>
}): {
  isOnline: boolean
  queue: QueuedItem[]
  refresh: () => Promise<void>
  flushNow: () => Promise<void>
  remove: (id: string) => Promise<void>
} {
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [queue, setQueue] = useState<QueuedItem[]>([])

  const refresh = useCallback(async () => {
    const items = await listQueue()
    setQueue(items)
  }, [])

  const flushNow = useCallback(async () => {
    const items = await listQueue()
    for (const item of items.filter((i) => !i.dead)) {
      try {
        const ok = await opts.syncOne(item)
        if (ok) {
          await removeQueued(item.id)
        } else {
          await bumpAttempt(item.id)
        }
      } catch (err) {
        await bumpAttempt(item.id, err instanceof Error ? err.message : String(err))
      }
    }
    await refresh()
  }, [opts, refresh])

  useEffect(() => {
    refresh()
    const onOnline = () => {
      setIsOnline(true)
      flushNow()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refresh, flushNow])

  return { isOnline, queue, refresh, flushNow, remove: removeQueued }
}
