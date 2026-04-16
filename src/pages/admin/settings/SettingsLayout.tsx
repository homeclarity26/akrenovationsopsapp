import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Building2, Users, Workflow, Plug, Activity, Database,
  BookOpen, Brain, Zap, AlertTriangle, Layers, Wrench,
  LayoutTemplate, DollarSign, ClipboardList, Shield,
  HardDrive, Stethoscope, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/Tooltip'
import { PageHeader } from '@/components/ui/PageHeader'

// ---------------------------------------------------------------------------
// Section / link definitions
// ---------------------------------------------------------------------------

interface SettingsLink {
  label: string
  desc: string
  to: string
  icon: React.ElementType
}

interface SettingsSection {
  group: string
  tooltip: string
  icon: React.ElementType
  links: SettingsLink[]
}

const SECTIONS: SettingsSection[] = [
  {
    group: 'Business',
    tooltip: 'Company identity, profile, and context',
    icon: Building2,
    links: [
      { label: 'Business Context', desc: 'Teach the AI about your company', to: 'context', icon: BookOpen },
      { label: 'Work-Type Rates', desc: 'Hourly rates for each trade', to: 'rates', icon: DollarSign },
    ],
  },
  {
    group: 'Team',
    tooltip: 'People, roles, and permissions',
    icon: Users,
    links: [
      { label: 'Pending Approvals', desc: 'Review AI actions before they execute', to: 'approvals', icon: AlertTriangle },
    ],
  },
  {
    group: 'Workflow',
    tooltip: 'Templates, checklists, and materials',
    icon: Workflow,
    links: [
      { label: 'Templates', desc: 'Scope, proposal, checklist, and punch list templates', to: 'templates', icon: LayoutTemplate },
      { label: 'Estimate Templates', desc: 'Pre-built line items for faster estimates', to: 'estimate-templates', icon: ClipboardList },
      { label: 'Checklist Templates', desc: 'Reusable inspection and task checklists', to: 'checklists', icon: ClipboardList },
      { label: 'Material Specs', desc: 'Preferred products surfaced by AI walkthroughs', to: 'materials', icon: Layers },
      { label: 'Tool Requests', desc: 'Approve crew tool purchases', to: 'tool-requests', icon: Wrench },
    ],
  },
  {
    group: 'Integrations',
    tooltip: 'Third-party connections and APIs',
    icon: Plug,
    links: [
      // Coming soon placeholder — no existing page
    ],
  },
  {
    group: 'Observability',
    tooltip: 'AI agents, memory, and system health',
    icon: Activity,
    links: [
      { label: 'AI Agents', desc: 'Manage all 27 autonomous agents', to: 'agents', icon: Zap },
      { label: 'Memory Inspector', desc: 'View and edit what the AI remembers', to: 'memory', icon: Brain },
      { label: 'System Health', desc: 'Edge-function latency, error rates, uptime', to: 'health', icon: Stethoscope },
    ],
  },
  {
    group: 'Data',
    tooltip: 'Backups, security, and compliance',
    icon: Database,
    links: [
      { label: 'Backups', desc: 'Scheduled exports and point-in-time restore', to: 'backups', icon: HardDrive },
      { label: 'Security', desc: 'Audit log, session management, MFA', to: 'security', icon: Shield },
    ],
  },
]

// ---------------------------------------------------------------------------
// "Coming soon" card shown when a section has zero pages
// ---------------------------------------------------------------------------

function ComingSoon({ section }: { section: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-xs">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--cream-light)] flex items-center justify-center mb-4">
          <Plug size={22} className="text-[var(--navy)]" />
        </div>
        <h3 className="font-display text-lg text-[var(--navy)] mb-1">{section}</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          This section is coming soon. QuickBooks, Google Calendar, Stripe, and Twilio integrations are on the roadmap.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop sidebar
// ---------------------------------------------------------------------------

function Sidebar() {
  return (
    <nav className="hidden lg:flex flex-col w-56 border-r border-[var(--border-light)] overflow-y-auto py-4 flex-shrink-0">
      {SECTIONS.map(section => (
        <div key={section.group} className="mb-4">
          <Tooltip content={section.tooltip} side="bottom">
            <h3 className="px-4 text-[10px] uppercase font-semibold tracking-[0.08em] text-[var(--text-tertiary)] mb-1 cursor-default">
              {section.group}
            </h3>
          </Tooltip>
          {section.links.length === 0 ? (
            <NavLink
              to={`/admin/settings/${section.group.toLowerCase()}`}
              className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-tertiary)] italic"
            >
              Coming soon
            </NavLink>
          ) : (
            section.links.map(link => (
              <NavLink
                key={link.to}
                to={`/admin/settings/${link.to}`}
                end
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-[var(--cream-light)] text-[var(--navy)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg)]',
                  )
                }
              >
                <link.icon size={15} className="flex-shrink-0" />
                {link.label}
              </NavLink>
            ))
          )}
        </div>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Mobile top tabs (scrollable)
// ---------------------------------------------------------------------------

function MobileTabs() {
  const flat = SECTIONS.flatMap(s =>
    s.links.length > 0
      ? s.links.map(l => ({ label: l.label, to: `/admin/settings/${l.to}`, icon: l.icon }))
      : [{ label: s.group, to: `/admin/settings/${s.group.toLowerCase()}`, icon: s.icon }],
  )

  return (
    <div className="lg:hidden overflow-x-auto border-b border-[var(--border-light)] -mx-4 px-4">
      <div className="flex gap-1 py-2 min-w-max">
        {flat.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-[var(--navy)] text-white'
                  : 'text-[var(--text-secondary)] bg-[var(--bg)] hover:bg-[var(--border-light)]',
              )
            }
          >
            <tab.icon size={13} />
            {tab.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layout shell
// ---------------------------------------------------------------------------

export function SettingsLayout() {
  const location = useLocation()
  // Detect if user landed on bare /admin/settings (the index)
  const isIndex = location.pathname === '/admin/settings' || location.pathname === '/admin/settings/'

  // Check if the path matches a "coming soon" section (no links)
  const comingSoonSection = SECTIONS.find(
    s => s.links.length === 0 && location.pathname.endsWith(`/settings/${s.group.toLowerCase()}`),
  )

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100svh-3.5rem)]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-4 lg:px-8 lg:py-6 flex-1 max-w-3xl w-full mx-auto">
          <div className="lg:hidden mb-4">
            <PageHeader title="Settings" subtitle="Company & account preferences" />
          </div>
          <MobileTabs />
          {comingSoonSection ? (
            <ComingSoon section={comingSoonSection.group} />
          ) : isIndex ? (
            <IndexPage />
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Index page (shown at /admin/settings with no subpath)
// ---------------------------------------------------------------------------

function IndexPage() {
  return (
    <div className="space-y-6 mt-4">
      {SECTIONS.map(section => {
        const SIcon = section.icon
        return (
          <div key={section.group}>
            <div className="flex items-center gap-2 mb-2">
              <SIcon size={15} className="text-[var(--text-tertiary)]" />
              <h3 className="uppercase text-[11px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)]">
                {section.group}
              </h3>
            </div>
            <div className="bg-white rounded-xl border border-[var(--border-light)] divide-y divide-[var(--border-light)]">
              {section.links.length === 0 ? (
                <div className="px-4 py-4 text-sm text-[var(--text-tertiary)] italic">Coming soon</div>
              ) : (
                section.links.map(link => (
                  <NavLink
                    key={link.to}
                    to={`/admin/settings/${link.to}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                      <link.icon size={17} className="text-[var(--navy)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[var(--text)]">{link.label}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{link.desc}</p>
                    </div>
                    <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
                  </NavLink>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
