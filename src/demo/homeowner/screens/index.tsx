// All homeowner demo screens — Sarah Mitchell perspective
// Pure presentational. No backend.

import { HOMEOWNER_DEMO_DATA } from '../homeowner-data'

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
export function PortalWelcomeScreen() {
  return (
    <div>
      <div style={s.portalHeader}>
        <div style={s.portalGreeting}>Welcome, Sarah</div>
        <div style={s.portalProject}>{D.client.project}</div>
      </div>

      <div style={s.portalProgressCard}>
        <div style={s.portalProgressLabel}>PROJECT PROGRESS</div>
        <div style={s.portalProgressBar}>
          <div style={{ ...s.portalProgressFill, width: '58%' }} />
        </div>
        <div style={s.portalProgressMeta}>
          <span>Week 3 of 7</span>
          <span>Cabinets installed</span>
        </div>
      </div>

      <div style={s.sectionTitle}>YOUR PORTAL</div>
      <div style={s.tabsGrid}>
        {D.portal_tabs.map((t) => (
          <div key={t.id} style={s.tabTile}>
            {t.label}
          </div>
        ))}
      </div>

      <div style={s.portalFooter}>
        Available on any device. No app to download.
      </div>
    </div>
  )
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
const PHOTO_GRADIENTS = [
  'linear-gradient(135deg, #6B7280 0%, #374151 100%)',
  'linear-gradient(135deg, #92400E 0%, #451A03 100%)',
  'linear-gradient(135deg, #E8DCC4 0%, #B7410E 100%)',
  'linear-gradient(135deg, #1B2B4D 0%, #2A3F6B 100%)',
  'linear-gradient(135deg, #B7410E 0%, #7C2D12 100%)',
  'linear-gradient(135deg, #ECFDF5 0%, #059669 100%)',
]

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
            <div
              style={{
                ...s.progressImg,
                background: PHOTO_GRADIENTS[i % PHOTO_GRADIENTS.length],
              }}
            >
              <div style={s.progressPhase}>{p.phase}</div>
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
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                ...s.updatePhoto,
                background: PHOTO_GRADIENTS[i % PHOTO_GRADIENTS.length],
              }}
            />
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
        <div
          style={{
            ...s.beforeAfterBox,
            background:
              'linear-gradient(135deg, #6B7280 0%, #374151 100%)',
          }}
        >
          <div style={s.baLabel}>BEFORE</div>
        </div>
        <div
          style={{
            ...s.beforeAfterBox,
            background:
              'linear-gradient(135deg, #E8DCC4 0%, #B7410E 100%)',
          }}
        >
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
  tabsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  } as const,
  tabTile: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 12,
    padding: '14px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#1A1A1A',
  } as const,
  portalFooter: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 18,
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
  } as const,
  progressPhase: {
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
