// Employee demo shell — orchestrates the 13-step walkthrough.
// Public route. Zero auth, zero supabase.
//
// Behaviors:
//  - Scroll-to-top on every step change (so tall screens never strand the user)
//  - Keyboard shortcuts (Space / Enter / →) to advance
//  - Always-visible Next button in the footer (handled by DemoPromptBar)
//  - On AI scenes, the footer button becomes "Skip →" so users can bail if
//    they don't want to type — or they can ask the AI and the inline
//    continue button in AIScene will advance them
//  - On the final step, button becomes "Finish →"

import { useEffect, useState } from 'react'
import { PhoneFrame } from '../shared/PhoneFrame'
import { DemoBanner, DemoPromptBar, DemoStage } from '../shared/DemoChrome'
import { AIScene } from '../shared/AIScene'
import { EMPLOYEE_DEMO_SCRIPT, EMPLOYEE_AI_FALLBACKS } from './demo-script'
import type { DemoStep } from './demo-script'
import {
  WelcomeScreen,
  LaunchpadScreen,
  ScheduleScreen,
  TimeClockProjectSelectScreen,
  TimeClockWorkTypeScreen,
  TimeClockActiveScreen,
  ReceiptScannerScreen,
  ReceiptConfirmScreen,
  ShoppingListScreen,
  PhotosScreen,
  BonusTrackerScreen,
  CompletionScreen,
} from './screens'

const TOTAL = EMPLOYEE_DEMO_SCRIPT.length

function ScreenForStep({
  step,
  onAdvance,
}: {
  step: DemoStep
  onAdvance: () => void
}) {
  switch (step.screen) {
    case 'welcome':
      return <WelcomeScreen />
    case 'launchpad':
      return <LaunchpadScreen highlight={step.highlight} />
    case 'schedule':
      return <ScheduleScreen highlight={step.highlight} />
    case 'time_clock_project_select':
      return <TimeClockProjectSelectScreen highlight={step.highlight} />
    case 'time_clock_work_type':
      return <TimeClockWorkTypeScreen highlight={step.highlight} />
    case 'time_clock_active':
      return <TimeClockActiveScreen highlight={step.highlight} />
    case 'receipt_scanner':
      return <ReceiptScannerScreen highlight={step.highlight} />
    case 'receipt_confirm':
      return <ReceiptConfirmScreen highlight={step.highlight} />
    case 'shopping_list':
      return <ShoppingListScreen highlight={step.highlight} />
    case 'photos':
      return <PhotosScreen highlight={step.highlight} />
    case 'bonus_tracker':
      return <BonusTrackerScreen highlight={step.highlight} />
    case 'ai_scene_1':
    case 'ai_scene_2': {
      const fallback =
        EMPLOYEE_AI_FALLBACKS[
          step.ai_scene_type as 'field_question' | 'change_order'
        ]
      return (
        <AIScene
          systemPrompt={step.ai_system_prompt || ''}
          suggestedPrompt={step.suggested_prompt || ''}
          sceneDescription={step.scene_description || ''}
          fallbackResponse={fallback}
          onComplete={onAdvance}
        />
      )
    }
    default:
      return null
  }
}

export default function EmployeeDemoShell() {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)

  // Scroll-to-top on every step change. Find the scroll container inside
  // PhoneFrame (marked with data-demo-scroll) and reset its scrollTop.
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

  const step = EMPLOYEE_DEMO_SCRIPT[index]
  const isLast = index === EMPLOYEE_DEMO_SCRIPT.length - 1
  const isAIScene = !!step.is_ai_scene
  const isFirst = index === 0

  function advance() {
    if (isLast) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
    }
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
          title={step.title}
          body={step.explanation}
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
