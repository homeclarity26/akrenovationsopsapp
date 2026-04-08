import { useState } from 'react'
import { X, Zap } from 'lucide-react'
import { useApiUsage, UsageRange } from '@/hooks/useApiUsage'

// ─── Formatting helpers ────────────────────────────────────────────────────────

function formatCost(usd: number): string {
  if (usd < 0.01) return '<$0.01'
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function formatAgentName(name: string): string {
  return name
    .replace(/^agent-/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ─── Service colors ────────────────────────────────────────────────────────────

const SERVICE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  anthropic: { bg: '#1B2B4D',  text: '#fff',     bar: '#1B2B4D'  },
  gemini:    { bg: '#E8F0FE',  text: '#1a73e8',  bar: '#4285F4'  },
  resend:    { bg: '#ECFDF5',  text: '#059669',  bar: '#059669'  },
  supabase:  { bg: '#E6FAF4',  text: '#1a7a5e',  bar: '#3ECF8E'  },
  stripe:    { bg: '#EEF2FF',  text: '#4F46E5',  bar: '#635BFF'  },
  twilio:    { bg: '#FFF7ED',  text: '#c2410c',  bar: '#F97316'  },
  other:     { bg: '#F3F4F6',  text: '#374151',  bar: '#9CA3AF'  },
}

function serviceColor(service: string) {
  return SERVICE_COLORS[service] ?? SERVICE_COLORS.other
}

// ─── Pill (collapsed state) ────────────────────────────────────────────────────

interface APIUsageBarProps {
  className?: string
}

export function APIUsageBar({ className = '' }: APIUsageBarProps) {
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<UsageRange>('today')
  const { data, isLoading } = useApiUsage(range)

  const total = data?.total_cost ?? 0

  // Color thresholds
  let pillBg = 'bg-[var(--navy)]'
  let pillText = 'text-white'
  if (total > 20) {
    pillBg = 'bg-[var(--rust)]'
  } else if (total > 5) {
    pillBg = 'bg-amber-500'
  }

  return (
    <>
      {/* Pill */}
      <button
        onClick={() => setOpen(true)}
        className={`${pillBg} ${pillText} flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-90 active:scale-95 ${className}`}
        style={{ fontFamily: 'var(--font-mono)' }}
        title="API Usage"
      >
        <Zap size={11} className={isLoading ? 'animate-pulse' : ''} />
        {isLoading ? '...' : formatCost(total)}
        <span style={{ fontFamily: 'var(--font-body)', opacity: 0.75, fontSize: '10px' }}>
          {range === 'today' ? 'today' : range === '7d' ? '7d' : range === '30d' ? '30d' : 'MTD'}
        </span>
      </button>

      {/* Drawer */}
      {open && <UsageDrawer range={range} setRange={setRange} onClose={() => setOpen(false)} />}
    </>
  )
}

// ─── Drawer ────────────────────────────────────────────────────────────────────

const RANGES: { value: UsageRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d',    label: '7 Days' },
  { value: '30d',   label: '30 Days' },
  { value: 'mtd',   label: 'This Month' },
]

function UsageDrawer({
  range,
  setRange,
  onClose,
}: {
  range: UsageRange
  setRange: (r: UsageRange) => void
  onClose: () => void
}) {
  const { data, isLoading } = useApiUsage(range)

  const totalCost = data?.total_cost ?? 0
  const totalCalls = data?.total_calls ?? 0
  const byService = data?.by_service ?? {}
  const topAgents = data?.top_agents ?? []
  const byDay = data?.by_day ?? {}

  const isEmpty = !isLoading && totalCalls === 0

  // Bar chart data
  const dayEntries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))
  const maxDay = Math.max(...dayEntries.map(([, v]) => v), 0.001)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full bg-[var(--white)] z-50 flex flex-col overflow-hidden"
        style={{ width: 'min(480px, 100vw)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[var(--navy)]" />
            <span className="font-semibold text-[var(--text)] text-sm" style={{ fontFamily: 'var(--font-body)' }}>
              API Usage
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Range tabs */}
        <div className="flex gap-1 px-5 pt-4 flex-shrink-0">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                range === r.value
                  ? 'bg-[var(--navy)] text-white'
                  : 'bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8" style={{ overflowX: 'hidden' }}>

          {isLoading && (
            <div className="flex items-center justify-center py-16 text-[var(--text-tertiary)] text-sm">
              Loading...
            </div>
          )}

          {!isLoading && isEmpty && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center justify-center">
                <Zap size={18} className="text-[var(--text-tertiary)]" />
              </div>
              <p className="text-sm text-[var(--text-secondary)]" style={{ fontFamily: 'var(--font-body)' }}>
                No API calls recorded yet.
              </p>
              <p className="text-xs text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-body)' }}>
                Usage will appear here as agents run.
              </p>
            </div>
          )}

          {!isLoading && !isEmpty && (
            <>
              {/* Summary */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="bg-[var(--bg)] rounded-xl p-4">
                  <p
                    className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] mb-1"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.06em' }}
                  >
                    Total Cost
                  </p>
                  <p
                    className="text-2xl font-medium text-[var(--text)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {formatCost(totalCost)}
                  </p>
                </div>
                <div className="bg-[var(--bg)] rounded-xl p-4">
                  <p
                    className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] mb-1"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.06em' }}
                  >
                    API Calls
                  </p>
                  <p
                    className="text-2xl font-medium text-[var(--text)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {totalCalls.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* By Service */}
              {Object.keys(byService).length > 0 && (
                <section className="mt-6">
                  <p
                    className="text-[13px] font-semibold text-[var(--text)] mb-3 uppercase tracking-wider"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.06em' }}
                  >
                    By Service
                  </p>
                  <div className="space-y-2">
                    {Object.entries(byService)
                      .sort(([, a], [, b]) => b.total_cost - a.total_cost)
                      .map(([svc, stats]) => {
                        const pct = totalCost > 0 ? (stats.total_cost / totalCost) * 100 : 0
                        const colors = serviceColor(svc)
                        return (
                          <div key={svc} className="bg-[var(--bg)] rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                                  style={{ background: colors.bg, color: colors.text, fontFamily: 'var(--font-body)' }}
                                >
                                  {svc}
                                </span>
                                <span className="text-xs text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-body)' }}>
                                  {stats.calls.toLocaleString()} calls
                                </span>
                              </div>
                              <span
                                className="text-sm font-semibold text-[var(--text)]"
                                style={{ fontFamily: 'var(--font-mono)' }}
                              >
                                {formatCost(stats.total_cost)}
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: colors.bar }}
                              />
                            </div>
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-1" style={{ fontFamily: 'var(--font-body)' }}>
                              {pct.toFixed(1)}% of total
                            </p>
                          </div>
                        )
                      })}
                  </div>
                </section>
              )}

              {/* Top Consumers */}
              {topAgents.length > 0 && (
                <section className="mt-6">
                  <p
                    className="text-[13px] font-semibold text-[var(--text)] mb-3 uppercase tracking-wider"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.06em' }}
                  >
                    Top Consumers
                  </p>
                  <div className="bg-[var(--bg)] rounded-xl overflow-hidden">
                    {topAgents.map((agent, i) => {
                      const costPerCall = agent.calls > 0 ? agent.total_cost / agent.calls : 0
                      const colors = serviceColor(agent.service)
                      return (
                        <div
                          key={agent.name}
                          className="flex items-center gap-3 px-4 py-3"
                          style={{ borderBottom: i < topAgents.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                        >
                          {/* Rank */}
                          <span
                            className="w-5 text-center text-[11px] text-[var(--text-tertiary)] flex-shrink-0"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {i + 1}
                          </span>

                          {/* Name + service */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm text-[var(--text)] truncate"
                              style={{ fontFamily: 'var(--font-body)' }}
                            >
                              {formatAgentName(agent.name)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full capitalize"
                                style={{ background: colors.bg, color: colors.text, fontFamily: 'var(--font-body)' }}
                              >
                                {agent.service}
                              </span>
                              <span className="text-[10px] text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-body)' }}>
                                {agent.calls} {agent.calls === 1 ? 'call' : 'calls'} · {formatCost(costPerCall)}/call
                              </span>
                            </div>
                          </div>

                          {/* Cost */}
                          <span
                            className="text-sm font-semibold text-[var(--text)] flex-shrink-0"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {formatCost(agent.total_cost)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* By Day chart — only when range is not today */}
              {range !== 'today' && dayEntries.length > 0 && (
                <section className="mt-6">
                  <p
                    className="text-[13px] font-semibold text-[var(--text)] mb-3 uppercase tracking-wider"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.06em' }}
                  >
                    Daily Spend
                  </p>
                  <div className="bg-[var(--bg)] rounded-xl p-4">
                    <div className="flex items-end gap-1" style={{ height: '80px' }}>
                      {dayEntries.map(([day, cost]) => {
                        const heightPct = (cost / maxDay) * 100
                        return (
                          <div key={day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                            <div className="w-full flex items-end" style={{ height: '64px' }}>
                              <div
                                className="w-full rounded-t-sm transition-all"
                                style={{
                                  height: `${Math.max(heightPct, 4)}%`,
                                  background: '#1B2B4D',
                                  opacity: cost === 0 ? 0.2 : 1,
                                }}
                                title={`${day}: ${formatCost(cost)}`}
                              />
                            </div>
                            <span
                              className="text-[9px] text-[var(--text-tertiary)] leading-none"
                              style={{ fontFamily: 'var(--font-mono)' }}
                            >
                              {new Date(day + 'T12:00:00').toLocaleDateString('en-US', {
                                month: 'numeric',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
