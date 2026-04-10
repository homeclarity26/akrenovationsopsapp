import { useState } from 'react'
import { ArrowRight, ArrowLeft, Mic, Check, Sparkles, Loader2, DollarSign, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { WALKTHROUGH_TEMPLATES } from '@/data/mock'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type ProjectType = 'bathroom' | 'kitchen' | 'basement' | 'addition'

const PROJECT_TYPES: { id: ProjectType; label: string; emoji: string }[] = [
  { id: 'bathroom', label: 'Bathroom',  emoji: '🚿' },
  { id: 'kitchen',  label: 'Kitchen',   emoji: '🍳' },
  { id: 'basement', label: 'Basement',  emoji: '🏠' },
  { id: 'addition', label: 'Addition',  emoji: '🏗️' },
]

interface Answer {
  question: string
  answer: string
}

interface EstimateLineItem {
  category: string
  item_name: string
  description: string
  quantity: number
  unit: string
  unit_cost: number
  total: number
}

interface PaymentMilestone {
  milestone: string
  percent: number
  amount: number
}

interface EstimateResult {
  success: boolean
  estimate_id?: string
  proposal_id?: string
  summary?: string
  finish_level?: string
  estimated_duration_weeks?: number
  line_items?: EstimateLineItem[]
  subtotal?: number
  contingency_percent?: number
  contingency_amount?: number
  total_estimated_cost?: number
  margin_percent?: number
  total_proposed_price?: number
  payment_schedule?: PaymentMilestone[]
  error?: string
}

export function WalkthroughPage() {
  const navigate = useNavigate()
  const [projectType, setProjectType] = useState<ProjectType | null>(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [textInput, setTextInput] = useState('')
  const [complete, setComplete] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const questions = projectType ? WALKTHROUGH_TEMPLATES[projectType] : []
  const current = questions[step]

  const answer = (value: string) => {
    const newAnswers = [...answers.slice(0, step), { question: current.question, answer: value }]
    setAnswers(newAnswers)
    if (step + 1 >= questions.length) {
      setComplete(true)
    } else {
      setStep(s => s + 1)
      setTextInput('')
    }
  }

  const goBack = () => {
    if (step === 0) {
      setProjectType(null)
      setStep(0)
      setAnswers([])
    } else {
      setStep(s => s - 1)
    }
  }

  const reset = () => {
    setProjectType(null)
    setStep(0)
    setAnswers([])
    setTextInput('')
    setComplete(false)
    setGenerating(false)
    setEstimate(null)
    setEstimateError(null)
    setExpandedCategories(new Set())
  }

  const generateEstimate = async () => {
    if (!projectType) return
    setGenerating(true)
    setEstimateError(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? supabaseKey

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_type: projectType,
          walkthrough_answers: answers,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const data: EstimateResult = await res.json()
      if (data.success) {
        setEstimate(data)
      } else {
        setEstimateError(data.error || 'Failed to generate estimate')
      }
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : 'Failed to connect to AI')
    } finally {
      setGenerating(false)
    }
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Group line items by category
  const groupedLineItems = (estimate?.line_items ?? []).reduce<Record<string, EstimateLineItem[]>>((acc, li) => {
    const cat = li.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(li)
    return acc
  }, {})

  // Estimate generated — show full result
  if (complete && projectType && estimate) {
    return (
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="text-center pt-6 pb-2">
          <div className="w-16 h-16 rounded-full bg-[var(--success-bg)] flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-[var(--success)]" />
          </div>
          <h1 className="font-display text-2xl text-[var(--navy)] mb-2">Estimate Ready</h1>
          <p className="text-sm text-[var(--text-secondary)]">{estimate.summary}</p>
        </div>

        {/* Price + Duration header */}
        <Card className="bg-[var(--navy)] border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">Proposed Price</p>
              <p className="text-white font-mono text-2xl font-bold">${(estimate.total_proposed_price ?? 0).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">Duration</p>
              <div className="flex items-center gap-1 text-white">
                <Clock size={14} />
                <span className="font-semibold">{estimate.estimated_duration_weeks ?? '—'} weeks</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
            <div className="text-xs text-white/60">
              Est. Cost: <span className="text-white font-mono">${(estimate.total_estimated_cost ?? 0).toLocaleString()}</span>
            </div>
            <div className="text-xs text-white/60">
              Margin: <span className="text-white font-mono">{estimate.margin_percent ?? 38}%</span>
            </div>
            <div className="text-xs text-white/60">
              Level: <span className="text-white capitalize">{(estimate.finish_level ?? 'mid_range').replace('_', ' ')}</span>
            </div>
          </div>
        </Card>

        {/* Line items by category */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            <DollarSign size={11} className="inline mr-1" />
            Estimate Line Items
          </p>
          {Object.entries(groupedLineItems).map(([category, items]) => {
            const catTotal = items.reduce((sum, li) => sum + li.total, 0)
            const isExpanded = expandedCategories.has(category)
            return (
              <Card key={category} padding="none">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp size={14} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={14} className="text-[var(--text-tertiary)]" />}
                    <span className="font-semibold text-sm text-[var(--text)]">{category}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">({items.length} items)</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-[var(--text)]">${catTotal.toLocaleString()}</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-[var(--border-light)]">
                    {items.map((li, j) => (
                      <div key={j} className="flex items-start justify-between px-3 py-2.5 border-b border-[var(--border-light)] last:border-0">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="text-sm font-medium text-[var(--text)]">{li.item_name}</p>
                          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{li.description}</p>
                          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            {li.quantity} {li.unit} x ${li.unit_cost.toLocaleString()}/{li.unit}
                          </p>
                        </div>
                        <p className="font-mono text-sm text-[var(--text)] flex-shrink-0">${li.total.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {/* Totals */}
        <Card>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Subtotal</span>
              <span className="font-mono font-medium">${(estimate.subtotal ?? 0).toLocaleString()}</span>
            </div>
            {(estimate.contingency_amount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Contingency ({estimate.contingency_percent}%)</span>
                <span className="font-mono font-medium">${(estimate.contingency_amount ?? 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-[var(--border-light)]">
              <span className="text-[var(--text-secondary)]">Estimated Cost</span>
              <span className="font-mono font-bold">${(estimate.total_estimated_cost ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-[var(--text)]">Proposed Price ({estimate.margin_percent}% margin)</span>
              <span className="font-mono font-bold text-[var(--navy)]">${(estimate.total_proposed_price ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Payment schedule */}
        {(estimate.payment_schedule ?? []).length > 0 && (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Payment Schedule</p>
            <div className="space-y-2">
              {estimate.payment_schedule!.map((pm, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[var(--navy)] text-white flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
                    <span className="text-sm text-[var(--text)]">{pm.milestone}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-medium">${pm.amount.toLocaleString()}</span>
                    <span className="text-xs text-[var(--text-tertiary)] ml-1">({pm.percent}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pb-8">
          {estimate.proposal_id && (
            <button
              onClick={() => navigate('/admin/proposals')}
              className="py-3.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold"
            >
              View Proposal
            </button>
          )}
          <button
            onClick={reset}
            className={`py-3.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] ${!estimate.proposal_id ? 'col-span-2' : ''}`}
          >
            Start New
          </button>
        </div>
      </div>
    )
  }

  // Completed state — walkthrough done, ready to generate
  if (complete && projectType) {
    return (
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="text-center pt-8 pb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--success-bg)] flex items-center justify-center mx-auto mb-4">
            {generating ? (
              <Loader2 size={28} className="text-[var(--navy)] animate-spin" />
            ) : (
              <Check size={28} className="text-[var(--success)]" />
            )}
          </div>
          <h1 className="font-display text-2xl text-[var(--navy)] mb-2">Walkthrough Complete</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {generating ? 'AI is generating your estimate and proposal draft...' : 'Ready to generate your estimate with AI.'}
          </p>
        </div>

        {/* AI Output preview */}
        <Card className="bg-[var(--navy)] border-0">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-white" />
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">AI Summary</p>
          </div>
          <p className="text-white text-sm leading-relaxed">
            Based on your responses, this appears to be a full gut {projectType} remodel. Hit "Generate Estimate" to get detailed line items, pricing, and a proposal draft powered by AI.
          </p>
        </Card>

        {estimateError && (
          <Card className="border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{estimateError}</p>
            <p className="text-xs text-red-500 mt-1">Please try again or check your connection.</p>
          </Card>
        )}

        {/* Answers review */}
        <div className="space-y-2">
          {answers.map((a, i) => (
            <div key={i} className="flex gap-3 p-3 bg-[var(--white)] rounded-xl border border-[var(--border-light)]">
              <div className="w-5 h-5 rounded-full bg-[var(--navy)] text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-0.5">{a.question}</p>
                <p className="text-sm font-medium text-[var(--text)]">{a.answer}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 pb-8">
          <button
            onClick={generateEstimate}
            disabled={generating}
            className="py-3.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Estimate'
            )}
          </button>
          <button
            onClick={reset}
            disabled={generating}
            className="py-3.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] disabled:opacity-40"
          >
            Start New
          </button>
        </div>
      </div>
    )
  }

  // Project type selection
  if (!projectType) {
    return (
      <div className="p-4 space-y-5 max-w-md mx-auto">
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-[var(--navy)]" />
            <h1 className="font-display text-2xl text-[var(--navy)]">AI Site Walk</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">Select the project type to begin the guided interview.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PROJECT_TYPES.map(pt => (
            <button
              key={pt.id}
              onClick={() => { setProjectType(pt.id); setStep(0); setAnswers([]) }}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-[var(--white)] border border-[var(--border-light)] active:scale-95 transition-all hover:border-[var(--navy)]"
            >
              <span className="text-3xl">{pt.emoji}</span>
              <span className="font-semibold text-sm text-[var(--text)]">{pt.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Interview in progress
  const progress = ((step) / questions.length) * 100

  return (
    <div className="p-4 space-y-5 max-w-md mx-auto">
      {/* Progress */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <button onClick={goBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
            <ArrowLeft size={15} />
            Back
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">{step + 1} of {questions.length}</span>
        </div>
        <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--navy)] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}
      {current && (
        <>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-[var(--navy)] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {step + 1}
              </div>
              <p className="font-semibold text-[var(--text)] leading-tight">{current.question}</p>
            </div>
          </div>

          {/* Answers */}
          {current.type === 'choice' && current.options && (
            <div className="space-y-2">
              {current.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => answer(opt)}
                  className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-[var(--white)] border border-[var(--border-light)] text-left active:scale-[0.98] transition-all hover:border-[var(--navy)]"
                >
                  <span className="text-sm text-[var(--text)]">{opt}</span>
                  <ArrowRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {current.type === 'text' && (
            <div className="space-y-3">
              <textarea
                className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] text-sm bg-[var(--white)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] resize-none"
                rows={4}
                placeholder="Type your notes here..."
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => answer(textInput || 'No additional notes')}
                  className="flex-1 py-3.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight size={15} />
                </button>
                <button className="w-12 h-12 rounded-xl border border-[var(--border)] flex items-center justify-center">
                  <Mic size={18} className="text-[var(--text-tertiary)]" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Previous answers */}
      {answers.length > 0 && (
        <div className="pt-2 border-t border-[var(--border-light)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">So far</p>
          <div className="space-y-1.5">
            {answers.slice(-3).map((a, i) => (
              <div key={i} className="flex gap-2 items-baseline">
                <Check size={12} className="text-[var(--success)] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--text-secondary)]">
                  <span className="text-[var(--text-tertiary)]">{a.question.split('?')[0]}?</span>
                  {' '}
                  <span className="font-medium text-[var(--text)]">{a.answer}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
