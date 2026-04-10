// 8-step homeowner demo walkthrough script.
//
// Narration style: warm and reassuring. Sarah's story. No "Tap X" instructions —
// the only action is the always-visible Next button in the footer.
//
// Step 1 is the portal welcome (previously step 4) so viewers land on the
// visual wow first. The old intro-with-metadata-card step was removed.

export type HomeownerScreen =
  | 'portal_welcome'
  | 'proposal_overview'
  | 'proposal_sections'
  | 'selections'
  | 'progress_photos'
  | 'weekly_update'
  | 'ai_scene'
  | 'completion'

export interface HomeownerStep {
  step: number
  screen: HomeownerScreen
  headline: string
  subline: string
  is_ai_scene?: boolean
  suggested_prompt?: string
  ai_system_prompt?: string
  scene_description?: string
  highlight?: string
  is_final?: boolean
}

export const HOMEOWNER_DEMO_SCRIPT: HomeownerStep[] = [
  {
    step: 1,
    screen: 'portal_welcome',
    headline: "This is what your portal feels like",
    subline:
      "Sarah Mitchell is 3 weeks into her kitchen remodel in Stow. Every detail of her project lives here — photos, schedule, selections, invoices, all in one place. Press Next to see the rest of her story.",
  },
  {
    step: 2,
    screen: 'proposal_overview',
    headline: 'It started with a real proposal',
    subline:
      "48 hours after the site visit, Sarah received a detailed written proposal. Clear scope, clear price, signable from her phone. No back-of-envelope number.",
  },
  {
    step: 3,
    screen: 'proposal_sections',
    headline: 'Every detail spelled out',
    subline:
      "No vague line items. Every phase is documented — what we're doing, what materials, what's included. No surprises once the work starts.",
    highlight: 'scope_sections',
  },
  {
    step: 4,
    screen: 'selections',
    headline: 'Make your selections on your own time',
    subline:
      "Every material decision is tracked here. Sarah knows what's confirmed and what's still needed. No losing track of tile samples or cabinet finishes.",
    highlight: 'selections_list',
  },
  {
    step: 5,
    screen: 'progress_photos',
    headline: 'Watch your project come together',
    subline:
      "Real photos from the job, uploaded as work happens. Sarah can show her family, share with her designer, or just check in during her lunch break.",
    highlight: 'photo_gallery',
  },
  {
    step: 6,
    screen: 'weekly_update',
    headline: 'A real Friday update, every week',
    subline:
      "Not a generic 'work is progressing' email. A specific, photo-backed summary of what happened this week and what's coming next.",
  },
  {
    step: 7,
    screen: 'ai_scene',
    headline: 'Have a question? Just ask.',
    subline:
      "Try it: ask about timeline, a selection, anything. Or press Skip. The real version answers you instantly, day or night, without bothering Adam.",
    is_ai_scene: true,
    suggested_prompt:
      'When will the countertops be installed? I want to plan when I can have my kitchen back.',
    ai_system_prompt: `You are the AK Renovations client portal AI assistant. You are talking with Sarah Mitchell, a homeowner who has a kitchen remodel in progress.

Project context:
- Kitchen remodel at 2841 Maple Ridge Dr, Stow OH 44224
- Started: June 2, 2025
- Target completion: July 18, 2025
- Current status: Week 3 of 7 — cabinets fully installed, flooring starts Monday Jun 23
- Countertop template appointment: Tuesday June 24
- Countertop lead time: typically 2-3 weeks after template
- Estimated countertop install: July 10-11
- After countertops: backsplash tile (2 days), final plumbing and electrical (1 day), punch list
- On schedule for July 18 completion

Answer Sarah's question warmly and specifically. Give her a real timeline she can plan around. Sound like a knowledgeable contractor's assistant — helpful, specific, reassuring. Max 3-4 sentences.`,
    scene_description:
      "That's what communication looks like when your contractor uses TradeOffice AI. Specific answers, any time, without playing phone tag.",
  },
  {
    step: 8,
    screen: 'completion',
    headline: 'Done. Documented. Delivered.',
    subline:
      "Project complete, final walkthrough done, 12-month warranty in place. Sarah keeps her portal active — her project is documented forever.",
    is_final: true,
  },
]

export const HOMEOWNER_AI_FALLBACK =
  "Great question, Sarah. Your countertop template appointment is Tuesday June 24. After template, fabrication runs about 2-3 weeks, so install will land around July 10-11. That keeps you on track for a July 18 completion — your kitchen should be fully functional by the 18th. I'll send you a reminder the day before each milestone."
