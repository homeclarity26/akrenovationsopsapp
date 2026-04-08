/**
 * Phase N — Universal Template System
 * N29: <EditableDeliverable> wrapper component
 *
 * Wraps any structured list-based content (checklist, scope sections,
 * punch list, shopping list, etc.) with:
 *  - Edit mode with inline editing, add/remove/reorder
 *  - Bottom action bar with Discard / Save / Save & update template
 *  - Promote flow integration (N30)
 *  - AI suggestion panel (N33)
 *  - Divergence tracking (N24)
 */

import { useState, useCallback } from 'react'
import { Edit3, RotateCcw, Trash2, GripVertical, Plus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AISuggestionPanel } from '@/components/ui/AISuggestionPanel'
import { PromoteFlowSheet } from '@/components/ui/PromoteFlow'
import { diffFromDivergenceSummary, recordDivergence } from '@/lib/templateUtils'
import { cn } from '@/lib/utils'
import type { DivergenceChange } from '@/lib/templateUtils'
import type { PromoteType } from '@/components/ui/PromoteFlow'
import { supabase } from '@/lib/supabase'

export interface EditableItem {
  id: string
  title: string
  description?: string
  required?: boolean
  templateItemId?: string
  [key: string]: unknown
}

interface EditableDeliverableProps {
  deliverableType: string
  instanceId: string
  instanceTable: string
  templateId?: string
  templateName?: string
  templateVersion?: number
  items: EditableItem[]
  onSave: (items: EditableItem[]) => Promise<void>
  isEditable: boolean
  showPromoteOption: boolean
  projectContext?: Record<string, unknown>
  userId?: string
  renderItem?: (item: EditableItem, isEditing: boolean) => React.ReactNode
  className?: string
}

export function EditableDeliverable({
  deliverableType,
  instanceId,
  instanceTable,
  templateId,
  templateName = 'Template',
  templateVersion = 1,
  items: initialItems,
  onSave,
  isEditable,
  showPromoteOption,
  projectContext = {},
  userId,
  renderItem,
  className,
}: EditableDeliverableProps) {
  const [editing, setEditing] = useState(false)
  const [items, setItems] = useState<EditableItem[]>(initialItems)
  const [pendingItems, setPendingItems] = useState<EditableItem[]>(initialItems)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemText, setEditingItemText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPromote, setShowPromote] = useState(false)
  const [localDivergences, setLocalDivergences] = useState<DivergenceChange[]>([])
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  function startEditing() {
    setPendingItems([...items])
    setDirty(false)
    setLocalDivergences([])
    setEditing(true)
  }

  function discardChanges() {
    setPendingItems([...items])
    setDirty(false)
    setLocalDivergences([])
    setEditing(false)
    setEditingItemId(null)
  }

  function markDirty() {
    setDirty(true)
  }

  // Inline item editing
  function beginItemEdit(item: EditableItem) {
    setEditingItemId(item.id)
    setEditingItemText(item.title)
  }

  function commitItemEdit(itemId: string) {
    const item = pendingItems.find((i) => i.id === itemId)
    if (!item) return

    const newTitle = editingItemText.trim()
    if (!newTitle || newTitle === item.title) {
      setEditingItemId(null)
      return
    }

    const updated = pendingItems.map((i) =>
      i.id === itemId ? { ...i, title: newTitle } : i,
    )
    setPendingItems(updated)
    setLocalDivergences((prev) => [
      ...prev,
      { type: 'edit', detail: { field: 'title', old_value: item.title, new_value: newTitle }, changed_at: new Date().toISOString(), changed_by: userId ?? null },
    ])
    setEditingItemId(null)
    markDirty()
  }

  function removeItem(itemId: string) {
    const item = pendingItems.find((i) => i.id === itemId)
    if (!item) return
    setPendingItems((prev) => prev.filter((i) => i.id !== itemId))
    setLocalDivergences((prev) => [
      ...prev,
      { type: 'remove', detail: { title: item.title, item_id: itemId }, changed_at: new Date().toISOString(), changed_by: userId ?? null },
    ])
    markDirty()
  }

  function addItem(title: string, description?: string) {
    const newItem: EditableItem = {
      id: crypto.randomUUID(),
      title,
      description,
      templateItemId: undefined,
    }
    setPendingItems((prev) => [...prev, newItem])
    setLocalDivergences((prev) => [
      ...prev,
      { type: 'add', detail: { title, description }, changed_at: new Date().toISOString(), changed_by: userId ?? null },
    ])
    markDirty()
  }

  const handleAISuggestionAdd = useCallback((sug: { title: string; description?: string }) => {
    addItem(sug.title, sug.description)
  }, [pendingItems])

  async function handleSave(andPromote = false) {
    setSaving(true)
    try {
      // Record divergences to instance
      if (instanceId && instanceTable && localDivergences.length > 0) {
        for (const div of localDivergences) {
          await recordDivergence(instanceTable, instanceId, div.type, div.detail, userId ?? null)
        }
      }
      await onSave(pendingItems)
      setItems(pendingItems)
      setDirty(false)
      setLocalDivergences([])
      if (andPromote) {
        setShowPromote(true)
      } else {
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handlePromoteConfirm(type: PromoteType, variationName?: string) {
    if (!templateId) {
      setShowPromote(false)
      setEditing(false)
      return
    }

    try {
      // Write to template_promotions table
      await supabase.from('template_promotions').insert({
        deliverable_type: deliverableType,
        instance_id: instanceId,
        instance_table: instanceTable,
        source_template_id: templateId,
        result_template_id: templateId, // will be updated server-side for create_variation
        promotion_type: type,
        variation_name: variationName ?? null,
        changes_promoted: localDivergences,
        promoted_by: userId ?? null,
        ai_suggested: false,
      })

      if (type === 'update_existing') {
        // Increment template version + append change_log entry
        const { data: tmpl } = await supabase
          .from(`${deliverableType === 'checklist' ? 'checklist_templates' : deliverableType === 'scope' ? 'scope_templates' : deliverableType === 'proposal' ? 'proposal_templates' : 'checklist_templates'}`)
          .select('version, change_log, name')
          .eq('id', templateId)
          .single()

        if (tmpl) {
          const currentLog: unknown[] = (tmpl.change_log as unknown[]) ?? []
          const newEntry = {
            version: (tmpl.version ?? 1) + 1,
            changed_at: new Date().toISOString(),
            changed_by: userId ?? null,
            changes: localDivergences,
            promoted_from_instance: instanceId,
          }
          const tableName = deliverableType === 'checklist' ? 'checklist_templates'
            : deliverableType === 'scope' ? 'scope_templates'
            : deliverableType === 'proposal' ? 'proposal_templates'
            : 'checklist_templates'

          await supabase
            .from(tableName)
            .update({
              version: (tmpl.version ?? 1) + 1,
              change_log: [...currentLog, newEntry],
              updated_by: userId ?? null,
            })
            .eq('id', templateId)
        }
      }

      // Mark instance as promoted
      await supabase
        .from(instanceTable)
        .update({
          promoted_to_template_id: templateId,
          promoted_at: new Date().toISOString(),
        })
        .eq('id', instanceId)

    } catch (err) {
      console.error('[EditableDeliverable] promote error', err)
    }

    setShowPromote(false)
    setEditing(false)
  }

  const diffs = diffFromDivergenceSummary(localDivergences)

  // Non-editable view
  if (!editing) {
    return (
      <div className={cn('space-y-1', className)}>
        {items.map((item) => (
          <div key={item.id} className="text-sm text-[var(--text)] py-1">
            {renderItem ? renderItem(item, false) : (
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--navy)] mt-1.5 shrink-0" />
                <span>{item.title}</span>
              </div>
            )}
          </div>
        ))}
        {isEditable && (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 text-xs text-[var(--navy)] hover:text-[var(--navy-light)] font-medium mt-2"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>
    )
  }

  // Edit mode
  return (
    <div className={cn('space-y-2', className)}>
      {/* Item list */}
      <div className="space-y-1">
        {pendingItems.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-2 bg-white border border-[var(--border-light)] rounded-lg px-3 py-2"
          >
            <GripVertical className="h-4 w-4 text-[var(--text-tertiary)] mt-0.5 shrink-0 opacity-40" />
            <div className="flex-1 min-w-0">
              {editingItemId === item.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editingItemText}
                    onChange={(e) => setEditingItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitItemEdit(item.id)
                      if (e.key === 'Escape') setEditingItemId(null)
                    }}
                    className="flex-1 text-sm bg-transparent border-b border-[var(--navy)] outline-none"
                  />
                  <button onClick={() => commitItemEdit(item.id)} className="p-1 text-[var(--success)]">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditingItemId(null)} className="p-1 text-[var(--text-secondary)]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span
                  className="text-sm text-[var(--text)] cursor-pointer hover:text-[var(--navy)]"
                  onClick={() => beginItemEdit(item)}
                >
                  {item.title}
                </span>
              )}
              {item.description && (
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => removeItem(item.id)}
              className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--danger)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add item */}
      <AddItemRow onAdd={(title) => addItem(title)} />

      {/* AI suggestions */}
      <AISuggestionPanel
        deliverableType={deliverableType}
        currentItems={pendingItems}
        projectContext={projectContext}
        onAdd={handleAISuggestionAdd}
        className="mt-1"
      />

      {/* Reset to template */}
      {templateId && (
        <div>
          {showResetConfirm ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-secondary)]">Reset to template? This discards all edits.</span>
              <button onClick={() => { setPendingItems([...initialItems]); setDirty(false); setLocalDivergences([]); setShowResetConfirm(false) }} className="text-[var(--danger)] font-medium">Reset</button>
              <button onClick={() => setShowResetConfirm(false)} className="text-[var(--text-secondary)]">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to template
            </button>
          )}
        </div>
      )}

      {/* Bottom action bar — only when dirty */}
      {dirty && (
        <div className="flex gap-2 pt-2 border-t border-[var(--border-light)]">
          <Button variant="secondary" onClick={discardChanges} className="flex-1 text-sm py-2">
            Discard
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 text-sm py-2"
          >
            {saving ? 'Saving...' : 'Save to this project'}
          </Button>
          {showPromoteOption && templateId && (
            <Button
              variant="primary"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 text-sm py-2 bg-[var(--navy-light)]"
            >
              Save & update template
            </Button>
          )}
        </div>
      )}

      {/* If not dirty but editing, show Cancel */}
      {!dirty && (
        <div className="pt-2 border-t border-[var(--border-light)]">
          <Button variant="secondary" onClick={discardChanges} className="text-sm py-2">
            Done editing
          </Button>
        </div>
      )}

      {/* Promote flow overlay */}
      {showPromote && (
        <PromoteFlowSheet
          templateName={templateName}
          currentVersion={templateVersion}
          diffs={diffs}
          onConfirm={handlePromoteConfirm}
          onCancel={() => { setShowPromote(false); setEditing(false) }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddItemRow — inline add at bottom of list
// ---------------------------------------------------------------------------

function AddItemRow({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  function commit() {
    if (!value.trim()) { setOpen(false); return }
    onAdd(value.trim())
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-[var(--navy)] hover:text-[var(--navy-light)] font-medium py-1"
      >
        <Plus className="h-4 w-4" />
        Add item
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-white border border-[var(--navy)] rounded-lg px-3 py-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setOpen(false); setValue('') }
        }}
        placeholder="Item title..."
        className="flex-1 text-sm bg-transparent outline-none"
      />
      <button onClick={commit} className="p-1 text-[var(--success)]">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => { setOpen(false); setValue('') }} className="p-1 text-[var(--text-secondary)]">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
