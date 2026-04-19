import { useRef, useState } from 'react'
import { ArrowLeft, Camera, Check, Clock, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBackNavigation } from '@/hooks/useBackNavigation'
import { usePickableProjects } from '@/hooks/usePickableProjects'

interface ReceiptRow {
  id: string; vendor: string | null; amount: number; date: string
  project: string; project_id: string | null; status: 'pending' | 'submitted'
}
interface ScanState {
  step: 'idle' | 'uploading' | 'reading' | 'review'
  fileId: string; vendor: string; amount: string; date: string
  projectId: string; items: string[]
}

export function ReceiptsPage() {
  const { user } = useAuth()
  const goBack = useBackNavigation('/employee')
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [scan, setScan] = useState<ScanState>({
    step: 'idle', fileId: '', vendor: '', amount: '',
    date: new Date().toISOString().slice(0, 10), projectId: '', items: [],
  })
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: projects = [] } = usePickableProjects()

  const { data: receipts = [], error: receiptsError, refetch: receiptsRefetch } = useQuery<ReceiptRow[]>({
    queryKey: ['receipts', user?.id, user?.company_id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, vendor, amount, date, project_id, receipt_image_url, projects(title)')
        .eq('entered_by', user!.id)
        .not('receipt_image_url', 'is', null)
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id: r.id, vendor: r.vendor ?? 'Unknown', amount: r.amount, date: r.date,
        project: r.projects?.title ?? 'No Project', project_id: r.project_id, status: 'submitted' as const,
      }))
    },
  })

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user || !selectedProjectId) return
    setScan(s => ({ ...s, step: 'uploading' }))
    setUploadError(null)

    try {
      // Upload file to storage
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
      const fileUrl = urlData.publicUrl

      // Insert to project_files
      const { data: fileRow, error: fErr } = await supabase
        .from('project_files')
        .insert({
          project_id: selectedProjectId,
          uploaded_by: user.id,
          file_name: file.name,
          file_url: fileUrl,
          file_type: file.type.includes('pdf') ? 'pdf' : 'image',
          file_size_bytes: file.size,
          category: 'other',
        })
        .select()
        .single()
      if (fErr) throw fErr

      // Call AI extraction
      setScan(s => ({ ...s, step: 'reading' }))
      const { data: extracted } = await supabase.functions.invoke('agent-receipt-processor', {
        body: { file_id: fileRow.id, project_id: selectedProjectId, entered_by: user.id },
      })

      const d = extracted?.extracted_data ?? {}
      setScan({
        step: 'review',
        fileId: fileRow.id,
        vendor: d.vendor ?? '',
        amount: d.total != null ? String(d.total) : '',
        date: d.date ?? new Date().toISOString().slice(0, 10),
        projectId: selectedProjectId,
        items: (d.items ?? []).map((i: any) => typeof i === 'string' ? i : i.description ?? '').filter(Boolean),
      })
    } catch (err: any) {
      setUploadError(err.message ?? 'Upload failed')
      setScan(s => ({ ...s, step: 'idle' }))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const submitReceipt = async () => {
    if (!user) return
    const { error } = await supabase.from('expenses').insert({
      project_id: scan.projectId,
      vendor: scan.vendor || 'Unknown',
      amount: parseFloat(scan.amount) || 0,
      date: scan.date,
      category: 'materials',
      entered_by: user.id,
      entry_method: 'receipt_scan',
    })
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['receipts', user.id] })
      setScan({ step: 'idle', fileId: '', vendor: '', amount: '', date: new Date().toISOString().slice(0, 10), projectId: '', items: [] })
      setSelectedProjectId('')
    }
  }

  if (receiptsError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load receipts. Check your connection and try again.</p>
      <button onClick={() => receiptsRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  if (scan.step === 'uploading' || scan.step === 'reading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
        <div className="w-20 h-20 rounded-full bg-[var(--navy)] flex items-center justify-center mb-6 animate-pulse">
          <Camera size={32} className="text-white" />
        </div>
        <p className="font-semibold text-[var(--text)] text-lg mb-2">
          {scan.step === 'uploading' ? 'Uploading receipt...' : 'Reading receipt...'}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">AI is extracting the details</p>
      </div>
    )
  }

  if (scan.step === 'review') {
    return (
      <div className="p-4 space-y-4">
        <div className="pt-2 flex items-center gap-3">
          <button onClick={() => setScan(s => ({ ...s, step: 'idle' }))} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-[var(--navy)]" />
          </button>
          <div>
            <h1 className="font-display text-2xl text-[var(--navy)]">Review Receipt</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">Confirm the extracted details</p>
          </div>
        </div>
        <Card>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Vendor</label>
              <input className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]" value={scan.vendor} onChange={e => setScan(s => ({ ...s, vendor: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Amount</label>
                <input className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]" value={scan.amount} onChange={e => setScan(s => ({ ...s, amount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Date</label>
                <input type="date" className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]" value={scan.date} onChange={e => setScan(s => ({ ...s, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Project</label>
              <select className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]" value={scan.projectId} onChange={e => setScan(s => ({ ...s, projectId: e.target.value }))}>
                <option value="">Select project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            {scan.items.length > 0 && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] block mb-2">Items</label>
                <div className="space-y-1">{scan.items.map((item, i) => <p key={i} className="text-sm text-[var(--text)] py-1.5 px-3 bg-[var(--bg)] rounded-lg">{item}</p>)}</div>
              </div>
            )}
          </div>
        </Card>
        <div className="space-y-2">
          <button onClick={submitReceipt} className="w-full py-4 rounded-xl font-semibold text-sm text-white bg-[var(--navy)] flex items-center justify-center gap-2">
            <Check size={16} />Submit Receipt
          </button>
          <button onClick={() => setScan(s => ({ ...s, step: 'idle' }))} className="w-full py-3 rounded-xl font-medium text-sm text-[var(--text-secondary)]">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2 flex items-center gap-3">
        <button onClick={goBack} className="p-1 -ml-1">
          <ArrowLeft size={20} className="text-[var(--navy)]" />
        </button>
        <h1 className="font-display text-2xl text-[var(--navy)]">Receipts</h1>
      </div>

      {uploadError && <p className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 rounded-xl">{uploadError}</p>}

      {/* Project selector */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] block mb-2">Project</label>
        <select
          className="w-full px-3 py-3 rounded-xl border border-[var(--border)] text-sm bg-white text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
        >
          <option value="">Select project first...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleFileSelected} />

      <button
        onClick={() => { if (!selectedProjectId) { setUploadError('Please select a project first'); return } setUploadError(null); fileInputRef.current?.click() }}
        className="w-full py-5 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2 transition-colors active:bg-[var(--cream-light)]"
        style={{ borderColor: selectedProjectId ? 'var(--navy)' : 'var(--border)', background: 'var(--white)' }}
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedProjectId ? 'bg-[var(--navy)]' : 'bg-gray-200'}`}>
          <Camera size={22} className="text-white" />
        </div>
        <p className="font-semibold text-sm text-[var(--text)]">Scan a Receipt</p>
        <p className="text-xs text-[var(--text-tertiary)]">AI extracts vendor, amount, and items</p>
      </button>

      <div>
        <SectionHeader title="Recent Receipts" />
        {receipts.length === 0 ? (
          <Card><p className="text-sm text-[var(--text-secondary)] text-center py-4">No receipts submitted yet.</p></Card>
        ) : (
          <Card padding="none">
            {receipts.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="w-10 h-10 rounded-xl bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                  {r.status === 'submitted' ? <Check size={16} className="text-[var(--success)]" /> : <Clock size={16} className="text-[var(--warning)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)]">{r.vendor}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{r.project} · {r.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm font-semibold text-[var(--text)]">${r.amount.toFixed(2)}</p>
                  <p className={`text-[11px] capitalize ${r.status === 'submitted' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>{r.status}</p>
                </div>
                <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
