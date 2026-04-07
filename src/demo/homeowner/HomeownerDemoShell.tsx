// Homeowner demo shell — orchestrates the 9-step Sarah Mitchell walkthrough.
// Public route. Pure client-side. Reuses the shared AIScene component.

import { useState } from 'react'
import { PhoneFrame } from '../shared/PhoneFrame'
import { DemoBanner, DemoPromptBar, DemoStage } from '../shared/DemoChrome'
import { AIScene } from '../shared/AIScene'
import {
  HOMEOWNER_DEMO_SCRIPT,
  HOMEOWNER_AI_FALLBACK,
} from './homeowner-script'
import type { HomeownerStep } from './homeowner-script'
import {
  IntroScreen,
  ProposalOverviewScreen,
  ProposalSectionsScreen,
  PortalWelcomeScreen,
  SelectionsScreen,
  ProgressPhotosScreen,
  WeeklyUpdateScreen,
  CompletionScreen,
} from './screens'

const TOTAL = HOMEOWNER_DEMO_SCRIPT.length // 9

function ScreenForStep({
  step,
  onAdvance,
}: {
  step: HomeownerStep
  onAdvance: () => void
}) {
  switch (step.screen) {
    case 'intro':
      return <IntroScreen />
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

  function advance() {
    if (isLast || step.is_final) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
    }
  }

  // The completion step is shown via the "done" branch but the script also
  // includes a final completion step — short-circuit to the done view when
  // we hit it.
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
          actionLabel={step.action_label}
          onAction={advance}
          hideAction={isAIScene}
        />
      }
    >
      <DemoStage>
        <ScreenForStep step={step} onAdvance={advance} />
      </DemoStage>
    </PhoneFrame>
  )
}
