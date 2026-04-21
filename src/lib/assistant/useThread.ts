// useThread — React hook for the active assistant thread.
//
// Manages: messages array, send + retry, loading state, monthly-spend
// info (for the budget banner), error surface. Phase 0 ships the hook;
// Phase 1 wires it into <AssistantHome />.

import { useCallback, useState } from 'react'
import { sendMessage, AssistantNetworkError } from './client'
import type { AIMessage } from './types'

export interface UseThreadState {
  thread_id: string | null
  messages: AIMessage[]
  isSending: boolean
  monthly_cost_so_far: number
  monthly_cost_cap: number
  blocked: boolean
  errorMessage: string | null
}

export interface UseThreadApi extends UseThreadState {
  send: (text: string, opts?: { context?: { pathname?: string; geo?: { lat: number; lng: number } | null } }) => Promise<void>
  resetError: () => void
  /** Switch to a different thread (e.g. resuming from history). */
  setThreadId: (id: string | null) => void
}

export function useThread(): UseThreadApi {
  const [thread_id, setThreadIdInternal] = useState<string | null>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [monthlyCost, setMonthlyCost] = useState(0)
  const [monthlyCap, setMonthlyCap] = useState(75)
  const [blocked, setBlocked] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const send = useCallback(async (text: string, opts?: { context?: { pathname?: string; geo?: { lat: number; lng: number } | null } }) => {
    setIsSending(true)
    setErrorMessage(null)
    try {
      const resp = await sendMessage({ thread_id, message: text, context: opts?.context })
      setThreadIdInternal(resp.thread_id)
      setMessages((prev) => [...prev, ...resp.messages])
      setMonthlyCost(resp.monthly_cost_so_far)
      setMonthlyCap(resp.monthly_cost_cap)
      setBlocked(resp.blocked)
    } catch (err) {
      if (err instanceof AssistantNetworkError) {
        setErrorMessage(err.message)
        if (err.blocked) setBlocked(true)
        if (typeof err.monthly_cost_so_far === 'number') setMonthlyCost(err.monthly_cost_so_far)
        if (typeof err.monthly_cost_cap === 'number') setMonthlyCap(err.monthly_cost_cap)
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
      }
    } finally {
      setIsSending(false)
    }
  }, [thread_id])

  const resetError = useCallback(() => setErrorMessage(null), [])
  const setThreadId = useCallback((id: string | null) => {
    setThreadIdInternal(id)
    setMessages([])
  }, [])

  return {
    thread_id,
    messages,
    isSending,
    monthly_cost_so_far: monthlyCost,
    monthly_cost_cap: monthlyCap,
    blocked,
    errorMessage,
    send,
    resetError,
    setThreadId,
  }
}
