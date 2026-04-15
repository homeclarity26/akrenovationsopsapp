import { useState, useEffect } from 'react'
import { Play, CheckCircle, XCircle, Clock, Zap, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

interface AgentDef {
  id: string
  name: string
  description: string
  schedule: string
  trigger: string
  enabled: boolean
  lastRun: string | null
  lastStatus: 'success' | 'error' | 'pending' | null
  type: 'proactive' | 'reactive'
}

const DEFAULT_AGENTS: AgentDef[] = [
  { id: 'morning-brief',       name: 'Morning Brief',           description: 'Daily business summary delivered at 6am', schedule: 'Daily 6am',      trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'lead-aging',          name: 'Lead Aging Monitor',      description: 'Drafts follow-ups for stale leads',        schedule: 'Daily 8am',      trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'risk-monitor',        name: 'At-Risk Monitor',         description: 'Checks project health scores',             schedule: 'Daily 7am',      trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'weekly-client-update',name: 'Weekly Client Update',    description: 'Drafts client progress emails',            schedule: 'Fri 4pm',        trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'sub-insurance-alert', name: 'Sub Insurance Alert',     description: 'Flags expiring subcontractor insurance',   schedule: 'Daily 9am',      trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'invoice-aging',       name: 'Invoice Aging',           description: 'Drafts collection reminders',              schedule: 'Daily 8:30am',   trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'weekly-financials',   name: 'Weekly Financials',       description: 'Financial snapshot every Monday',          schedule: 'Mon 7am',        trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'cash-flow',           name: 'Cash Flow Forecast',      description: '60-day cash position projection',          schedule: 'Fri 4pm',        trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'social-content',      name: 'Social Content',          description: 'Drafts Instagram/Facebook posts from photos', schedule: 'Sun 8am',   trigger: 'cron', enabled: false, lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'warranty-tracker',    name: 'Warranty Tracker',        description: 'Alerts on expiring warranties',            schedule: 'Daily 9am',      trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'weather-schedule',    name: 'Weather Alert',           description: 'Flags weather impacting outdoor work',     schedule: 'Daily 6:30am',   trigger: 'cron', enabled: false, lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'daily-log',           name: 'Daily Log Generator',     description: 'Drafts daily logs at 5:30pm per project',  schedule: 'Daily 5:30pm',   trigger: 'cron', enabled: true,  lastRun: null, lastStatus: null, type: 'proactive' },
  { id: 'bonus-qualification', name: 'Bonus Qualification',     description: 'Calculates bonus on project completion',   schedule: 'On completion',  trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'review-request',      name: 'Review Request',          description: 'Sends review link 7 days after completion', schedule: '7d post-complete', trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'receipt-processor',   name: 'Receipt Processor',       description: 'Extracts data from uploaded receipts',     schedule: 'On upload',      trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'quote-reader',        name: 'Quote Reader',            description: 'Extracts data from uploaded quote docs',   schedule: 'On upload',      trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'document-classifier', name: 'Document Classifier',     description: 'Auto-tags uploaded files by type',         schedule: 'On upload',      trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'sub-invoice-matcher', name: 'Sub Invoice Matcher',     description: 'Matches sub invoices to awarded quotes',   schedule: 'On classify',    trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'change-order-drafter',name: 'Change Order Drafter',    description: 'Drafts change orders from flagged items',   schedule: 'On flag',        trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'invoice-generator',   name: 'Invoice Generator',       description: 'Creates invoices on milestone trigger',    schedule: 'On milestone',   trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'lead-intake',         name: 'Lead Intake',             description: 'Processes and scores new web leads',       schedule: 'On new lead',    trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'sms-responder',       name: 'SMS Responder',           description: 'Handles inbound SMS messages',             schedule: 'On SMS',         trigger: 'event', enabled: false, lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'photo-tagger',        name: 'Photo Tagger',            description: 'Describes and tags uploaded photos',       schedule: 'On upload',      trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'voice-transcriber',   name: 'Voice Transcriber',       description: 'Transcribes voice note uploads',           schedule: 'On upload',      trigger: 'event', enabled: false, lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'call-summarizer',     name: 'Call Summarizer',         description: 'Summarizes recorded phone calls',          schedule: 'On recording',   trigger: 'event', enabled: false, lastRun: null, lastStatus: null, type: 'reactive' },
  { id: 'punch-list',          name: 'Punch List Generator',    description: 'Drafts punch list near project completion', schedule: 'At 90% complete', trigger: 'event', enabled: true,  lastRun: null, lastStatus: null, type: 'reactive' },
]

export function AgentsPage() {
  const [agents, setAgents] = useState<AgentDef[]>(DEFAULT_AGENTS)
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [runningAgent, setRunningAgent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAgentConfigs() {
      try {
        const { data } = await supabase
          .from('agent_configs')
          .select('agent_id, enabled, last_run_at, last_status')

        if (data && data.length > 0) {
          const configMap = new Map(data.map(d => [d.agent_id, d]))
          setAgents(prev => prev.map(agent => {
            const config = configMap.get(agent.id)
            if (!config) return agent
            return {
              ...agent,
              enabled: config.enabled ?? agent.enabled,
              lastRun: config.last_run_at ? new Date(config.last_run_at).toLocaleTimeString() : null,
              lastStatus: config.last_status as AgentDef['lastStatus'] ?? null,
            }
          }))
        }
      } catch {
        // Table may not exist — use defaults
      }
      setLoading(false)
    }
    loadAgentConfigs()
  }, [])

  const toggleAgent = async (id: string) => {
    const agent = agents.find(a => a.id === id)
    if (!agent) return
    const newEnabled = !agent.enabled
    setAgents(prev => prev.map(a => a.id === id ? { ...a, enabled: newEnabled } : a))
    try {
      await supabase.from('agent_configs').upsert({ agent_id: id, enabled: newEnabled }, { onConflict: 'agent_id' })
    } catch {
      // Silently fail
    }
  }

  const runNow = async (id: string) => {
    setRunningAgent(id)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string)

      const res = await fetch(`${supabaseUrl}/functions/v1/run-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ agent_id: id }),
      })

      const status = res.ok ? 'success' : 'error'
      setAgents(prev => prev.map(a => a.id === id ? {
        ...a,
        lastRun: new Date().toLocaleTimeString(),
        lastStatus: status as AgentDef['lastStatus'],
      } : a))
    } catch {
      setAgents(prev => prev.map(a => a.id === id ? {
        ...a,
        lastRun: new Date().toLocaleTimeString(),
        lastStatus: 'error',
      } : a))
    }
    setRunningAgent(null)
  }

  const proactiveAgents = agents.filter(a => a.type === 'proactive')
  const reactiveAgents = agents.filter(a => a.type === 'reactive')

  const StatusIcon = ({ status }: { status: AgentDef['lastStatus'] }) => {
    if (!status) return <Clock size={13} className="text-[var(--text-tertiary)]" />
    if (status === 'success') return <CheckCircle size={13} className="text-[var(--success)]" />
    if (status === 'error') return <XCircle size={13} className="text-[var(--danger)]" />
    return <Clock size={13} className="text-[var(--warning)]" />
  }

  const renderAgentRow = (agent: AgentDef) => (
    <div key={agent.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-light)] last:border-0 min-h-[44px]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-medium text-sm text-[var(--text)] truncate">{agent.name}</p>
          <StatusIcon status={agent.lastStatus} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-[var(--text-tertiary)] truncate">{agent.description}</p>
          <span className="text-[10px] bg-[var(--cream-light)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
            {agent.schedule}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {agent.type === 'proactive' && (
          <button
            onClick={() => runNow(agent.id)}
            disabled={!!runningAgent || !globalEnabled}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] disabled:opacity-40 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Run now"
          >
            {runningAgent === agent.id
              ? <RefreshCw size={13} className="animate-spin" />
              : <Play size={13} />
            }
          </button>
        )}
        <button
          onClick={() => toggleAgent(agent.id)}
          disabled={!globalEnabled}
          className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 disabled:opacity-40 ${agent.enabled && globalEnabled ? 'bg-[var(--navy)]' : 'bg-[var(--border)]'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${agent.enabled && globalEnabled ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader title="AI Agents" subtitle={`${agents.length} configured agents`} />

      {/* Global toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--navy)] flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">AI Agent System</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {loading ? 'Loading...' : globalEnabled ? `${agents.filter(a => a.enabled).length} of ${agents.length} agents enabled` : 'All agents paused'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setGlobalEnabled(p => !p)}
            className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${globalEnabled ? 'bg-[var(--navy)]' : 'bg-[var(--danger)]'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${globalEnabled ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
        {!globalEnabled && (
          <p className="text-xs text-[var(--danger)] mt-3 font-medium">Emergency stop active — all agents paused. Toggle above to resume.</p>
        )}
      </Card>

      {/* Proactive agents */}
      <div>
        <SectionHeader title={`Proactive Agents (${proactiveAgents.length})`} />
        <Card padding="none">
          {proactiveAgents.map(renderAgentRow)}
        </Card>
      </div>

      {/* Reactive agents */}
      <div>
        <SectionHeader title={`Reactive Agents (${reactiveAgents.length})`} />
        <Card padding="none">
          {reactiveAgents.map(renderAgentRow)}
        </Card>
      </div>

      <div className="h-4" />
    </div>
  )
}
