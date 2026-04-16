/**
 * Hook: open/close state for the Agent Overlay.
 *
 * Handles:
 *   - Open/close toggle
 *   - Swipe-down gesture (touchstart/touchmove/touchend — no library)
 *   - Back button (pushState on open, popstate to close)
 *   - Body scroll lock while overlay is open
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const SWIPE_THRESHOLD = 80 // px needed to dismiss

export interface AgentOverlayState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  /** Bind these to the overlay container for swipe-down-to-close. */
  swipeHandlers: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
  }
  /** Current swipe offset in px (for transform animation). */
  swipeOffset: number
}

export function useAgentOverlay(): AgentOverlayState {
  const [isOpen, setIsOpen] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)

  // ---- Body scroll lock ----
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [isOpen])

  // ---- History API for back button ----
  const open = useCallback(() => {
    setIsOpen(true)
    window.history.pushState({ agentOverlay: true }, '')
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setSwipeOffset(0)
    // Pop the state we pushed (if it's ours)
    if (window.history.state?.agentOverlay) {
      window.history.back()
    }
  }, [])

  const toggle = useCallback(() => {
    if (isOpen) close()
    else open()
  }, [isOpen, open, close])

  useEffect(() => {
    const onPop = (_e: PopStateEvent) => {
      if (isOpen) {
        setIsOpen(false)
        setSwipeOffset(0)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [isOpen])

  // ---- Swipe-down gesture ----
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = true
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) {
      setSwipeOffset(delta)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    isSwiping.current = false
    if (swipeOffset > SWIPE_THRESHOLD) {
      close()
    } else {
      setSwipeOffset(0)
    }
  }, [swipeOffset, close])

  return {
    isOpen,
    open,
    close,
    toggle,
    swipeHandlers: { onTouchStart, onTouchMove, onTouchEnd },
    swipeOffset,
  }
}
