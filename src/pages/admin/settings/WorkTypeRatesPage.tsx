import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type WorkType = 'field_carpentry' | 'project_management' | 'site_visit' | 'design' | 'administrative' | 'travel' | 'other'

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  field_carpentry:    'Field Carpentry',
  project_management: 'Project Management',
  site_visit:         'Site Visit',
  design:             'Design',
  administrative:     'Administrative',
  travel:             'Travel',
  other:              'Other',
}

const WORK_TYPES: WorkType[] = ['field_carpentry', 'project_management', 'site_visit', 'design', 'administrative', 'travel', 'other']

type DbProfile = { id: string; full_name: string; role: string }
type RateRow = { id: string; user_id: string; work_type: WorkType; rate_per_hour: number; is_default_billable: boolean }

export function WorkTypeRatesPage() {
  const { data: dbRates = [], isLoading: ratesLoading } = useQuery({
    queryKey: ['work-type-rates'],
    queryFn: async () => {
      const { data } = await supabase.from('work_type_rates').select('*').order('work_type')
      return (data ?? []) as Array<{ id: string; work_type: string; label: string; billable_rate: number; cost_rate: number; description: string }>
    },
  })

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles-active'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id,full_name,role').in('role', ['admin', 'employee']).eq('is_active', true).order('full_name')
      return (data ?? []) as DbProfile[]
    },
  })

  const isLoading = ratesLoading || profilesLoading

  const initialRates = useMemo<RateRow[]>(() =>
    profiles.flatMap((u: DbProfile) =>
      WORK_TYPES.map(wt => {
        const dbRate = dbRates.find(r => r.work_type === wt)
        return {
          id: `wtr-${u.id}-${wt}`,
          user_id: u.id,
          work_type: wt,
          rate_per_hour: dbRate ? Number(dbRate.billable_rate ?? 0) : 0,
          is_default_billable: dbRate ? Number(dbRate.billable_rate ?? 0) > 0 : false,
        }
      })
    ),
  [dbRates, profiles])

  const [overrides, setOverrides] = useState<Record<string, Partial<RateRow>>>({})
  const [defaults, setDefaults] = useState<Record<string, WorkType>>({})
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const rates = useMemo<RateRow[]>(() =>
    initialRates.map(r => ({ ...r, ...(overrides[`${r.user_id}-${r.work_type}`] ?? {}) })),
  [initialRates, overrides])

  const getRate = (userId: string, wt: WorkType) =>
    rates.find(r => r.user_id === userId && r.work_type === wt)

  const updateRate = (userId: string, wt: WorkType, field: 'rate_per_hour' | 'is_default_billable', value: number | boolean) => {
    const key = `${userId}-${wt}`
    setOverrides(prev => ({ ...prev, [key]: { ...(prev[key] ?? {}), [field]: value } }))
    setSaved(key)
    setTimeout(() => setSaved(null), 1500)
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
        <PageHeader title="Work Type Rates" subtitle="Loading..." />
        <div className="text-sm text-[var(--text-secondary)] text-center py-8">Loading work type rates...</div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader title="Work Type Rates" subtitle="Set billing rates per person per work type" />

      {profiles.length === 0 && !isLoading && (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No employees found.</p>
      )}
      {profiles.map((user: DbProfile) => (
        <div key={user.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <SectionHeader title={user.full_name} />
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-[var(--navy)] text-white' : 'bg-[var(--cream-light)] text-[var(--navy)]'}`}>
              {user.role}
            </span>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-[var(--border-light)]">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-[var(--bg)]">
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Work Type</p>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold w-20 text-right">$/hr</p>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold w-16 text-center">Billable</p>
              </div>
              {WORK_TYPES.map(wt => {
                const r = getRate(user.id, wt)
                const cellKey = `${user.id}-${wt}`
                const isEditing = editingCell === cellKey
                return (
                  <div key={wt} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 items-center">
                    <p className="text-sm text-[var(--text)]">{WORK_TYPE_LABELS[wt]}</p>
                    {/* Rate */}
                    <div className="w-20 flex items-center justify-end gap-1">
                      {isEditing ? (
                        <input
                          type="number"
                          autoFocus
                          defaultValue={r?.rate_per_hour ?? 0}
                          onBlur={e => {
                            updateRate(user.id, wt, 'rate_per_hour', Number(e.target.value))
                            setEditingCell(null)
                          }}
                          className="w-16 text-right font-mono text-sm border border-[var(--navy)] rounded-lg px-2 py-1 bg-white focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingCell(cellKey)}
                          className="font-mono text-sm text-[var(--text)] text-right w-16 hover:text-[var(--navy)] transition-colors"
                        >
                          {r && r.rate_per_hour > 0 ? `$${r.rate_per_hour}` : <span className="text-[var(--text-tertiary)]">—</span>}
                        </button>
                      )}
                      {saved === cellKey && <Check size={12} className="text-[var(--success)] flex-shrink-0" />}
                    </div>
                    {/* Default billable toggle */}
                    <div className="w-16 flex justify-center">
                      <button
                        onClick={() => updateRate(user.id, wt, 'is_default_billable', !(r?.is_default_billable ?? false))}
                        className={`w-9 h-5 rounded-full relative transition-colors ${(r?.is_default_billable ?? false) ? 'bg-[var(--navy)]' : 'bg-[var(--border)]'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${(r?.is_default_billable ?? false) ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Default work type */}
          <div className="flex items-center gap-3 px-1">
            <label className="text-sm text-[var(--text-secondary)] flex-shrink-0">Default work type:</label>
            <select
              value={defaults[user.id]}
              onChange={e => setDefaults(prev => ({ ...prev, [user.id]: e.target.value as WorkType }))}
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
            >
              {WORK_TYPES.map(wt => <option key={wt} value={wt}>{WORK_TYPE_LABELS[wt]}</option>)}
            </select>
          </div>
        </div>
      ))}
    </div>
  )
}
