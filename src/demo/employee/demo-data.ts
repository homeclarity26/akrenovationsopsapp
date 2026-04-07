// Employee demo data — entirely client-side, no backend
// Phase L — replaces old Phase G demo

export const EMPLOYEE_DEMO_DATA = {
  employee: {
    name: 'Marcus',
    initials: 'MR',
    role: 'Lead Remodeler',
    start_date: 'Today is your first look at how we work',
  },

  projects: [
    {
      id: 'demo-p1',
      title: 'Henderson Kitchen Remodel',
      client: 'Tom & Dana Henderson',
      address: '1847 Ridgewood Dr, Stow OH 44224',
      phase: 'Cabinet Installation',
      percent_complete: 58,
      schedule_status: 'on_track' as const,
      color: '#1B2B4D',
    },
    {
      id: 'demo-p2',
      title: 'Carter Bathroom — Master Suite',
      client: 'Rachel Carter',
      address: '923 Elmhurst Ave, Hudson OH 44236',
      phase: 'Tile Work',
      percent_complete: 71,
      schedule_status: 'on_track' as const,
      color: '#B7410E',
    },
  ],

  todaySchedule: [
    {
      time: '7:00 AM',
      project: 'Henderson Kitchen',
      task: 'Upper cabinet install — finish run along east wall',
    },
    { time: '12:00 PM', project: 'Lunch', task: null as string | null },
    {
      time: '1:00 PM',
      project: 'Carter Bathroom',
      task: 'Floor tile grouting — master bath',
    },
  ],

  workTypes: [
    { id: 'field_carp', label: 'Field Carpentry', rate: '$85/hr', icon: 'hammer' },
    { id: 'tile', label: 'Tile Work', rate: '$85/hr', icon: 'grid' },
    { id: 'demo', label: 'Demo', rate: '$75/hr', icon: 'pickaxe' },
    { id: 'site_visit', label: 'Site Visit', rate: '$120/hr', icon: 'eye' },
    { id: 'finish', label: 'Finish Work', rate: '$95/hr', icon: 'paintbrush' },
    { id: 'cleanup', label: 'Cleanup', rate: '$65/hr', icon: 'broom' },
  ],

  shoppingList: [
    {
      item: 'Cabinet screws 2.5"',
      qty: '2 boxes',
      project: 'Henderson Kitchen',
      status: 'needed' as const,
      supplier: "Lowe's Pro — Stow",
      account: 'AKR-7842',
    },
    {
      item: 'Unsanded grout — Mapei Warm Gray',
      qty: '3 bags',
      project: 'Carter Bathroom',
      status: 'needed' as const,
      supplier: 'Floor & Decor — Fairlawn',
      account: 'AKR-2291',
    },
    {
      item: 'Painters tape 2"',
      qty: '4 rolls',
      project: 'Henderson Kitchen',
      status: 'purchased' as const,
      supplier: "Lowe's Pro — Stow",
      account: 'AKR-7842',
    },
  ],

  receipt: {
    vendor: "Lowe's — Stow",
    date: 'Today',
    total: '$47.82',
    items: [
      'Cabinet screws 2.5" 2pk — $18.40',
      'Wood shims 12pk — $6.99',
      'Thinset 50lb — $22.43',
    ],
    project: 'Henderson Kitchen Remodel',
    ai_extracted: true,
  },

  activeClockIn: {
    project: 'Henderson Kitchen Remodel',
    work_type: 'Field Carpentry',
    started_at: '7:02 AM',
    is_billable: true,
    rate: '$85/hr',
  },

  bonusTracker: {
    next_project: 'Henderson Kitchen',
    bonus_amount: 900,
    on_track: true,
    completion_target: 'Jun 28',
    days_remaining: 12,
  },

  photoCategories: [
    { id: 'demo', label: 'Demo' },
    { id: 'rough_in', label: 'Rough-In' },
    { id: 'progress', label: 'Progress' },
    { id: 'finish', label: 'Finish' },
    { id: 'issue', label: 'Issue' },
    { id: 'before_after', label: 'Before / After' },
  ],
}

export type EmployeeDemoData = typeof EMPLOYEE_DEMO_DATA
