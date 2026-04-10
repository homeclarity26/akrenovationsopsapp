// Format 1 — Auto-cycling homepage showcase.
// Pure CSS animation, no API calls, no Supabase, no auth.
// Drop into the homepage with a single import.

import { useEffect, useState } from 'react'

export interface HomeShowcaseProps {
  autoplay?: boolean
  interval?: number
  showCta?: boolean
  ctaLabel?: string
  ctaHref?: string
}

const SHOWCASE_MOMENTS = [
  {
    label: 'Professional proposal',
    headline: 'A proposal that looks as good as our work',
    subline: 'Digital, detailed, and signed in minutes — not days.',
    mockup: 'proposal' as const,
    stat: { value: '< 48 hrs', label: 'from site visit to proposal' },
  },
  {
    label: 'Your personal portal',
    headline: 'See your project any time, from anywhere',
    subline:
      'Photos, schedule, selections, and invoices — all in one place.',
    mockup: 'portal' as const,
    stat: { value: '100%', label: 'transparent, always' },
  },
  {
    label: 'Weekly updates',
    headline: "You always know what's happening",
    subline: 'A real update with real photos, every Friday.',
    mockup: 'update' as const,
    stat: { value: 'Every Friday', label: 'without asking' },
  },
  {
    label: 'Project reel',
    headline: 'We document everything',
    subline:
      'Before, during, and after — delivered when your project is complete.',
    mockup: 'reel' as const,
    stat: { value: 'Yours forever', label: 'full photo archive' },
  },
]

export function HomeShowcase({
  autoplay = true,
  interval = 4000,
  showCta = true,
  ctaLabel = 'See the full experience',
  ctaHref = '/experience',
}: HomeShowcaseProps) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!autoplay) return
    const t = setInterval(() => {
      setActive((a) => (a + 1) % SHOWCASE_MOMENTS.length)
    }, interval)
    return () => clearInterval(t)
  }, [autoplay, interval])

  const m = SHOWCASE_MOMENTS[active]

  return (
    <section style={s.section}>
      <div style={s.inner}>
        <div style={s.left}>
          <div style={s.label}>{m.label}</div>
          <h2 style={s.headline}>{m.headline}</h2>
          <p style={s.subline}>{m.subline}</p>

          <div style={s.statCard}>
            <div style={s.statValue}>{m.stat.value}</div>
            <div style={s.statLabel}>{m.stat.label}</div>
          </div>

          {showCta && (
            <a href={ctaHref} style={s.cta}>
              {ctaLabel} →
            </a>
          )}
        </div>

        <div style={s.right}>
          <div style={s.phone}>
            <div style={s.phoneScreen}>
              <Mockup type={m.mockup} />
            </div>
          </div>
        </div>
      </div>

      <div style={s.dots}>
        {SHOWCASE_MOMENTS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              ...s.dot,
              background: i === active ? '#B7410E' : 'rgba(255,255,255,0.35)',
              width: i === active ? 28 : 8,
            }}
          />
        ))}
      </div>
    </section>
  )
}

function Mockup({ type }: { type: 'proposal' | 'portal' | 'update' | 'reel' }) {
  if (type === 'proposal') {
    return (
      <div style={mock.wrap}>
        <div style={mock.brand}>YOUR COMPANY</div>
        <div style={mock.title}>Kitchen Remodel</div>
        <div style={mock.sub}>Sarah Mitchell · Stow OH</div>
        <div style={mock.priceCard}>
          <div style={mock.priceLabel}>CONTRACT VALUE</div>
          <div style={mock.priceValue}>$54,800</div>
        </div>
        <div style={mock.lineGroup}>
          <div style={mock.line} />
          <div style={mock.line} />
          <div style={{ ...mock.line, width: '70%' }} />
        </div>
        <div style={mock.signBtn}>Sign Proposal</div>
      </div>
    )
  }
  if (type === 'portal') {
    return (
      <div style={mock.wrap}>
        <div style={mock.greet}>Welcome, Sarah</div>
        <div style={mock.progressLabel}>WEEK 3 OF 7</div>
        <div style={mock.progressBar}>
          <div style={{ ...mock.progressFill, width: '58%' }} />
        </div>
        <div style={mock.tabs}>
          {['Progress', 'Photos', 'Selections', 'Invoices'].map((t, i) => (
            <div
              key={t}
              style={{
                ...mock.tab,
                background: i === 0 ? '#1B2B4D' : '#FFFFFF',
                color: i === 0 ? '#FFF' : '#1A1A1A',
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div style={mock.photoStrip}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                ...mock.thumb,
                background: GRADS[i % GRADS.length],
              }}
            />
          ))}
        </div>
      </div>
    )
  }
  if (type === 'update') {
    return (
      <div style={mock.wrap}>
        <div style={mock.updateLabel}>FRIDAY UPDATE · WEEK 3</div>
        <div style={mock.updateBody}>
          Big week on your kitchen, Sarah. Cabinets are fully installed.
          Countertop template Tuesday. On track for July 18.
        </div>
        <div style={mock.photoStrip}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                ...mock.thumb,
                background: GRADS[(i + 2) % GRADS.length],
              }}
            />
          ))}
        </div>
        <div style={mock.signature}>— Your Company</div>
      </div>
    )
  }
  // reel
  return (
    <div style={mock.wrap}>
      <div style={mock.reelLabel}>YOUR PROJECT REEL</div>
      <div style={mock.beforeAfter}>
        <div style={{ ...mock.ba, background: GRADS[0] }}>
          <div style={mock.baLabel}>BEFORE</div>
        </div>
        <div style={{ ...mock.ba, background: GRADS[2] }}>
          <div style={mock.baLabel}>AFTER</div>
        </div>
      </div>
      <div style={mock.lineGroup}>
        <div style={{ ...mock.line, width: '90%' }} />
        <div style={{ ...mock.line, width: '60%' }} />
      </div>
      <div style={mock.archive}>24 photos · saved forever</div>
    </div>
  )
}

const GRADS = [
  'linear-gradient(135deg, #6B7280 0%, #374151 100%)',
  'linear-gradient(135deg, #92400E 0%, #451A03 100%)',
  'linear-gradient(135deg, #E8DCC4 0%, #B7410E 100%)',
  'linear-gradient(135deg, #1B2B4D 0%, #2A3F6B 100%)',
]

const s = {
  section: {
    background: '#1B2B4D',
    color: '#FFFFFF',
    padding: '60px 24px 40px',
    fontFamily:
      "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  } as const,
  inner: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 40,
    alignItems: 'center',
  } as const,
  left: {
    minWidth: 0,
  } as const,
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#B7410E',
    marginBottom: 14,
  } as const,
  headline: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 36,
    lineHeight: 1.15,
    fontWeight: 500,
    margin: 0,
    marginBottom: 14,
  } as const,
  subline: {
    fontSize: 16,
    lineHeight: 1.55,
    color: 'rgba(255,255,255,0.75)',
    margin: 0,
    marginBottom: 22,
  } as const,
  statCard: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'inline-block',
    marginBottom: 22,
  } as const,
  statValue: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 26,
    fontWeight: 500,
  } as const,
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: '0.06em',
  } as const,
  cta: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'underline',
    textUnderlineOffset: 4,
    display: 'inline-block',
  } as const,
  right: {
    display: 'flex',
    justifyContent: 'center',
  } as const,
  phone: {
    width: 280,
    aspectRatio: '9/19',
    background: '#0E1A33',
    borderRadius: 38,
    padding: 10,
    boxShadow:
      '0 30px 80px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
  } as const,
  phoneScreen: {
    background: '#FAFAF8',
    borderRadius: 30,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    color: '#1A1A1A',
    transition: 'opacity 400ms ease',
  } as const,
  dots: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    marginTop: 28,
  } as const,
  dot: {
    height: 8,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 300ms ease',
    padding: 0,
  } as const,
}

const mock = {
  wrap: {
    padding: 18,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily:
      "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  } as const,
  brand: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#1B2B4D',
  } as const,
  title: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 18,
    fontWeight: 500,
    color: '#1B2B4D',
    marginTop: 8,
  } as const,
  sub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 12,
  } as const,
  priceCard: {
    background: '#1B2B4D',
    color: '#FFF',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 12,
  } as const,
  priceLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.1em',
    fontWeight: 700,
  } as const,
  priceValue: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 22,
    marginTop: 2,
  } as const,
  lineGroup: {
    marginBottom: 14,
  } as const,
  line: {
    height: 6,
    background: '#E8E8E6',
    borderRadius: 3,
    width: '100%',
    marginBottom: 6,
  } as const,
  signBtn: {
    background: '#B7410E',
    color: '#FFF',
    borderRadius: 8,
    padding: '10px',
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'center' as const,
    marginTop: 'auto',
  } as const,
  greet: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 18,
    color: '#1B2B4D',
    marginBottom: 12,
  } as const,
  progressLabel: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#9CA3AF',
  } as const,
  progressBar: {
    height: 5,
    background: '#E8E8E6',
    borderRadius: 3,
    margin: '6px 0 12px',
    overflow: 'hidden',
  } as const,
  progressFill: {
    height: '100%',
    background: '#B7410E',
  } as const,
  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
    marginBottom: 12,
  } as const,
  tab: {
    border: '1px solid #E8E8E6',
    borderRadius: 8,
    padding: '8px 6px',
    fontSize: 10,
    fontWeight: 600,
    textAlign: 'center' as const,
  } as const,
  photoStrip: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 4,
    marginBottom: 8,
  } as const,
  thumb: {
    aspectRatio: '1',
    borderRadius: 6,
  } as const,
  updateLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#B7410E',
    marginBottom: 8,
  } as const,
  updateBody: {
    fontSize: 11,
    color: '#1A1A1A',
    lineHeight: 1.5,
    marginBottom: 12,
  } as const,
  signature: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontStyle: 'italic',
    fontSize: 11,
    color: '#1B2B4D',
    marginTop: 'auto',
  } as const,
  beforeAfter: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
    marginBottom: 12,
  } as const,
  ba: {
    aspectRatio: '4/3',
    borderRadius: 8,
    position: 'relative' as const,
  } as const,
  baLabel: {
    position: 'absolute' as const,
    top: 6,
    left: 6,
    background: 'rgba(0,0,0,0.6)',
    color: '#FFF',
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '2px 5px',
    borderRadius: 3,
  } as const,
  archive: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 'auto',
    textAlign: 'center' as const,
  } as const,
  reelLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#B7410E',
    marginBottom: 10,
  } as const,
}
