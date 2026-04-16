/**
 * AgentBar — the persistent pill at the top of every page.
 *
 * One tap opens the full-screen Agent Overlay.
 *
 * Pill shape: `[sparkle emoji] Ask me anything  [mic] [clip]`
 * 44px tall, sticky below the page header.
 */

import { Mic, Paperclip } from 'lucide-react'
import { isSpeechRecognitionAvailable } from '@/components/ui/VoiceInput'
import { AgentOverlay } from '@/components/ui/AgentOverlay'
import { useAgentOverlay } from '@/hooks/useAgentOverlay'
import { usePendingItems } from '@/hooks/usePendingItems'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentBarProps {
  /** Override pill copy for client layout. */
  pillLabel?: string
  /** Additional class for positioning. */
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentBar({
  pillLabel = 'Ask me anything',
  className,
}: AgentBarProps) {
  const overlay = useAgentOverlay()
  const { totalCount } = usePendingItems()
  const showMic = isSpeechRecognitionAvailable()

  return (
    <>
      {/* ---- Pill (collapsed) ---- */}
      <div
        className={cn(
          'sticky z-30 mx-3 my-2',
          className,
        )}
      >
        <button
          onClick={overlay.open}
          className={cn(
            'w-full flex items-center justify-between',
            'h-11 px-4 rounded-full',
            'bg-[var(--navy)] text-white',
            'shadow-md hover:shadow-lg transition-shadow',
            'min-h-[44px]', // touch target
          )}
          aria-label="Open AI assistant"
        >
          <span className="flex items-center gap-2 text-sm font-medium truncate">
            <span aria-hidden="true">&#10024;</span>
            {pillLabel}
            {totalCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold">
                {totalCount > 9 ? '9+' : totalCount}
              </span>
            )}
          </span>

          <span className="flex items-center gap-1">
            {showMic && (
              <span
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                aria-hidden="true"
              >
                <Mic size={16} />
              </span>
            )}
            <span
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              aria-hidden="true"
            >
              <Paperclip size={16} />
            </span>
          </span>
        </button>
      </div>

      {/* ---- Overlay (expanded) ---- */}
      {overlay.isOpen && <AgentOverlay overlay={overlay} />}
    </>
  )
}
