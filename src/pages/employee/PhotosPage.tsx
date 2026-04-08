import { useRef, useState } from 'react'
import { ArrowLeft, Camera, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'

const CATEGORIES = [
  { id: 'progress',     label: 'Progress',     color: 'bg-blue-100',   text: 'text-blue-700' },
  { id: 'demo',         label: 'Demo',         color: 'bg-red-100',    text: 'text-red-700' },
  { id: 'rough_in',    label: 'Rough-In',     color: 'bg-orange-100', text: 'text-orange-700' },
  { id: 'finish',      label: 'Finish',       color: 'bg-green-100',  text: 'text-green-700' },
  { id: 'issue',       label: 'Issue',        color: 'bg-yellow-100', text: 'text-yellow-700' },
  { id: 'before_after', label: 'Before/After', color: 'bg-purple-100', text: 'text-purple-700' },
]

interface Photo {
  id: string
  category: string
  caption?: string | null
  taken_at?: string | null
  image_url: string
  thumbnail_url?: string | null
  project_id?: string | null
}

interface Project {
  id: string
  title: string
}

type UploadStep = 'idle' | 'project' | 'category' | 'uploading'

export function PhotosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<UploadStep>('idle')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Active projects for selector
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['active-projects-photos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title')
        .eq('status', 'active')
        .order('title')
      return (data ?? []) as Project[]
    },
  })

  // Photos from DB
  const { data: photos = [] } = useQuery<Photo[]>({
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

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setStep('uploading')
    setUploadError(null)

    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${selectedProjectId}/${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('project-photos')
        .upload(path, file, { contentType: file.type })

      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(path)
      const imageUrl = urlData.publicUrl

      const { data: photoRow, error: insertErr } = await supabase
        .from('project_photos')
        .insert({
          project_id: selectedProjectId,
          uploaded_by: user.id,
          image_url: imageUrl,
          category: selectedCategory,
          caption: `${CATEGORIES.find(c => c.id === selectedCategory)?.label ?? 'Photo'} — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          taken_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      // Fire agent-photo-tagger in background (non-blocking)
      supabase.functions.invoke('agent-photo-tagger', {
        body: { photo_id: photoRow.id, image_url: imageUrl },
      }).catch(() => {/* silent */})

      queryClient.invalidateQueries({ queryKey: ['my_photos', user.id] })
      setStep('idle')
      setSelectedProjectId('')
      setSelectedCategory('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setUploadError(message)
      setStep('category')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Step: project selection
  if (step === 'project') {
    return (
      <div className="p-4 space-y-4">
        <div className="pt-2 flex items-center gap-3">
          <button onClick={() => setStep('idle')} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-[var(--navy)]" />
          </button>
          <div>
            <h1 className="font-display text-2xl text-[var(--navy)]">Select Project</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">Which project is this photo for?</p>
          </div>
        </div>
        {projects.length === 0 ? (
          <Card><p className="text-sm text-[var(--text-secondary)] text-center py-4">No active projects found.</p></Card>
        ) : (
          <Card padding="none">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedProjectId(p.id); setStep('category') }}
                className="w-full flex items-center justify-between px-4 py-4 border-b border-[var(--border-light)] last:border-0 text-left"
              >
                <span className="font-medium text-sm text-[var(--text)]">{p.title}</span>
              </button>
            ))}
          </Card>
        )}
        <button onClick={() => setStep('idle')} className="w-full py-3 text-sm text-[var(--text-secondary)]">Cancel</button>
      </div>
    )
  }

  // Step: category selection
  if (step === 'category') {
    return (
      <div className="p-4 space-y-4">
        <div className="pt-2 flex items-center gap-3">
          <button onClick={() => setStep('project')} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-[var(--navy)]" />
          </button>
          <div>
            <h1 className="font-display text-2xl text-[var(--navy)]">Select Category</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">What type of photo is this?</p>
          </div>
        </div>
        {uploadError && <p className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 rounded-xl">{uploadError}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelected}
        />
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id)
                fileInputRef.current?.click()
              }}
              className={`py-5 rounded-2xl flex flex-col items-center gap-2 border border-[var(--border-light)] transition-all active:scale-95 ${cat.color}`}
            >
              <span className={`font-semibold text-sm ${cat.text}`}>{cat.label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setStep('idle')} className="w-full py-3 text-sm text-[var(--text-secondary)]">Cancel</button>
      </div>
    )
  }

  // Step: uploading
  if (step === 'uploading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
        <div className="w-20 h-20 rounded-full bg-[var(--navy)] flex items-center justify-center mb-6 animate-pulse">
          <Camera size={32} className="text-white" />
        </div>
        <p className="font-semibold text-[var(--text)] text-lg mb-2">Uploading photo...</p>
        <p className="text-sm text-[var(--text-secondary)]">AI will tag it automatically</p>
      </div>
    )
  }

  // Main gallery view
  return (
    <div className="p-4 space-y-5">
      <div className="pt-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ArrowLeft size={20} className="text-[var(--navy)]" />
        </button>
        <h1 className="font-display text-2xl text-[var(--navy)]">Photos</h1>
      </div>

      <button
        onClick={() => setStep('project')}
        className="w-full py-5 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2 transition-colors active:bg-[var(--cream-light)]"
        style={{ borderColor: 'var(--border)', background: 'var(--white)' }}
      >
        <div className="w-12 h-12 rounded-full bg-[var(--rust)] flex items-center justify-center">
          <Camera size={22} className="text-white" />
        </div>
        <p className="font-semibold text-sm text-[var(--text)]">Take or Upload Photo</p>
        <p className="text-xs text-[var(--text-tertiary)]">Select project → category → snap</p>
      </button>

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
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{photo.caption ?? 'Photo'}</p>
                  {photo.taken_at && (
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      {new Date(photo.taken_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0 ${CATEGORIES.find(c => c.id === photo.category)?.color ?? 'bg-gray-100'} ${CATEGORIES.find(c => c.id === photo.category)?.text ?? 'text-gray-600'}`}>
                  {CATEGORIES.find(c => c.id === photo.category)?.label ?? photo.category}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="flex items-center gap-2 p-3 bg-[var(--success-bg)] rounded-xl">
        <Check size={15} className="text-[var(--success)] flex-shrink-0" />
        <p className="text-xs text-[var(--success)]">{photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded</p>
      </div>
    </div>
  )
}
