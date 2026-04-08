import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ChecklistCategory, ChecklistTemplate } from '@/data/mock'

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  marketing: 'Marketing',
  sales_prep: 'Sales Prep',
  sales_call: 'Sales Call',
  client_meeting: 'Client Meetings',
  client_onboarding: 'Client Onboarding',
  project_kickoff: 'Project Kickoff',
  project_sop: 'Project SOPs',
  project_closeout: 'Project Closeout',
  post_project: 'Post-Project',
  employee_onboarding: 'Employee Onboarding',
  subcontractor_onboarding: 'Sub Onboarding',
  compliance: 'Compliance',
}

function groupByCategory(templates: ChecklistTemplate[]): Record<string, ChecklistTemplate[]> {
  const groups: Record<string, ChecklistTemplate[]> = {}
  for (const t of templates) {
    const key = t.category ?? t.project_type ?? 'other'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  return groups
}

export function ChecklistTemplatesPage() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('checklist_templates').select('*').order('created_at', { ascending: false })
      return (data ?? []) as ChecklistTemplate[]
    },
  })

  const groups = groupByCategory(templates)

  if (isLoading) {
    return (
      <div className="space-y-5 pb-10">
        <PageHeader title="Checklist Templates" subtitle="Loading..." />
        <div className="text-sm text-[var(--text-secondary)] text-center py-8">Loading checklist templates...</div>
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="space-y-5 pb-10">
        <PageHeader
          title="Checklist Templates"
          subtitle="Master definitions of every checklist. Triggers determine when they auto-generate."
        />
        <Card>
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">No checklist templates added yet.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Checklist Templates"
        subtitle="Master definitions of every checklist. Triggers determine when they auto-generate."
      />

      {Object.entries(groups).map(([cat, catTemplates]) => (
        <div key={cat} className="space-y-2">
          <SectionHeader title={CATEGORY_LABELS[cat as ChecklistCategory] ?? cat} />
          {catTemplates.map((t) => (
            <Card key={t.id} padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-body font-semibold text-[15px] text-[var(--navy)]">{t.name}</p>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                    {t.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {t.item_count != null && (
                      <span className="text-[11px] text-[var(--text-tertiary)]">
                        {t.item_count} items
                      </span>
                    )}
                    {t.trigger_event && (
                      <>
                        <span className="text-[11px] text-[var(--text-tertiary)]">·</span>
                        <span className="text-[11px] text-[var(--text-tertiary)]">
                          Trigger: {t.trigger_event}
                        </span>
                      </>
                    )}
                    {t.project_type && (
                      <>
                        <span className="text-[11px] text-[var(--text-tertiary)]">·</span>
                        <span className="text-[11px] text-[var(--rust)] font-medium">
                          {t.project_type}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0 mt-1" />
              </div>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}
