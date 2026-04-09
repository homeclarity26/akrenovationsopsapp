import { useState } from 'react'
import { Check, Clock, ShoppingBag, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface ClientSelection {
  id: string
  project_id: string
  category: string
  item_name: string
  description?: string
  where_to_shop?: string
  selected_product?: string | null
  selected_brand?: string | null
  selected_model?: string | null
  selected_color?: string | null
  selected_image_url?: string | null
  product_url?: string | null
  estimated_cost?: number | null
  status: 'pending' | 'selected' | 'approved' | 'ordered' | 'received'
  sort_order?: number | null
  notes?: string | null
}

export function ClientSelections() {
  const { user } = useAuth()

  const { data: projectId } = useQuery({
    queryKey: ['client_project_id', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('client_user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle()
      return data?.id ?? null
    },
  })

  const { data: dbSelections = [], error, refetch } = useQuery({
    queryKey: ['client_selections', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from('client_selections')
        .select('*')
        .eq('project_id', projectId!)
        .order('sort_order', { ascending: true })
      return (data ?? []) as ClientSelection[]
    },
  })

  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<ClientSelection>>>({})
  const selections: ClientSelection[] = dbSelections.map(s => ({ ...s, ...localOverrides[s.id] }))
  const setSelections = (fn: (prev: ClientSelection[]) => ClientSelection[]) => {
    const next = fn(selections)
    const overrides: Record<string, Partial<ClientSelection>> = {}
    for (const item of next) overrides[item.id] = item
    setLocalOverrides(overrides)
  }
  const [selected, setSelected] = useState<string | null>(null)
  const [choiceInput, setChoiceInput] = useState({ product: '', color: '', url: '' })

  const pending = selections.filter(s => s.status === 'pending')
  const decided = selections.filter(s => s.status !== 'pending')

  const viewing = selections.find(s => s.id === selected)

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load selections. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  if (dbSelections.length === 0 && !selected) {
    return (
      <div className="p-4 flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-[var(--text-secondary)]">No selections yet.</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">Your contractor will add selections here when they're ready for you.</p>
      </div>
    )
  }

  const submitSelection = (id: string) => {
    setSelections(prev => prev.map(s =>
      s.id === id ? { ...s, status: 'selected' as const, selected_product: choiceInput.product, selected_color: choiceInput.color, product_url: choiceInput.url } : s
    ))
    setSelected(null)
    setChoiceInput({ product: '', color: '', url: '' })
  }

  if (viewing) {
    return (
      <div className="p-4 space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          ← Selections
        </button>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-0.5">{viewing.category}</p>
          <h2 className="font-display text-2xl text-[var(--navy)]">{viewing.item_name}</h2>
        </div>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Your Selection</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Product name or description</label>
              <input
                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                placeholder="e.g. Kohler Marabou 60&quot; vanity"
                value={choiceInput.product}
                onChange={e => setChoiceInput(c => ({ ...c, product: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Color / finish</label>
              <input
                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                placeholder="e.g. White, Matte Black"
                value={choiceInput.color}
                onChange={e => setChoiceInput(c => ({ ...c, color: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Product link (optional)</label>
              <input
                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                placeholder="https://..."
                value={choiceInput.url}
                onChange={e => setChoiceInput(c => ({ ...c, url: e.target.value }))}
              />
            </div>
          </div>
          <button
            onClick={() => submitSelection(viewing.id)}
            disabled={!choiceInput.product.trim()}
            className="w-full mt-4 py-3.5 rounded-xl bg-[var(--navy)] text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Submit Selection
          </button>
        </Card>

        {viewing.estimated_cost && (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Budget Allowance</p>
            <p className="font-mono text-lg font-bold text-[var(--text)]">
              ${typeof viewing.estimated_cost === 'number' && viewing.estimated_cost < 100
                ? `${viewing.estimated_cost}/sqft`
                : viewing.estimated_cost?.toLocaleString()
              }
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Included in your contract price</p>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      {/* Progress summary */}
      <div className="flex items-center gap-3 p-4 bg-[var(--white)] rounded-2xl border border-[var(--border-light)]">
        <div className="flex-1">
          <p className="font-semibold text-sm text-[var(--text)]">
            {decided.length} of {selections.length} selections made
          </p>
          <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-[var(--navy)] rounded-full"
              style={{ width: `${selections.length > 0 ? (decided.length / selections.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="w-12 h-12 rounded-full bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">{decided.length}/{selections.length}</span>
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <SectionHeader title="Needs Your Selection" />
          <Card padding="none">
            {pending.map(sel => (
              <button
                key={sel.id}
                onClick={() => setSelected(sel.id)}
                className="w-full flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0 text-left active:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--warning-bg)] flex items-center justify-center flex-shrink-0">
                  <Clock size={16} className="text-[var(--warning)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)]">{sel.item_name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{sel.category}</p>
                </div>
                <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
              </button>
            ))}
          </Card>
        </div>
      )}

      {/* Decided */}
      {decided.length > 0 && (
        <div>
          <SectionHeader title="Selections Made" />
          <Card padding="none">
            {decided.map(sel => (
              <div key={sel.id} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  sel.status === 'ordered' ? 'bg-[var(--success-bg)]' : 'bg-[var(--cream-light)]'
                }`}>
                  {sel.status === 'ordered'
                    ? <ShoppingBag size={15} className="text-[var(--success)]" />
                    : <Check size={15} className="text-[var(--navy)]" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)]">{sel.item_name}</p>
                  {sel.selected_product && (
                    <p className="text-xs text-[var(--text-secondary)]">{sel.selected_product}</p>
                  )}
                  {sel.selected_color && (
                    <p className="text-xs text-[var(--text-tertiary)]">{sel.selected_color}</p>
                  )}
                </div>
                <StatusPill status={sel.status} />
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
