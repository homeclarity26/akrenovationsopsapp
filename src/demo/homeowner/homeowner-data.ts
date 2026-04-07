// Homeowner demo data — Sarah Mitchell persona, kitchen remodel
// Pure client-side mock. No backend.

export const HOMEOWNER_DEMO_DATA = {
  client: {
    name: 'Sarah Mitchell',
    address: '2841 Maple Ridge Dr, Stow OH 44224',
    project: 'Kitchen Remodel',
    contract_value: '$54,800',
    start_date: 'June 2, 2025',
    completion_date: 'July 18, 2025',
  },

  proposal_sections: [
    {
      title: 'Demo & Preparation',
      items: [
        'Remove existing cabinets, countertops, and flooring',
        'Protect adjacent areas and hardwood floors',
        'Haul all debris — clean site maintained throughout',
      ],
    },
    {
      title: 'Cabinet Installation',
      items: [
        'Install new Shaker-style cabinets — Antique White',
        'Crown molding on uppers, soft-close hardware throughout',
        'Custom pull-out shelving in lower cabinets',
      ],
    },
    {
      title: 'Countertops & Backsplash',
      items: [
        'Quartz countertops — Cambria Brittanicca Warm',
        '3x6 subway tile backsplash — Bright White, stacked bond pattern',
        'Under-mount stainless sink with Moen Arbor faucet',
      ],
    },
    {
      title: 'Flooring',
      items: [
        'LVP flooring — Shaw Flintwood in Weathered Chestnut',
        'Transition to existing hardwood in dining room',
      ],
    },
    {
      title: 'Electrical & Lighting',
      items: [
        'Under-cabinet LED lighting',
        'Recessed lighting — 6 cans on dimmer',
        'New outlet placement per code',
      ],
    },
  ],

  payment_schedule: [
    { milestone: 'Contract signing', amount: '$16,440', status: 'paid' as const, date: 'May 28' },
    { milestone: 'Demo complete & rough-in', amount: '$16,440', status: 'paid' as const, date: 'Jun 9' },
    { milestone: 'Cabinet installation', amount: '$13,700', status: 'pending' as const, date: 'Jul 1' },
    { milestone: 'Final completion', amount: '$8,220', status: 'upcoming' as const, date: 'Jul 18' },
  ],

  selections: [
    { item: 'Cabinet color', choice: 'Antique White — confirmed', status: 'confirmed' as const },
    { item: 'Countertop material', choice: 'Cambria Brittanicca Warm', status: 'confirmed' as const },
    { item: 'Backsplash tile', choice: '3x6 Subway — Bright White', status: 'confirmed' as const },
    { item: 'Flooring', choice: 'Shaw Flintwood — Weathered Chestnut', status: 'confirmed' as const },
    { item: 'Faucet', choice: 'Moen Arbor — Spot Resist Stainless', status: 'confirmed' as const },
    { item: 'Hardware', choice: 'Brushed nickel bar pull 5"', status: 'pending' as const },
  ],

  weekly_update: {
    week: 'Week 3 — June 16–20',
    summary:
      "Big week on your kitchen, Sarah. Cabinets are fully installed and they look incredible — the Antique White against your existing floors is exactly what we envisioned. Uppers and lowers are done, crown molding is on, and the countertop template appointment is confirmed for Tuesday the 24th. Flooring starts Monday. You're on schedule for a July 18 completion.",
    photos_this_week: 4,
    next_week:
      'Flooring installation Mon–Tue, countertop template appointment Tue the 24th',
  },

  photos: [
    { phase: 'Before', label: 'Original kitchen', date: 'Jun 2' },
    { phase: 'Demo', label: 'Demo complete', date: 'Jun 5' },
    { phase: 'Cabinets', label: 'Uppers installed', date: 'Jun 16' },
    { phase: 'Cabinets', label: 'Lowers and hardware', date: 'Jun 18' },
    { phase: 'Flooring', label: 'LVP installation', date: 'Jun 23' },
    { phase: 'After', label: 'Completed kitchen', date: 'Jul 18' },
  ],

  portal_tabs: [
    { id: 'progress', label: 'Progress' },
    { id: 'photos', label: 'Photos' },
    { id: 'selections', label: 'Selections' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'messages', label: 'Messages' },
    { id: 'docs', label: 'Documents' },
    { id: 'schedule', label: 'Schedule' },
  ],
}

export type HomeownerDemoData = typeof HOMEOWNER_DEMO_DATA
