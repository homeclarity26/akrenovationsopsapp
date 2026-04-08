// Shared demo image registry.
//
// These are AK-branded photos generated via Gemini 2.5 Flash Image using
// chained reference generation — each kitchen progression photo used the
// previous image as a reference so the same space is visible throughout.
//
// Images are stored as static JPGs in public/demo/photos/ and served from
// Vercel's edge CDN. No runtime API calls. No third-party hosts. No CSP
// config needed beyond 'self'.
//
// If you ever want to regenerate: see /tmp/generate-demo-images.mjs (was
// used for the initial batch) and the anchored prompts in that script.

const P = '/demo/photos'

// ── Sarah's house (portal welcome hero) ────────────────────────────────────

export const HOUSE = {
  exterior: `${P}/sarah-house.jpg`,
}

// ── Kitchen photos — 6-photo progression of Sarah's same kitchen ──────────

export const KITCHEN = {
  original:  `${P}/kitchen-01-original.jpg`,  // 1990s dated oak
  demo:      `${P}/kitchen-02-demo.jpg`,      // gutted to studs
  uppers:    `${P}/kitchen-03-uppers.jpg`,    // uppers only installed
  lowers:    `${P}/kitchen-04-lowers.jpg`,    // full cabinets, no counters
  flooring:  `${P}/kitchen-05-flooring.jpg`,  // LVP install in progress
  complete:  `${P}/kitchen-06-complete.jpg`,  // finished with quartz + subway
}

// ── Employee demo — Henderson Kitchen active worksite ─────────────────────

export const EMPLOYEE_JOB = {
  progress: `${P}/emp-01-progress.jpg`,  // Wide shot of cabinet install
  roughin:  `${P}/emp-02-roughin.jpg`,   // Plumbing/electrical detail
  finish:   `${P}/emp-03-finish.jpg`,    // Crown molding close-up
  issue:    `${P}/emp-04-issue.jpg`,     // Water damage behind cabinet
}

// ── Sequence-ordered sets for "timeline" usage ─────────────────────────────

// Homeowner progress photo gallery — 6 photos in chronological order
// Maps to the 6 entries in HOMEOWNER_DEMO_DATA.photos
export const PROGRESS_SEQUENCE = [
  KITCHEN.original,   // "Original kitchen" · Jun 2
  KITCHEN.demo,       // "Demo complete" · Jun 5
  KITCHEN.uppers,     // "Uppers installed" · Jun 16
  KITCHEN.lowers,     // "Lowers and hardware" · Jun 18
  KITCHEN.flooring,   // "LVP installation" · Jun 23
  KITCHEN.complete,   // "Completed kitchen" · Jul 18
]

// Employee photos screen — 4 recent job photos (same kitchen, different phases)
export const EMPLOYEE_RECENT_PHOTOS = [
  EMPLOYEE_JOB.progress,
  EMPLOYEE_JOB.roughin,
  EMPLOYEE_JOB.finish,
  EMPLOYEE_JOB.issue,
]

// Weekly update attachments — 4 photos from "this week" (the cabinet install phase)
export const WEEKLY_UPDATE_PHOTOS = [
  KITCHEN.uppers,
  KITCHEN.lowers,
  EMPLOYEE_JOB.finish,
  EMPLOYEE_JOB.progress,
]

// Before/after pair for completion screen
export const BEFORE_AFTER = {
  before: KITCHEN.original,
  after:  KITCHEN.complete,
}

// Hero thumbnail used inside the portal welcome "currently" card
export const CURRENT_PHASE_THUMB = KITCHEN.uppers
