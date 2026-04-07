// Format 2 — Interactive "How We Work" section.
// 6 stages, tap to advance or jump via stage pills.
// No API calls, no Supabase, no auth.

import { useState } from 'react'

const STAGES = [
  {
    stage: 1,
    pill: 'First contact',
    headline: 'You reach out. We respond same day.',
    body: "Fill out the form on our website and you'll hear from Adam — not an answering service, not a call center. We'll schedule a site visit at a time that works for you.",
    detail:
      'Most contractors take 3-5 days to call back. We respond same day.',
    accent: '#1B2B4D',
    mockup: 'lead' as const,
  },
  {
    stage: 2,
    pill: 'Site visit',
    headline: 'We listen first. Then we measure.',
    body: "Adam walks your space, takes detailed photos and measurements, and listens to what you want. No pressure, no hard sell — just a real conversation about your project.",
    detail:
      'Every project starts with understanding your home and your vision.',
    accent: '#1B2B4D',
    mockup: 'site' as const,
  },
  {
    stage: 3,
    pill: 'Proposal',
    headline: 'A proposal you can actually understand.',
    body: 'Within 48 hours you receive a detailed written proposal — clear scope, clear price, no vague line items. Review it, ask questions, and sign digitally from your phone.',
    detail:
      'No hidden costs. No surprises. What we quote is what you pay.',
    accent: '#B7410E',
    mockup: 'proposal' as const,
  },
  {
    stage: 4,
    pill: 'Your portal',
    headline: 'Your project, always visible.',
    body: 'The moment you sign, you get access to your personal project portal. See progress photos, your selection checklist, the project schedule, invoices, and messages — all in one place.',
    detail: 'Available on any device. No app to download.',
    accent: '#1B2B4D',
    mockup: 'portal' as const,
  },
  {
    stage: 5,
    pill: 'During the project',
    headline: "You're never left wondering.",
    body: 'Every Friday you receive a progress update with photos from that week. Any questions go directly to Adam. Any decisions you need to make are tracked in your portal.',
    detail: 'No chasing your contractor. No wondering if they showed up.',
    accent: '#1B2B4D',
    mockup: 'update' as const,
  },
  {
    stage: 6,
    pill: 'Completion',
    headline: 'Done right, documented forever.',
    body: 'We walk through the finished project together. Any punch list items are handled before we consider the job done. You receive a photo reel of your project and a 12-month warranty on our workmanship.',
    detail:
      "You keep the photos. You keep the portal. You have Adam's number.",
    accent: '#B7410E',
    mockup: 'completion' as const,
  },
]

export interface HowWeWorkProps {
  ctaScheduleHref?: string
  ctaExperienceHref?: string
}

export function HowWeWork({
  ctaScheduleHref = '/contact',
  ctaExperienceHref = '/experience',
}: HowWeWorkProps) {
  const [active, setActive] = useState(0)
  const stage = STAGES[active]

  return (
    <section style={s.section}>
      <div style={s.inner}>
        <div style={s.header}>
          <div style={s.eyebrow}>HOW WE WORK</div>
          <h2 style={s.title}>Six stages of every project.</h2>
          <p style={s.lede}>
            From first call to final walkthrough — here is the rhythm we
            run on every job.
          </p>
        </div>

        <div style={s.pills}>
          {STAGES.map((st, i) => (
            <button
              key={st.stage}
              onClick={() => setActive(i)}
              style={{
                ...s.pill,
                background: i === active ? '#1B2B4D' : '#FFFFFF',
                color: i === active ? '#FFFFFF' : '#1A1A1A',
                borderColor: i === active ? '#1B2B4D' : '#E8E8E6',
              }}
            >
              <span style={s.pillNum}>0{st.stage}</span>
              <span>{st.pill}</span>
            </button>
          ))}
        </div>

        <div style={s.body}>
          <div style={s.bodyLeft}>
            <div style={s.phoneOuter}>
              <div style={s.phoneInner}>
                <StageMockup type={stage.mockup} />
              </div>
            </div>
          </div>

          <div style={s.bodyRight}>
            <div
              style={{
                ...s.stageNum,
                color: stage.accent,
              }}
            >
              STAGE {stage.stage}
            </div>
            <h3 style={s.stageHeadline}>{stage.headline}</h3>
            <p style={s.stageBody}>{stage.body}</p>
            <div style={s.stageDetail}>{stage.detail}</div>

            <div style={s.navRow}>
              <button
                onClick={() => setActive((a) => Math.max(0, a - 1))}
                disabled={active === 0}
                style={{
                  ...s.navBtn,
                  opacity: active === 0 ? 0.4 : 1,
                  cursor: active === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={() =>
                  setActive((a) => Math.min(STAGES.length - 1, a + 1))
                }
                disabled={active === STAGES.length - 1}
                style={{
                  ...s.navBtnPrimary,
                  opacity: active === STAGES.length - 1 ? 0.4 : 1,
                  cursor:
                    active === STAGES.length - 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Next stage →
              </button>
            </div>
          </div>
        </div>

        <div style={s.cta}>
          <div style={s.ctaTitle}>Ready to get started?</div>
          <div style={s.ctaRow}>
            <a href={ctaScheduleHref} style={s.ctaPrimary}>
              Schedule a site visit
            </a>
            <a href={ctaExperienceHref} style={s.ctaSecondary}>
              See the full experience →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function StageMockup({
  type,
}: {
  type: 'lead' | 'site' | 'proposal' | 'portal' | 'update' | 'completion'
}) {
  switch (type) {
    case 'lead':
      return (
        <div style={m.wrap}>
          <div style={m.smsHeader}>AK Renovations</div>
          <div style={m.smsBubble}>
            Hi Sarah, this is Adam — got your kitchen inquiry. I can swing by
            Thursday at 4pm or Friday morning, whichever works. Looking
            forward to seeing the space.
          </div>
          <div style={m.smsTime}>2:14 PM · Same day</div>
        </div>
      )
    case 'site':
      return (
        <div style={m.wrap}>
          <div style={m.brand}>SITE NOTES</div>
          <div style={m.title}>Mitchell Kitchen</div>
          <div style={m.line} />
          <div style={m.line} />
          <div style={{ ...m.line, width: '70%' }} />
          <div style={m.thumbsRow}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...m.thumb, background: GRADS[i] }} />
            ))}
          </div>
        </div>
      )
    case 'proposal':
      return (
        <div style={m.wrap}>
          <div style={m.brand}>AK RENOVATIONS</div>
          <div style={m.title}>Kitchen Remodel</div>
          <div style={m.priceCard}>
            <div style={m.priceLabel}>CONTRACT</div>
            <div style={m.priceValue}>$54,800</div>
          </div>
          <div style={m.line} />
          <div style={m.line} />
          <div style={m.signBtn}>Sign Proposal</div>
        </div>
      )
    case 'portal':
      return (
        <div style={m.wrap}>
          <div style={m.greet}>Welcome, Sarah</div>
          <div style={m.tabs}>
            {['Progress', 'Photos', 'Selections', 'Invoices'].map((t, i) => (
              <div
                key={t}
                style={{
                  ...m.tab,
                  background: i === 0 ? '#1B2B4D' : '#FFFFFF',
                  color: i === 0 ? '#FFF' : '#1A1A1A',
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <div style={m.thumbsRow}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{ ...m.thumbSm, background: GRADS[i % GRADS.length] }}
              />
            ))}
          </div>
        </div>
      )
    case 'update':
      return (
        <div style={m.wrap}>
          <div style={m.updateLabel}>FRIDAY UPDATE · WEEK 3</div>
          <div style={m.updateBody}>
            Cabinets installed, countertop template Tuesday. On track for
            July 18.
          </div>
          <div style={m.thumbsRow}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  ...m.thumbSm,
                  background: GRADS[(i + 2) % GRADS.length],
                }}
              />
            ))}
          </div>
          <div style={m.signature}>— Adam</div>
        </div>
      )
    case 'completion':
      return (
        <div style={m.wrap}>
          <div style={m.brand}>PROJECT COMPLETE</div>
          <div style={m.beforeAfter}>
            <div style={{ ...m.ba, background: GRADS[0] }}>
              <div style={m.baLabel}>BEFORE</div>
            </div>
            <div style={{ ...m.ba, background: GRADS[2] }}>
              <div style={m.baLabel}>AFTER</div>
            </div>
          </div>
          <div style={m.warranty}>12-month warranty · 24 photos</div>
        </div>
      )
  }
}

const GRADS = [
  'linear-gradient(135deg, #6B7280 0%, #374151 100%)',
  'linear-gradient(135deg, #92400E 0%, #451A03 100%)',
  'linear-gradient(135deg, #E8DCC4 0%, #B7410E 100%)',
  'linear-gradient(135deg, #1B2B4D 0%, #2A3F6B 100%)',
]

const s = {
  section: {
    background: '#FAFAF8',
    padding: '70px 24px',
    fontFamily:
      "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: '#1A1A1A',
  } as const,
  inner: {
    maxWidth: 1100,
    margin: '0 auto',
  } as const,
  header: {
    textAlign: 'center' as const,
    marginBottom: 36,
  } as const,
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#B7410E',
    marginBottom: 12,
  } as const,
  title: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 38,
    fontWeight: 500,
    color: '#1B2B4D',
    margin: 0,
    marginBottom: 12,
    lineHeight: 1.15,
  } as const,
  lede: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 1.55,
    margin: 0,
    maxWidth: 540,
    marginLeft: 'auto',
    marginRight: 'auto',
  } as const,
  pills: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    justifyContent: 'center',
    marginBottom: 32,
  } as const,
  pill: {
    border: '1px solid #E8E8E6',
    borderRadius: 999,
    padding: '10px 16px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 200ms ease',
  } as const,
  pillNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    opacity: 0.5,
  } as const,
  body: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 32,
    alignItems: 'center',
    marginBottom: 48,
  } as const,
  bodyLeft: {
    display: 'flex',
    justifyContent: 'center',
  } as const,
  bodyRight: {
    minWidth: 0,
  } as const,
  phoneOuter: {
    width: 280,
    aspectRatio: '9/19',
    background: '#0E1A33',
    borderRadius: 38,
    padding: 10,
    boxShadow: '0 30px 60px -20px rgba(27,43,77,0.35)',
  } as const,
  phoneInner: {
    background: '#FAFAF8',
    borderRadius: 30,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  } as const,
  stageNum: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    marginBottom: 12,
  } as const,
  stageHeadline: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 30,
    fontWeight: 500,
    color: '#1B2B4D',
    margin: 0,
    marginBottom: 14,
    lineHeight: 1.2,
  } as const,
  stageBody: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 1.6,
    margin: 0,
    marginBottom: 16,
  } as const,
  stageDetail: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderLeft: '3px solid #B7410E',
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: 13,
    color: '#1B2B4D',
    fontStyle: 'italic',
    marginBottom: 22,
  } as const,
  navRow: {
    display: 'flex',
    gap: 10,
  } as const,
  navBtn: {
    background: '#FFFFFF',
    color: '#1B2B4D',
    border: '1.5px solid #1B2B4D',
    borderRadius: 12,
    padding: '12px 20px',
    fontSize: 13,
    fontWeight: 600,
  } as const,
  navBtnPrimary: {
    background: '#1B2B4D',
    color: '#FFFFFF',
    border: '1.5px solid #1B2B4D',
    borderRadius: 12,
    padding: '12px 20px',
    fontSize: 13,
    fontWeight: 600,
    flex: 1,
  } as const,
  cta: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 18,
    padding: '32px 24px',
    textAlign: 'center' as const,
  } as const,
  ctaTitle: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 24,
    fontWeight: 500,
    color: '#1B2B4D',
    marginBottom: 18,
  } as const,
  ctaRow: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  } as const,
  ctaPrimary: {
    background: '#1B2B4D',
    color: '#FFFFFF',
    padding: '14px 24px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
  } as const,
  ctaSecondary: {
    background: 'transparent',
    color: '#1B2B4D',
    padding: '14px 24px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    border: '1.5px solid #1B2B4D',
  } as const,
}

const m = {
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
    marginTop: 6,
    marginBottom: 12,
  } as const,
  line: {
    height: 6,
    background: '#E8E8E6',
    borderRadius: 3,
    width: '100%',
    marginBottom: 6,
  } as const,
  thumbsRow: {
    display: 'flex',
    gap: 4,
    marginTop: 10,
  } as const,
  thumb: {
    flex: 1,
    aspectRatio: '1',
    borderRadius: 6,
  } as const,
  thumbSm: {
    flex: 1,
    aspectRatio: '1',
    borderRadius: 4,
  } as const,
  smsHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9CA3AF',
    letterSpacing: '0.06em',
    marginBottom: 8,
    textAlign: 'center' as const,
  } as const,
  smsBubble: {
    background: '#F5F0E6',
    borderRadius: 14,
    padding: '12px 14px',
    fontSize: 12,
    color: '#1A1A1A',
    lineHeight: 1.5,
    marginBottom: 6,
  } as const,
  smsTime: {
    fontSize: 9,
    color: '#9CA3AF',
    textAlign: 'center' as const,
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
    fontWeight: 700,
    letterSpacing: '0.1em',
  } as const,
  priceValue: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 22,
    marginTop: 2,
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
    marginBottom: 10,
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
    marginTop: 8,
    marginBottom: 10,
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
  warranty: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    marginTop: 'auto',
  } as const,
}
