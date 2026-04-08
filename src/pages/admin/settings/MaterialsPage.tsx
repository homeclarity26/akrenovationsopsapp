// N43: When a client selects a product not in the library, prompt to add to
// material_specs — implemented in ClientSelections.tsx follow-up.
// The "Add to library" button below is the admin-side equivalent for specs
// already surfaced in this view.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, Plus, BookmarkPlus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MOCK_MATERIAL_SPECS } from '@/data/mock'
import { cn } from '@/lib/utils'

const FINISH_LEVEL_COLORS: Record<string, string> = {
  builder: 'bg-gray-100 text-gray-700',
  mid_range: 'bg-blue-100 text-blue-700',
  high_end: 'bg-purple-100 text-purple-700',
  luxury: 'bg-amber-100 text-amber-700',
}

export function MaterialsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string>('all')
  const categories = Array.from(new Set(MOCK_MATERIAL_SPECS.map((m) => m.category)))
  const filtered = filter === 'all' ? MOCK_MATERIAL_SPECS : MOCK_MATERIAL_SPECS.filter((m) => m.category === filter)

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto lg:px-8 lg:py-6">
      <button
        onClick={() => navigate('/admin/settings')}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]"
      >
        <ArrowLeft size={15} />
        Settings
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-[var(--navy)]">Material Specs</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Preferred products surfaced during walkthroughs and selections
          </p>
        </div>
        <Button size="sm">
          <Plus size={13} />
          Add spec
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-semibold border',
            filter === 'all' ? 'bg-[var(--navy)] text-white border-[var(--navy)]' : 'bg-white border-[var(--border)] text-[var(--text-secondary)]'
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border capitalize',
              filter === c ? 'bg-[var(--navy)] text-white border-[var(--navy)]' : 'bg-white border-[var(--border)] text-[var(--text-secondary)]'
            )}
          >
            {c.replace('_', ' ')}
          </button>
        ))}
      </div>

      <Card padding="none">
        {filtered.map((m) => (
          <div key={m.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {m.brand && <span className="text-[var(--text-secondary)]">{m.brand} </span>}
                    {m.product_name}
                  </p>
                  {m.is_preferred && <Star size={11} className="text-[var(--rust)] fill-[var(--rust)]" />}
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)] capitalize mt-0.5">
                  {m.category.replace('_', ' ')}
                  {m.supplier_name && ` · ${m.supplier_name}`}
                  {' · '}
                  used {m.times_specified}×
                </p>
                {m.notes && <p className="text-[11px] text-[var(--text-secondary)] italic mt-1">{m.notes}</p>}
              </div>
              <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                <p className="font-mono text-sm font-semibold text-[var(--text)]">
                  {m.price_typical != null ? `$${m.price_typical}` : '—'}
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)]">{m.unit}</p>
                <span
                  className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full inline-block ${
                    FINISH_LEVEL_COLORS[m.finish_level]
                  }`}
                >
                  {m.finish_level.replace('_', ' ')}
                </span>
                {/* N43: Add to library — for products sourced from client selections or external sources */}
                <button
                  className="flex items-center gap-1 text-[10px] text-[var(--navy)] font-semibold hover:text-[var(--navy-light)] transition-colors mt-0.5"
                  onClick={() => {
                    // TODO: open an "add to library" sheet pre-filled with this spec's data
                    alert(`Add "${m.product_name}" to library — coming soon`)
                  }}
                >
                  <BookmarkPlus size={10} />
                  Add to library
                </button>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
