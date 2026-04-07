import { useParams } from 'react-router-dom'
import { MOCK_PORTFOLIO_PHOTOS, MOCK_PROJECT_REELS } from '@/data/mock'

export function PublicGallery() {
  const { token } = useParams<{ token: string }>()
  const reel = MOCK_PROJECT_REELS.find((r) => r.gallery_token === token) ?? MOCK_PROJECT_REELS[0]
  const photos = MOCK_PORTFOLIO_PHOTOS.slice(0, 12)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[var(--border-light)]">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <p className="font-display text-2xl text-[var(--navy)]">{reel?.project_title ?? 'Project Reel'}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">By AK Renovations</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[var(--rust)] flex items-center justify-center">
            <span className="text-white font-bold">AK</span>
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((p) => (
            <div key={p.id} className="space-y-2">
              <div className="aspect-[4/3] rounded-xl bg-[var(--bg)] overflow-hidden">
                <img src={p.image_url} alt={p.caption} className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] text-center">{p.caption}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-[var(--text-secondary)]">
          <p>Thank you for trusting us with your home.</p>
          <p className="font-display text-base text-[var(--navy)] mt-2">Adam Kilgore — AK Renovations</p>
        </div>
      </div>
    </div>
  )
}
