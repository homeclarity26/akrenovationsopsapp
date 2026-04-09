import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface PortfolioPhoto {
  id: string
  project_id: string
  image_url: string
  thumbnail_url: string | null
  category: string | null
  caption: string | null
  ai_tags: unknown
  ai_description: string | null
  taken_at: string
  created_at: string
}

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

  const { data: allPhotos = [], error, refetch } = useQuery({
    queryKey: ['portfolio_photos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_photos')
        .select('*')
        .order('taken_at', { ascending: false })
      return (data ?? []) as PortfolioPhoto[]
    },
  })

  const photos = filter === 'all' ? allPhotos : allPhotos.filter((p) => p.category === filter)

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load portfolio. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

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
            {allPhotos.length} curated photos
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
              <img src={p.image_url} alt={p.caption ?? ''} className="w-full h-full object-cover" />
            </div>
            <div className="p-3">
              {p.category && (
                <p className="text-xs font-semibold text-[var(--text)] capitalize">{p.category.replace('_', ' ')}</p>
              )}
              {p.caption && (
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{p.caption}</p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {photos.length === 0 && (
        <Card>
          <p className="text-center text-sm text-[var(--text-tertiary)] py-6">No portfolio photos yet.</p>
        </Card>
      )}
    </div>
  )
}
