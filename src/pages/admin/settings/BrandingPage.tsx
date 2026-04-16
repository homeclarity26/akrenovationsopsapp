import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, Check, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCompanyProfile } from '@/hooks/useCompanyProfile'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function uploadAsset(
  file: File,
  companyId: string,
  folder: string,
): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${companyId}/${folder}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('company-assets').upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) {
    console.error('[BrandingPage] upload error:', error.message)
    return null
  }
  const { data } = supabase.storage.from('company-assets').getPublicUrl(path)
  return data.publicUrl
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandingPage() {
  const { user } = useAuth()
  const { data: company } = useCompanyProfile()
  const qc = useQueryClient()

  const [primary, setPrimary] = useState('#1e3a5f')
  const [accent, setAccent] = useState('#c45a3c')
  const [bg, setBg] = useState('#faf8f5')
  const [tagline, setTagline] = useState('')
  const [poweredByVisible, setPoweredByVisible] = useState(true)
  const [poweredByText, setPoweredByText] = useState('Powered by TradeOffice AI')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null)

  // Sync form state from fetched company data
  useEffect(() => {
    if (!company) return
    setPrimary(company.brand_color_primary ?? '#1e3a5f')
    setAccent(company.brand_color_accent ?? '#c45a3c')
    setBg(company.brand_color_bg ?? '#faf8f5')
    setTagline(company.brand_tagline ?? '')
    setPoweredByVisible(company.powered_by_visible ?? true)
    setPoweredByText(company.powered_by_text ?? 'Powered by TradeOffice AI')
  }, [company])

  const companyId = user?.company_id
  if (!companyId) return null

  async function handleFileUpload(type: 'logo' | 'favicon', file: File) {
    setUploading(type)
    const url = await uploadAsset(file, companyId!, type === 'logo' ? 'logos' : 'favicons')
    if (url) {
      const col = type === 'logo' ? 'brand_logo_url' : 'brand_favicon_url'
      await supabase.from('companies').update({ [col]: url }).eq('id', companyId!)
      qc.invalidateQueries({ queryKey: ['company-profile', companyId] })
    }
    setUploading(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('companies')
      .update({
        brand_color_primary: primary,
        brand_color_accent: accent,
        brand_color_bg: bg,
        brand_tagline: tagline || null,
        powered_by_visible: poweredByVisible,
        powered_by_text: poweredByText || 'Powered by TradeOffice AI',
      })
      .eq('id', companyId!)
    if (!error) {
      qc.invalidateQueries({ queryKey: ['company-profile', companyId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 mt-2">
      <PageHeader title="Branding" subtitle="Customize your company's look and feel" />

      {/* Colors */}
      <Card>
        <h3 className="font-semibold text-sm text-[var(--text)] mb-4">Brand Colors</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorField label="Primary" value={primary} onChange={setPrimary} />
          <ColorField label="Accent" value={accent} onChange={setAccent} />
          <ColorField label="Background" value={bg} onChange={setBg} />
        </div>
      </Card>

      {/* Logo + Favicon */}
      <Card>
        <h3 className="font-semibold text-sm text-[var(--text)] mb-4">Logo &amp; Favicon</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileField
            label="Logo"
            current={company?.brand_logo_url ?? null}
            uploading={uploading === 'logo'}
            onFile={(f) => handleFileUpload('logo', f)}
          />
          <FileField
            label="Favicon"
            current={company?.brand_favicon_url ?? null}
            uploading={uploading === 'favicon'}
            onFile={(f) => handleFileUpload('favicon', f)}
          />
        </div>
      </Card>

      {/* Tagline */}
      <Card>
        <h3 className="font-semibold text-sm text-[var(--text)] mb-3">Tagline</h3>
        <input
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="e.g. Building dreams since 1998"
          className="w-full rounded-lg border border-[var(--border-light)] px-3 py-2 text-sm text-[var(--text)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--rust)]/30"
        />
      </Card>

      {/* Powered By */}
      <Card>
        <h3 className="font-semibold text-sm text-[var(--text)] mb-3">Powered-By Footer</h3>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={poweredByVisible}
            onChange={(e) => setPoweredByVisible(e.target.checked)}
            className="rounded"
          />
          Show &quot;Powered by&quot; footer
        </label>
        {poweredByVisible && (
          <input
            type="text"
            value={poweredByText}
            onChange={(e) => setPoweredByText(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-light)] px-3 py-2 text-sm text-[var(--text)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--rust)]/30"
          />
        )}
      </Card>

      {/* Live Preview */}
      <Card>
        <h3 className="font-semibold text-sm text-[var(--text)] mb-3">Live Preview</h3>
        <PreviewCard
          primary={primary}
          accent={accent}
          bg={bg}
          companyName={company?.name ?? 'Your Company'}
          logoUrl={company?.brand_logo_url ?? null}
          tagline={tagline}
          poweredByVisible={poweredByVisible}
          poweredByText={poweredByText}
        />
      </Card>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: accent }}
      >
        {saving ? (
          <><RefreshCw size={15} className="animate-spin" /> Saving...</>
        ) : saved ? (
          <><Check size={15} /> Saved</>
        ) : (
          'Save Branding'
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-[var(--border-light)] cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border-light)] px-3 py-2 text-sm font-mono text-[var(--text)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--rust)]/30"
        />
      </div>
    </div>
  )
}

function FileField({
  label,
  current,
  uploading,
  onFile,
}: {
  label: string
  current: string | null
  uploading: boolean
  onFile: (f: File) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>
      {current && (
        <img src={current} alt={label} className="w-16 h-16 rounded-lg object-cover border border-[var(--border-light)] mb-2" />
      )}
      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--border-light)] text-xs text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg)] transition-colors">
        {uploading ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <Upload size={14} />
        )}
        {uploading ? 'Uploading...' : `Upload ${label}`}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
          }}
        />
      </label>
    </div>
  )
}

function PreviewCard({
  primary,
  accent,
  bg,
  companyName,
  logoUrl,
  tagline,
  poweredByVisible,
  poweredByText,
}: {
  primary: string
  accent: string
  bg: string
  companyName: string
  logoUrl: string | null
  tagline: string
  poweredByVisible: boolean
  poweredByText: string
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border-light)]" style={{ backgroundColor: bg }}>
      {/* Header bar */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: primary }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: accent }}>
            {companyName.charAt(0)}
          </div>
        )}
        <span className="text-white text-sm font-semibold">{companyName}</span>
      </div>
      {/* Body */}
      <div className="px-4 py-4 space-y-2">
        {tagline && <p className="text-xs" style={{ color: primary }}>{tagline}</p>}
        <div className="flex gap-2">
          <div className="h-6 rounded-lg px-3 flex items-center text-white text-[10px] font-medium" style={{ backgroundColor: accent }}>
            Button
          </div>
          <div className="h-6 rounded-lg px-3 flex items-center text-[10px] font-medium border" style={{ borderColor: primary, color: primary }}>
            Outline
          </div>
        </div>
        {poweredByVisible && (
          <p className="text-[10px] text-center pt-2" style={{ color: `${primary}80` }}>
            {poweredByText || 'Powered by TradeOffice AI'}
          </p>
        )}
      </div>
    </div>
  )
}
