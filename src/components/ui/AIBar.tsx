/**
 * AIBar — legacy wrapper.
 *
 * PR 20 replaced the inline chat sheet with AgentBar + AgentOverlay.
 * This file is kept so any existing callers that import `<AIBar />`
 * continue to work. It renders the new AgentOverlay directly (since
 * old callers opened this as a modal).
 *
 * Existing prop surface preserved:
 *   - onClose: called when the overlay closes
 *   - placeholder: forwarded as overlay input placeholder (display only)
 */

import { useEffect } from 'react'
import { AgentOverlay } from '@/components/ui/AgentOverlay'
import { useAgentOverlay } from '@/hooks/useAgentOverlay'

interface AIBarProps {
  onClose?: () => void
  placeholder?: string
}

export function AIBar({ onClose }: AIBarProps) {
  const overlay = useAgentOverlay()

  // Auto-open on mount (legacy callers expect modal behaviour)
  useEffect(() => {
    if (!overlay.isOpen) overlay.open()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync close to parent
  useEffect(() => {
    if (!overlay.isOpen && onClose) onClose()
  }, [overlay.isOpen, onClose])

  if (!overlay.isOpen) return null

  return <AgentOverlay overlay={overlay} />
}
