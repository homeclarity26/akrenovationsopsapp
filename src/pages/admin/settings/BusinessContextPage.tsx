import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BusinessContextRecord {
  id: string
  key: string
  value: string
  category: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = [
  'identity',
  'preferences',
  'brand_voice',
  'pricing_rules',
  'workflow_rules',
  'employee_profiles',
  'sub_profiles',
  'client_patterns',
  'meta_rules',
] as const

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Identity',
  preferences: 'Preferences',
  brand_voice: 'Brand Voice',
  pricing_rules: 'Pricing Rules',
  workflow_rules: 'Workflow Rules',
  employee_profiles: 'Employee Profiles',
  sub_profiles: 'Subcontractor Profiles',
  client_patterns: 'Client Patterns',
  meta_rules: 'Meta Rules',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SavedFlashProps {
  show: boolean
}

function SavedFlash({ show }: SavedFlashProps) {
  if (!show) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--success)] animate-fade-in">
      <Check size={11} />
      Saved
    </span>
  )
}

interface InlineValueEditorProps {
  recordId: string
  value: string
  onSave: (id: string, value: string) => Promise<void>
}

function InlineValueEditor({ recordId, value, onSave }: InlineValueEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [showSaved, setShowSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Keep draft in sync if value changes externally
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  // Auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      textareaRef.current.focus()
    }
  }, [editing, draft])

  const handleSave = async () => {
    if (draft.trim() === value) {
      setEditing(false)
      return
    }
    await onSave(recordId, draft.trim())
    setEditing(false)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setDraft(value)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={e => {
          setDraft(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = `${e.target.scrollHeight}px`
        }}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        rows={1}
        className="w-full resize-none rounded-[14px] border-[1.5px] border-[var(--navy)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none overflow-hidden"
        style={{ minHeight: '44px', fontSize: '14px' }}
      />
    )
  }

  return (
    <div className="flex items-start gap-2 min-w-0">
      <button
        onClick={() => setEditing(true)}
        className="flex-1 min-w-0 text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors break-words whitespace-pre-wrap"
        style={{ minHeight: '44px', paddingTop: '10px', paddingBottom: '10px' }}
      >
        {value || <span className="text-[var(--text-tertiary)] italic">empty</span>}
      </button>
      {showSaved && <SavedFlash show={showSaved} />}
    </div>
  )
}

interface NewRecordRowProps {
  category: string
  onSave: (key: string, value: string, category: string) => Promise<void>
  onCancel: () => void
}

function NewRecordRow({ category, onSave, onCancel }: NewRecordRowProps) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!key.trim() || !value.trim()) return
    setSaving(true)
    await onSave(key.trim(), value.trim(), category)
    setSaving(false)
  }

  return (
    <div className="px-4 py-3 border-b border-[var(--border-light)] last:border-0 bg-[var(--bg)] space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Key (e.g. company_name)"
          value={key}
          onChange={e => setKey(e.target.value)}
          className="flex-1 min-w-0 rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--navy)]"
          style={{ fontSize: '14px', minHeight: '44px' }}
          autoFocus
        />
      </div>
      <textarea
        placeholder="Value"
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={2}
        className="w-full rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--navy)] resize-none"
        style={{ fontSize: '14px' }}
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-sm text-[var(--text-secondary)] bg-white hover:bg-[var(--bg)] transition-colors"
          style={{ minHeight: '44px' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!key.trim() || !value.trim() || saving}
          className="px-4 py-2 rounded-[10px] bg-[var(--navy)] text-white text-sm font-medium hover:bg-[var(--navy-light)] disabled:opacity-40 transition-colors"
          style={{ minHeight: '44px' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

interface CategorySectionProps {
  category: string
  records: BusinessContextRecord[]
  onUpdate: (id: string, value: string) => Promise<void>
  onDelete: (id: string) => void
}

function CategorySection({ category, records, onUpdate, onDelete }: CategorySectionProps) {
  const [expanded, setExpanded] = useState(true)
  const [addingNew, setAddingNew] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const addMutation = useMutation({
    mutationFn: async ({ key, value, cat }: { key: string; value: string; cat: string }) => {
      const { error } = await supabase.from('business_context').insert({ key, value, category: cat })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_context'] })
      setAddingNew(false)
    },
  })

  const handleAddSave = async (key: string, value: string, cat: string) => {
    await addMutation.mutateAsync({ key, value, cat })
  }

  const label = CATEGORY_LABELS[category] ?? category
  const count = records.length

  return (
    <div>
      <SectionHeader
        title={`${label.toUpperCase()} (${count})`}
        action={
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text)] transition-colors"
            style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        }
      />

      {expanded && (
        <Card padding="none">
          {records.length === 0 && !addingNew && (
            <div className="px-4 py-4 text-sm text-[var(--text-tertiary)] italic">
              No entries yet.
            </div>
          )}

          {records.map(record => (
            <div
              key={record.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border-light)] last:border-0 group"
              onMouseEnter={() => setHoveredId(record.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ minHeight: '44px' }}
            >
              {/* Key */}
              <div className="w-32 flex-shrink-0 pt-[10px]">
                <span className="text-sm font-semibold text-[var(--text)] break-words">
                  {record.key}
                </span>
              </div>

              {/* Value */}
              <div className="flex-1 min-w-0">
                <InlineValueEditor
                  recordId={record.id}
                  value={record.value}
                  onSave={onUpdate}
                />
              </div>

              {/* Delete */}
              <button
                onClick={() => onDelete(record.id)}
                className={`flex-shrink-0 p-1.5 rounded-lg transition-opacity text-[var(--rust)] hover:bg-[var(--rust-subtle)] ${
                  hoveredId === record.id ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {addingNew && (
            <NewRecordRow
              category={category}
              onSave={handleAddSave}
              onCancel={() => setAddingNew(false)}
            />
          )}

          {!addingNew && (
            <button
              onClick={() => setAddingNew(true)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors border-t border-[var(--border-light)]"
              style={{ minHeight: '44px', borderRadius: '0 0 12px 12px' }}
            >
              <Plus size={14} className="text-[var(--rust)]" />
              <span>Add entry</span>
            </button>
          )}
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function BusinessContextPage() {
  const queryClient = useQueryClient()

  const { data: records = [], isLoading } = useQuery<BusinessContextRecord[]>({
    queryKey: ['business_context'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_context')
        .select('id, key, value, category, created_at, updated_at')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from('business_context')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_context'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('business_context').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_context'] })
    },
  })

  const handleUpdate = async (id: string, value: string) => {
    await updateMutation.mutateAsync({ id, value })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  // Group records by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, BusinessContextRecord[]>>((acc, cat) => {
    acc[cat] = records.filter(r => r.category === cat)
    return acc
  }, {} as Record<string, BusinessContextRecord[]>)

  // Also catch any records in categories not in CATEGORY_ORDER
  const knownCategories = new Set(CATEGORY_ORDER as unknown as string[])
  const otherRecords = records.filter(r => !knownCategories.has(r.category))

  const totalCategories = CATEGORY_ORDER.filter(cat => grouped[cat].length > 0).length
  const totalRecords = records.length

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Business Context"
        subtitle="What the AI knows about your business"
      />

      {/* Summary */}
      {!isLoading && (
        <p className="text-sm text-[var(--text-secondary)]">
          {totalRecords} {totalRecords === 1 ? 'item' : 'items'} across {totalCategories} {totalCategories === 1 ? 'category' : 'categories'}
        </p>
      )}

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-[var(--border-light)] rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-6">
          {CATEGORY_ORDER.map(cat => (
            <CategorySection
              key={cat}
              category={cat}
              records={grouped[cat]}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}

          {otherRecords.length > 0 && (
            <CategorySection
              category="other"
              records={otherRecords}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}
