import { useState, useMemo } from 'react'
import { Camera, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useClientProject } from '@/hooks/useClientProject'

interface Photo {
  id: string
  image_url: string
  thumbnail_url: string | null
  category: string | null
  caption: string | null
  phase: string | null
  taken_at: string | null
  created_at: string
}

const CATEGORY_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all',           label: 'All' },
  { value: 'demo',          label: 'Demo' },
  { value: 'rough_in',      label: 'Rough-In' },
  { value: 'progress',      label: 'Progress' },
  { value: 'finish',        label: 'Finish' },
  { value: 'issue',         label: 'Issue' },
  { value: 'before_after',  label: 'Before/After' },
]

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function labelFor(category: string | null): string {
  if (!category) return ''
  const found = CATEGORY_FILTERS.find((c) => c.value === category)
  return found?.label ?? category
}

export function ClientPhotos() {
  const { data: project } = useClientProject()
  const projectId = project?.id ?? null
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [lightbox, setLightbox] = useState<Photo | null>(null)

  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ['client-photos', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_photos')
        .select('id, image_url, thumbnail_url, category, caption, phase, taken_at, created_at')
        .eq('project_id', projectId!)
        .eq('visible_to_client', true)
        .order('taken_at', { ascending: false })
      if (error) {
        console.warn('[ClientPhotos] fetch error:', error.message)
        return []
      }
      return (data ?? []) as Photo[]
    },
  })

  const availableCategories = useMemo(() => {
    const set = new Set(photos.map((p) => p.category).filter(Boolean) as string[])
    return CATEGORY_FILTERS.filter((c) => c.value === 'all' || set.has(c.value))
  }, [photos])

  const filtered = activeCategory === 'all'
    ? photos
    : photos.filter((p) => p.category === activeCategory)

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="font-display text-2xl text-[var(--navy)]">Photos</h1>

      {availableCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {availableCategories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat.value
                  ? 'bg-[var(--navy)] text-white'
                  : 'bg-white border border-[var(--border)] text-[var(--text-secondary)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--text-tertiary)]">Loading photos...</p>
      ) : photos.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--border-light)] p-6 text-center">
          <Camera size={28} className="mx-auto text-[var(--text-tertiary)] mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">
            No photos shared yet — Adam will post updates as your project progresses.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((photo) => {
            const src = photo.thumbnail_url ?? photo.image_url
            return (
              <button
                key={photo.id}
                onClick={() => setLightbox(photo)}
                className="rounded-xl overflow-hidden aspect-square relative cursor-pointer active:scale-95 transition-transform text-left"
              >
                <img
                  src={src}
                  alt={photo.caption ?? labelFor(photo.category)}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {(photo.caption || photo.category) && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    {photo.caption && <p className="text-white text-xs font-medium line-clamp-2">{photo.caption}</p>}
                    {photo.category && (
                      <p className="text-white/70 text-[10px] mt-0.5">{labelFor(photo.category)}</p>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={(e) => {
              e.stopPropagation()
              setLightbox(null)
            }}
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.image_url}
              alt={lightbox.caption ?? ''}
              className="w-full rounded-xl object-contain max-h-[80vh]"
            />
            <div className="mt-3 text-white space-y-1">
              {lightbox.caption && <p className="text-sm">{lightbox.caption}</p>}
              <div className="flex items-center gap-3 text-xs text-white/60">
                {lightbox.category && <span>{labelFor(lightbox.category)}</span>}
                {lightbox.taken_at && <span>{formatDate(lightbox.taken_at)}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
