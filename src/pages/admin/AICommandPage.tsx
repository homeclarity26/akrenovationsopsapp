import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Sparkles, Check, X, Send, Mic, AlertCircle, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'

type ActionStatus = 'pending' | 'executed' | 'approved' | 'rejected'
type ActionItem = { id: string; request_text: string; action_type: string; risk_level: string; status: string; created_at: string; requires_approval: boolean; preview: string }

export function AICommandPage() {
  const { data: dbActions = [] } = useQuery({
    queryKey: ['ai_actions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_actions')
        .select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as ActionItem[]
    },
  })
  const [localActions, setLocalActions] = useState<ActionItem[]>([])
  const actions = localActions.length > 0 ? [...localActions, ...dbActions] : dbActions
  const setActions = (updater: ActionItem[] | ((prev: ActionItem[]) => ActionItem[])) => {
    setLocalActions(prev => {
      const merged = [...prev, ...dbActions]
      const next = typeof updater === 'function' ? updater(merged) : updater
      return next.filter(a => !dbActions.some(d => d.id === a.id))
    })
  }
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const sessionId = useRef(crypto.randomUUID()).current

  const pending = actions.filter(a => a.status === 'pending')
  const executed = actions.filter(a => a.status === 'executed')

  const approve = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: 'executed' as ActionStatus } : a))
  }

  const reject = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' as ActionStatus } : a))
  }

  const sendCommand = async () => {
    if (!input.trim() || processing) return
    setProcessing(true)
    const cmd = input
    setInput('')
    setLastResult(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const res = await fetch(`${supabaseUrl}/functions/v1/meta-agent-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: cmd,
          session_id: sessionId,
          user_id: session?.user?.id ?? 'unknown',
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.reply) {
        const errorDetail = data.error ?? data.message ?? `HTTP ${res.status}`
        console.error('[AICommand] Edge function error:', res.status, data)
        const reply = `Error: ${errorDetail}`
        setActions(prev => [{
          id: `ai-${Date.now()}`,
          request_text: cmd,
          action_type: 'chat',
          risk_level: 'low' as const,
          status: 'executed' as ActionStatus,
          created_at: new Date().toISOString(),
          requires_approval: false,
          preview: reply,
        }, ...prev])
        setLastResult(reply)
        return
      }
      const reply = data.reply

      setActions(prev => [{
        id: `ai-${Date.now()}`,
        request_text: cmd,
        action_type: 'chat',
        risk_level: 'low' as const,
        status: 'executed' as ActionStatus,
        created_at: new Date().toISOString(),
        requires_approval: false,
        preview: reply,
      }, ...prev])
      setLastResult(reply)
    } catch (err) {
      console.error('[AICommand] Network error:', err)
      setLastResult(`Network error: ${err instanceof Error ? err.message : 'Unable to reach AI service'}`)
    } finally {
      setProcessing(false)
    }
  }

  const RISK_CONFIG = {
    low:    { label: 'Auto-executed', color: 'bg-[var(--success-bg)] text-[var(--success)]' },
    medium: { label: 'Notify & execute', color: 'bg-[var(--warning-bg)] text-[var(--warning)]' },
    high:   { label: 'Requires approval', color: 'bg-[var(--danger-bg)] text-[var(--danger)]' },
  }

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader title="AI Command Center" subtitle="Manage AI actions and send commands" />

      {/* Command input */}
      <Card className="bg-[var(--navy)] border-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles size={14} className="text-white" />
          </div>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Command the AI</p>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
            placeholder="e.g. Send Johnson their weekly update..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendCommand()}
          />
          <button className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
            <Mic size={18} className="text-white/70" />
          </button>
          <button
            onClick={sendCommand}
            disabled={processing || !input.trim()}
            className="w-11 h-11 rounded-xl bg-white flex items-center justify-center disabled:opacity-50"
          >
            {processing
              ? <div className="w-4 h-4 border-2 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
              : <Send size={16} className="text-[var(--navy)]" />
            }
          </button>
        </div>
        {lastResult && (
          <p className="text-white/70 text-xs mt-2">{lastResult}</p>
        )}
      </Card>

      {/* Risk level legend */}
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(RISK_CONFIG).map(([level, cfg]) => (
          <div key={level} className={`px-3 py-2 rounded-xl ${cfg.color}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide capitalize">{level}</p>
            <p className="text-[11px] mt-0.5">{cfg.label}</p>
          </div>
        ))}
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div>
          <SectionHeader title={`Awaiting Approval (${pending.length})`} />
          <div className="space-y-3">
            {pending.map(action => (
              <Card key={action.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[var(--navy)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={13} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[var(--text)]">{action.request_text}</p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full inline-block mt-1 ${RISK_CONFIG[action.risk_level as keyof typeof RISK_CONFIG]?.color}`}>
                        {action.risk_level} risk
                      </span>
                    </div>
                  </div>
                  <AlertCircle size={16} className="text-[var(--warning)] flex-shrink-0 mt-0.5" />
                </div>

                {/* Preview */}
                <div className="bg-[var(--bg)] rounded-xl p-3 mb-3 border border-[var(--border-light)]">
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Preview</p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{action.preview}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => approve(action.id)}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} />
                    Approve & Send
                  </button>
                  <button
                    onClick={() => reject(action.id)}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] flex items-center justify-center gap-1.5"
                  >
                    <X size={14} />
                    Reject
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Executed log */}
      <div>
        <SectionHeader title="Recent Activity" />
        <Card padding="none">
          {executed.length === 0 && (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No AI actions yet.</div>
          )}
          {executed.map(action => (
            <div key={action.id} className="flex items-start gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
              <div className="w-7 h-7 rounded-full bg-[var(--success-bg)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={13} className="text-[var(--success)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text)]">{action.preview}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock size={11} className="text-[var(--text-tertiary)]" />
                  <p className="text-[11px] text-[var(--text-tertiary)]">{action.created_at.split('T')[0]}</p>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${RISK_CONFIG[action.risk_level as keyof typeof RISK_CONFIG]?.color}`}>
                    {action.risk_level}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
