/**
 * Phase N — Task N44-N48
 * Master Template Library at /admin/settings/templates
 *
 * N44: Layout (mobile tabs + desktop sidebar)
 * N45: Template list with version badge, active toggle, edit, duplicate
 * N46: Inline template editor (slide-in panel style)
 * N47: Version history timeline (change_log JSONB)
 * N48: Variations tree (parent_template_id grouping)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Edit3,
  Copy,
  Clock,
  Plus,
  Check,
  X,
  Trash2,
  GripVertical,
  Eye,
  GitBranch,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateType =
  | 'Checklists'
  | 'Scopes of Work'
  | 'Proposals'
  | 'Estimate Templates'
  | 'Punch Lists'
  | 'Payment Schedules'
  | 'Shopping Lists'
  | 'Inspection Forms'

interface ChangeLogEntry {
  version: number
  changed_at: string
  changed_by: string | null
  summary?: string
  changes?: { type: string; detail: Record<string, unknown> }[]
}

interface BaseTemplate {
  id: string
  name: string
  version: number
  is_active: boolean
  times_used: number
  last_used_at: string | null
  change_log: ChangeLogEntry[] | null
  is_variation?: boolean
  variation_name?: string | null
  parent_template_id?: string | null
  project_type?: string | null
}

interface ChecklistTemplate extends BaseTemplate {
  _table: 'checklist_templates'
  items?: EditableItem[]
}
interface ScopeTemplate extends BaseTemplate {
  _table: 'scope_templates'
  trade?: string | null
  scope_sections?: EditableItem[]
}
interface ProposalTemplate extends BaseTemplate {
  _table: 'proposal_templates'
  sections?: EditableItem[]
}
interface EstimateTemplate extends BaseTemplate {
  _table: 'estimate_templates'
  items?: EditableItem[]
}
interface PunchListTemplate extends BaseTemplate {
  _table: 'punch_list_templates'
  items?: EditableItem[]
}
interface PaymentScheduleTemplate extends BaseTemplate {
  _table: 'payment_schedule_templates'
  milestones?: EditableItem[]
}
interface ShoppingListTemplate extends BaseTemplate {
  _table: 'shopping_list_templates'
  phase?: string | null
  items?: EditableItem[]
}
interface InspectionFormTemplate extends BaseTemplate {
  _table: 'inspection_form_templates'
  inspection_type?: string | null
  areas?: EditableItem[]
}

type AnyTemplate =
  | ChecklistTemplate
  | ScopeTemplate
  | ProposalTemplate
  | EstimateTemplate
  | PunchListTemplate
  | PaymentScheduleTemplate
  | ShoppingListTemplate
  | InspectionFormTemplate

interface EditableItem {
  id: string
  title: string
  description?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TEMPLATE_TYPES: TemplateType[] = [
  'Checklists',
  'Scopes of Work',
  'Proposals',
  'Estimate Templates',
  'Punch Lists',
  'Payment Schedules',
  'Shopping Lists',
  'Inspection Forms',
]

type TableName =
  | 'checklist_templates'
  | 'scope_templates'
  | 'proposal_templates'
  | 'estimate_templates'
  | 'punch_list_templates'
  | 'payment_schedule_templates'
  | 'shopping_list_templates'
  | 'inspection_form_templates'

const TYPE_TO_TABLE: Record<TemplateType, TableName> = {
  'Checklists':         'checklist_templates',
  'Scopes of Work':     'scope_templates',
  'Proposals':          'proposal_templates',
  'Estimate Templates': 'estimate_templates',
  'Punch Lists':        'punch_list_templates',
  'Payment Schedules':  'payment_schedule_templates',
  'Shopping Lists':     'shopping_list_templates',
  'Inspection Forms':   'inspection_form_templates',
}

/** Return the content field name for a given table */
function contentField(table: TableName): string {
  switch (table) {
    case 'scope_templates':    return 'scope_sections'
    case 'proposal_templates': return 'sections'
    case 'payment_schedule_templates': return 'milestones'
    case 'inspection_form_templates':  return 'areas'
    default: return 'items'
  }
}

/** Extract the EditableItem[] from any template */
function extractItems(tmpl: AnyTemplate): EditableItem[] {
  const t = tmpl as unknown as Record<string, unknown>
  const field = contentField(tmpl._table as TableName)
  const raw = t[field]
  if (!Array.isArray(raw)) return []
  return (raw as unknown[]).map((r, i) => {
    if (typeof r === 'object' && r !== null) {
      const obj = r as Record<string, unknown>
      return {
        id: (obj.id as string) ?? crypto.randomUUID(),
        title: (obj.title as string) ?? (obj.name as string) ?? `Item ${i + 1}`,
        description: (obj.description as string) ?? undefined,
        ...obj,
      }
    }
    return { id: crypto.randomUUID(), title: String(r) }
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// LoadingSpinner
// ---------------------------------------------------------------------------
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--rust)' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
function EmptyState({ type }: { type: TemplateType }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[var(--cream-light)] flex items-center justify-center mb-3">
        <GitBranch size={22} className="text-[var(--text-tertiary)]" />
      </div>
      <p className="font-semibold text-[var(--text)] text-sm">No {type} yet</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-[200px]">
        Templates will appear here once seeded or created.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VersionBadge — small navy pill
// ---------------------------------------------------------------------------
function VersionBadge({ version }: { version: number }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: 'var(--navy)', color: '#fff' }}
    >
      v{version}
    </span>
  )
}

// ---------------------------------------------------------------------------
// TypeBadge — inline label pill
// ---------------------------------------------------------------------------
function TypeBadge({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
        muted
          ? 'bg-[var(--border-light)] text-[var(--text-tertiary)]'
          : 'bg-[var(--cream-light)] text-[var(--text-secondary)]',
      )}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// ActiveToggle
// ---------------------------------------------------------------------------
function ActiveToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      disabled={disabled}
      className={cn(
        'w-10 h-5 rounded-full relative transition-colors flex-shrink-0 disabled:opacity-50',
        active ? 'bg-[var(--navy)]' : 'bg-[var(--border)]',
      )}
      title={active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
    >
      <div
        className={cn(
          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
          active ? 'left-5' : 'left-0.5',
        )}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// VersionHistory — N47
// ---------------------------------------------------------------------------
function VersionHistory({ changeLog }: { changeLog: ChangeLogEntry[] | null }) {
  const entries = changeLog ?? []

  if (entries.length === 0) {
    return (
      <p className="text-xs text-[var(--text-tertiary)] py-2">No history recorded yet.</p>
    )
  }

  return (
    <div className="space-y-3 py-2">
      {[...entries].reverse().map((entry, idx) => {
        const who = entry.changed_by ?? 'System'
        const isInitial = entry.version === 1 && idx === entries.length - 1
        return (
          <div key={idx} className="flex gap-3">
            {/* Timeline dot */}
            <div className="flex flex-col items-center">
              <div
                className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                style={{ background: isInitial ? 'var(--border)' : 'var(--navy)' }}
              />
              {idx < entries.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ background: 'var(--border-light)' }} />
              )}
            </div>
            {/* Content */}
            <div className="pb-3 min-w-0">
              <p className="text-[12px] font-semibold text-[var(--text)]">
                v{entry.version}
                {entry.changed_at && (
                  <span className="font-normal text-[var(--text-tertiary)] ml-1">
                    — {fmtDateTime(entry.changed_at)} — {who}
                  </span>
                )}
              </p>
              {isInitial ? (
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Initial template (seeded)</p>
              ) : (
                entry.changes?.map((c, ci) => (
                  <p key={ci} className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {c.type === 'add' && '+ Added'}
                    {c.type === 'remove' && '− Removed'}
                    {c.type === 'edit' && '~ Edited'}
                    {typeof c.detail === 'object' && c.detail !== null && 'title' in c.detail
                      ? `: "${String(c.detail.title)}"`
                      : typeof c.detail === 'object' && c.detail !== null && 'new_value' in c.detail
                      ? `: "${String(c.detail.new_value)}"`
                      : ''}
                  </p>
                ))
              )}
              {entry.summary && (
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 italic">{entry.summary}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TemplateEditor — N46
// ---------------------------------------------------------------------------
interface TemplateEditorProps {
  template: AnyTemplate
  table: TableName
  onClose: () => void
  onSaved: (updated: AnyTemplate) => void
}

function TemplateEditor({ template, table, onClose, onSaved }: TemplateEditorProps) {
  const [items, setItems] = useState<EditableItem[]>(() => extractItems(template))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [dirty, setDirty] = useState(false)

  function beginEdit(item: EditableItem) {
    setEditingId(item.id)
    setEditText(item.title)
  }

  function commitEdit(id: string) {
    const trimmed = editText.trim()
    if (!trimmed) { setEditingId(null); return }
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, title: trimmed } : i))
    setEditingId(null)
    setDirty(true)
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setDirty(true)
  }

  function addItem(title: string) {
    if (!title.trim()) return
    setItems((prev) => [...prev, { id: crypto.randomUUID(), title: title.trim() }])
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const field = contentField(table)
      const newVersion = template.version + 1
      const changeEntry: ChangeLogEntry = {
        version: newVersion,
        changed_at: new Date().toISOString(),
        changed_by: 'Adam',
        changes: [{ type: 'edit', detail: { saved_items: items.length } }],
      }
      const existingLog: ChangeLogEntry[] = template.change_log ?? []

      const { data, error } = await supabase
        .from(table)
        .update({
          [field]: items,
          version: newVersion,
          change_log: [...existingLog, changeEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', template.id)
        .select()
        .single()

      if (error) throw error
      onSaved({ ...(data as AnyTemplate), _table: template._table })
      setDirty(false)
      onClose()
    } catch (_err) {
      // silently fail in production; editor stays open
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 border-t border-[var(--border-light)] pt-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[var(--text)]">
          {previewing ? 'Preview' : 'Edit Template'}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewing((v) => !v)}
            className="flex items-center gap-1 text-xs text-[var(--navy)] font-medium"
          >
            <Eye size={13} />
            {previewing ? 'Edit' : 'Preview'}
          </button>
          <button onClick={onClose} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text)]">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Preview mode */}
      {previewing ? (
        <div className="bg-[var(--bg)] rounded-xl p-4 space-y-1.5">
          {items.length === 0 && (
            <p className="text-xs text-[var(--text-tertiary)] italic">No items yet.</p>
          )}
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-start gap-2 text-sm text-[var(--text)]">
              <span className="text-[var(--text-tertiary)] font-mono text-[11px] mt-0.5 w-4 shrink-0">{idx + 1}.</span>
              <span>{item.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Item list */}
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-2 bg-white border border-[var(--border-light)] rounded-lg px-3 py-2"
              >
                <GripVertical size={14} className="text-[var(--text-tertiary)] shrink-0 opacity-40" />
                <div className="flex-1 min-w-0">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(item.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 text-sm bg-transparent border-b border-[var(--navy)] outline-none"
                      />
                      <button onClick={() => commitEdit(item.id)} className="p-1 text-[var(--success)]">
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-[var(--text-secondary)]">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <span
                      className="text-sm text-[var(--text)] cursor-pointer hover:text-[var(--navy)]"
                      onClick={() => beginEdit(item)}
                    >
                      {item.title}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Add item */}
          <AddItemRow onAdd={addItem} />
        </>
      )}

      {/* Save bar */}
      {dirty && (
        <div className="flex gap-2 pt-2 border-t border-[var(--border-light)]">
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            Discard
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving...' : `Save — v${template.version + 1}`}
          </Button>
        </div>
      )}
      {!dirty && (
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddItemRow
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
        <Plus size={15} />
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
        <Check size={13} />
      </button>
      <button onClick={() => { setOpen(false); setValue('') }} className="p-1 text-[var(--text-secondary)]">
        <X size={13} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VariationsTree — N48
// ---------------------------------------------------------------------------
function VariationsTree({
  root: _root,
  children,
}: {
  root: AnyTemplate
  children: AnyTemplate[]
}) {
  const [collapsed, setCollapsed] = useState(false)

  if (children.length === 0) return null

  return (
    <div className="mt-2 pl-4 border-l-2 border-[var(--border-light)]">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] mb-1"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        {children.length} variation{children.length !== 1 ? 's' : ''}
      </button>
      {!collapsed && children.map((child) => (
        <div key={child.id} className="flex items-center gap-2 py-1.5">
          <span className="text-[var(--text-tertiary)] text-xs">└──</span>
          <span className="text-sm text-[var(--text)] font-medium truncate">{child.name}</span>
          <VersionBadge version={child.version} />
          <span className="text-[11px] text-[var(--text-tertiary)] font-mono ml-auto shrink-0">
            {child.times_used} use{child.times_used !== 1 ? 's' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TemplateCard — N45 + N46 + N47 + N48
// ---------------------------------------------------------------------------
interface TemplateCardProps {
  template: AnyTemplate
  table: TableName
  allTemplates: AnyTemplate[]
  onToggleActive: (id: string, current: boolean) => void
  onDuplicate: (template: AnyTemplate) => void
  onUpdated: (updated: AnyTemplate) => void
  toggling: string | null
}

function TemplateCard({
  template,
  table,
  allTemplates,
  onToggleActive,
  onDuplicate,
  onUpdated,
  toggling,
}: TemplateCardProps) {
  const [showEditor, setShowEditor] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Children = templates that have this template as parent and are NOT itself
  const children = allTemplates.filter(
    (t) => t.parent_template_id === template.id && t.id !== template.id,
  )

  // Only render root-level cards (no parent) to avoid duplication
  // Children are shown inside the VariationsTree of the parent
  if (template.parent_template_id && allTemplates.some((t) => t.id === template.parent_template_id)) {
    return null
  }

  const subtitle: string[] = []
  if (template.project_type) subtitle.push(template.project_type)
  const t = template as unknown as Record<string, unknown>
  if (typeof t.trade === 'string' && t.trade) subtitle.push(t.trade)
  if (typeof t.inspection_type === 'string' && t.inspection_type) subtitle.push(t.inspection_type)
  if (typeof t.phase === 'string' && t.phase) subtitle.push(`Phase: ${t.phase}`)

  return (
    <Card padding="md">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Name + version */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[15px] text-[var(--navy)] leading-tight truncate">
              {template.name}
            </p>
            <VersionBadge version={template.version} />
            {template.is_variation && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}
              >
                Variation
              </span>
            )}
          </div>

          {/* Subtitle badges */}
          {subtitle.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {subtitle.map((s) => (
                <TypeBadge key={s} label={s} />
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
              {template.times_used} use{template.times_used !== 1 ? 's' : ''}
            </span>
            {template.last_used_at && (
              <>
                <span className="text-[11px] text-[var(--text-tertiary)]">·</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  Last used {fmtDate(template.last_used_at)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Active toggle */}
        <ActiveToggle
          active={template.is_active}
          onToggle={() => onToggleActive(template.id, template.is_active)}
          disabled={toggling === template.id}
        />
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-light)] flex-wrap">
        <button
          onClick={() => { setShowEditor((v) => !v); setShowHistory(false) }}
          className="flex items-center gap-1.5 text-xs text-[var(--navy)] font-semibold hover:text-[var(--navy-light)]"
        >
          <Edit3 size={13} />
          {showEditor ? 'Close editor' : 'Edit template'}
        </button>
        <span className="text-[var(--border)] text-xs">|</span>
        <button
          onClick={() => { setShowHistory((v) => !v); setShowEditor(false) }}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
        >
          <Clock size={13} />
          {showHistory ? 'Hide history' : 'View history'}
        </button>
        <span className="text-[var(--border)] text-xs">|</span>
        <button
          onClick={() => onDuplicate(template)}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
        >
          <Copy size={13} />
          Duplicate
        </button>
      </div>

      {/* Inline editor — N46 */}
      {showEditor && (
        <TemplateEditor
          template={template}
          table={table}
          onClose={() => setShowEditor(false)}
          onSaved={(updated) => { onUpdated(updated); setShowEditor(false) }}
        />
      )}

      {/* Version history — N47 */}
      {showHistory && (
        <div className="mt-3 border-t border-[var(--border-light)] pt-3">
          <p className="text-[11px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] mb-2">
            Version History
          </p>
          <VersionHistory changeLog={template.change_log} />
        </div>
      )}

      {/* Variations tree — N48 */}
      {children.length > 0 && (
        <div className="mt-3 border-t border-[var(--border-light)] pt-2">
          <p className="text-[11px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] mb-1">
            Variations
          </p>
          <div className="flex items-center gap-2 text-sm text-[var(--text)] font-medium">
            <span>{template.name}</span>
            <VersionBadge version={template.version} />
            <span className="text-[11px] text-[var(--text-tertiary)] font-mono ml-auto">
              {template.times_used} use{template.times_used !== 1 ? 's' : ''}
            </span>
          </div>
          <VariationsTree root={template} children={children} />
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// TemplateTypePanel — fetches and renders templates for a given type
// ---------------------------------------------------------------------------
interface TemplateTypePanelProps {
  type: TemplateType
}

function TemplateTypePanel({ type }: TemplateTypePanelProps) {
  const table = TYPE_TO_TABLE[type]
  const [templates, setTemplates] = useState<AnyTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from(table).select('*').order('name')
      if (data) {
        setTemplates(
          (data as unknown as Record<string, unknown>[]).map((row) => ({
            ...(row as unknown as BaseTemplate),
            _table: table,
            is_active: row.is_active !== false,
            times_used: (row.times_used as number) ?? 0,
            version: (row.version as number) ?? 1,
            change_log: (row.change_log as ChangeLogEntry[] | null) ?? null,
          })) as AnyTemplate[],
        )
      }
    } finally {
      setLoading(false)
    }
  }, [table])

  useEffect(() => { load() }, [load])

  async function handleToggleActive(id: string, current: boolean) {
    setToggling(id)
    try {
      await supabase.from(table).update({ is_active: !current }).eq('id', id)
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: !current } : t)),
      )
    } finally {
      setToggling(null)
    }
  }

  async function handleDuplicate(template: AnyTemplate) {
    setDuplicating(template.id)
    try {
      const field = contentField(table)
      const original = template as unknown as Record<string, unknown>
      const { id: _id, ...rest } = original
      void _id

      const payload: Record<string, unknown> = {
        ...rest,
        name: `${template.name} — Copy`,
        version: 1,
        times_used: 0,
        last_used_at: null,
        change_log: [],
        is_active: false,
        parent_template_id: template.id,
        is_variation: true,
        variation_name: 'Copy',
        [field]: original[field] ?? [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Remove private _table field before insert
        _table: undefined,
      }
      delete payload._table

      const { data, error } = await supabase.from(table).insert(payload).select().single()
      if (!error && data) {
        const newTmpl: AnyTemplate = {
          ...(data as BaseTemplate),
          _table: table,
          is_active: false,
          times_used: 0,
          version: 1,
          change_log: [],
        } as AnyTemplate
        setTemplates((prev) => [...prev, newTmpl])
      }
    } finally {
      setDuplicating(null)
    }
  }

  function handleUpdated(updated: AnyTemplate) {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  if (loading) return <Spinner />

  if (templates.length === 0) return <EmptyState type={type} />

  return (
    <div className="space-y-3">
      {templates.map((tmpl) => (
        <TemplateCard
          key={tmpl.id}
          template={tmpl}
          table={table}
          allTemplates={templates}
          onToggleActive={handleToggleActive}
          onDuplicate={handleDuplicate}
          onUpdated={handleUpdated}
          toggling={duplicating === tmpl.id ? tmpl.id : toggling}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TemplatesPage — main export
// ---------------------------------------------------------------------------
export function TemplatesPage() {
  const [activeType, setActiveType] = useState<TemplateType>('Checklists')

  return (
    <div className="pb-12">
      {/* Mobile: top tabs + stacked content */}
      <div className="lg:hidden">
        <div className="px-4 pt-4 pb-3">
          <PageHeader
            title="Template Library"
            subtitle="Master definitions for all reusable templates."
          />
        </div>

        {/* Horizontal scrolling tabs — use overflow-x-auto only for the nav, not the page */}
        <div className="overflow-x-auto px-4">
          <div className="flex gap-1 pb-1 min-w-max">
            {TEMPLATE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={cn(
                  'px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap',
                  activeType === type
                    ? 'bg-[var(--navy)] text-white'
                    : 'bg-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--border)]',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-4">
          <TemplateTypePanel key={activeType} type={activeType} />
        </div>
      </div>

      {/* Desktop: sidebar + main */}
      <div className="hidden lg:grid lg:grid-cols-[220px_1fr] gap-0 min-h-screen">
        {/* Sidebar */}
        <div
          className="border-r border-[var(--border-light)] py-6 px-4"
          style={{ background: 'var(--bg)' }}
        >
          <p className="uppercase text-[11px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] mb-3 px-2">
            Template Types
          </p>
          <nav className="space-y-0.5">
            {TEMPLATE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                  activeType === type
                    ? 'bg-[var(--navy)] text-white font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--border-light)]',
                )}
              >
                <span className="truncate">{type}</span>
                {activeType === type && <ChevronRight size={14} className="shrink-0" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Main panel */}
        <div className="px-8 py-6 space-y-5 overflow-y-auto">
          <PageHeader
            title={activeType}
            subtitle="Manage, edit, and version all templates of this type."
          />
          <TemplateTypePanel key={activeType} type={activeType} />
        </div>
      </div>
    </div>
  )
}
