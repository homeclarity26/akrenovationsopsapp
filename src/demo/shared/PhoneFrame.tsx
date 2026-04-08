// Mobile-first phone "frame" wrapper used by both demos.
//
// CRITICAL: this layout pins the banner to the top and the footer to the
// bottom, with a scrollable middle. The footer is ALWAYS visible regardless
// of content height. Previously used minHeight:100vh everywhere which caused
// the footer to scroll off-screen on tall content — that bug is fixed here
// by using height:100dvh on the outer container, overflow:hidden, and
// making the scroll region the only flex:1 child with minHeight:0.

import type { ReactNode } from 'react'

export function PhoneFrame({
  children,
  banner,
  footer,
}: {
  children: ReactNode
  banner?: ReactNode
  footer?: ReactNode
}) {
  return (
    <div style={page.outer}>
      <div style={page.bezel}>
        {banner}
        <div style={page.scroll} data-demo-scroll>
          {children}
        </div>
        {footer}
      </div>
    </div>
  )
}

const page = {
  // Fill the dynamic viewport exactly. dvh accounts for mobile browser chrome
  // (Safari URL bar, keyboard) correctly. 100vh would be wrong on mobile.
  outer: {
    height: '100dvh',
    minHeight: '100dvh',
    width: '100%',
    background:
      'radial-gradient(ellipse at top, #F5F0E6 0%, #FAFAF8 50%, #E8DCC4 100%)',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    overflow: 'hidden',
    fontFamily:
      "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: '#1A1A1A',
  } as const,
  // Bezel = the phone "device" column, centered, max 440 wide.
  // Flex column: banner -> scroll -> footer. No minHeight — the parent's
  // height:100dvh + overflow:hidden does the clipping.
  bezel: {
    width: '100%',
    maxWidth: 440,
    height: '100%',
    background: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxShadow: '0 20px 60px -20px rgba(27,43,77,0.25)',
    overflow: 'hidden',
  } as const,
  // The ONLY scrollable container. minHeight:0 is the magic that makes
  // flex:1 respect the parent's height rather than grow beyond it.
  scroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    background: '#FAFAF8',
  } as const,
}
