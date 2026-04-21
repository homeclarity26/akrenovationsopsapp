// Shared types for the AI v2 chat-first assistant.
// Mirrors the shape of the agent-tool-call edge function response.

export type Persona = 'admin' | 'employee' | 'client' | 'platform_owner'

export type AIMessageRole = 'user' | 'assistant' | 'tool'

export interface QuickReplyOption {
  label: string
  value: string
}

export interface QuickReplies {
  options: QuickReplyOption[]
  /** Always treated as true by the renderer regardless of value. */
  allow_custom?: boolean
  custom_placeholder?: string
}

export interface ToolResultPayload {
  tool_name: string
  tool_use_id: string
  message: string
  data?: Record<string, unknown>
  quick_replies?: QuickReplies
  needs_confirmation?: { prompt: string; confirm_value: string }
  is_error?: boolean
}

export interface AIMessage {
  id: string
  thread_id: string
  role: AIMessageRole
  content: string | null
  tool_call?: { tool_uses: Array<{ id: string; name: string; input: Record<string, unknown> }> } | null
  tool_result?: ToolResultPayload | null
  quick_replies?: QuickReplies | null
  created_at: string
}

export interface AgentToolCallResponse {
  thread_id: string
  messages: AIMessage[]
  monthly_cost_so_far: number
  monthly_cost_cap: number
  blocked: boolean
  error?: string
  details?: unknown
}

export interface SuggestionItem {
  id: string
  icon: string
  label: string
  hint?: string
  tool: string
  args?: Record<string, unknown>
}
