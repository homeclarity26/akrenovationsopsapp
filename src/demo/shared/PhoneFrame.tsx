// Mobile-first phone "frame" wrapper used by both demos.
// On phones: full-screen with no chrome.
// On desktops: shows a stylized phone bezel so the demo feels like a device.

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
        <div style={page.notch} />
        <div style={page.screen}>
          {banner}
          <div style={page.scroll}>{children}</div>
          {footer}
        </div>
      </div>
    </div>
  )
}

const page = {
  outer: {
    minHeight: '100vh',
    width: '100%',
    background:
      'radial-gradient(ellipse at top, #F5F0E6 0%, #FAFAF8 50%, #E8DCC4 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '0',
    fontFamily:
      "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: '#1A1A1A',
  } as const,
  bezel: {
    width: '100%',
    maxWidth: 420,
    minHeight: '100vh',
    background: '#FFFFFF',
    position: 'relative',
    boxShadow: '0 20px 60px -20px rgba(27,43,77,0.25)',
    display: 'flex',
    flexDirection: 'column',
  } as const,
  notch: {
    height: 0,
  } as const,
  screen: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#FAFAF8',
    minHeight: '100vh',
  } as const,
  scroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
  } as const,
}
