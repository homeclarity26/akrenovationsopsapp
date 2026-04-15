// PR 12 — Photo-based stocktake modal.
//
// Alternative entry mode for EmployeeStocktakePage. Three internal steps:
//   A. Capture   — camera input or drop zone.
//   B. Processing — upload to storage, call agent-photo-stocktake, wait.
//   C. Review    — show photo + AI proposals, let user edit/remove, submit.
//
// On submit the modal inserts `inventory_stocktakes` rows with
// source='photo_ai', defaulting confidence to 'estimate' (per-row override
// allowed). The AFTER-INSERT trigger upserts inventory_stock — no extra
// wiring.
//
// Focused: always operates on the ONE location the caller opened the modal
// with. If the caller's location_id drifts (e.g. they switched locations
// in the background), we surface a warning and block submission.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Camera,
  X,
  Upload,
  Loader2,
  AlertTriangle,
  Check,
  Pencil,
  Trash2,
  Info,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Props + types
// ─────────────────────────────────────────────────────────────────────────────

type Confidence = 'exact' | 'rough' | 'estimate'
type AiConfidence = 'low' | 'medium' | 'high'

export interface PhotoStocktakeKnownItem {
  item_id: string
  name: string
  unit: string
  pack_size: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  locationId: string
  locationName: string
  // Items at this location — used to disambiguate the AI's matches and to
  // render item names/units in the review step.
  knownItems: PhotoStocktakeKnownItem[]
  // Called on successful submission so the caller can surface a toast and
  // invalidate queries.
  onSubmitted: (insertedCount: number) => void
}

interface Proposal {
  item_id: string
  estimated_quantity: number
  confidence: AiConfidence
  reasoning: string
}

// What the user has in hand in the review step — editable.
interface ReviewRow {
  item_id: string
  quantity: number
  ai_confidence: AiConfidence
  user_confidence: Confidence
  reasoning: string
  user_edited_quantity: boolean
  removed: boolean
}

type Step = 'capture' | 'processing' | 'review' | 'error'

// Map AI confidence → pill colors. Keep this in the component so we don't
// leak a new design token to the rest of the app.
const AI_CONF_STYLES: Record<AiConfidence, string> = {
  high:   'bg-[var(--success-bg)] text-[var(--success)]',
  medium: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  low:    'bg-[var(--rust)]/10 text-[var(--rust)]',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function yyyyMmDd(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function extensionFor(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('heic')) return 'heic'
  return 'jpg'
}

function randomId(): string {
  // crypto.randomUUID exists in all modern browsers; guard just in case.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function clampQty(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PhotoStocktakeModal({
  open,
  onClose,
  locationId,
  locationName,
  knownItems,
  onSubmitted,
}: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<Step>('capture')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [photoDisplayUrl, setPhotoDisplayUrl] = useState<string | null>(null) // signed URL for review step
  const [photoStoragePath, setPhotoStoragePath] = useState<string | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submittedLocationId, setSubmittedLocationId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dropInputRef = useRef<HTMLInputElement | null>(null)

  // Reset state every time the modal re-opens.
  useEffect(() => {
    if (!open) return
    setStep('capture')
    setFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPhotoDisplayUrl(null)
    setPhotoStoragePath(null)
    setRows([])
    setErrorMsg(null)
    setSubmittedLocationId(null)
  }, [open])

  // Clean up object URLs on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const itemById = useMemo(() => {
    const m = new Map<string, PhotoStocktakeKnownItem>()
    for (const it of knownItems) m.set(it.item_id, it)
    return m
  }, [knownItems])

  // The active rows (not user-removed) and how many pass the basic "would
  // submit" check — quantity >= 0 and item still in catalog.
  const activeRows = rows.filter((r) => !r.removed)
  const submittableCount = activeRows.filter((r) => itemById.has(r.item_id)).length

  // Warn if the caller's location changed under us between capture and review.
  const locationDrifted =
    submittedLocationId !== null && submittedLocationId !== locationId

  // ── Capture step handlers ──────────────────────────────────────────────
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const url = URL.createObjectURL(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(url)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    const url = URL.createObjectURL(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(url)
  }

  // ── Upload + analyze ───────────────────────────────────────────────────
  async function analyzeMutationFn(): Promise<{
    proposals: Proposal[]
    storagePath: string
    signedUrl: string
  }> {
    if (!file) throw new Error('No photo selected')
    if (!user?.company_id || !user?.id) {
      throw new Error('Missing company or user context')
    }

    const ext = extensionFor(file.type)
    const path = `${user.company_id}/${user.id}/${yyyyMmDd()}/${randomId()}.${ext}`
    const bucket = 'stocktake-photos'

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

    // Sign a URL so the review step can render the photo.
    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10) // 10 minutes — plenty for review
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Couldn't create signed URL: ${signErr?.message ?? 'unknown'}`)
    }

    // Call the edge function with the signed URL so it doesn't need to
    // re-sign the storage path itself.
    const { data, error: fnErr } = await supabase.functions.invoke(
      'agent-photo-stocktake',
      {
        body: {
          photo_url: signed.signedUrl,
          location_id: locationId,
          expected_items: knownItems.map((i) => ({
            item_id: i.item_id,
            name: i.name,
            unit: i.unit,
            pack_size: i.pack_size ?? undefined,
          })),
        },
      },
    )
    if (fnErr) throw fnErr
    const proposals = ((data?.proposals ?? []) as Proposal[]).filter(
      (p) =>
        p.item_id &&
        typeof p.estimated_quantity === 'number' &&
        (p.confidence === 'low' || p.confidence === 'medium' || p.confidence === 'high'),
    )
    return { proposals, storagePath: `${bucket}/${path}`, signedUrl: signed.signedUrl }
  }

  const analyzeMutation = useMutation({
    mutationFn: analyzeMutationFn,
    onMutate: () => {
      setStep('processing')
      setErrorMsg(null)
      setSubmittedLocationId(locationId)
    },
    onSuccess: ({ proposals, storagePath, signedUrl }) => {
      setPhotoStoragePath(storagePath)
      setPhotoDisplayUrl(signedUrl)
      setRows(
        proposals.map((p) => ({
          item_id: p.item_id,
          quantity: clampQty(p.estimated_quantity),
          ai_confidence: p.confidence,
          user_confidence: 'estimate', // per spec: photo counts default to 'estimate'
          reasoning: p.reasoning ?? '',
          user_edited_quantity: false,
          removed: false,
        })),
      )
      setStep('review')
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Photo analysis failed')
      setStep('error')
    },
  })

  // ── Submit ─────────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Missing user')
      if (locationDrifted) throw new Error('Location changed — reopen to resubmit')
      const payload = activeRows
        .filter((r) => itemById.has(r.item_id))
        .map((r) => ({
          location_id: locationId,
          item_id: r.item_id,
          counted_by: user.id,
          quantity_after: clampQty(r.quantity),
          confidence: r.user_confidence,
          source: 'photo_ai' as const,
          photo_url: photoStoragePath,
          // Keep the AI's reasoning as the note when the user didn't edit it
          // and there's something useful there.
          notes: r.reasoning?.trim() ? r.reasoning.trim().slice(0, 500) : null,
        }))
      if (payload.length === 0) return { inserted: 0 }
      const { error } = await supabase.from('inventory_stocktakes').insert(payload)
      if (error) throw error
      return { inserted: payload.length }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['inventory_location_items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory_stock'] })
      onSubmitted(res.inserted)
      onClose()
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Submit failed')
    },
  })

  // ── Row editing helpers ────────────────────────────────────────────────
  function updateRow(itemId: string, patch: Partial<ReviewRow>) {
    setRows((prev) =>
      prev.map((r) => (r.item_id === itemId ? { ...r, ...patch } : r)),
    )
  }

  if (!open) return null

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full md:max-w-3xl md:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-2 min-w-0">
            <Camera size={18} className="text-[var(--navy)] flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-[18px] text-[var(--navy)] truncate">
                Scan with photo
              </h2>
              <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                {locationName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'capture' && (
            <CaptureStep
              previewUrl={previewUrl}
              onPickFile={onPickFile}
              onDrop={onDrop}
              fileInputRef={fileInputRef}
              dropInputRef={dropInputRef}
            />
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <Loader2 size={28} className="text-[var(--navy)] animate-spin" />
              <p className="text-sm font-medium text-[var(--text)]">Analyzing photo…</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                This usually takes 5–15 seconds. You can edit every count on the next screen.
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="p-6 space-y-4">
              <Card className="border-[var(--rust)]/40 bg-[var(--rust)]/5">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-[var(--rust)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">Couldn't analyze the photo</p>
                    <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                      {errorMsg ?? 'Unknown error'}
                    </p>
                  </div>
                </div>
              </Card>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                You can retake the photo or close this and count manually.
              </p>
            </div>
          )}

          {step === 'review' && (
            <ReviewStep
              photoUrl={photoDisplayUrl}
              rows={rows}
              itemById={itemById}
              locationDrifted={locationDrifted}
              errorMsg={errorMsg}
              onUpdate={updateRow}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border-light)] flex items-center gap-2 bg-white">
          {step === 'capture' && (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <div className="flex-1" />
              <Button
                variant="primary"
                disabled={!file}
                onClick={() => analyzeMutation.mutate()}
              >
                Analyze photo
              </Button>
            </>
          )}
          {step === 'processing' && (
            <>
              <div className="flex-1" />
              <Button variant="ghost" disabled>
                Analyzing…
              </Button>
            </>
          )}
          {step === 'error' && (
            <>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <div className="flex-1" />
              <Button variant="primary" onClick={() => setStep('capture')}>
                Retake photo
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <div className="flex-1" />
              <Button
                variant="primary"
                disabled={
                  submittableCount === 0 ||
                  submitMutation.isPending ||
                  locationDrifted
                }
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending
                  ? 'Submitting…'
                  : `Submit ${submittableCount} count${submittableCount === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step A — Capture
// ─────────────────────────────────────────────────────────────────────────────

interface CaptureStepProps {
  previewUrl: string | null
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  dropInputRef: React.RefObject<HTMLInputElement | null>
}

function CaptureStep({
  previewUrl,
  onPickFile,
  onDrop,
  fileInputRef,
  dropInputRef,
}: CaptureStepProps) {
  return (
    <div className="p-4 space-y-4">
      {previewUrl ? (
        <div className="space-y-3">
          <div className="relative w-full rounded-xl overflow-hidden bg-[var(--bg)] border border-[var(--border-light)]">
            <img
              src={previewUrl}
              alt="Selected"
              className="w-full h-auto max-h-[420px] object-contain"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-11 rounded-lg border border-[var(--border)] bg-white text-sm font-medium flex items-center justify-center gap-2"
            >
              <Camera size={16} /> Retake
            </button>
            <button
              type="button"
              onClick={() => dropInputRef.current?.click()}
              className="flex-1 h-11 rounded-lg border border-[var(--border)] bg-white text-sm font-medium flex items-center justify-center gap-2"
            >
              <Upload size={16} /> Choose different
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] p-6 flex flex-col items-center justify-center gap-2 hover:border-[var(--navy)] transition-colors min-h-[160px]"
          >
            <Camera size={28} className="text-[var(--navy)]" />
            <p className="text-sm font-semibold text-[var(--text)]">Take a photo</p>
            <p className="text-[12px] text-[var(--text-tertiary)] text-center max-w-[260px]">
              Point at a shelf, truck compartment, or bin. AI will propose counts.
            </p>
          </button>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => dropInputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-[var(--border-light)] p-4 flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)] hover:border-[var(--border)] transition-colors cursor-pointer"
          >
            <Upload size={14} />
            Or drop / pick an image from your computer
          </div>
        </div>
      )}

      <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5">
        <Info size={11} /> Photo counts default to <strong>Estimate</strong> confidence. You can change it per row.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPickFile}
        className="hidden"
      />
      <input
        ref={dropInputRef}
        type="file"
        accept="image/*"
        onChange={onPickFile}
        className="hidden"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step C — Review
// ─────────────────────────────────────────────────────────────────────────────

interface ReviewStepProps {
  photoUrl: string | null
  rows: ReviewRow[]
  itemById: Map<string, PhotoStocktakeKnownItem>
  locationDrifted: boolean
  errorMsg: string | null
  onUpdate: (itemId: string, patch: Partial<ReviewRow>) => void
}

function ReviewStep({
  photoUrl,
  rows,
  itemById,
  locationDrifted,
  errorMsg,
  onUpdate,
}: ReviewStepProps) {
  const visibleRows = rows.filter((r) => !r.removed)
  return (
    <div className="p-4 space-y-4">
      {locationDrifted && (
        <Card className="border-[var(--warning)]/40 bg-[var(--warning-bg)]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-[var(--warning)] flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-[var(--text-secondary)]">
              The active location changed while this photo was processing.
              Close and retake at the new location to avoid mis-counting.
            </p>
          </div>
        </Card>
      )}

      {errorMsg && (
        <Card className="border-[var(--rust)]/40 bg-[var(--rust)]/5">
          <p className="text-[12px] text-[var(--rust)]">{errorMsg}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {photoUrl && (
          <div className="rounded-xl overflow-hidden bg-[var(--bg)] border border-[var(--border-light)] md:sticky md:top-0">
            <img
              src={photoUrl}
              alt="Captured shelf"
              className="w-full h-auto max-h-[360px] object-contain"
            />
          </div>
        )}

        <div className="space-y-2 min-w-0">
          {visibleRows.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--text-secondary)]">
                No items were confidently detected. Retake the photo with better
                lighting, or close this and count manually.
              </p>
            </Card>
          ) : (
            visibleRows.map((row) => {
              const item = itemById.get(row.item_id)
              if (!item) return null
              return (
                <Card key={row.item_id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[var(--text)] leading-tight">
                        {item.name}
                        <span className="text-[11px] font-normal text-[var(--text-tertiary)] ml-1.5">
                          · {item.unit}
                        </span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={cn(
                            'text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5',
                            AI_CONF_STYLES[row.ai_confidence],
                          )}
                        >
                          AI: {row.ai_confidence}
                        </span>
                        {row.user_edited_quantity && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--navy)]/10 text-[var(--navy)]">
                            Edited
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdate(row.item_id, { removed: true })}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--rust)] hover:bg-[var(--rust)]/5"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {row.reasoning && (
                    <p className="text-[11px] text-[var(--text-tertiary)] italic leading-snug">
                      {row.reasoning}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-[var(--text-secondary)] w-14">
                      Count
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={Number.isFinite(row.quantity) ? row.quantity : 0}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        onUpdate(row.item_id, {
                          quantity: Number.isNaN(v) ? 0 : clampQty(v),
                          user_edited_quantity: true,
                        })
                      }}
                      className="flex-1 h-10 px-3 text-center text-base font-bold bg-white border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--navy)]"
                    />
                    <Pencil size={12} className="text-[var(--text-tertiary)]" />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-[var(--text-secondary)] w-14">
                      Conf.
                    </label>
                    <select
                      value={row.user_confidence}
                      onChange={(e) =>
                        onUpdate(row.item_id, { user_confidence: e.target.value as Confidence })
                      }
                      className="flex-1 h-10 px-2 rounded-lg bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--navy)]"
                    >
                      <option value="estimate">Estimate (photo)</option>
                      <option value="rough">Rough count</option>
                      <option value="exact">Exact</option>
                    </select>
                    <Check
                      size={14}
                      className={cn(
                        'text-[var(--success)]',
                        row.user_confidence === 'estimate' && 'opacity-40',
                      )}
                    />
                  </div>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
