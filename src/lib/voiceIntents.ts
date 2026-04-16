/**
 * Regex-based intent parser for voice input.
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
  // --- Time tracking ---
  {
    regex: /^clock\s*in(?:\s+(?:to|on|at|for)\s+(.+))?$/i,
    commandId: 'clock_in',
    paramKeys: ['projectName'],
  },
  {
    regex: /^clock\s*out$/i,
    commandId: 'clock_out',
    paramKeys: [],
  },
  {
    regex: /^(?:add|log)\s+(?:past\s+)?time(?:\s+(?:for|on)\s+(.+))?$/i,
    commandId: 'add_past_time',
    paramKeys: ['projectName'],
  },

  // --- Projects ---
  {
    regex: /^(?:create|start|new)\s+project(?:\s+(.+))?$/i,
    commandId: 'create_project',
    paramKeys: ['projectName'],
  },
  {
    regex: /^(?:search|find|look\s*up)\s+project(?:s)?(?:\s+(.+))?$/i,
    commandId: 'search_projects',
    paramKeys: ['query'],
  },

  // --- Tasks ---
  {
    regex: /^add\s+task\s+(.+)/i,
    commandId: 'add_task',
    paramKeys: ['taskName'],
  },
  {
    regex: /^(?:complete|finish|done\s+with)\s+task\s+(.+)/i,
    commandId: 'complete_task',
    paramKeys: ['taskName'],
  },

  // --- Communication ---
  {
    regex: /^send\s+(?:update|message)(?:\s+(?:to)\s+(.+))?$/i,
    commandId: 'send_update',
    paramKeys: ['recipient'],
  },
  {
    regex: /^send\s+invoice(?:\s+(?:to)\s+(.+))?$/i,
    commandId: 'send_invoice',
    paramKeys: ['clientName'],
  },
  {
    regex: /^(?:draft|write)\s+(?:an?\s+)?email(?:\s+(?:to)\s+(.+))?$/i,
    commandId: 'draft_email',
    paramKeys: ['recipient'],
  },

  // --- AI insights ---
  {
    regex: /^what(?:'s|s|\s+is)\s+at\s+risk/i,
    commandId: 'whats_at_risk',
    paramKeys: [],
  },
  {
    regex: /^(?:what\s+needs?\s+(?:my\s+)?attention|what(?:'s|s)\s+urgent)/i,
    commandId: 'whats_at_risk',
    paramKeys: [],
  },
  {
    regex: /^(?:morning\s+)?brief(?:ing)?$/i,
    commandId: 'morning_brief',
    paramKeys: [],
  },

  // --- Inventory ---
  {
    regex: /^check\s+(?:stock|inventory)(?:\s+(?:on|for|of)\s+(.+))?$/i,
    commandId: 'check_stock',
    paramKeys: ['itemName'],
  },
  {
    regex: /^add\s+(.+?)\s+to\s+(?:the\s+)?(?:shopping|list)/i,
    commandId: 'add_to_shopping',
    paramKeys: ['itemName'],
  },
  {
    regex: /^(?:reorder|order\s+more)\s+(.+)/i,
    commandId: 'reorder_item',
    paramKeys: ['itemName'],
  },

  // --- People / assignment ---
  {
    regex: /^assign\s+(.+?)\s+to\s+(.+)/i,
    commandId: 'assign_to_project',
    paramKeys: ['employeeName', 'projectName'],
  },

  // --- Documents ---
  {
    regex: /^(?:generate|create|write)\s+(?:a\s+)?proposal(?:\s+(?:for)\s+(.+))?$/i,
    commandId: 'generate_proposal',
    paramKeys: ['projectName'],
  },
  {
    regex: /^(?:generate|create)\s+(?:a\s+)?(?:estimate|quote)(?:\s+(?:for)\s+(.+))?$/i,
    commandId: 'create_estimate',
    paramKeys: ['projectName'],
  },

  // --- Field / employee ---
  {
    regex: /^(?:daily\s+)?log(?:\s+(?:for\s+)?today)?$/i,
    commandId: 'log_daily',
    paramKeys: [],
  },
  {
    regex: /^(?:take|upload)\s+(?:a\s+)?photo/i,
    commandId: 'take_photo',
    paramKeys: [],
  },
  {
    regex: /^scan\s+(?:a\s+)?receipt/i,
    commandId: 'scan_receipt',
    paramKeys: [],
  },

  // --- Review ---
  {
    regex: /^(?:review|show)\s+(?:pending|suggestions)/i,
    commandId: 'review_suggestions',
    paramKeys: [],
  },

  // --- Client ---
  {
    regex: /^(?:check|show|what(?:'s|s))\s+(?:my\s+)?progress/i,
    commandId: 'check_progress',
    paramKeys: [],
  },
  {
    regex: /^(?:pay|make\s+(?:a\s+)?payment\s+on)\s+(?:my\s+)?invoice/i,
    commandId: 'pay_invoice',
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
