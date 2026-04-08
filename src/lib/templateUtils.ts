/**
 * Universal Template System — shared utilities
 * N24: recordDivergence
 * N25: promotionDiff
 */

import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// N24: Record a divergence on any instance table
// ---------------------------------------------------------------------------

export type DivergenceChangeType = 'add' | 'remove' | 'edit' | 'reorder'

export interface DivergenceChange {
  type: DivergenceChangeType
  detail: Record<string, unknown>
  changed_at: string
  changed_by: string | null
}

/**
 * Call this whenever an instance item is added, removed, edited, or reordered.
 * Updates diverged_from_template=true and appends to divergence_summary JSONB.
 */
export async function recordDivergence(
  instanceTable: string,
  instanceId: string,
  changeType: DivergenceChangeType,
  changeDetail: Record<string, unknown>,
  userId: string | null,
): Promise<void> {
  // Fetch current divergence summary
  const { data: instance, error: fetchErr } = await supabase
    .from(instanceTable)
    .select('divergence_summary')
    .eq('id', instanceId)
    .single()

  if (fetchErr) {
    console.error('[recordDivergence] fetch error', fetchErr)
    return
  }

  const currentSummary: DivergenceChange[] = (instance?.divergence_summary ?? []) as DivergenceChange[]

  const newChange: DivergenceChange = {
    type: changeType,
    detail: changeDetail,
    changed_at: new Date().toISOString(),
    changed_by: userId,
  }

  const updatedSummary = [...currentSummary, newChange]

  const { error: updateErr } = await supabase
    .from(instanceTable)
    .update({
      diverged_from_template: true,
      divergence_summary: updatedSummary,
    })
    .eq('id', instanceId)

  if (updateErr) {
    console.error('[recordDivergence] update error', updateErr)
  }
}

// ---------------------------------------------------------------------------
// N25: Generate a human-readable diff for the promote flow
// ---------------------------------------------------------------------------

export interface DiffLine {
  type: 'add' | 'remove' | 'change' | 'reorder'
  label: string
  oldValue?: string
  newValue?: string
}

/**
 * Compares two arrays of items (template vs instance) and returns diff lines
 * suitable for display in the promote flow confirmation dialog.
 */
export function promotionDiff(
  templateItems: Array<{ id?: string; title?: string; description?: string; [key: string]: unknown }>,
  instanceItems: Array<{ id?: string; title?: string; description?: string; templateItemId?: string; [key: string]: unknown }>,
): DiffLine[] {
  const diffs: DiffLine[] = []

  const templateById = new Map(
    templateItems.map((item, idx) => [item.id ?? String(idx), item]),
  )

  const instanceByTemplateId = new Map(
    instanceItems
      .filter((i) => i.templateItemId)
      .map((i) => [i.templateItemId!, i]),
  )

  // Items removed from instance (in template but not in instance)
  for (const [id, tItem] of templateById.entries()) {
    if (!instanceByTemplateId.has(id)) {
      diffs.push({
        type: 'remove',
        label: `Removed: "${tItem.title ?? tItem.description ?? id}"`,
      })
    }
  }

  // Items changed
  for (const [templateId, iItem] of instanceByTemplateId.entries()) {
    const tItem = templateById.get(templateId)
    if (!tItem) continue

    const tTitle = String(tItem.title ?? tItem.description ?? '')
    const iTitle = String(iItem.title ?? iItem.description ?? '')

    if (tTitle !== iTitle) {
      diffs.push({
        type: 'change',
        label: `Changed: "${tTitle}" → "${iTitle}"`,
        oldValue: tTitle,
        newValue: iTitle,
      })
    }
  }

  // Items added to instance (in instance but no templateItemId — new additions)
  for (const iItem of instanceItems) {
    if (!iItem.templateItemId) {
      diffs.push({
        type: 'add',
        label: `Added: "${iItem.title ?? iItem.description ?? 'New item'}"`,
      })
    }
  }

  return diffs
}

/**
 * Generate diff from raw divergence_summary array (N24 records)
 */
export function diffFromDivergenceSummary(summary: DivergenceChange[]): DiffLine[] {
  return summary.map((change) => {
    const detail = change.detail
    switch (change.type) {
      case 'add':
        return { type: 'add' as const, label: `Added: "${detail.title ?? detail.item_name ?? 'item'}"` }
      case 'remove':
        return { type: 'remove' as const, label: `Removed: "${detail.title ?? detail.item_name ?? 'item'}"` }
      case 'edit':
        return {
          type: 'change' as const,
          label: `Changed: "${detail.field ?? 'item'}"`,
          oldValue: String(detail.old_value ?? ''),
          newValue: String(detail.new_value ?? ''),
        }
      case 'reorder':
        return { type: 'reorder' as const, label: `Reordered items` }
      default:
        return { type: 'change' as const, label: 'Modified' }
    }
  })
}
