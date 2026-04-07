import { useState } from 'react'
import { Camera } from 'lucide-react'

const CATEGORIES = ['All', 'Demo', 'Rough-In', 'Progress', 'Finish']

const PHOTOS = [
  { id: 1, category: 'Demo',     caption: 'Demo complete',        color: 'bg-[var(--cream)]' },
  { id: 2, category: 'Demo',     caption: 'Subfloor exposed',      color: 'bg-[var(--cream-light)]' },
  { id: 3, category: 'Rough-In', caption: 'Plumbing rough-in',    color: 'bg-blue-100' },
  { id: 4, category: 'Rough-In', caption: 'Waterproofing done',   color: 'bg-blue-50' },
  { id: 5, category: 'Progress', caption: 'Floor tile set',       color: 'bg-[var(--success-bg)]' },
  { id: 6, category: 'Progress', caption: 'Wall prep',            color: 'bg-[var(--cream-light)]' },
]

export function ClientPhotos() {
  const [active, setActive] = useState('All')

  const filtered = active === 'All' ? PHOTOS : PHOTOS.filter(p => p.category === active)

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="font-display text-2xl text-[var(--navy)]">Photos</h1>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              active === cat
                ? 'bg-[var(--navy)] text-white'
                : 'bg-white border border-[var(--border)] text-[var(--text-secondary)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        {filtered.map(photo => (
          <div key={photo.id} className="rounded-xl overflow-hidden aspect-square relative cursor-pointer active:scale-95 transition-transform">
            <div className={`w-full h-full ${photo.color} flex items-center justify-center`}>
              <Camera size={28} className="text-[var(--text-tertiary)]" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 p-2">
              <p className="text-white text-xs font-medium">{photo.caption}</p>
              <p className="text-white/60 text-[10px]">{photo.category}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-[var(--text-tertiary)]">
        Photo thumbnails shown as placeholders — will display real project photos.
      </p>
    </div>
  )
}
