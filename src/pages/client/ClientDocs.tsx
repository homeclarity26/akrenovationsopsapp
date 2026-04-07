import { FileText, FileCheck, Download } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'

const DOCS = [
  { name: 'Signed Contract', type: 'PDF', date: 'Feb 28', icon: FileCheck, color: 'text-[var(--success)]' },
  { name: 'Accepted Proposal', type: 'PDF', date: 'Feb 25', icon: FileText, color: 'text-[var(--navy)]' },
  { name: 'Scope of Work', type: 'PDF', date: 'Feb 25', icon: FileText, color: 'text-[var(--navy)]' },
]

export function ClientDocs() {
  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h1 className="font-display text-2xl text-[var(--navy)]">Documents</h1>

      <SectionHeader title="Your Files" />
      <Card padding="none">
        {DOCS.map((doc, i) => {
          const Icon = doc.icon
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-light)] last:border-0">
              <Icon size={22} className={doc.color} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[var(--text)]">{doc.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{doc.type} · {doc.date}</p>
              </div>
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-[var(--text-secondary)]">
                <Download size={16} />
              </button>
            </div>
          )
        })}
      </Card>

      <p className="text-xs text-center text-[var(--text-tertiary)]">
        Only documents marked visible to you are shown here.
      </p>
    </div>
  )
}
