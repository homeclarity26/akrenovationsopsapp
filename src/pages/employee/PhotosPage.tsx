import { useState } from 'react'
import { Camera, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const CATEGORIES = [
  { id: 'progress',    label: 'Progress',     color: 'bg-blue-100',   text: 'text-blue-700' },
  { id: 'demo',        label: 'Demo',         color: 'bg-red-100',    text: 'text-red-700' },
  { id: 'rough_in',   label: 'Rough-In',     color: 'bg-orange-100', text: 'text-orange-700' },
  { id: 'finish',     label: 'Finish',       color: 'bg-green-100',  text: 'text-green-700' },
  { id: 'issue',      label: 'Issue',        color: 'bg-yellow-100', text: 'text-yellow-700' },
  { id: 'before_after',label: 'Before/After', color: 'bg-purple-100', text: 'text-purple-700' },
]

interface Photo {
  id: string
  category: string
  caption?: string | null
  taken_at?: string | null
  project?: string   // derived from project join
  image_url: string
  thumbnail_url?: string | null
}

export function PhotosPage() {
  const { user } = useAuth()
  const [selected, setSelected] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([])

  const { data: dbPhotos = [] } = useQuery({
    queryKey: ['my_photos', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('project_photos')
        .select('id, category, caption, taken_at, image_url, thumbnail_url, project_id')
        .eq('uploaded_by', user!.id)
        .order('taken_at', { ascending: false })
        .limit(50)
      return (data ?? []) as Photo[]
    },
  })

  const photos = [...localPhotos, ...dbPhotos.filter(p => !localPhotos.find(l => l.id === p.id))]

  const takePhoto = (categoryId: string) => {
    setUploading(true)
    const cat = CATEGORIES.find(c => c.id === categoryId)
    setTimeout(() => {
      setLocalPhotos(prev => [{
        id: `ph-${Date.now()}`,
        category: categoryId,
        caption: `${cat?.label ?? 'Photo'} — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        taken_at: new Date().toISOString(),
        image_url: '',
      }, ...prev])
      setSelected(null)
      setUploading(false)
    }, 1200)
  }

  if (selected) {
    return (
      <div className="p-4 space-y-4">
        <div className="pt-2">
          <h1 className="font-display text-2xl text-[var(--navy)]">Select Category</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">What type of photo is this?</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => takePhoto(cat.id)}
              disabled={uploading}
              className={`py-5 rounded-2xl flex flex-col items-center gap-2 border border-[var(--border-light)] transition-all active:scale-95 ${cat.color}`}
            >
              <span className={`font-semibold text-sm ${cat.text}`}>{cat.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setSelected(null)}
          className="w-full py-3 text-sm text-[var(--text-secondary)]"
        >
          Cancel
        </button>

        {uploading && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--navy)] flex items-center justify-center animate-pulse">
                <Camera size={22} className="text-white" />
              </div>
              <p className="font-semibold text-sm text-[var(--text)]">Uploading photo...</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl text-[var(--navy)]">Photos</h1>
      </div>

      {/* Upload button */}
      <button
        onClick={() => setSelected('progress')}
        className="w-full py-5 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2 transition-colors active:bg-[var(--cream-light)]"
        style={{ borderColor: 'var(--border)', background: 'var(--white)' }}
      >
        <div className="w-12 h-12 rounded-full bg-[var(--rust)] flex items-center justify-center">
          <Camera size={22} className="text-white" />
        </div>
        <p className="font-semibold text-sm text-[var(--text)]">Take or Upload Photo</p>
        <p className="text-xs text-[var(--text-tertiary)]">Auto-assigned to today's project</p>
      </button>

      {/* Gallery */}
      <div>
        <SectionHeader title="Recent Photos" />
        <Card padding="none">
          {photos.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No photos yet. Take one above.</div>
          ) : (
            photos.map(photo => (
              <div key={photo.id} className="flex items-center gap-3 p-3 border-b border-[var(--border-light)] last:border-0">
                {photo.thumbnail_url || photo.image_url ? (
                  <img
                    src={photo.thumbnail_url ?? photo.image_url}
                    alt={photo.caption ?? ''}
                    className="w-16 h-14 rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-14 rounded-xl flex-shrink-0 bg-[var(--cream-light)]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm text-[var(--text)] truncate">{photo.caption ?? 'Photo'}</p>
                  </div>
                  {photo.taken_at && (
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      {new Date(photo.taken_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                    CATEGORIES.find(c => c.id === photo.category)?.color ?? 'bg-gray-100'
                  } ${
                    CATEGORIES.find(c => c.id === photo.category)?.text ?? 'text-gray-600'
                  }`}>
                    {CATEGORIES.find(c => c.id === photo.category)?.label ?? photo.category}
                  </span>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="flex items-center gap-2 p-3 bg-[var(--success-bg)] rounded-xl">
        <Check size={15} className="text-[var(--success)] flex-shrink-0" />
        <p className="text-xs text-[var(--success)]">{photos.length} photos uploaded this week</p>
      </div>
    </div>
  )
}
