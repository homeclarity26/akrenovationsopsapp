// Client-side wrapper for agent-tool-call + agent-suggestions.
//
// Responsibilities:
//   1. Fresh idempotency key per send (uuid).
//   2. Auth token resolved via the same raw-REST helper AuthContext uses,
//      so a wedged supabase-js client doesn't block the call.
//   3. Offline detection — defers to useOfflineQueue for retry semantics.
//   4. Returns the typed AgentToolCallResponse.

import { resolveAuthToken } from '@/lib/authToken'
import type { AgentToolCallResponse, SuggestionItem } from './types'

const URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? ''

export interface SendMessageInput {
  thread_id: string | null
  message: string
  context?: {
    pathname?: string
    geo?: { lat: number; lng: number } | null
  }
  /** Caller can pre-mint an idempotency key to retry the same intent across
   *  network failures. Omit and we generate one. */
  idempotency_key?: string
}

export class AssistantNetworkError extends Error {
  status?: number
  blocked?: boolean
  monthly_cost_so_far?: number
  monthly_cost_cap?: number
  constructor(opts: {
    message: string
    status?: number
    blocked?: boolean
    monthly_cost_so_far?: number
    monthly_cost_cap?: number
  }) {
    super(opts.message)
    this.name = 'AssistantNetworkError'
    this.status = opts.status
    this.blocked = opts.blocked
    this.monthly_cost_so_far = opts.monthly_cost_so_far
    this.monthly_cost_cap = opts.monthly_cost_cap
  }
}

export async function sendMessage(input: SendMessageInput): Promise<AgentToolCallResponse> {
  const { accessToken } = await resolveAuthToken()
  const token = accessToken ?? ANON
  const idempotency_key = input.idempotency_key ?? crypto.randomUUID()

  const res = await fetch(`${URL}/functions/v1/agent-tool-call`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      thread_id: input.thread_id,
      message: input.message,
      idempotency_key,
      context: input.context ?? {},
    }),
  })

  let body: AgentToolCallResponse
  try {
    body = (await res.json()) as AgentToolCallResponse
  } catch {
    throw new AssistantNetworkError({
      message: `Bad response (HTTP ${res.status}, no JSON)`,
      status: res.status,
    })
  }

  if (!res.ok) {
    throw new AssistantNetworkError({
      message: body.error ?? `HTTP ${res.status}`,
      status: res.status,
      blocked: body.blocked,
      monthly_cost_so_far: body.monthly_cost_so_far,
      monthly_cost_cap: body.monthly_cost_cap,
    })
  }
  return body
}

export async function fetchSuggestions(opts?: {
  pathname?: string
  geo?: { lat: number; lng: number } | null
}): Promise<SuggestionItem[]> {
  const { accessToken } = await resolveAuthToken()
  const token = accessToken ?? ANON
  const local_hour = new Date().getHours()
  const local_dow = new Date().getDay()

  try {
    const res = await fetch(`${URL}/functions/v1/agent-suggestions`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: {
          pathname: opts?.pathname,
          geo: opts?.geo ?? null,
          local_hour,
          local_dow,
        },
      }),
    })
    if (!res.ok) return []
    const j = (await res.json()) as { suggestions?: SuggestionItem[] }
    return j.suggestions ?? []
  } catch {
    return []
  }
}
