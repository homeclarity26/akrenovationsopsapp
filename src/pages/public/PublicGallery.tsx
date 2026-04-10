import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface Photo {
  id: string
  image_url: string
  caption: string | null
  project_id: string
}

export function PublicGallery() {
  const { token } = useParams<{ token: string }>()

  const { data: photos = [] } = useQuery({
    queryKey: ['public_gallery', token],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_photos')
        .select('id, image_url, caption, project_id')
        .order('taken_at', { ascending: false })
        .limit(24)
      return (data ?? []) as Photo[]
    },
  })

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[var(--border-light)]">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <p className="font-display text-2xl text-[var(--navy)]">Project Reel</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Powered by TradeOffice AI</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[var(--rust)] flex items-center justify-center">
            <span className="text-white font-bold">T</span>
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {photos.length === 0 && (
          <p className="text-center text-sm text-[var(--text-tertiary)] py-16">No photos available.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((p) => (
            <div key={p.id} className="space-y-2">
              <div className="aspect-[4/3] rounded-xl bg-[var(--bg)] overflow-hidden">
                <img src={p.image_url} alt={p.caption ?? ''} className="w-full h-full object-cover" />
              </div>
              {p.caption && (
                <p className="text-xs text-[var(--text-secondary)] text-center">{p.caption}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-[var(--text-secondary)]">
          <p>Thank you for trusting us with your home.</p>
          <p className="font-display text-base text-[var(--navy)] mt-2">Powered by TradeOffice AI</p>
        </div>
      </div>
    </div>
  )
}
