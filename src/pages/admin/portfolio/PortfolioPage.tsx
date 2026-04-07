import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MOCK_PORTFOLIO_PHOTOS } from '@/data/mock'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'addition', label: 'Addition' },
  { id: 'basement', label: 'Basement' },
  { id: 'first_floor', label: 'First Floor' },
  { id: 'before_after', label: 'Before / After' },
  { id: 'detail', label: 'Detail' },
  { id: 'exterior', label: 'Exterior' },
] as const

export function PortfolioPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string>('all')
  const photos = filter === 'all' ? MOCK_PORTFOLIO_PHOTOS : MOCK_PORTFOLIO_PHOTOS.filter((p) => p.category === filter)

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto lg:px-8 lg:py-6">
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]"
      >
        <ArrowLeft size={15} />
        Back to dashboard
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-[var(--navy)]">Portfolio</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {MOCK_PORTFOLIO_PHOTOS.length} curated photos · {MOCK_PORTFOLIO_PHOTOS.filter((p) => p.featured).length} featured
          </p>
        </div>
        <Button size="sm">
          <Sparkles size={13} />
          Add AI captions
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
              filter === c.id
                ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                : 'bg-white text-[var(--text-secondary)] border-[var(--border)]'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Masonry-ish grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((p) => (
          <Card key={p.id} padding="none">
            <div className="aspect-[4/3] bg-[var(--bg)] rounded-t-xl overflow-hidden relative">
              <img src={p.image_url} alt={p.caption} className="w-full h-full object-cover" />
              {p.featured && (
                <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5">
                  <Star size={13} className="text-[var(--warning)] fill-[var(--warning)]" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-xs font-semibold text-[var(--text)] capitalize">{p.category.replace('_', ' ')}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{p.caption}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{p.project_title}</p>
            </div>
          </Card>
        ))}
      </div>

      {photos.length === 0 && (
        <Card>
          <p className="text-center text-sm text-[var(--text-tertiary)] py-6">No photos in this category.</p>
        </Card>
      )}
    </div>
  )
}
