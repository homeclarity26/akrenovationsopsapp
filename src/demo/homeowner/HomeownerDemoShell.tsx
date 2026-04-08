// Homeowner demo shell — orchestrates the 9-step Sarah Mitchell walkthrough.
// Public route. Pure client-side. Reuses the shared AIScene component.
//
// Behaviors:
//  - Scroll-to-top on every step change
//  - Keyboard shortcuts to advance (Space / Enter / →)
//  - Always-visible Next button in the footer
//  - AI scene uses "Skip" so the user can bypass typing

import { useEffect, useState } from 'react'
import { PhoneFrame } from '../shared/PhoneFrame'
import { DemoBanner, DemoPromptBar, DemoStage } from '../shared/DemoChrome'
import { AIScene } from '../shared/AIScene'
import {
  HOMEOWNER_DEMO_SCRIPT,
  HOMEOWNER_AI_FALLBACK,
} from './homeowner-script'
import type { HomeownerStep } from './homeowner-script'
import {
  ProposalOverviewScreen,
  ProposalSectionsScreen,
  PortalWelcomeScreen,
  SelectionsScreen,
  ProgressPhotosScreen,
  WeeklyUpdateScreen,
  CompletionScreen,
} from './screens'

const TOTAL = HOMEOWNER_DEMO_SCRIPT.length

function ScreenForStep({
  step,
  onAdvance,
}: {
  step: HomeownerStep
  onAdvance: () => void
}) {
  switch (step.screen) {
    case 'proposal_overview':
      return <ProposalOverviewScreen />
    case 'proposal_sections':
      return <ProposalSectionsScreen highlight={step.highlight} />
    case 'portal_welcome':
      return <PortalWelcomeScreen />
    case 'selections':
      return <SelectionsScreen highlight={step.highlight} />
    case 'progress_photos':
      return <ProgressPhotosScreen highlight={step.highlight} />
    case 'weekly_update':
      return <WeeklyUpdateScreen />
    case 'ai_scene':
      return (
        <AIScene
          systemPrompt={step.ai_system_prompt || ''}
          suggestedPrompt={step.suggested_prompt || ''}
          sceneDescription={step.scene_description || ''}
          fallbackResponse={HOMEOWNER_AI_FALLBACK}
          speakerLabel="AK Renovations"
          onComplete={onAdvance}
        />
      )
    case 'completion':
      return null
    default:
      return null
  }
}

export default function HomeownerDemoShell() {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)

  // Scroll-to-top on step change
  useEffect(() => {
    const scroller = document.querySelector('[data-demo-scroll]') as HTMLElement | null
    if (scroller) scroller.scrollTop = 0
  }, [index, done])

  if (done) {
    return (
      <PhoneFrame>
        <CompletionScreen
          onReplay={() => {
            setDone(false)
            setIndex(0)
          }}
        />
      </PhoneFrame>
    )
  }

  const step = HOMEOWNER_DEMO_SCRIPT[index]
  const isLast = index === HOMEOWNER_DEMO_SCRIPT.length - 1
  const isAIScene = !!step.is_ai_scene
  const isFirst = index === 0

  function advance() {
    if (isLast || step.is_final) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
    }
  }

  // The script includes a final "completion" screen step. Short-circuit to done.
  if (step.screen === 'completion') {
    return (
      <PhoneFrame>
        <CompletionScreen
          onReplay={() => {
            setDone(false)
            setIndex(0)
          }}
        />
      </PhoneFrame>
    )
  }

  const buttonLabel = isFirst
    ? 'Start'
    : isLast
      ? 'Finish'
      : isAIScene
        ? 'Skip'
        : 'Next'

  return (
    <PhoneFrame
      banner={
        <DemoBanner
          step={step.step}
          totalSteps={TOTAL}
          onExit={() => {
            setIndex(0)
            setDone(false)
          }}
        />
      }
      footer={
        <DemoPromptBar
          title={step.headline}
          body={step.subline}
          onAction={advance}
          buttonLabel={buttonLabel}
          pulse={!isAIScene}
        />
      }
    >
      <DemoStage>
        <ScreenForStep step={step} onAdvance={advance} />
      </DemoStage>
    </PhoneFrame>
  )
}
