import { Phone, Mail, MapPin, ExternalLink, User } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MOCK_PROJECTS, MOCK_PHASES } from '@/data/mock'

export function ClientInfoPage() {
  // Employee is on the Johnson project
  const project = MOCK_PROJECTS.find(p => p.id === 'proj-1')!
  const phases = MOCK_PHASES['proj-1'] ?? []

  const callClient = () => {
    window.location.href = `tel:${project.client_phone.replace(/\D/g, '')}`
  }

  const textClient = () => {
    window.location.href = `sms:${project.client_phone.replace(/\D/g, '')}`
  }

  const openMaps = () => {
    const encoded = encodeURIComponent(project.address)
    window.open(`https://maps.apple.com/?address=${encoded}`, '_blank')
  }

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl text-[var(--navy)]">Client Info</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">Current project</p>
      </div>

      {/* Client card */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
            <User size={22} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text)]">{project.client_name}</p>
            <p className="text-xs text-[var(--text-tertiary)] capitalize mt-0.5">{project.project_type} · {project.status}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={callClient}
            className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-[var(--bg)] text-left"
          >
            <Phone size={16} className="text-[var(--navy)] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-[var(--text-tertiary)]">Phone</p>
              <p className="text-sm font-medium text-[var(--text)]">{project.client_phone}</p>
            </div>
            <ExternalLink size={14} className="text-[var(--text-tertiary)]" />
          </button>

          <button
            onClick={() => window.location.href = `mailto:${project.client_email}`}
            className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-[var(--bg)] text-left"
          >
            <Mail size={16} className="text-[var(--navy)] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-[var(--text-tertiary)]">Email</p>
              <p className="text-sm font-medium text-[var(--text)] truncate">{project.client_email}</p>
            </div>
            <ExternalLink size={14} className="text-[var(--text-tertiary)]" />
          </button>

          <button
            onClick={openMaps}
            className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-[var(--bg)] text-left"
          >
            <MapPin size={16} className="text-[var(--rust)] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-[var(--text-tertiary)]">Address</p>
              <p className="text-sm font-medium text-[var(--text)]">{project.address}</p>
            </div>
            <ExternalLink size={14} className="text-[var(--text-tertiary)]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={callClient}
            className="py-3 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Phone size={15} />
            Call
          </button>
          <button
            onClick={textClient}
            className="py-3 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] flex items-center justify-center gap-2"
          >
            Text
          </button>
        </div>
      </Card>

      {/* Project summary */}
      <div>
        <SectionHeader title="Project" />
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Project</p>
              <p className="text-sm font-semibold text-[var(--text)] text-right max-w-[60%] truncate">{project.title}</p>
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Current phase</p>
              <p className="text-sm font-semibold text-[var(--text)]">{project.current_phase}</p>
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Completion</p>
              <p className="text-sm font-semibold text-[var(--text)]">{project.percent_complete}%</p>
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Target finish</p>
              <p className="text-sm font-semibold text-[var(--text)]">{project.target_completion_date}</p>
            </div>
          </div>

          {/* Phase progress */}
          <div className="mt-4 pt-4 border-t border-[var(--border-light)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Phases</p>
            <div className="space-y-2">
              {phases.map((phase, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    phase.status === 'complete' ? 'bg-[var(--success)]' :
                    phase.status === 'active' ? 'bg-[var(--navy)]' :
                    'bg-[var(--border)]'
                  }`} />
                  <p className={`text-sm flex-1 ${
                    phase.status === 'active' ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-secondary)]'
                  }`}>{phase.name}</p>
                  {phase.status === 'active' && (
                    <span className="text-xs font-mono text-[var(--navy)]">{phase.pct}%</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
