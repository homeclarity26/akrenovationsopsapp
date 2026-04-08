/**
 * Phase N — Universal Template System
 * N30: Promote flow bottom sheet — choose update vs create variation
 * N31: Diff view component
 * N32: Variation name input
 */

import { useState } from 'react'
import { ArrowUpCircle, GitBranch, Plus, Minus, Edit2, ArrowUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { DiffLine } from '@/lib/templateUtils'

// ---------------------------------------------------------------------------
// DiffView (N31)
// ---------------------------------------------------------------------------

interface DiffViewProps {
  diffs: DiffLine[]
  templateName: string
  currentVersion: number
}

export function DiffView({ diffs, templateName, currentVersion }: DiffViewProps) {
  if (diffs.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)] py-2">
        No structural changes detected.
      </p>
    )
  }

  return (
    <div>
      <p className="text-xs text-[var(--text-tertiary)] mb-3">
        Updating <strong>"{templateName}"</strong> v{currentVersion} → v{currentVersion + 1}
      </p>
      <div className="space-y-2">
        {diffs.map((diff, idx) => (
          <div
            key={idx}
            className={cn(
              'flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
              diff.type === 'add' && 'bg-[var(--success-bg)] text-[var(--success)]',
              diff.type === 'remove' && 'bg-[var(--danger-bg)] text-[var(--danger)]',
              diff.type === 'change' && 'bg-[var(--warning-bg)] text-[var(--warning)]',
              diff.type === 'reorder' && 'bg-gray-50 text-[var(--text-secondary)]',
            )}
          >
            {diff.type === 'add' && <Plus className="h-4 w-4 mt-0.5 shrink-0" />}
            {diff.type === 'remove' && <Minus className="h-4 w-4 mt-0.5 shrink-0" />}
            {diff.type === 'change' && <Edit2 className="h-4 w-4 mt-0.5 shrink-0" />}
            {diff.type === 'reorder' && <ArrowUpDown className="h-4 w-4 mt-0.5 shrink-0" />}
            <span className="leading-snug">{diff.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VariationNameInput (N32)
// ---------------------------------------------------------------------------

interface VariationNameInputProps {
  baseName: string
  value: string
  onChange: (v: string) => void
}

export function VariationNameInput({ baseName, value, onChange }: VariationNameInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
        Name this variation
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`e.g. "${baseName} — High-End Finishes"`}
        className="w-full px-3 py-2.5 text-sm bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[14px] focus:outline-none focus:border-[var(--navy)]"
      />
      <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
        The original template stays unchanged. Future projects can use either version.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PromoteFlowSheet (N30) — step-by-step promote flow
// ---------------------------------------------------------------------------

export type PromoteType = 'update_existing' | 'create_variation'

interface PromoteFlowSheetProps {
  templateName: string
  currentVersion: number
  diffs: DiffLine[]
  onConfirm: (type: PromoteType, variationName?: string) => void
  onCancel: () => void
}

type Step = 'choose' | 'confirm_update' | 'name_variation'

export function PromoteFlowSheet({
  templateName,
  currentVersion,
  diffs,
  onConfirm,
  onCancel,
}: PromoteFlowSheetProps) {
  const [step, setStep] = useState<Step>('choose')
  const [variationName, setVariationName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleConfirmUpdate() {
    setSaving(true)
    await onConfirm('update_existing')
    setSaving(false)
  }

  async function handleConfirmVariation() {
    if (!variationName.trim()) return
    setSaving(true)
    await onConfirm('create_variation', variationName.trim())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text)]">
            {step === 'choose' && 'Save changes as a template'}
            {step === 'confirm_update' && 'Confirm template update'}
            {step === 'name_variation' && 'Save as new variation'}
          </h3>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Step: choose type */}
        {step === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setStep('confirm_update')}
              className="w-full text-left p-4 border-[1.5px] border-[var(--border)] rounded-xl hover:border-[var(--navy)] hover:bg-[var(--cream-light)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <ArrowUpCircle className="h-5 w-5 text-[var(--navy)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    Update "{templateName}"
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Updates the existing template to v{currentVersion + 1}. All future projects will use your improved version.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setStep('name_variation')}
              className="w-full text-left p-4 border-[1.5px] border-[var(--border)] rounded-xl hover:border-[var(--navy)] hover:bg-[var(--cream-light)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <GitBranch className="h-5 w-5 text-[var(--navy)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">
                    Save as new variation
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Creates a new template. You name it. The original "{templateName}" stays unchanged.
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Step: confirm update */}
        {step === 'confirm_update' && (
          <div className="space-y-4">
            <DiffView diffs={diffs} templateName={templateName} currentVersion={currentVersion} />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep('choose')} className="flex-1">
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmUpdate}
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Updating...' : 'Confirm update'}
              </Button>
            </div>
          </div>
        )}

        {/* Step: name variation */}
        {step === 'name_variation' && (
          <div className="space-y-4">
            <VariationNameInput
              baseName={templateName}
              value={variationName}
              onChange={setVariationName}
            />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep('choose')} className="flex-1">
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmVariation}
                disabled={saving || !variationName.trim()}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save variation'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
