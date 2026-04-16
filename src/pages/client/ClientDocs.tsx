import { FileText, FileCheck, Download } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'
import { useClientProject } from '@/hooks/useClientProject'
import { SkeletonRow } from '@/components/ui/Skeleton'

interface ProjectFile {
  id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size_bytes: number | null
  category: string | null
  description: string | null
  created_at: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fileTypeLabel(file: ProjectFile): string {
  if (file.file_type) return file.file_type.toUpperCase()
  const ext = file.file_name.split('.').pop()
  return ext ? ext.toUpperCase() : 'FILE'
}

function iconFor(category: string | null) {
  if (category === 'contract') return FileCheck
  return FileText
}

function iconColor(category: string | null) {
  if (category === 'contract') return 'text-[var(--success)]'
  return 'text-[var(--navy)]'
}

function labelFor(category: string | null): string {
  if (!category) return 'Document'
  return category
    .split('_')
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(' ')
}

export function ClientDocs() {
  const { data: project } = useClientProject()
  const projectId = project?.id ?? null

  const { data: docs = [], isLoading } = useQuery<ProjectFile[]>({
    queryKey: ['client-docs', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_files')
        .select('id, file_name, file_url, file_type, file_size_bytes, category, description, created_at')
        .eq('project_id', projectId!)
        .eq('visible_to_client', true)
        .order('created_at', { ascending: false })
      if (error) {
        console.warn('[ClientDocs] fetch error:', error.message)
        return []
      }
      return (data ?? []) as ProjectFile[]
    },
  })

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h1 className="font-display text-2xl text-[var(--navy)]">Documents</h1>

      <SectionHeader title="Your Files" />

      {isLoading ? (
        <Card padding="none"><SkeletonRow count={3} /></Card>
      ) : docs.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-secondary)]">
            No documents shared yet. Your contractor will upload contracts, proposals, and other files here.
          </p>
        </Card>
      ) : (
        <Card padding="none">
          {docs.map((doc) => {
            const Icon = iconFor(doc.category)
            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-light)] last:border-0">
                <Icon size={22} className={iconColor(doc.category)} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--text)] truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {doc.category && (
                      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] bg-[var(--cream-light)] rounded-full px-2 py-0.5">
                        {labelFor(doc.category)}
                      </span>
                    )}
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {fileTypeLabel(doc)} · {formatDate(doc.created_at)}
                    </p>
                  </div>
                </div>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-[var(--text-secondary)]"
                  aria-label={`Download ${doc.file_name}`}
                >
                  <Download size={16} />
                </a>
              </div>
            )
          })}
        </Card>
      )}

      <p className="text-xs text-center text-[var(--text-tertiary)]">
        Only documents marked visible to you are shown here.
      </p>
    </div>
  )
}
