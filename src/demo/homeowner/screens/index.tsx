// All homeowner demo screens — Sarah Mitchell perspective
// Pure presentational. No backend.

import { HOMEOWNER_DEMO_DATA } from '../homeowner-data'
import {
  KITCHEN,
  PROGRESS_SEQUENCE,
  WEEKLY_UPDATE_PHOTOS,
  BEFORE_AFTER,
} from '../../shared/demo-images'

const D = HOMEOWNER_DEMO_DATA

// ───────────────────────── Intro ─────────────────────────
export function IntroScreen() {
  return (
    <div style={s.introWrap}>
      <div style={s.introBadge}>A KITCHEN REMODEL · STOW, OHIO</div>
      <div style={s.introHeadline}>Sarah's kitchen.</div>
      <div style={s.introSub}>
        See what it's actually like to hire a contractor who runs a tight
        operation.
      </div>
      <div style={s.introCard}>
        <div style={s.introCardRow}>
          <div style={s.introMetaLabel}>HOMEOWNER</div>
          <div style={s.introMetaValue}>{D.client.name}</div>
        </div>
        <div style={s.introCardRow}>
          <div style={s.introMetaLabel}>ADDRESS</div>
          <div style={s.introMetaValue}>{D.client.address}</div>
        </div>
        <div style={s.introCardRow}>
          <div style={s.introMetaLabel}>PROJECT</div>
          <div style={s.introMetaValue}>{D.client.project}</div>
        </div>
        <div style={s.introCardRow}>
          <div style={s.introMetaLabel}>TIMELINE</div>
          <div style={s.introMetaValue}>
            {D.client.start_date} → {D.client.completion_date}
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Proposal overview ─────────────────────────
export function ProposalOverviewScreen() {
  return (
    <div>
      <div style={s.docHeader}>
        <div style={s.docBrand}>AK RENOVATIONS</div>
        <div style={s.docMeta}>PROPOSAL · {D.client.start_date}</div>
      </div>

      <div style={s.docTitle}>Kitchen Remodel</div>
      <div style={s.docSub}>Prepared for {D.client.name}</div>
      <div style={s.docAddr}>{D.client.address}</div>

      <div style={s.priceCard}>
        <div style={s.priceLabel}>CONTRACT VALUE</div>
        <div style={s.priceValue}>{D.client.contract_value}</div>
        <div style={s.priceFine}>
          Fixed price · No hidden fees · 12-month workmanship warranty
        </div>
      </div>

      <div style={s.eSignCard}>
        <div style={s.eSignLabel}>READY TO SIGN</div>
        <div style={s.eSignSlot}>
          <div style={s.eSignLine} />
          <div style={s.eSignHint}>Tap to sign</div>
        </div>
        <button style={s.eSignBtn}>Sign Proposal</button>
      </div>
    </div>
  )
}

// ───────────────────────── Proposal sections ─────────────────────────
export function ProposalSectionsScreen({
  highlight,
}: {
  highlight?: string
}) {
  return (
    <div>
      <div style={s.sectionTitle}>SCOPE OF WORK</div>
      <div
        style={{
          outline: highlight === 'scope_sections' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
          borderRadius: 14,
        }}
      >
        {D.proposal_sections.map((sec, i) => (
          <div key={i} style={s.scopeCard}>
            <div style={s.scopeTitle}>
              <span style={s.scopeNum}>{String(i + 1).padStart(2, '0')}</span>
              {sec.title}
            </div>
            <ul style={s.scopeList}>
              {sec.items.map((item, j) => (
                <li key={j} style={s.scopeItem}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Portal welcome ─────────────────────────
// High-end homeowner portal. Full-width hero image of the project vision,
// overlaid with the warm greeting. Below: a progress ring, a "this week"
// card with a real photo, then the tab tiles in a refined layout.

export function PortalWelcomeScreen() {
  return (
    <div style={{ margin: '-16px -14px 0' }}>
      {/* Full-bleed hero with image + gradient overlay + welcome text */}
      <div style={s.heroWrap}>
        <img
          src={KITCHEN.heroLuxury}
          alt="Your kitchen vision"
          style={s.heroImg}
        />
        <div style={s.heroGradient} />
        <div style={s.heroContent}>
          <div style={s.heroKicker}>YOUR PROJECT · STOW, OH</div>
          <div style={s.heroGreeting}>Welcome home, Sarah.</div>
          <div style={s.heroTagline}>
            Your kitchen, every detail. In one place, always.
          </div>
        </div>
      </div>

      {/* Progress + This Week card — elevated, warm */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={s.elevatedCard}>
          <div style={s.progressRow}>
            <div>
              <div style={s.tinyLabel}>PROJECT PROGRESS</div>
              <div style={s.progressBig}>58%</div>
              <div style={s.progressSub}>Week 3 of 7 · On schedule</div>
            </div>
            <div style={s.ring}>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" stroke="#F0F0EE" strokeWidth="6" fill="none" />
                <circle
                  cx="36"
                  cy="36"
                  r="30"
                  stroke="#B7410E"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray="188.5"
                  strokeDashoffset="79.2"
                  strokeLinecap="round"
                  transform="rotate(-90 36 36)"
                />
              </svg>
            </div>
          </div>
          <div style={s.phaseDivider} />
          <div style={s.currentPhase}>
            <img
              src={KITCHEN.shakerCream}
              alt="Cabinets installed"
              style={s.currentPhaseImg}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.tinyLabel}>CURRENTLY</div>
              <div style={s.currentPhaseLabel}>Cabinet installation</div>
              <div style={s.currentPhaseSub}>
                Uppers complete · Lowers starting today
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 18 }} />

        <div style={s.sectionTitle}>YOUR PORTAL</div>
        <div style={s.tabsGrid}>
          {D.portal_tabs.map((t) => (
            <div key={t.id} style={s.tabTile}>
              <div style={s.tabTileIcon}>{iconFor(t.id)}</div>
              <div>{t.label}</div>
            </div>
          ))}
        </div>

        <div style={s.portalFooter}>
          Available on any device. No app to download.
        </div>
      </div>
    </div>
  )
}

// Small inline icons for the portal tabs — simple unicode-free approach
function iconFor(id: string): string {
  const map: Record<string, string> = {
    progress:   '◐',
    photos:     '▣',
    selections: '✓',
    invoices:   '$',
    messages:   '✉',
    docs:       '⎋',
    schedule:   '◷',
  }
  return map[id] ?? '·'
}

// ───────────────────────── Selections ─────────────────────────
export function SelectionsScreen({ highlight }: { highlight?: string }) {
  return (
    <div>
      <div style={s.sectionTitle}>YOUR SELECTIONS</div>
      <div
        style={{
          outline: highlight === 'selections_list' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
          borderRadius: 14,
        }}
      >
        {D.selections.map((sel, i) => {
          const confirmed = sel.status === 'confirmed'
          return (
            <div key={i} style={s.selRow}>
              <div
                style={{
                  ...s.selCheck,
                  background: confirmed ? '#059669' : 'transparent',
                  borderColor: confirmed ? '#059669' : '#E8E8E6',
                }}
              >
                {confirmed && (
                  <span style={{ color: '#fff', fontSize: 13 }}>✓</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.selItem}>{sel.item}</div>
                <div style={s.selChoice}>{sel.choice}</div>
              </div>
              <div
                style={{
                  ...s.selStatus,
                  color: confirmed ? '#059669' : '#D97706',
                  background: confirmed ? '#ECFDF5' : '#FFFBEB',
                }}
              >
                {confirmed ? 'Confirmed' : 'Pending'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ───────────────────────── Progress photos ─────────────────────────

export function ProgressPhotosScreen({
  highlight,
}: {
  highlight?: string
}) {
  return (
    <div>
      <div style={s.sectionTitle}>PROGRESS PHOTOS · 24 TOTAL</div>
      <div
        style={{
          ...s.progressGrid,
          outline: highlight === 'photo_gallery' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
          borderRadius: 14,
        }}
      >
        {D.photos.map((p, i) => (
          <div key={i} style={s.progressPhoto}>
            <div style={s.progressImg}>
              <img
                src={PROGRESS_SEQUENCE[i % PROGRESS_SEQUENCE.length]}
                alt={p.label}
                style={s.progressImgTag}
              />
              <div style={s.progressPhaseOverlay}>{p.phase}</div>
            </div>
            <div style={s.progressMeta}>
              <div style={s.progressLabel}>{p.label}</div>
              <div style={s.progressDate}>{p.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Weekly update ─────────────────────────
export function WeeklyUpdateScreen() {
  return (
    <div>
      <div style={s.sectionTitle}>FROM ADAM · WEEKLY UPDATE</div>
      <div style={s.updateCard}>
        <div style={s.updateWeek}>{D.weekly_update.week}</div>
        <div style={s.updateBody}>{D.weekly_update.summary}</div>

        <div style={s.updatePhotos}>
          {WEEKLY_UPDATE_PHOTOS.map((src, i) => (
            <div key={i} style={s.updatePhoto}>
              <img src={src} alt={`Week 3 photo ${i + 1}`} style={s.updatePhotoImg} />
            </div>
          ))}
        </div>

        <div style={s.updateNext}>
          <div style={s.updateNextLabel}>NEXT WEEK</div>
          <div style={s.updateNextValue}>{D.weekly_update.next_week}</div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Completion ─────────────────────────
export function CompletionScreen({
  onReplay,
}: {
  onReplay: () => void
}) {
  return (
    <div style={s.completeWrap}>
      <div style={s.beforeAfter}>
        <div style={s.beforeAfterBox}>
          <img src={BEFORE_AFTER.before} alt="Before" style={s.beforeAfterImg} />
          <div style={s.baLabel}>BEFORE</div>
        </div>
        <div style={s.beforeAfterBox}>
          <img src={BEFORE_AFTER.after} alt="After" style={s.beforeAfterImg} />
          <div style={s.baLabel}>AFTER</div>
        </div>
      </div>

      <div style={s.completeTitle}>Sarah's kitchen.</div>
      <div style={s.completeSub}>6 weeks. Done right. Documented.</div>

      <div style={s.completeDivider} />

      <div style={s.completeCTA}>Ready to start your project?</div>
      <a href="/contact" style={s.completeBtnPrimary}>
        Schedule a free site visit →
      </a>
      <div style={s.completeOr}>or call Adam directly</div>
      <a href="tel:" style={s.completePhone}>
        330-555-0188
      </a>

      <div style={s.completeDivider} />

      <button onClick={onReplay} style={s.completeBtnSecondary}>
        Replay Sarah's story
      </button>

      <div style={s.completeFooter}>
        This was a demo. Sarah's project represents the experience every
        AK Renovations client gets.
      </div>
    </div>
  )
}

// ───────────────────────── styles ─────────────────────────
const s = {
  // intro
  introWrap: {
    padding: '40px 24px 30px',
  } as const,
  introBadge: {
    display: 'inline-block',
    background: '#FFF5F0',
    color: '#B7410E',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '5px 10px',
    borderRadius: 6,
    marginBottom: 16,
  } as const,
  introHeadline: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 38,
    fontWeight: 500,
    color: '#1B2B4D',
    lineHeight: 1.1,
    marginBottom: 12,
  } as const,
  introSub: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 1.55,
    marginBottom: 28,
  } as const,
  introCard: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: 18,
  } as const,
  introCardRow: {
    paddingBottom: 12,
    marginBottom: 12,
    borderBottom: '1px solid #F0F0EE',
  } as const,
  introMetaLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#9CA3AF',
  } as const,
  introMetaValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: 600,
    marginTop: 3,
  } as const,

  // proposal
  docHeader: {
    paddingBottom: 14,
    marginBottom: 16,
    borderBottom: '1px solid #E8E8E6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  } as const,
  docBrand: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1B2B4D',
    letterSpacing: '0.1em',
  } as const,
  docMeta: {
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: '0.06em',
  } as const,
  docTitle: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 26,
    fontWeight: 500,
    color: '#1B2B4D',
  } as const,
  docSub: {
    fontSize: 13,
    color: '#1A1A1A',
    marginTop: 4,
  } as const,
  docAddr: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 22,
  } as const,
  priceCard: {
    background: '#1B2B4D',
    color: '#FFF',
    borderRadius: 16,
    padding: '20px 18px',
    marginBottom: 18,
  } as const,
  priceLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.55)',
  } as const,
  priceValue: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 38,
    fontWeight: 500,
    margin: '4px 0 8px',
  } as const,
  priceFine: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  } as const,
  eSignCard: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: 16,
  } as const,
  eSignLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#9CA3AF',
    marginBottom: 12,
  } as const,
  eSignSlot: {
    background: '#F5F0E6',
    borderRadius: 10,
    padding: '20px 16px 12px',
    marginBottom: 12,
    position: 'relative' as const,
  } as const,
  eSignLine: {
    height: 1,
    background: '#1B2B4D',
    marginBottom: 6,
  } as const,
  eSignHint: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    letterSpacing: '0.06em',
  } as const,
  eSignBtn: {
    width: '100%',
    background: '#B7410E',
    color: '#FFF',
    border: 'none',
    borderRadius: 10,
    padding: '12px',
    fontSize: 14,
    fontWeight: 600,
  } as const,

  // sections
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#9CA3AF',
    margin: '4px 4px 12px',
  } as const,
  scopeCard: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  } as const,
  scopeTitle: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 17,
    fontWeight: 500,
    color: '#1B2B4D',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
  } as const,
  scopeNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#B7410E',
    fontWeight: 600,
  } as const,
  scopeList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  } as const,
  scopeItem: {
    fontSize: 13,
    color: '#1A1A1A',
    lineHeight: 1.5,
    paddingLeft: 16,
    position: 'relative' as const,
    marginBottom: 6,
  } as const,

  // portal
  portalHeader: {
    padding: '4px 4px 18px',
  } as const,
  portalGreeting: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 26,
    fontWeight: 500,
    color: '#1B2B4D',
  } as const,
  portalProject: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  } as const,
  // HERO — full-bleed kitchen image with overlay
  heroWrap: {
    position: 'relative' as const,
    width: '100%',
    aspectRatio: '4/3',
    overflow: 'hidden',
  } as const,
  heroImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  } as const,
  heroGradient: {
    position: 'absolute' as const,
    inset: 0,
    background:
      'linear-gradient(180deg, rgba(27,43,77,0.15) 0%, rgba(27,43,77,0.55) 65%, rgba(27,43,77,0.92) 100%)',
  } as const,
  heroContent: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    padding: '20px 22px 22px',
    color: '#FFF',
  } as const,
  heroKicker: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 8,
  } as const,
  heroGreeting: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 30,
    fontWeight: 500,
    lineHeight: 1.1,
    marginBottom: 6,
  } as const,
  heroTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.45,
    maxWidth: 300,
  } as const,

  // ELEVATED CARD — the progress + current phase block
  elevatedCard: {
    background: '#FFFFFF',
    border: '1px solid #F0F0EE',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 12px 32px -18px rgba(27,43,77,0.22)',
    marginTop: -30,
    position: 'relative' as const,
    zIndex: 2,
  } as const,
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  } as const,
  tinyLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#9CA3AF',
  } as const,
  progressBig: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 38,
    fontWeight: 500,
    color: '#1B2B4D',
    lineHeight: 1,
    marginTop: 4,
  } as const,
  progressSub: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: "'JetBrains Mono', monospace",
  } as const,
  ring: {
    marginLeft: 'auto',
    flexShrink: 0,
  } as const,
  phaseDivider: {
    height: 1,
    background: '#F0F0EE',
    margin: '18px -4px 16px',
  } as const,
  currentPhase: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as const,
  currentPhaseImg: {
    width: 54,
    height: 54,
    borderRadius: 10,
    objectFit: 'cover' as const,
    flexShrink: 0,
  } as const,
  currentPhaseLabel: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 16,
    fontWeight: 500,
    color: '#1B2B4D',
    marginTop: 3,
  } as const,
  currentPhaseSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  } as const,

  // LEGACY (left in case other screens still reference — safe to keep)
  portalProgressCard: {
    background: '#1B2B4D',
    color: '#FFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
  } as const,
  portalProgressLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.55)',
  } as const,
  portalProgressBar: {
    height: 6,
    background: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    margin: '12px 0 10px',
  } as const,
  portalProgressFill: {
    height: '100%',
    background: '#B7410E',
  } as const,
  portalProgressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  } as const,

  // PORTAL TABS — refined with icon
  tabsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  } as const,
  tabTile: {
    background: '#FFFFFF',
    border: '1px solid #F0F0EE',
    borderRadius: 14,
    padding: '16px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#1A1A1A',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    transition: 'transform 120ms ease',
  } as const,
  tabTileIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: '#F5F0E6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#B7410E',
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  } as const,
  portalFooter: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 20,
    marginBottom: 4,
    textAlign: 'center' as const,
  } as const,

  // selections
  selRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 8,
  } as const,
  selCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: '2px solid #E8E8E6',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  selItem: {
    fontSize: 11,
    fontWeight: 700,
    color: '#9CA3AF',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  } as const,
  selChoice: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: 500,
    marginTop: 2,
  } as const,
  selStatus: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '4px 8px',
    borderRadius: 6,
    flexShrink: 0,
  } as const,

  // progress photos
  progressGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  } as const,
  progressPhoto: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 12,
    overflow: 'hidden',
  } as const,
  progressImg: {
    aspectRatio: '4/3',
    position: 'relative' as const,
    overflow: 'hidden',
    background: '#F5F0E6',
  } as const,
  progressImgTag: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  } as const,
  progressPhaseOverlay: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    background: 'rgba(0,0,0,0.55)',
    color: '#FFF',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '3px 7px',
    borderRadius: 4,
  } as const,
  progressMeta: {
    padding: '8px 10px 10px',
  } as const,
  progressLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1A1A1A',
  } as const,
  progressDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
    fontFamily: "'JetBrains Mono', monospace",
  } as const,

  // weekly update
  updateCard: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: 18,
  } as const,
  updateWeek: {
    fontSize: 11,
    fontWeight: 700,
    color: '#B7410E',
    letterSpacing: '0.08em',
    marginBottom: 12,
  } as const,
  updateBody: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 1.6,
    marginBottom: 16,
  } as const,
  updatePhotos: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 6,
    marginBottom: 16,
  } as const,
  updatePhoto: {
    aspectRatio: '1',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#F5F0E6',
  } as const,
  updatePhotoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  } as const,
  updateNext: {
    background: '#F5F0E6',
    borderRadius: 10,
    padding: 12,
  } as const,
  updateNextLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#B7410E',
  } as const,
  updateNextValue: {
    fontSize: 12,
    color: '#1B2B4D',
    fontWeight: 500,
    marginTop: 4,
    lineHeight: 1.4,
  } as const,

  // completion
  completeWrap: {
    padding: '28px 22px 36px',
    textAlign: 'center' as const,
  } as const,
  beforeAfter: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 22,
  } as const,
  beforeAfterBox: {
    aspectRatio: '4/3',
    borderRadius: 12,
    position: 'relative' as const,
    overflow: 'hidden',
    background: '#F5F0E6',
  } as const,
  beforeAfterImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  } as const,
  baLabel: {
    position: 'absolute' as const,
    top: 10,
    left: 10,
    background: 'rgba(0,0,0,0.6)',
    color: '#FFF',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.12em',
    padding: '4px 8px',
    borderRadius: 4,
  } as const,
  completeTitle: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 32,
    fontWeight: 500,
    color: '#1B2B4D',
    marginBottom: 6,
  } as const,
  completeSub: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  } as const,
  completeDivider: {
    height: 1,
    background: '#E8E8E6',
    margin: '20px 0',
  } as const,
  completeCTA: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 18,
    color: '#1B2B4D',
    marginBottom: 14,
  } as const,
  completeBtnPrimary: {
    display: 'block',
    width: '100%',
    background: '#1B2B4D',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: 12,
  } as const,
  completeOr: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 6,
  } as const,
  completePhone: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 16,
    color: '#B7410E',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'block',
  } as const,
  completeBtnSecondary: {
    width: '100%',
    background: '#FFFFFF',
    color: '#1B2B4D',
    border: '1.5px solid #1B2B4D',
    borderRadius: 12,
    padding: '12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  } as const,
  completeFooter: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 20,
    lineHeight: 1.5,
  } as const,
}
