// All employee demo screen mockups in one file.
// Pure presentational components fed by EMPLOYEE_DEMO_DATA.
// No state, no backend, no auth.

import { EMPLOYEE_DEMO_DATA } from '../demo-data'

const D = EMPLOYEE_DEMO_DATA

// ───────────────────────── Welcome ─────────────────────────
export function WelcomeScreen() {
  return (
    <div style={s.welcomeWrap}>
      <div style={s.welcomeLogo}>AK</div>
      <div style={s.welcomeTitle}>Welcome to AK Renovations</div>
      <div style={s.welcomeSub}>
        A 5-minute look at how we run our jobs. No login. Tap through at your
        own pace.
      </div>
      <div style={s.welcomeMetaRow}>
        <div style={s.welcomeMeta}>
          <div style={s.welcomeMetaLabel}>FOR</div>
          <div style={s.welcomeMetaValue}>{D.employee.name}</div>
        </div>
        <div style={s.welcomeMeta}>
          <div style={s.welcomeMetaLabel}>ROLE</div>
          <div style={s.welcomeMetaValue}>{D.employee.role}</div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Launchpad ─────────────────────────
const LAUNCH_TILES = [
  { id: 'schedule_card', label: 'Schedule', sub: '2 stops today', color: '#1B2B4D' },
  { id: 'time', label: 'Time Clock', sub: 'Not clocked in', color: '#B7410E' },
  { id: 'shopping', label: 'Shopping', sub: '2 items needed' },
  { id: 'receipts', label: 'Receipts', sub: 'Snap & file' },
  { id: 'photos', label: 'Photos', sub: 'Document work' },
  { id: 'bonus', label: 'Bonus', sub: 'On track' },
  { id: 'notes', label: 'Notes', sub: 'Project files' },
  { id: 'messages', label: 'Messages', sub: '3 new' },
  { id: 'client', label: 'Client Info', sub: 'Henderson' },
]

export function LaunchpadScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div style={s.greeting}>
        <div style={s.greetingHi}>Hey {D.employee.name},</div>
        <div style={s.greetingDate}>Tuesday — June 16</div>
      </div>
      <div style={s.tileGrid}>
        {LAUNCH_TILES.map((t) => {
          const isHighlight = highlight === t.id
          return (
            <div
              key={t.id}
              style={{
                ...s.tile,
                background: t.color || '#FFFFFF',
                color: t.color ? '#FFFFFF' : '#1A1A1A',
                outline: isHighlight ? '3px solid #B7410E' : 'none',
                outlineOffset: isHighlight ? 3 : 0,
                transform: isHighlight ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <div style={{ ...s.tileLabel, color: t.color ? '#FFFFFF' : '#1A1A1A' }}>
                {t.label}
              </div>
              <div
                style={{
                  ...s.tileSub,
                  color: t.color ? 'rgba(255,255,255,0.7)' : '#9CA3AF',
                }}
              >
                {t.sub}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ───────────────────────── Schedule ─────────────────────────
export function ScheduleScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div style={s.sectionTitle}>TODAY</div>
      <div
        style={{
          ...s.card,
          padding: 0,
          outline: highlight === 'schedule_items' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
        }}
      >
        {D.todaySchedule.map((row, i) => (
          <div
            key={i}
            style={{
              padding: '14px 16px',
              borderBottom:
                i < D.todaySchedule.length - 1 ? '1px solid #F0F0EE' : 'none',
            }}
          >
            <div style={s.timeRow}>
              <div style={s.timeStamp}>{row.time}</div>
              <div style={s.timeProject}>{row.project}</div>
            </div>
            {row.task && <div style={s.timeTask}>{row.task}</div>}
          </div>
        ))}
      </div>

      <div style={{ ...s.sectionTitle, marginTop: 24 }}>THIS WEEK</div>
      <div style={s.weekGrid}>
        {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
          <div key={i} style={{ ...s.weekDay, background: i === 1 ? '#1B2B4D' : '#FFFFFF', color: i === 1 ? '#FFFFFF' : '#1A1A1A' }}>
            <div style={s.weekDayLabel}>{d}</div>
            <div style={s.weekDayNum}>{15 + i}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Time Clock — pick project ─────────────────────────
export function TimeClockProjectSelectScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div style={s.sectionTitle}>CLOCK IN — PICK A PROJECT</div>
      <div
        style={{
          outline: highlight === 'project_list' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
          borderRadius: 14,
        }}
      >
        {D.projects.map((p) => (
          <div key={p.id} style={s.projectRow}>
            <div style={{ ...s.projectDot, background: p.color }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.projectTitle}>{p.title}</div>
              <div style={s.projectMeta}>
                {p.phase} · {p.percent_complete}%
              </div>
              <div style={s.projectAddr}>{p.address}</div>
            </div>
            <div style={s.chev}>›</div>
          </div>
        ))}
      </div>
      <div style={s.helperNote}>
        Two projects today — you'll clock in/out for each one separately.
      </div>
    </div>
  )
}

// ───────────────────────── Time Clock — work type ─────────────────────────
export function TimeClockWorkTypeScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div style={s.contextChip}>HENDERSON KITCHEN</div>
      <div style={s.sectionTitle}>WHAT KIND OF WORK?</div>
      <div
        style={{
          ...s.workGrid,
          outline: highlight === 'work_type_grid' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
          borderRadius: 14,
        }}
      >
        {D.workTypes.map((w, i) => (
          <div
            key={w.id}
            style={{
              ...s.workTile,
              background: i === 0 ? '#1B2B4D' : '#FFFFFF',
              color: i === 0 ? '#FFFFFF' : '#1A1A1A',
              borderColor: i === 0 ? '#1B2B4D' : '#E8E8E6',
            }}
          >
            <div style={{ ...s.workTileLabel, color: i === 0 ? '#FFFFFF' : '#1A1A1A' }}>
              {w.label}
            </div>
            <div
              style={{
                ...s.workTileRate,
                color: i === 0 ? 'rgba(255,255,255,0.65)' : '#9CA3AF',
              }}
            >
              {w.rate}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Time Clock — active ─────────────────────────
export function TimeClockActiveScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div
        style={{
          ...s.activeCard,
          outline: highlight === 'active_segment' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
        }}
      >
        <div style={s.activeBadge}>● ON THE CLOCK</div>
        <div style={s.activeTimer}>02:14:38</div>
        <div style={s.activeProject}>{D.activeClockIn.project}</div>
        <div style={s.activeWorkType}>{D.activeClockIn.work_type}</div>

        <div style={s.activeMetaRow}>
          <div style={s.activeMeta}>
            <div style={s.activeMetaLabel}>STARTED</div>
            <div style={s.activeMetaValue}>{D.activeClockIn.started_at}</div>
          </div>
          <div style={s.activeMeta}>
            <div style={s.activeMetaLabel}>RATE</div>
            <div style={s.activeMetaValue}>{D.activeClockIn.rate}</div>
          </div>
          <div style={s.activeMeta}>
            <div style={s.activeMetaLabel}>GPS</div>
            <div style={{ ...s.activeMetaValue, color: '#059669' }}>✓ On site</div>
          </div>
        </div>
      </div>

      <button style={s.clockOutBtn}>Clock Out</button>
    </div>
  )
}

// ───────────────────────── Receipt scanner (camera) ─────────────────────────
export function ReceiptScannerScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div style={s.sectionTitle}>SCAN A RECEIPT</div>
      <div style={s.cameraStage}>
        <div
          style={{
            ...s.cameraFrame,
            outline: highlight === 'camera_button' ? '3px solid #B7410E' : 'none',
            outlineOffset: 3,
          }}
        >
          <div style={s.cameraReticle}>
            <div style={{ ...s.cameraCorner, top: 12, left: 12, borderTop: '3px solid #FFF', borderLeft: '3px solid #FFF' }} />
            <div style={{ ...s.cameraCorner, top: 12, right: 12, borderTop: '3px solid #FFF', borderRight: '3px solid #FFF' }} />
            <div style={{ ...s.cameraCorner, bottom: 12, left: 12, borderBottom: '3px solid #FFF', borderLeft: '3px solid #FFF' }} />
            <div style={{ ...s.cameraCorner, bottom: 12, right: 12, borderBottom: '3px solid #FFF', borderRight: '3px solid #FFF' }} />
            <div style={s.cameraHint}>Position receipt in frame</div>
          </div>
        </div>
        <div style={s.shutterRow}>
          <div style={s.shutterOuter}>
            <div style={s.shutterInner} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Receipt confirm ─────────────────────────
export function ReceiptConfirmScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div style={s.aiBadge}>● AI EXTRACTED</div>
      <div
        style={{
          ...s.card,
          outline: highlight === 'extracted_data' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
        }}
      >
        <div style={s.receiptHeader}>
          <div>
            <div style={s.receiptVendor}>{D.receipt.vendor}</div>
            <div style={s.receiptDate}>{D.receipt.date}</div>
          </div>
          <div style={s.receiptTotal}>{D.receipt.total}</div>
        </div>
        <div style={s.divider} />
        <div style={s.receiptItems}>
          {D.receipt.items.map((item, i) => (
            <div key={i} style={s.receiptItem}>
              {item}
            </div>
          ))}
        </div>
        <div style={s.divider} />
        <div style={s.receiptAssign}>
          <div style={s.receiptAssignLabel}>ASSIGNED TO</div>
          <div style={s.receiptAssignValue}>{D.receipt.project}</div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Shopping list ─────────────────────────
export function ShoppingListScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div style={s.sectionTitle}>SHOPPING LIST</div>
      {D.shoppingList.map((item, i) => {
        const isHighlight =
          i === 0 && highlight === 'first_item_with_supplier'
        const isPurchased = item.status === 'purchased'
        return (
          <div
            key={i}
            style={{
              ...s.shopRow,
              outline: isHighlight ? '3px solid #B7410E' : 'none',
              outlineOffset: 3,
              opacity: isPurchased ? 0.55 : 1,
            }}
          >
            <div
              style={{
                ...s.shopCheck,
                background: isPurchased ? '#059669' : 'transparent',
                borderColor: isPurchased ? '#059669' : '#E8E8E6',
              }}
            >
              {isPurchased && (
                <span style={{ color: '#fff', fontSize: 13 }}>✓</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  ...s.shopItem,
                  textDecoration: isPurchased ? 'line-through' : 'none',
                }}
              >
                {item.item}
              </div>
              <div style={s.shopMeta}>
                {item.qty} · {item.project}
              </div>
              {!isPurchased && (
                <div style={s.shopSupplier}>
                  <span style={s.shopSupplierLabel}>GO TO</span>{' '}
                  <span style={s.shopSupplierName}>{item.supplier}</span>
                  {item.account && (
                    <>
                      {' · '}
                      <span style={s.shopAcct}>Acct {item.account}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────────── Photos ─────────────────────────
export function PhotosScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div style={s.contextChip}>HENDERSON KITCHEN</div>
      <div style={s.sectionTitle}>PICK A CATEGORY</div>
      <div
        style={{
          ...s.catGrid,
          outline: highlight === 'category_picker' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
          borderRadius: 14,
        }}
      >
        {D.photoCategories.map((c, i) => (
          <div
            key={c.id}
            style={{
              ...s.catTile,
              background: i === 2 ? '#1B2B4D' : '#FFFFFF',
              color: i === 2 ? '#FFFFFF' : '#1A1A1A',
              borderColor: i === 2 ? '#1B2B4D' : '#E8E8E6',
            }}
          >
            {c.label}
          </div>
        ))}
      </div>

      <div style={{ ...s.sectionTitle, marginTop: 22 }}>RECENT PHOTOS</div>
      <div style={s.photoGrid}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={s.photoBox}>
            <div style={s.photoIcon}>📷</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Bonus tracker ─────────────────────────
export function BonusTrackerScreen({ highlight }: { highlight?: string | null }) {
  return (
    <div>
      <div style={s.sectionTitle}>BONUS TRACKER</div>
      <div
        style={{
          ...s.bonusCard,
          outline: highlight === 'bonus_card' ? '3px solid #B7410E' : 'none',
          outlineOffset: 3,
        }}
      >
        <div style={s.bonusLabel}>NEXT BONUS</div>
        <div style={s.bonusAmount}>${D.bonusTracker.bonus_amount}</div>
        <div style={s.bonusProject}>{D.bonusTracker.next_project}</div>

        <div style={s.bonusBarOuter}>
          <div style={{ ...s.bonusBarInner, width: '58%' }} />
        </div>

        <div style={s.bonusMetaRow}>
          <div>
            <div style={s.bonusMetaLabel}>COMPLETION TARGET</div>
            <div style={s.bonusMetaValue}>{D.bonusTracker.completion_target}</div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={s.bonusMetaLabel}>STATUS</div>
            <div style={{ ...s.bonusMetaValue, color: '#059669' }}>● On track</div>
          </div>
        </div>
      </div>

      <div style={s.bonusYTD}>
        <div style={s.bonusYTDLabel}>YTD EARNED</div>
        <div style={s.bonusYTDValue}>$3,150</div>
      </div>
    </div>
  )
}

// ───────────────────────── Completion ─────────────────────────
export function CompletionScreen({ onReplay }: { onReplay: () => void }) {
  return (
    <div style={s.completeWrap}>
      <div style={s.completeCheck}>✓</div>
      <div style={s.completeTitle}>That's how we work.</div>
      <div style={s.completeBody}>
        The app handles the documentation.
        <br />
        The AI handles the questions.
        <br />
        You handle the craft.
      </div>
      <div style={s.completeMeta}>
        Any questions? Adam will walk you through everything in person.
      </div>
      <button onClick={onReplay} style={s.completeBtnSecondary}>
        Replay walkthrough
      </button>
      <a
        href="https://akrenovationsohio.com"
        style={s.completeBtnPrimary}
      >
        Visit akrenovationsohio.com
      </a>
      <div style={s.completeFooter}>
        This was a demo. No real data was used.
      </div>
    </div>
  )
}

// ───────────────────────── styles ─────────────────────────
const s = {
  // welcome
  welcomeWrap: {
    padding: '60px 28px 40px',
    textAlign: 'center' as const,
  } as const,
  welcomeLogo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    background: '#1B2B4D',
    color: '#FFF',
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 30,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  } as const,
  welcomeTitle: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 26,
    fontWeight: 500,
    color: '#1B2B4D',
    marginBottom: 12,
    lineHeight: 1.2,
  } as const,
  welcomeSub: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 1.55,
    marginBottom: 32,
  } as const,
  welcomeMetaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: 16,
  } as const,
  welcomeMeta: {
    textAlign: 'left' as const,
  } as const,
  welcomeMetaLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: 600,
    letterSpacing: '0.08em',
  } as const,
  welcomeMetaValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: 600,
    marginTop: 4,
  } as const,

  // launchpad
  greeting: {
    padding: '4px 4px 18px',
  } as const,
  greetingHi: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 26,
    color: '#1B2B4D',
    fontWeight: 500,
  } as const,
  greetingDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  } as const,
  tileGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  } as const,
  tile: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: '16px 14px',
    minHeight: 78,
    transition: 'all 220ms ease',
  } as const,
  tileLabel: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 4,
  } as const,
  tileSub: {
    fontSize: 11,
    color: '#9CA3AF',
  } as const,

  // shared
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#9CA3AF',
    margin: '4px 4px 10px',
  } as const,
  card: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  } as const,
  contextChip: {
    display: 'inline-block',
    background: '#1B2B4D',
    color: '#FFF',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '5px 10px',
    borderRadius: 6,
    marginBottom: 12,
  } as const,
  helperNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 14,
    padding: '10px 12px',
    background: '#F5F5F3',
    borderRadius: 10,
  } as const,
  divider: {
    height: 1,
    background: '#F0F0EE',
    margin: '12px 0',
  } as const,
  aiBadge: {
    display: 'inline-block',
    background: '#1B2B4D',
    color: '#FFF',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '5px 10px',
    borderRadius: 6,
    marginBottom: 10,
  } as const,

  // schedule
  timeRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 4,
  } as const,
  timeStamp: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: '#9CA3AF',
    width: 60,
    flexShrink: 0,
  } as const,
  timeProject: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1A1A1A',
  } as const,
  timeTask: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 72,
    lineHeight: 1.4,
  } as const,
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 8,
  } as const,
  weekDay: {
    border: '1px solid #E8E8E6',
    borderRadius: 12,
    padding: '12px 4px',
    textAlign: 'center' as const,
  } as const,
  weekDayLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    opacity: 0.6,
  } as const,
  weekDayNum: {
    fontSize: 18,
    fontWeight: 600,
    marginTop: 2,
  } as const,

  // project select
  projectRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 10,
  } as const,
  projectDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    flexShrink: 0,
  } as const,
  projectTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1A1A1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as const,
  projectMeta: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  } as const,
  projectAddr: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  } as const,
  chev: {
    fontSize: 22,
    color: '#9CA3AF',
    flexShrink: 0,
  } as const,

  // work type
  workGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    padding: 0,
  } as const,
  workTile: {
    border: '1px solid #E8E8E6',
    borderRadius: 12,
    padding: '16px 14px',
    minHeight: 72,
  } as const,
  workTileLabel: {
    fontSize: 14,
    fontWeight: 600,
  } as const,
  workTileRate: {
    fontSize: 11,
    marginTop: 4,
    fontFamily: "'JetBrains Mono', monospace",
  } as const,

  // active
  activeCard: {
    background: '#1B2B4D',
    color: '#FFF',
    borderRadius: 18,
    padding: '24px 20px',
    marginBottom: 14,
  } as const,
  activeBadge: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.12)',
    color: '#FFF',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '4px 10px',
    borderRadius: 6,
    marginBottom: 14,
  } as const,
  activeTimer: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 36,
    fontWeight: 600,
    marginBottom: 14,
    letterSpacing: '0.04em',
  } as const,
  activeProject: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 19,
    fontWeight: 500,
  } as const,
  activeWorkType: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    marginBottom: 18,
  } as const,
  activeMetaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 10,
    paddingTop: 16,
    borderTop: '1px solid rgba(255,255,255,0.12)',
  } as const,
  activeMeta: {} as const,
  activeMetaLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.1em',
  } as const,
  activeMetaValue: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: 500,
    marginTop: 4,
  } as const,
  clockOutBtn: {
    width: '100%',
    background: '#FFFFFF',
    color: '#1B2B4D',
    border: '1.5px solid #1B2B4D',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
  } as const,

  // camera
  cameraStage: {
    background: '#1A1A1A',
    borderRadius: 18,
    padding: '20px 16px 24px',
  } as const,
  cameraFrame: {
    aspectRatio: '3/4',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
    border: '1px dashed rgba(255,255,255,0.18)',
    borderRadius: 12,
    position: 'relative' as const,
    marginBottom: 24,
  } as const,
  cameraReticle: {
    position: 'absolute' as const,
    inset: 0,
  } as const,
  cameraCorner: {
    position: 'absolute' as const,
    width: 24,
    height: 24,
  } as const,
  cameraHint: {
    position: 'absolute' as const,
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: 'center' as const,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.05em',
  } as const,
  shutterRow: {
    display: 'flex',
    justifyContent: 'center',
  } as const,
  shutterOuter: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  shutterInner: {
    width: 50,
    height: 50,
    borderRadius: '50%',
    background: '#FFF',
  } as const,

  // receipt confirm
  receiptHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  } as const,
  receiptVendor: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 18,
    fontWeight: 500,
    color: '#1B2B4D',
  } as const,
  receiptDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  } as const,
  receiptTotal: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 22,
    fontWeight: 600,
    color: '#1B2B4D',
  } as const,
  receiptItems: {} as const,
  receiptItem: {
    fontSize: 13,
    color: '#1A1A1A',
    padding: '4px 0',
  } as const,
  receiptAssign: {
    background: '#FFF5F0',
    borderRadius: 10,
    padding: 12,
  } as const,
  receiptAssignLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#B7410E',
    letterSpacing: '0.1em',
  } as const,
  receiptAssignValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1B2B4D',
    marginTop: 3,
  } as const,

  // shopping
  shopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 10,
  } as const,
  shopCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: '2px solid #E8E8E6',
    flexShrink: 0,
    marginTop: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  shopItem: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1A1A1A',
  } as const,
  shopMeta: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  } as const,
  shopSupplier: {
    fontSize: 11,
    color: '#1B2B4D',
    marginTop: 6,
    background: '#F5F0E6',
    padding: '6px 8px',
    borderRadius: 6,
    display: 'inline-block',
  } as const,
  shopSupplierLabel: {
    color: '#9CA3AF',
    fontWeight: 700,
    letterSpacing: '0.06em',
  } as const,
  shopSupplierName: {
    fontWeight: 600,
  } as const,
  shopAcct: {
    fontFamily: "'JetBrains Mono', monospace",
    color: '#B7410E',
  } as const,

  // photos
  catGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
  } as const,
  catTile: {
    border: '1px solid #E8E8E6',
    borderRadius: 10,
    padding: '12px 8px',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center' as const,
  } as const,
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } as const,
  photoBox: {
    aspectRatio: '1',
    background: '#F5F0E6',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  photoIcon: {
    fontSize: 28,
    opacity: 0.4,
  } as const,

  // bonus
  bonusCard: {
    background:
      'linear-gradient(135deg, #1B2B4D 0%, #2A3F6B 100%)',
    color: '#FFF',
    borderRadius: 18,
    padding: '24px 20px',
    marginBottom: 14,
  } as const,
  bonusLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.5)',
  } as const,
  bonusAmount: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 44,
    fontWeight: 500,
    margin: '6px 0 4px',
  } as const,
  bonusProject: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 18,
  } as const,
  bonusBarOuter: {
    height: 6,
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  } as const,
  bonusBarInner: {
    height: '100%',
    background: '#B7410E',
  } as const,
  bonusMetaRow: {
    display: 'flex',
    justifyContent: 'space-between',
  } as const,
  bonusMetaLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.1em',
  } as const,
  bonusMetaValue: {
    fontSize: 13,
    fontWeight: 500,
    marginTop: 4,
  } as const,
  bonusYTD: {
    background: '#FFFFFF',
    border: '1px solid #E8E8E6',
    borderRadius: 14,
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as const,
  bonusYTDLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: 600,
    letterSpacing: '0.06em',
  } as const,
  bonusYTDValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 22,
    fontWeight: 600,
    color: '#1B2B4D',
  } as const,

  // completion
  completeWrap: {
    padding: '60px 28px 40px',
    textAlign: 'center' as const,
  } as const,
  completeCheck: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#059669',
    color: '#FFF',
    fontSize: 40,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  } as const,
  completeTitle: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: 28,
    fontWeight: 500,
    color: '#1B2B4D',
    marginBottom: 16,
  } as const,
  completeBody: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 1.7,
    marginBottom: 22,
  } as const,
  completeMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 28,
    lineHeight: 1.5,
  } as const,
  completeBtnSecondary: {
    width: '100%',
    background: '#FFFFFF',
    color: '#1B2B4D',
    border: '1.5px solid #1B2B4D',
    borderRadius: 12,
    padding: '14px',
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 10,
    cursor: 'pointer',
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
    textAlign: 'center' as const,
    textDecoration: 'none',
    boxSizing: 'border-box' as const,
  } as const,
  completeFooter: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 28,
  } as const,
}
