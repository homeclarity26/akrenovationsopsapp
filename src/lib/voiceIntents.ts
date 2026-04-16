/**
 * Simple regex-based intent parser for voice input.
 *
 * Runs BEFORE sending to the AI — if a transcript matches a known
 * pattern we can execute the command directly (faster, no network).
 * Unmatched input falls through to the meta-agent.
 */

export interface VoiceIntent {
  commandId: string
  /** Extracted parameters (e.g. project name). */
  params: Record<string, string>
}

interface IntentPattern {
  regex: RegExp
  commandId: string
  /** Named capture groups map to params. */
  paramKeys: string[]
}

const PATTERNS: IntentPattern[] = [
  {
    regex: /^clock\s*in(?:\s+(?:to|on|at)\s+(.+))?$/i,
    commandId: 'clock_in',
    paramKeys: ['projectName'],
  },
  {
    regex: /^clock\s*out$/i,
    commandId: 'clock_in', // same page, action differs
    paramKeys: [],
  },
  {
    regex: /^(?:create|start|new)\s+project(?:\s+(.+))?$/i,
    commandId: 'create_project',
    paramKeys: ['projectName'],
  },
  {
    regex: /^add\s+task\s+(.+)/i,
    commandId: 'add_task',
    paramKeys: ['taskName'],
  },
  {
    regex: /^send\s+(?:update|message)(?:\s+(?:to)\s+(.+))?$/i,
    commandId: 'send_update',
    paramKeys: ['recipient'],
  },
  {
    regex: /^what(?:'s|s)\s+at\s+risk/i,
    commandId: 'whats_at_risk',
    paramKeys: [],
  },
  {
    regex: /^add\s+(.+?)\s+to\s+(?:the\s+)?(?:shopping|list)/i,
    commandId: 'add_to_shopping',
    paramKeys: ['itemName'],
  },
  {
    regex: /^(?:review|show)\s+pending/i,
    commandId: 'review_pending',
    paramKeys: [],
  },
  {
    regex: /^check\s+(?:inventory|stock)/i,
    commandId: 'check_inventory',
    paramKeys: [],
  },
]

/**
 * Try to match a voice transcript to a known command.
 * Returns `null` if no match — caller should fall through to AI.
 */
export function matchVoiceIntent(transcript: string): VoiceIntent | null {
  const trimmed = transcript.trim()
  if (!trimmed) return null

  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern.regex)
    if (match) {
      const params: Record<string, string> = {}
      pattern.paramKeys.forEach((key, i) => {
        const value = match[i + 1]
        if (value) params[key] = value.trim()
      })
      return { commandId: pattern.commandId, params }
    }
  }

  return null
}
