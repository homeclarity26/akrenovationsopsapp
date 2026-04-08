import { useState } from 'react'
import { ArrowRight, ArrowLeft, Mic, Check, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { WALKTHROUGH_TEMPLATES } from '@/data/mock'

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

export function WalkthroughPage() {
  const [projectType, setProjectType] = useState<ProjectType | null>(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [textInput, setTextInput] = useState('')
  const [complete, setComplete] = useState(false)

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
  }

  // Completed state
  if (complete && projectType) {
    return (
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="text-center pt-8 pb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--success-bg)] flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-[var(--success)]" />
          </div>
          <h1 className="font-display text-2xl text-[var(--navy)] mb-2">Walkthrough Complete</h1>
          <p className="text-sm text-[var(--text-secondary)]">AI is generating your estimate and proposal draft</p>
        </div>

        {/* AI Output preview */}
        <Card className="bg-[var(--navy)] border-0">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-white" />
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">AI Summary</p>
          </div>
          <p className="text-white text-sm leading-relaxed">
            Based on your responses, this appears to be a full gut {projectType} remodel with custom tile, new fixtures, and full plumbing scope. Estimated range: <span className="font-semibold font-mono">$42K–$56K</span>. Proposal draft and material takeoff are being prepared.
          </p>
        </Card>

        {/* Labor benchmark preview (Phase K) */}
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
            Labor benchmarks pulled
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            AI will use labor benchmarks from your templates to size labor cost separately from sub costs.
          </p>
        </Card>

        {/* Preferred materials suggestions (Phase K) */}
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
            Preferred materials suggested
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            AI will cross-reference preferred materials from your templates library.
          </p>
        </Card>

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
            className="py-3.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold"
          >
            View Estimate
          </button>
          <button
            onClick={reset}
            className="py-3.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)]"
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
