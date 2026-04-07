// 9-step homeowner demo walkthrough script

export type HomeownerScreen =
  | 'intro'
  | 'proposal_overview'
  | 'proposal_sections'
  | 'portal_welcome'
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
  action_label: string | null
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
    screen: 'intro',
    headline: "What it's like to hire AK Renovations",
    subline:
      "You're about to experience the client side — from first contact to finished kitchen. This is Sarah's story. It could be yours.",
    action_label: "Start Sarah's project",
  },
  {
    step: 2,
    screen: 'proposal_overview',
    headline: 'You receive a real proposal',
    subline:
      "48 hours after the site visit, Sarah gets a detailed written proposal. Clear scope. Clear price. Sign from her phone.",
    action_label: 'See the full scope',
  },
  {
    step: 3,
    screen: 'proposal_sections',
    headline: 'Every detail spelled out',
    subline:
      "No vague line items. Every phase is documented — what we're doing, what materials, what's included. No surprises.",
    action_label: 'Sign the proposal',
    highlight: 'scope_sections',
  },
  {
    step: 4,
    screen: 'portal_welcome',
    headline: 'Your personal portal is ready',
    subline:
      "The moment Sarah signs, she gets access. Photos, schedule, selections, invoices — all in one place. No app to download.",
    action_label: 'Open the portal',
  },
  {
    step: 5,
    screen: 'selections',
    headline: 'Make your selections — at your own pace',
    subline:
      "Every material decision is tracked here. Sarah knows exactly what she's confirmed and what's still needed. No losing track of tile samples.",
    action_label: 'View progress photos',
    highlight: 'selections_list',
  },
  {
    step: 6,
    screen: 'progress_photos',
    headline: 'See your project every step of the way',
    subline:
      "Real photos from the job site, uploaded as work happens. Sarah can show her family, share with her designer, or just check in from work.",
    action_label: "Read this week's update",
    highlight: 'photo_gallery',
  },
  {
    step: 7,
    screen: 'weekly_update',
    headline: 'Every Friday — a real update',
    subline:
      'Not a generic "work is progressing" email. A specific, photo-backed summary of what happened this week and what is coming next.',
    action_label: 'Ask the AI a question',
  },
  {
    step: 8,
    screen: 'ai_scene',
    headline: 'Have a question? Just ask.',
    subline:
      "Sarah can ask about her project any time — no waiting for Adam to call back, no wondering if her question is too small to bother him with.",
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
    action_label: null,
    scene_description:
      "That's what communication looks like when your contractor uses AK Ops. Specific answers, any time, without playing phone tag.",
  },
  {
    step: 9,
    screen: 'completion',
    headline: 'Done. Documented. Delivered.',
    subline:
      'Project complete. Final walkthrough done. Sarah receives her photo reel and her 12-month warranty. The portal stays active — her project is documented forever.',
    action_label: null,
    is_final: true,
  },
]

export const HOMEOWNER_AI_FALLBACK =
  "Great question, Sarah. Your countertop template appointment is Tuesday June 24th. After template, fabrication runs about 2-3 weeks, so install will land around July 10-11. That keeps you on track for a July 18 completion — your kitchen should be fully functional by the 18th. I'll send you a reminder the day before each milestone."
