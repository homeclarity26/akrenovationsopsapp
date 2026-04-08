// Shared demo image registry.
//
// Both demos (employee + homeowner) pull photos from here so there's one
// place to swap them out later — either to real AK Renovations job photos
// once they exist, or to DALL-E-generated AK-branded images.
//
// Current source: verified Unsplash URLs. All IDs were HEAD-checked with
// HTTP 200 before being added. See the audit history in the commit log.
//
// Each URL includes w=800&q=80&auto=format for fast mobile loads. Unsplash
// auto-serves WebP/AVIF when the browser supports it.

const U = (id: string, opts = 'w=800&q=80&auto=format') =>
  `https://images.unsplash.com/photo-${id}?${opts}`

// Narrower resolution for grid thumbnails (half the bytes)
const UT = (id: string, opts = 'w=400&q=75&auto=format') =>
  `https://images.unsplash.com/photo-${id}?${opts}`

// ── Kitchen photos (for Henderson + Sarah's kitchen) ────────────────────────

export const KITCHEN = {
  heroLuxury:      U('1556909114-f6e7ad7d3136'),   // Bright white luxury kitchen
  modernIsland:    U('1600585154340-be6161a56a0c'), // Marble island kitchen
  warmCabinets:    U('1556911220-e15b29be8c8f'),   // Warm wood cabinets
  emptyBright:     U('1565538810643-b5bdb714032a'), // Clean bright kitchen
  shakerCream:     U('1556912167-f556f1f39fdf'),   // Shaker-style cream cabinets
  counterDetail:   U('1522771739844-6a9f6d5f14af'), // Counter and backsplash detail
  fullViewFinish:  U('1556912173-46c336c7fd55'),   // Full finished kitchen
}

// ── Construction / in-progress photos (for employee Photos screen) ─────────

export const CONSTRUCTION = {
  framing:         U('1503594384566-461fe158e797'), // Framing / structure
  workerSite:      U('1504307651254-35680f356dfd'), // Worker on site
  cabinetInstall:  U('1558618666-fcd25c85cd64'),   // Cabinet install in progress
  tileWork:        U('1584622650111-993a426fbf0a'), // Tile work
  drywall:         U('1560448204-e02f11c3d0e2'),   // Drywall / rough-in
  progressScene:   U('1600210492486-724fe5c67fb0'), // Construction scene
  toolsBelt:       U('1597047084897-51e81819a499'), // Tools / work site
}

// ── Bathroom (for Carter bathroom references in employee demo) ─────────────

export const BATHROOM = {
  finishedMaster:  U('1552321554-5fefe8c9ef14'),   // Finished master bath
  shower:          U('1564540583246-934409427776'), // Walk-in shower
  vanity:          U('1620626011761-996317b8d101'), // Vanity + mirror
}

// ── Thumbnails for grid views ──────────────────────────────────────────────

export const THUMB = {
  kitchen1: UT('1556909114-f6e7ad7d3136'),
  kitchen2: UT('1600585154340-be6161a56a0c'),
  kitchen3: UT('1556911220-e15b29be8c8f'),
  kitchen4: UT('1565538810643-b5bdb714032a'),
  kitchen5: UT('1556912167-f556f1f39fdf'),
  kitchen6: UT('1556912173-46c336c7fd55'),
  const1:   UT('1503594384566-461fe158e797'),
  const2:   UT('1558618666-fcd25c85cd64'),
  const3:   UT('1584622650111-993a426fbf0a'),
  const4:   UT('1560448204-e02f11c3d0e2'),
}

// ── Sequence-ordered sets for "timeline" usage ─────────────────────────────

// Homeowner progress photo gallery — 6 photos in chronological order
// (before → demo → cabinets uppers → cabinets lowers → flooring → finished)
export const PROGRESS_SEQUENCE = [
  CONSTRUCTION.drywall,       // Before/empty state
  CONSTRUCTION.framing,       // Demo / rough
  KITCHEN.shakerCream,        // Cabinets uppers
  KITCHEN.warmCabinets,       // Cabinets lowers
  CONSTRUCTION.progressScene, // Flooring going in
  KITCHEN.heroLuxury,         // Finished
]

// Employee photos screen — 4 recent job photos
export const EMPLOYEE_RECENT_PHOTOS = [
  CONSTRUCTION.cabinetInstall,
  CONSTRUCTION.tileWork,
  CONSTRUCTION.progressScene,
  KITCHEN.warmCabinets,
]

// Weekly update attachments — 4 photos from "this week"
export const WEEKLY_UPDATE_PHOTOS = [
  KITCHEN.shakerCream,
  KITCHEN.counterDetail,
  KITCHEN.warmCabinets,
  CONSTRUCTION.progressScene,
]

// Before/after pair for completion screen
export const BEFORE_AFTER = {
  before: CONSTRUCTION.drywall,
  after:  KITCHEN.heroLuxury,
}
