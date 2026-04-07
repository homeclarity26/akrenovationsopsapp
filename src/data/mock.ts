// ── Mock Users ───────────────────────────────────────────────────────────────
export const MOCK_USERS = [
  { id: 'admin-1',    role: 'admin'    as const, full_name: 'Adam Kilgore',           email: 'adam@akrenovations.com',  avatar_url: null },
  { id: 'employee-1', role: 'employee' as const, full_name: 'Jeff Miller',            email: 'jeff@akrenovations.com',  avatar_url: null },
  { id: 'employee-2', role: 'employee' as const, full_name: 'Steven Clark',           email: 'steven@akrenovations.com',avatar_url: null },
  { id: 'client-1',   role: 'client'   as const, full_name: 'Michael & Sarah Johnson',email: 'johnson@email.com',       avatar_url: null },
]

// ── Mock Projects ─────────────────────────────────────────────────────────────
export const MOCK_PROJECTS = [
  {
    id: 'proj-1',
    title: 'Johnson Master Bath Remodel',
    project_type: 'bathroom',
    client_name: 'Michael & Sarah Johnson',
    client_email: 'johnson@email.com',
    client_phone: '(330) 555-0188',
    address: '142 Maple Ridge Drive, Hudson, OH 44236',
    contract_value: 48500,
    estimated_cost: 29000,
    actual_cost: 28200,
    status: 'active' as const,
    schedule_status: 'on_track' as const,
    percent_complete: 62,
    current_phase: 'Tile & Fixtures',
    estimated_start_date: '2026-03-10',
    target_completion_date: '2026-05-15',
    estimated_duration_weeks: 10,
    actual_margin: 0.419,
    target_margin: 0.38,
    bonus_eligible: true,
    warranty_months: 12,
    geofence_lat: 41.2400,
    geofence_lng: -81.4400,
  },
  {
    id: 'proj-2',
    title: 'Thompson Kitchen Addition',
    project_type: 'addition',
    client_name: 'Dave & Lisa Thompson',
    client_email: 'thompson@email.com',
    client_phone: '(330) 555-0142',
    address: '88 Crestwood Lane, Stow, OH 44224',
    contract_value: 124000,
    estimated_cost: 78000,
    actual_cost: 61000,
    status: 'active' as const,
    schedule_status: 'at_risk' as const,
    percent_complete: 38,
    current_phase: 'Framing & Rough-In',
    estimated_start_date: '2026-02-15',
    target_completion_date: '2026-07-01',
    estimated_duration_weeks: 20,
    actual_margin: 0.347,
    target_margin: 0.38,
    bonus_eligible: true,
    warranty_months: 12,
    geofence_lat: 41.1600,
    geofence_lng: -81.4400,
  },
  {
    id: 'proj-3',
    title: 'Martinez Basement Finish',
    project_type: 'basement',
    client_name: 'Carlos & Ana Martinez',
    client_email: 'martinez@email.com',
    client_phone: '(234) 555-0201',
    address: '2210 Summit Circle, Cuyahoga Falls, OH 44221',
    contract_value: 67000,
    estimated_cost: 41000,
    actual_cost: 0,
    status: 'pending' as const,
    schedule_status: 'on_track' as const,
    percent_complete: 0,
    current_phase: 'Pre-Construction',
    estimated_start_date: '2026-05-01',
    target_completion_date: '2026-08-30',
    estimated_duration_weeks: 18,
    actual_margin: null,
    target_margin: 0.38,
    bonus_eligible: true,
    warranty_months: 12,
    geofence_lat: 41.1300,
    geofence_lng: -81.4850,
  },
  {
    id: 'proj-4',
    title: 'Williams Guest Bath',
    project_type: 'bathroom',
    client_name: 'Tom & Karen Williams',
    client_email: 'williams@email.com',
    client_phone: '(330) 555-0317',
    address: '554 Birchwood Dr, Tallmadge, OH 44278',
    contract_value: 22800,
    estimated_cost: 14500,
    actual_cost: 14600,
    status: 'complete' as const,
    schedule_status: 'on_track' as const,
    percent_complete: 100,
    current_phase: 'Complete',
    estimated_start_date: '2026-02-01',
    target_completion_date: '2026-03-20',
    estimated_duration_weeks: 7,
    actual_margin: 0.361,
    target_margin: 0.38,
    bonus_eligible: true,
    warranty_months: 12,
    geofence_lat: 41.1022,
    geofence_lng: -81.4339,
  },
]

// ── Project Phases ────────────────────────────────────────────────────────────
export const MOCK_PHASES: Record<string, { name: string; status: 'complete'|'active'|'upcoming'; pct: number }[]> = {
  'proj-1': [
    { name: 'Demo & Prep',        status: 'complete',  pct: 100 },
    { name: 'Plumbing Rough-In',  status: 'complete',  pct: 100 },
    { name: 'Board & Waterproof', status: 'complete',  pct: 100 },
    { name: 'Tile & Fixtures',    status: 'active',    pct: 45  },
    { name: 'Vanity & Hardware',  status: 'upcoming',  pct: 0   },
    { name: 'Punch List',         status: 'upcoming',  pct: 0   },
  ],
  'proj-2': [
    { name: 'Demo & Excavation',  status: 'complete',  pct: 100 },
    { name: 'Foundation',         status: 'complete',  pct: 100 },
    { name: 'Framing',            status: 'active',    pct: 60  },
    { name: 'Rough-In MEP',       status: 'upcoming',  pct: 0   },
    { name: 'Insulation & Board', status: 'upcoming',  pct: 0   },
    { name: 'Finishes',           status: 'upcoming',  pct: 0   },
    { name: 'Punch List',         status: 'upcoming',  pct: 0   },
  ],
}

// ── Mock Leads ────────────────────────────────────────────────────────────────
export const MOCK_LEADS = [
  {
    id: 'lead-1',
    full_name: 'Robert & Michelle Davis',
    email: 'rdavis@email.com',
    phone: '(330) 555-0219',
    address: '775 Oakdale Ave, Akron, OH 44310',
    project_type: 'kitchen',
    stage: 'consultation' as const,
    estimated_value: 85000,
    next_action: 'Site walk scheduled',
    next_action_date: '2026-04-10',
    days_in_stage: 3,
    source: 'referral',
    notes: 'Referred by the Johnsons. Full kitchen gut and island addition.',
    activities: [
      { type: 'note',    desc: 'Initial inquiry received via website',         date: '2026-04-01', by: 'Adam' },
      { type: 'call',    desc: 'Spoke with Robert — interested in full remodel',date: '2026-04-02', by: 'Adam' },
      { type: 'meeting', desc: 'Consultation scheduled for Apr 10',            date: '2026-04-03', by: 'Adam' },
    ],
  },
  {
    id: 'lead-2',
    full_name: 'Brian & Kelly Foster',
    email: 'bfoster@email.com',
    phone: '(330) 555-0388',
    address: '1901 Highland Blvd, Hudson, OH 44236',
    project_type: 'addition',
    stage: 'proposal_sent' as const,
    estimated_value: 215000,
    next_action: 'Follow up on proposal',
    next_action_date: '2026-04-08',
    days_in_stage: 8,
    source: 'google_ads',
    notes: '4-season sunroom addition, 600 sqft. Client is comparing 2 other bids.',
    activities: [
      { type: 'call',    desc: 'Initial call — sunroom addition inquiry',       date: '2026-03-20', by: 'Adam' },
      { type: 'meeting', desc: 'Site walk completed',                           date: '2026-03-25', by: 'Adam' },
      { type: 'email',   desc: 'Proposal sent via email',                       date: '2026-03-29', by: 'Adam' },
    ],
  },
  {
    id: 'lead-3',
    full_name: 'Patricia Nguyen',
    email: 'pnguyen@email.com',
    phone: '(234) 555-0104',
    address: '340 Elm Court, Stow, OH 44224',
    project_type: 'bathroom',
    stage: 'lead' as const,
    estimated_value: 35000,
    next_action: 'Schedule consultation',
    next_action_date: '2026-04-09',
    days_in_stage: 1,
    source: 'website',
    notes: 'Master bath refresh. Submitted inquiry form online.',
    activities: [
      { type: 'note', desc: 'Inquiry received via website contact form', date: '2026-04-05', by: 'System' },
    ],
  },
  {
    id: 'lead-4',
    full_name: 'James & Lynn Cooper',
    email: 'jcooper@email.com',
    phone: '(330) 555-0477',
    address: '612 Brookside Run, Cuyahoga Falls, OH 44221',
    project_type: 'basement',
    stage: 'contract_signed' as const,
    estimated_value: 71000,
    next_action: 'Begin pre-construction',
    next_action_date: '2026-04-20',
    days_in_stage: 5,
    source: 'referral',
    notes: 'Full basement finish — wet bar, theater room, full bath.',
    activities: [
      { type: 'meeting', desc: 'Site walk and measurement',                date: '2026-03-28', by: 'Adam' },
      { type: 'email',   desc: 'Proposal sent',                            date: '2026-04-01', by: 'Adam' },
      { type: 'note',    desc: 'Client accepted proposal, contract signed', date: '2026-04-01', by: 'Adam' },
    ],
  },
]

// ── Mock Invoices ─────────────────────────────────────────────────────────────
export const MOCK_INVOICES = [
  {
    id: 'inv-1',
    invoice_number: 'INV-2026-041',
    project_id: 'proj-1',
    client_name: 'Johnson',
    title: 'Milestone 2 – Tile & Fixtures',
    line_items: [
      { label: 'Tile labor',       amount: 4800 },
      { label: 'Fixture install',  amount: 2400 },
      { label: 'Materials',        amount: 9000 },
    ],
    subtotal: 16200,
    tax_rate: 0,
    total: 16200,
    balance_due: 16200,
    status: 'sent' as const,
    due_date: '2026-04-20',
    sent_at: '2026-04-05',
  },
  {
    id: 'inv-2',
    invoice_number: 'INV-2026-038',
    project_id: 'proj-2',
    client_name: 'Thompson',
    title: 'Deposit – Kitchen Addition',
    line_items: [
      { label: '30% project deposit', amount: 37200 },
    ],
    subtotal: 37200,
    tax_rate: 0,
    total: 37200,
    balance_due: 0,
    status: 'paid' as const,
    due_date: '2026-03-15',
    sent_at: '2026-03-10',
    paid_at: '2026-03-14',
  },
  {
    id: 'inv-3',
    invoice_number: 'INV-2026-039',
    project_id: 'proj-2',
    client_name: 'Thompson',
    title: 'Milestone 1 – Framing',
    line_items: [
      { label: 'Framing labor',    amount: 18000 },
      { label: 'Lumber materials', amount: 13000 },
    ],
    subtotal: 31000,
    tax_rate: 0,
    total: 31000,
    balance_due: 31000,
    status: 'overdue' as const,
    due_date: '2026-04-01',
    sent_at: '2026-03-28',
  },
  {
    id: 'inv-4',
    invoice_number: 'INV-2026-035',
    project_id: 'proj-4',
    client_name: 'Williams',
    title: 'Final Payment – Guest Bath',
    line_items: [
      { label: 'Remaining balance', amount: 8400 },
    ],
    subtotal: 8400,
    tax_rate: 0,
    total: 8400,
    balance_due: 0,
    status: 'paid' as const,
    due_date: '2026-03-25',
    sent_at: '2026-03-20',
    paid_at: '2026-03-24',
  },
]

// ── Mock Expenses ─────────────────────────────────────────────────────────────
export const MOCK_EXPENSES = [
  { id: 'exp-1', project_id: 'proj-1', vendor: 'Tile Outlet',       description: '12x24 Matte Tile (60 sqft)',     category: 'materials' as const,     amount: 1140, date: '2026-04-05', entered_by: 'employee-1', entry_method: 'receipt_scan' as const },
  { id: 'exp-2', project_id: 'proj-1', vendor: 'Ferguson',          description: 'Kohler shower valve & trim',     category: 'materials' as const,     amount: 485,  date: '2026-04-04', entered_by: 'admin-1',    entry_method: 'manual' as const },
  { id: 'exp-3', project_id: 'proj-1', vendor: 'Home Depot',        description: 'Tile mortar, grout, supplies',   category: 'materials' as const,     amount: 210,  date: '2026-04-03', entered_by: 'employee-1', entry_method: 'receipt_scan' as const },
  { id: 'exp-4', project_id: 'proj-2', vendor: 'Sutherlands',       description: '2x6 framing lumber (80 pcs)',    category: 'materials' as const,     amount: 3200, date: '2026-04-02', entered_by: 'admin-1',    entry_method: 'purchase_order' as const },
  { id: 'exp-5', project_id: 'proj-2', vendor: 'ABC Concrete',      description: 'Foundation pour',                category: 'subcontractor' as const, amount: 8500, date: '2026-03-28', entered_by: 'admin-1',    entry_method: 'manual' as const },
  { id: 'exp-6', project_id: 'proj-2', vendor: 'Summit Electric',   description: 'Rough-in electrical',            category: 'subcontractor' as const, amount: 4200, date: '2026-04-01', entered_by: 'admin-1',    entry_method: 'manual' as const },
  { id: 'exp-7', project_id: 'proj-1', vendor: 'Jeff Miller',       description: 'Labor week of Apr 6',            category: 'labor' as const,         amount: 1200, date: '2026-04-06', entered_by: 'admin-1',    entry_method: 'manual' as const },
  { id: 'exp-8', project_id: 'proj-1', vendor: 'City of Hudson',    description: 'Building permit',                category: 'permit' as const,        amount: 285,  date: '2026-03-09', entered_by: 'admin-1',    entry_method: 'manual' as const },
]

// ── Mock Purchase Orders ──────────────────────────────────────────────────────
export const MOCK_PURCHASE_ORDERS = [
  {
    id: 'po-1',
    po_number: 'PO-2026-008',
    project_id: 'proj-2',
    vendor: 'Sutherlands Lumber',
    items: [
      { description: '2x6x8 Studs',          qty: 80,  unit_price: 9.50,  total: 760  },
      { description: '7/16" OSB Sheathing',  qty: 24,  unit_price: 32.00, total: 768  },
      { description: 'Engineered LVL Beam',  qty: 2,   unit_price: 186.00,total: 372  },
      { description: 'Hurricane Ties',       qty: 50,  unit_price: 1.30,  total: 65   },
    ],
    total: 1965,
    status: 'received' as const,
    expected_delivery: '2026-04-03',
    received_at: '2026-04-03',
  },
  {
    id: 'po-2',
    po_number: 'PO-2026-009',
    project_id: 'proj-1',
    vendor: 'Tile Outlet Warehouse',
    items: [
      { description: '12x24 Matte White Field Tile', qty: 3,  unit_price: 89.00, total: 267  },
      { description: 'Schluter Kerdi Membrane',       qty: 1,  unit_price: 145.00,total: 145  },
      { description: 'Mapei Grout – Warm Gray',       qty: 4,  unit_price: 18.00, total: 72   },
    ],
    total: 484,
    status: 'partial' as const,
    expected_delivery: '2026-04-07',
    received_at: null,
  },
]

// ── Mock Financial Summary ────────────────────────────────────────────────────
export const MOCK_FINANCIALS = {
  revenue_ytd: 263300,
  expenses_ytd: 111300,
  profit_ytd: 152000,
  outstanding_ar: 47200,
  active_projects: 2,
  avg_margin: 0.402,
}

// ── Mock Time Entries ─────────────────────────────────────────────────────────
export const MOCK_TIME_ENTRIES = [
  {
    id: 'te-1',
    user_id: 'employee-1',
    project_id: 'proj-1',
    project_title: 'Johnson Master Bath',
    work_type: 'field_carpentry' as const,
    clock_in: '2026-04-07T07:02:00',
    clock_out: null,
    total_minutes: null,
    is_billable: true,
    billing_rate: 85,
    billed_amount: null,
    billing_status: 'pending' as const,
    entry_method: 'live' as const,
    geofence_verified: true,
  },
  {
    id: 'te-2',
    user_id: 'employee-1',
    project_id: 'proj-1',
    project_title: 'Johnson Master Bath',
    work_type: 'field_carpentry' as const,
    clock_in: '2026-04-06T07:00:00',
    clock_out: '2026-04-06T15:30:00',
    total_minutes: 510,
    is_billable: true,
    billing_rate: 85,
    billed_amount: 722.50,
    billing_status: 'pending' as const,
    entry_method: 'live' as const,
    geofence_verified: true,
  },
  {
    id: 'te-3',
    user_id: 'employee-1',
    project_id: 'proj-2',
    project_title: 'Thompson Addition',
    work_type: 'field_carpentry' as const,
    clock_in: '2026-04-06T07:15:00',
    clock_out: '2026-04-06T14:45:00',
    total_minutes: 450,
    is_billable: true,
    billing_rate: 85,
    billed_amount: 637.50,
    billing_status: 'invoiced' as const,
    entry_method: 'live' as const,
    geofence_verified: true,
  },
  {
    id: 'te-4',
    user_id: 'employee-2',
    project_id: 'proj-2',
    project_title: 'Thompson Addition',
    work_type: 'field_carpentry' as const,
    clock_in: '2026-04-07T06:45:00',
    clock_out: null,
    total_minutes: null,
    is_billable: true,
    billing_rate: 85,
    billed_amount: null,
    billing_status: 'pending' as const,
    entry_method: 'live' as const,
    geofence_verified: true,
  },
  {
    id: 'te-5',
    user_id: 'admin-1',
    project_id: 'proj-1',
    project_title: 'Johnson Master Bath',
    work_type: 'project_management' as const,
    clock_in: '2026-04-07T09:00:00',
    clock_out: '2026-04-07T11:30:00',
    total_minutes: 150,
    is_billable: true,
    billing_rate: 120,
    billed_amount: 300,
    billing_status: 'pending' as const,
    entry_method: 'live' as const,
    geofence_verified: false,
  },
  {
    id: 'te-6',
    user_id: 'employee-1',
    project_id: null,
    project_title: null,
    work_type: 'administrative' as const,
    clock_in: '2026-04-05T08:00:00',
    clock_out: '2026-04-05T08:45:00',
    total_minutes: 45,
    is_billable: false,
    billing_rate: null,
    billed_amount: null,
    billing_status: 'na' as const,
    entry_method: 'manual' as const,
    manual_reason: 'Forgot to clock in for morning paperwork',
    geofence_verified: false,
    approved_by: null,
    approved_at: null,
  },
]

export const MOCK_WORK_TYPE_RATES = [
  { id: 'wtr-1', user_id: 'admin-1',    work_type: 'field_carpentry',    rate_per_hour: 85,  is_default_billable: true },
  { id: 'wtr-2', user_id: 'admin-1',    work_type: 'project_management', rate_per_hour: 120, is_default_billable: true },
  { id: 'wtr-3', user_id: 'admin-1',    work_type: 'site_visit',         rate_per_hour: 120, is_default_billable: true },
  { id: 'wtr-4', user_id: 'admin-1',    work_type: 'design',             rate_per_hour: 95,  is_default_billable: true },
  { id: 'wtr-5', user_id: 'admin-1',    work_type: 'administrative',     rate_per_hour: 0,   is_default_billable: false },
  { id: 'wtr-6', user_id: 'admin-1',    work_type: 'travel',             rate_per_hour: 65,  is_default_billable: false },
  { id: 'wtr-7', user_id: 'employee-1', work_type: 'field_carpentry',    rate_per_hour: 85,  is_default_billable: true },
  { id: 'wtr-8', user_id: 'employee-1', work_type: 'project_management', rate_per_hour: 0,   is_default_billable: false },
  { id: 'wtr-9', user_id: 'employee-2', work_type: 'field_carpentry',    rate_per_hour: 85,  is_default_billable: true },
]

// ── Mock Shopping Items ───────────────────────────────────────────────────────
export const MOCK_SHOPPING_ITEMS = [
  { id: 'si-1', project_id: 'proj-1', project_title: 'Johnson Bath',      item_name: '12x24 Matte White Field Tile', quantity: 3,  unit: 'boxes',  status: 'needed'    as const },
  { id: 'si-2', project_id: 'proj-1', project_title: 'Johnson Bath',      item_name: 'Schluter Kerdi Band',          quantity: 1,  unit: 'roll',   status: 'needed'    as const },
  { id: 'si-3', project_id: 'proj-2', project_title: 'Thompson Addition', item_name: '2x6 Studs 8ft',               quantity: 40, unit: 'each',   status: 'needed'    as const },
  { id: 'si-4', project_id: 'proj-2', project_title: 'Thompson Addition', item_name: 'OSB 7/16" Sheathing',         quantity: 12, unit: 'sheets', status: 'needed'    as const },
  { id: 'si-5', project_id: 'proj-1', project_title: 'Johnson Bath',      item_name: 'Toilet Flange',               quantity: 1,  unit: 'each',   status: 'purchased' as const },
]

// ── Mock Employee Schedule ────────────────────────────────────────────────────
export const MOCK_SCHEDULE = [
  { id: 'sc-1', date: '2026-04-06', project: 'Johnson Master Bath', task: 'Tile installation – shower floor', address: '142 Maple Ridge Drive, Hudson' },
  { id: 'sc-2', date: '2026-04-07', project: 'Johnson Master Bath', task: 'Tile installation – shower walls', address: '142 Maple Ridge Drive, Hudson' },
  { id: 'sc-3', date: '2026-04-08', project: 'Johnson Master Bath', task: 'Grouting & cleanup',              address: '142 Maple Ridge Drive, Hudson' },
  { id: 'sc-4', date: '2026-04-09', project: 'Thompson Addition',   task: 'Framing – exterior walls',        address: '88 Crestwood Lane, Stow' },
  { id: 'sc-5', date: '2026-04-10', project: 'Thompson Addition',   task: 'Framing – roof structure',        address: '88 Crestwood Lane, Stow' },
]

// ── Mock Bonus Records ────────────────────────────────────────────────────────
export const MOCK_BONUS = {
  ytd_earned: 1800,
  ytd_qualified: 2,
  ytd_projects: 3,
  hit_rate: 0.667,
  records: [
    { project: 'Williams Guest Bath',    project_type: 'bathroom', amount: 900, qualified: true,  schedule_hit: true,  margin_hit: true,  margin: 36.1, target: 38 },
    { project: 'Thompson Addition',      project_type: 'addition', amount: 0,   qualified: false, schedule_hit: false, margin_hit: false, margin: 34.7, target: 38 },
    { project: 'Johnson Master Bath',    project_type: 'bathroom', amount: 900, qualified: true,  schedule_hit: true,  margin_hit: true,  margin: 41.9, target: 38 },
  ],
}

// ── Mock Tasks ────────────────────────────────────────────────────────────────
export const MOCK_TASKS = [
  { id: 'task-1', project_id: 'proj-1', title: 'Order final tile shipment',           status: 'todo'        as const, priority: 'high'   as const, due_date: '2026-04-08', assigned_to: 'employee-1' },
  { id: 'task-2', project_id: 'proj-1', title: 'Schedule vanity delivery',            status: 'in_progress' as const, priority: 'medium' as const, due_date: '2026-04-10', assigned_to: 'admin-1' },
  { id: 'task-3', project_id: 'proj-1', title: 'Confirm fixture selections w/ client',status: 'done'        as const, priority: 'medium' as const, due_date: '2026-04-03', assigned_to: 'admin-1' },
  { id: 'task-4', project_id: 'proj-2', title: 'Submit framing inspection request',   status: 'todo'        as const, priority: 'urgent' as const, due_date: '2026-04-09', assigned_to: 'admin-1' },
  { id: 'task-5', project_id: 'proj-2', title: 'Coordinate HVAC sub schedule',        status: 'todo'        as const, priority: 'medium' as const, due_date: '2026-04-12', assigned_to: 'admin-1' },
]

// ── Mock Daily Logs ───────────────────────────────────────────────────────────
export const MOCK_DAILY_LOGS = [
  { id: 'log-1', project_id: 'proj-1', employee: 'Jeff Miller', date: '2026-04-05', summary: 'Completed shower floor tile layout. All tiles set and leveled. Started on first course of wall tile on the back wall. No issues — work is progressing on schedule.', workers: ['Jeff Miller'], weather: 'Clear' },
  { id: 'log-2', project_id: 'proj-1', employee: 'Jeff Miller', date: '2026-04-04', summary: 'Applied Schluter Kerdi waterproofing membrane to shower pan and walls. Seams taped and embedded. Let cure overnight before tile.', workers: ['Jeff Miller'], weather: 'Clear' },
  { id: 'log-3', project_id: 'proj-2', employee: 'Steven Clark', date: '2026-04-05', summary: 'Framing crew on site. 60% of exterior walls framed. Some delays getting the LVL beam positioned — needed second man. Will need full day Saturday to get back on schedule.', workers: ['Steven Clark', 'Day Labor x2'], weather: 'Overcast' },
]

// ── Mock Change Orders ────────────────────────────────────────────────────────
export const MOCK_CHANGE_ORDERS = [
  {
    id: 'co-1',
    project_id: 'proj-1',
    title: 'Niche Addition – Shower Wall',
    description: 'Client requested a built-in tile niche on the back wall during tile work. Adds approximately 4 hours labor and extra tile.',
    status: 'approved' as const,
    cost_change: 650,
    schedule_change_days: 0,
    flagged_by: 'Jeff Miller',
    flagged_at: '2026-04-05',
    client_approved_at: '2026-04-05',
  },
  {
    id: 'co-2',
    project_id: 'proj-2',
    title: 'Beam Upgrade – Structural Span',
    description: 'Engineer review required 3.5" LVL beam instead of double 2x10. Cost difference plus engineer fee.',
    status: 'sent' as const,
    cost_change: 2100,
    schedule_change_days: 3,
    flagged_by: 'Steven Clark',
    flagged_at: '2026-04-04',
    client_approved_at: null,
  },
]

// ── Mock Punch List ───────────────────────────────────────────────────────────
export const MOCK_PUNCH_LIST = [
  { id: 'pl-1', project_id: 'proj-1', description: 'Caulk gap at base of vanity',            location: 'Vanity',    status: 'open'     as const, assigned_to: 'Jeff Miller' },
  { id: 'pl-2', project_id: 'proj-1', description: 'Touch up paint above shower niche',       location: 'Shower',    status: 'open'     as const, assigned_to: 'Jeff Miller' },
  { id: 'pl-3', project_id: 'proj-1', description: 'Install towel bar – final height TBD',    location: 'Main wall', status: 'open'     as const, assigned_to: 'Jeff Miller' },
  { id: 'pl-4', project_id: 'proj-4', description: 'Re-grout corner near toilet',             location: 'Toilet',    status: 'complete' as const, assigned_to: 'Jeff Miller' },
  { id: 'pl-5', project_id: 'proj-4', description: 'Adjust door sweep on bathroom door',      location: 'Door',      status: 'complete' as const, assigned_to: 'Jeff Miller' },
]

// ── Mock Subcontractors ───────────────────────────────────────────────────────
export const MOCK_SUBCONTRACTORS = [
  { id: 'sub-1', company_name: 'Summit Electric',      contact_name: 'Mike Holt',      phone: '(330) 555-0211', trade: 'electrical',  rating: 5, insurance_expiry: '2026-12-01', is_active: true },
  { id: 'sub-2', company_name: 'ABC Concrete & Found', contact_name: 'Tony Bassett',   phone: '(330) 555-0399', trade: 'concrete',    rating: 4, insurance_expiry: '2026-09-15', is_active: true },
  { id: 'sub-3', company_name: 'Harding Plumbing',     contact_name: 'Dale Harding',   phone: '(234) 555-0188', trade: 'plumbing',    rating: 5, insurance_expiry: '2027-01-01', is_active: true },
  { id: 'sub-4', company_name: 'NE Ohio HVAC',         contact_name: 'Steve Romano',   phone: '(330) 555-0422', trade: 'hvac',        rating: 4, insurance_expiry: '2026-07-30', is_active: true },
  { id: 'sub-5', company_name: 'All-Pro Roofing',      contact_name: 'Jim Taggart',    phone: '(330) 555-0577', trade: 'roofing',     rating: 3, insurance_expiry: '2026-06-01', is_active: true },
]

// ── Mock Permits ──────────────────────────────────────────────────────────────
export const MOCK_PERMITS = [
  { id: 'per-1', project_id: 'proj-1', permit_type: 'building',    permit_number: 'HUD-2026-0312', jurisdiction: 'City of Hudson', status: 'approved' as const, applied_date: '2026-03-05', approved_date: '2026-03-09', expiry_date: '2026-09-09', fee: 285 },
  { id: 'per-2', project_id: 'proj-2', permit_type: 'building',    permit_number: 'STW-2026-0188', jurisdiction: 'City of Stow',   status: 'approved' as const, applied_date: '2026-02-10', approved_date: '2026-02-14', expiry_date: '2026-08-14', fee: 440 },
  { id: 'per-3', project_id: 'proj-2', permit_type: 'electrical',  permit_number: null,             jurisdiction: 'City of Stow',   status: 'needed'   as const, applied_date: null,          approved_date: null,          expiry_date: null,          fee: 120 },
  { id: 'per-4', project_id: 'proj-2', permit_type: 'plumbing',    permit_number: null,             jurisdiction: 'City of Stow',   status: 'needed'   as const, applied_date: null,          approved_date: null,          expiry_date: null,          fee: 95  },
]

// ── Mock Proposals ────────────────────────────────────────────────────────────
export const MOCK_PROPOSALS = [
  {
    id: 'prop-1',
    lead_id: 'lead-2',
    client_name: 'Brian & Kelly Foster',
    title: 'Four-Season Sunroom Addition',
    project_type: 'addition',
    status: 'sent' as const,
    total_price: 215000,
    sent_at: '2026-03-29',
    overview_body: 'We will design and build a 600 square foot four-season sunroom addition on the rear of your home, fully insulated and climate-controlled for year-round use.',
    sections: [
      { title: 'Foundation & Framing',   bullets: ['Excavation and poured concrete foundation', 'Engineered lumber framing', 'Structural steel beam at connection'] },
      { title: 'Exterior Envelope',      bullets: ['Andersen 400 Series windows throughout', 'Fiber cement siding to match existing', 'Architectural shingle roof'] },
      { title: 'Interior Finishes',      bullets: ['Luxury vinyl plank flooring', 'Drywall, paint, and trim to match existing home', 'Recessed lighting package'] },
      { title: 'MEP Systems',            bullets: ['HVAC extension with mini-split backup', 'Electrical – 20A circuits, outlets, switches', 'Optional heated floor rough-in'] },
    ],
    duration: '16–18 weeks',
  },
]

// ── Mock Client Selections ────────────────────────────────────────────────────
export const MOCK_SELECTIONS = [
  { id: 'sel-1', project_id: 'proj-1', category: 'Floor Tile',       item_name: '12x24 Porcelain Field Tile',  status: 'selected'  as const, selected_product: 'MSI Cotto Bianco 12x24', selected_color: 'Bianco White', estimated_cost: 4.20 },
  { id: 'sel-2', project_id: 'proj-1', category: 'Wall Tile',        item_name: 'Subway Tile – Shower Walls',  status: 'approved'  as const, selected_product: 'Daltile Restore 3x12',   selected_color: 'Matte White',  estimated_cost: 3.10 },
  { id: 'sel-3', project_id: 'proj-1', category: 'Vanity',           item_name: 'Vanity & Sink',               status: 'ordered'   as const, selected_product: 'Kohler Marabou 60"',     selected_color: 'White',        estimated_cost: 1840 },
  { id: 'sel-4', project_id: 'proj-1', category: 'Plumbing Fixtures',item_name: 'Shower System',               status: 'pending'   as const, selected_product: null, selected_color: null, estimated_cost: 900 },
  { id: 'sel-5', project_id: 'proj-1', category: 'Hardware',         item_name: 'Towel Bars & Accessories',    status: 'pending'   as const, selected_product: null, selected_color: null, estimated_cost: 280 },
]

// ── Mock Walkthrough Templates ────────────────────────────────────────────────
export const WALKTHROUGH_TEMPLATES: Record<string, { question: string; type: 'choice'|'text'|'number'; options?: string[] }[]> = {
  bathroom: [
    { question: 'Is this a full gut remodel or a cosmetic refresh?', type: 'choice', options: ['Full gut remodel', 'Cosmetic refresh', 'Partial (fixtures only)', 'Not sure yet'] },
    { question: 'What are the approximate dimensions of the bathroom?', type: 'choice', options: ['Under 50 sqft', '50–80 sqft', '80–120 sqft', 'Over 120 sqft'] },
    { question: 'What type of shower does the client want?', type: 'choice', options: ['Walk-in tile shower', 'Tub/shower combo', 'Freestanding tub + separate shower', 'Keep existing layout'] },
    { question: 'What is the tile scope?', type: 'choice', options: ['Floor only', 'Shower only', 'Full floor + shower', 'Floor, shower, and accent wall'] },
    { question: 'What is the vanity plan?', type: 'choice', options: ['New double vanity', 'New single vanity', 'Keep existing vanity', 'Custom built-in'] },
    { question: 'Any plumbing relocations needed?', type: 'choice', options: ['None – keep existing locations', 'Minor (add fixture)', 'Full relocation'] },
    { question: 'Additional notes or special requests?', type: 'text' },
  ],
  kitchen: [
    { question: 'Is this a full gut or keeping the existing layout?', type: 'choice', options: ['Full gut – new layout', 'Same layout, new everything', 'Partial – cabinets only', 'Cosmetic only'] },
    { question: 'Approximate kitchen size?', type: 'choice', options: ['Under 150 sqft', '150–250 sqft', '250–400 sqft', 'Over 400 sqft'] },
    { question: 'What is the cabinet plan?', type: 'choice', options: ['Full custom cabinetry', 'Semi-custom (RTA)', 'Reface existing', 'Keep existing'] },
    { question: 'Countertop material?', type: 'choice', options: ['Quartz', 'Granite', 'Marble', 'Butcher block', 'TBD'] },
    { question: 'Is an island being added or modified?', type: 'choice', options: ['New island', 'Expand existing island', 'No island'] },
    { question: 'Appliance scope?', type: 'choice', options: ['Client supplying all appliances', 'We source and install', 'Keep existing appliances'] },
    { question: 'Additional notes?', type: 'text' },
  ],
  basement: [
    { question: 'What is the main use of the finished basement?', type: 'choice', options: ['Family/rec room', 'Home theater', 'In-law suite', 'Home office', 'Multiple spaces'] },
    { question: 'Approximate basement square footage?', type: 'choice', options: ['Under 600 sqft', '600–900 sqft', '900–1200 sqft', 'Over 1200 sqft'] },
    { question: 'Bathroom being added?', type: 'choice', options: ['Full bath', 'Half bath', 'Wet bar only', 'No bathroom'] },
    { question: 'Ceiling height after finishing?', type: 'choice', options: ['Standard drywall (7–8 ft)', 'Drop ceiling', 'Exposed/industrial', 'Depends on ductwork'] },
    { question: 'Egress windows needed?', type: 'choice', options: ['Yes – need egress', 'Already have egress', 'No bedroom planned'] },
    { question: 'Additional notes?', type: 'text' },
  ],
  addition: [
    { question: 'What type of addition?', type: 'choice', options: ['Room addition', 'Garage addition', 'Sunroom/four-season', 'Second story', 'Bump-out'] },
    { question: 'Approximate square footage?', type: 'choice', options: ['Under 200 sqft', '200–400 sqft', '400–700 sqft', 'Over 700 sqft'] },
    { question: 'Foundation type?', type: 'choice', options: ['Slab on grade', 'Full basement', 'Crawl space', 'Cantilevered/engineered'] },
    { question: 'Will this have HVAC?', type: 'choice', options: ['Extend existing system', 'Mini-split', 'Radiant heat', 'No HVAC needed'] },
    { question: 'Exterior finish to match existing?', type: 'choice', options: ['Yes – match exactly', 'Similar but updated', 'Different accent material'] },
    { question: 'Additional notes?', type: 'text' },
  ],
}

// ── Mock AI Actions (for approval queue) ─────────────────────────────────────
export const MOCK_AI_ACTIONS = [
  { id: 'ai-1', request_text: 'Send weekly update to Johnson client',        action_type: 'send_message',   risk_level: 'high'   as const, status: 'pending'  as const, created_at: '2026-04-06T08:00:00', requires_approval: true,  preview: 'Hi Michael and Sarah — here\'s your weekly progress update for the master bath...' },
  { id: 'ai-2', request_text: 'Add shower niche to Johnson shopping list',   action_type: 'update_data',    risk_level: 'low'    as const, status: 'executed' as const, created_at: '2026-04-05T14:00:00', requires_approval: false, preview: 'Added "Schluter Niche 12x12" to Johnson Bath shopping list.' },
  { id: 'ai-3', request_text: 'Follow up with Foster on proposal',           action_type: 'send_email',     risk_level: 'high'   as const, status: 'pending'  as const, created_at: '2026-04-06T09:30:00', requires_approval: true,  preview: 'Hi Brian — just wanted to follow up on the sunroom proposal we sent last week...' },
  { id: 'ai-4', request_text: 'Generate Thompson daily log for Apr 5',       action_type: 'create_document',risk_level: 'medium' as const, status: 'executed' as const, created_at: '2026-04-05T17:00:00', requires_approval: false, preview: 'Framing crew on site. Exterior walls 60% complete...' },
]

// ── Mock Warranty Claims ──────────────────────────────────────────────────────
export const MOCK_WARRANTY_CLAIMS = [
  { id: 'wc-1', project_id: 'proj-4', description: 'Grout cracking near shower drain', reported_by: 'Karen Williams', reported_at: '2026-04-02', status: 'scheduled' as const, assigned_to: 'Jeff Miller', resolution: null },
]

// ── Mock Receipts ─────────────────────────────────────────────────────────────
export const MOCK_RECEIPTS = [
  { id: 'rec-1', vendor: 'Home Depot',    amount: 210.44, date: '2026-04-03', project: 'Johnson Bath',      items: ['Tile mortar', 'Grout', 'Spacers'], status: 'submitted' as const },
  { id: 'rec-2', vendor: 'Tile Outlet',   amount: 1140.00,date: '2026-04-05', project: 'Johnson Bath',      items: ['12x24 Matte Tile (60 sqft)'],       status: 'submitted' as const },
  { id: 'rec-3', vendor: 'Sutherlands',   amount: 87.32,  date: '2026-04-06', project: 'Thompson Addition', items: ['Misc hardware', 'LedgerLOK screws'], status: 'pending'   as const },
]

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET MODULE MOCK DATA
// Used by ProjectDetailPage Budget tab (addition / large_remodel projects only)
// ─────────────────────────────────────────────────────────────────────────────

export type TradeCategory = 'structural' | 'exterior' | 'mep' | 'interior_subs' | 'crew' | 'other'
export type QuoteStatus   = 'requested' | 'received' | 'awarded' | 'declined'

export interface BudgetTrade {
  id: string
  project_id: string
  name: string
  trade_category: TradeCategory
  sort_order: number
  budget_amount: number
  awarded_amount: number | null
  awarded_subcontractor_id: string | null
  is_locked: boolean
  locked_at: string | null
  notes: string | null
}

export interface BudgetQuote {
  id: string
  trade_id: string
  project_id: string
  subcontractor_id: string | null
  company_name: string
  contact_name: string | null
  contact_phone: string | null
  amount: number
  quote_date: string
  expiry_date: string | null
  scope_included: string | null
  scope_excluded: string | null
  includes_materials: boolean
  notes: string | null
  status: QuoteStatus
  awarded_at: string | null
  ai_analysis: string | null
  document_url: string | null
}

export interface BudgetSettings {
  id: string
  project_id: string
  sub_markup_percent: number
  pm_rate_per_hour: number
  pm_hours_per_week: number
  duration_weeks: number
  crew_weeks_on_site: number
  crew_weekly_cost: number
  crew_bill_multiplier: number
  contingency_amount: number
  monthly_overhead: number
  final_contract_price: number | null
  final_locked_at: string | null
  final_locked_by: string | null
}

// ── Budget Settings (proj-2 = Thompson Addition, proj-3 = Martinez Basement is standard) ─
export const MOCK_BUDGET_SETTINGS: Record<string, BudgetSettings> = {
  'proj-2': {
    id: 'bs-1',
    project_id: 'proj-2',
    sub_markup_percent: 0.25,
    pm_rate_per_hour: 120,
    pm_hours_per_week: 10,
    duration_weeks: 18,
    crew_weeks_on_site: 3.5,
    crew_weekly_cost: 3300,
    crew_bill_multiplier: 2.0,
    contingency_amount: 5000,
    monthly_overhead: 5000,
    final_contract_price: null,
    final_locked_at: null,
    final_locked_by: null,
  },
}

// ── Budget Trades (proj-2) ────────────────────────────────────────────────────
export const MOCK_BUDGET_TRADES: BudgetTrade[] = [
  { id: 'bt-1',  project_id: 'proj-2', name: 'Excavation & site work',         trade_category: 'structural',     sort_order: 0,  budget_amount: 12000, awarded_amount: 11500, awarded_subcontractor_id: 'sub-2', is_locked: true,  locked_at: '2026-03-20', notes: null },
  { id: 'bt-2',  project_id: 'proj-2', name: 'Foundation / concrete footings', trade_category: 'structural',     sort_order: 1,  budget_amount: 22000, awarded_amount: 23800, awarded_subcontractor_id: 'sub-2', is_locked: true,  locked_at: '2026-03-20', notes: 'Over budget due to soil conditions requiring deeper footings.' },
  { id: 'bt-3',  project_id: 'proj-2', name: 'Framing',                        trade_category: 'structural',     sort_order: 2,  budget_amount: 38000, awarded_amount: 34500, awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
  { id: 'bt-4',  project_id: 'proj-2', name: 'Roofing',                        trade_category: 'exterior',       sort_order: 3,  budget_amount: 18000, awarded_amount: null,  awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
  { id: 'bt-5',  project_id: 'proj-2', name: 'Siding',                         trade_category: 'exterior',       sort_order: 4,  budget_amount: 14000, awarded_amount: null,  awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
  { id: 'bt-6',  project_id: 'proj-2', name: 'Windows & exterior doors',       trade_category: 'exterior',       sort_order: 5,  budget_amount: 20000, awarded_amount: null,  awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
  { id: 'bt-7',  project_id: 'proj-2', name: 'Plumbing — rough & finish',      trade_category: 'mep',            sort_order: 6,  budget_amount: 22000, awarded_amount: null,  awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
  { id: 'bt-8',  project_id: 'proj-2', name: 'Electrical — rough & finish',    trade_category: 'mep',            sort_order: 7,  budget_amount: 18000, awarded_amount: null,  awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
  { id: 'bt-9',  project_id: 'proj-2', name: 'HVAC',                           trade_category: 'mep',            sort_order: 8,  budget_amount: 16000, awarded_amount: null,  awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
  { id: 'bt-10', project_id: 'proj-2', name: 'Drywall',                        trade_category: 'interior_subs',  sort_order: 9,  budget_amount: 14000, awarded_amount: null,  awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
  { id: 'bt-11', project_id: 'proj-2', name: 'Interior painting',              trade_category: 'interior_subs',  sort_order: 10, budget_amount: 9000,  awarded_amount: null,  awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
  { id: 'bt-12', project_id: 'proj-2', name: 'Flooring',                       trade_category: 'interior_subs',  sort_order: 11, budget_amount: 16000, awarded_amount: null,  awarded_subcontractor_id: null,    is_locked: false, locked_at: null, notes: null },
]

// ── Budget Quotes (proj-2) ────────────────────────────────────────────────────
export const MOCK_BUDGET_QUOTES: BudgetQuote[] = [
  // Excavation — 2 quotes, awarded ABC (locked)
  { id: 'bq-1', trade_id: 'bt-1', project_id: 'proj-2', subcontractor_id: 'sub-2', company_name: 'ABC Concrete & Found',  contact_name: 'Tony Bassett', contact_phone: '(330) 555-0399', amount: 11500, quote_date: '2026-03-15', expiry_date: '2026-04-15', scope_included: 'Full site excavation, grading, haul-away', scope_excluded: 'Tree removal', includes_materials: false, notes: null, status: 'awarded', awarded_at: '2026-03-18', ai_analysis: null, document_url: null },
  { id: 'bq-2', trade_id: 'bt-1', project_id: 'proj-2', subcontractor_id: null,    company_name: 'Hawk Excavating',       contact_name: 'Dan Hawk',     contact_phone: '(330) 555-0299', amount: 13200, quote_date: '2026-03-14', expiry_date: '2026-04-14', scope_included: 'Site excavation and grading', scope_excluded: 'Haul-away, tree removal', includes_materials: false, notes: 'Haul-away adds ~$1,400 extra.', status: 'declined', awarded_at: null, ai_analysis: null, document_url: null },
  // Foundation — 1 quote awarded (over budget, locked)
  { id: 'bq-3', trade_id: 'bt-2', project_id: 'proj-2', subcontractor_id: 'sub-2', company_name: 'ABC Concrete & Found',  contact_name: 'Tony Bassett', contact_phone: '(330) 555-0399', amount: 23800, quote_date: '2026-03-15', expiry_date: '2026-04-15', scope_included: 'Poured concrete footings and walls, waterproofing both sides', scope_excluded: 'Backfill', includes_materials: true,  notes: 'Required deeper footings per engineer — $1,800 overage.', status: 'awarded', awarded_at: '2026-03-18', ai_analysis: null, document_url: null },
  // Framing — 2 quotes, awarded Summit (not locked)
  { id: 'bq-4', trade_id: 'bt-3', project_id: 'proj-2', subcontractor_id: null,    company_name: 'Summit Framing',        contact_name: 'Rick Doyle',   contact_phone: '(330) 555-0188', amount: 34500, quote_date: '2026-03-28', expiry_date: '2026-04-28', scope_included: 'Full framing per plans including lumber package', scope_excluded: 'Engineered LVL beams (separate)', includes_materials: true,  notes: null, status: 'awarded', awarded_at: '2026-04-01', ai_analysis: 'Summit Framing ($34,500 with lumber) is the stronger apples-to-apples value. Akron Framers\' lower bid ($31,000) excludes all lumber — adding ~$5,200 in materials brings their true cost to ~$36,200. Recommend Summit.', document_url: null },
  { id: 'bq-5', trade_id: 'bt-3', project_id: 'proj-2', subcontractor_id: null,    company_name: 'Akron Framers LLC',     contact_name: 'Pete Cline',   contact_phone: '(234) 555-0188', amount: 31000, quote_date: '2026-03-27', expiry_date: '2026-04-27', scope_included: 'Labor only — framing per plans', scope_excluded: 'All lumber and sheathing', includes_materials: false, notes: null, status: 'declined', awarded_at: null, ai_analysis: null, document_url: null },
  // Roofing — 2 quotes received, not awarded
  { id: 'bq-6', trade_id: 'bt-4', project_id: 'proj-2', subcontractor_id: 'sub-5', company_name: 'All-Pro Roofing',       contact_name: 'Jim Taggart',  contact_phone: '(330) 555-0577', amount: 17200, quote_date: '2026-04-01', expiry_date: '2026-05-01', scope_included: 'Architectural shingle, ice/water shield, ridge vent', scope_excluded: 'Decking replacement if needed', includes_materials: true,  notes: null, status: 'received', awarded_at: null, ai_analysis: null, document_url: null },
  { id: 'bq-7', trade_id: 'bt-4', project_id: 'proj-2', subcontractor_id: null,    company_name: 'Northern Ohio Roofing', contact_name: 'Mark Kessler', contact_phone: '(330) 555-0622', amount: 19500, quote_date: '2026-04-02', expiry_date: '2026-05-02', scope_included: 'Full roof system including any needed decking repairs', scope_excluded: 'Nothing — all-inclusive bid', includes_materials: true,  notes: 'Includes 1-year labor warranty.', status: 'received', awarded_at: null, ai_analysis: null, document_url: null },
  // Plumbing — 1 quote received
  { id: 'bq-8', trade_id: 'bt-7', project_id: 'proj-2', subcontractor_id: 'sub-3', company_name: 'Harding Plumbing',      contact_name: 'Dale Harding', contact_phone: '(234) 555-0188', amount: 21500, quote_date: '2026-04-03', expiry_date: '2026-05-03', scope_included: 'Rough and finish plumbing, all new supply/drain lines', scope_excluded: 'Fixtures and trim (owner supply)', includes_materials: false, notes: null, status: 'received', awarded_at: null, ai_analysis: null, document_url: null },
  // Electrical — 1 quote received
  { id: 'bq-9', trade_id: 'bt-8', project_id: 'proj-2', subcontractor_id: 'sub-1', company_name: 'Summit Electric',       contact_name: 'Mike Holt',    contact_phone: '(330) 555-0211', amount: 17800, quote_date: '2026-04-04', expiry_date: '2026-05-04', scope_included: 'Full rough and finish electrical, 200A panel upgrade included', scope_excluded: 'Fixtures and devices', includes_materials: false, notes: null, status: 'received', awarded_at: null, ai_analysis: null, document_url: null },
]

// ── Budget Selections (proj-2 — these extend MOCK_SELECTIONS for budget projects) ──
export const MOCK_BUDGET_SELECTIONS = [
  { id: 'bsel-1', project_id: 'proj-2', budget_trade_id: 'bt-12', category: 'Flooring',          item_name: 'Luxury Vinyl Plank',       budget_allowance: 8000,  status: 'pending'   as const, selected_product: null,                  estimated_cost: null },
  { id: 'bsel-2', project_id: 'proj-2', budget_trade_id: 'bt-6',  category: 'Windows',           item_name: 'Andersen 400 Series',       budget_allowance: 18000, status: 'selected'  as const, selected_product: 'Andersen 400 Series White', estimated_cost: 17400 },
  { id: 'bsel-3', project_id: 'proj-2', budget_trade_id: null,     category: 'Lighting Package',  item_name: 'Recessed + pendant lights', budget_allowance: 3500,  status: 'pending'   as const, selected_product: null,                  estimated_cost: null },
  { id: 'bsel-4', project_id: 'proj-2', budget_trade_id: null,     category: 'Exterior Doors',    item_name: 'Entry & rear patio door',   budget_allowance: 4200,  status: 'approved'  as const, selected_product: 'Therma-Tru Fiber-Classic', estimated_cost: 3900 },
]

// ─────────────────────────────────────────────────────────────────────────────
// PHASE H — SUB SCOPES, CONTRACTS & COMPLIANCE MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

export type SubScopeStatus = 'draft' | 'reviewed' | 'sent' | 'acknowledged' | 'superseded'
export type SubContractStatus = 'draft' | 'attorney_review' | 'approved' | 'sent' | 'signed' | 'voided'

export interface ScopeSection {
  header: {
    scope_number: string
    project_name: string
    project_address: string
    client_name: string
    trade: string
    subcontractor: string
    contract_amount: number
    date_prepared: string
    prepared_by: string
  }
  scope_summary: string
  inclusions: string[]
  exclusions: string[]
  materials: {
    furnished_by_sub: string[]
    furnished_by_akr: string[]
    client_selections: string[]
  }
  quality_standards: string[]
  coordination_requirements: string[]
  inspection_requirements: string[]
  schedule: {
    mobilization_date: string
    substantial_completion: string
    milestones: string[]
  }
  payment_terms: {
    total_amount: number
    schedule: string
    retention: string
  }
  special_conditions: string[]
}

export interface SubScope {
  id: string
  project_id: string
  budget_trade_id: string | null
  budget_quote_id: string | null
  subcontractor_id: string | null
  scope_number: string
  trade: string
  revision: number
  scope_sections: ScopeSection
  status: SubScopeStatus
  ai_generated: boolean
  attorney_reviewed: boolean
  attorney_reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface SubContractPaymentMilestone {
  milestone: string
  amount: number
  due_condition: string
}

export interface SubContract {
  id: string
  project_id: string
  scope_id: string
  subcontractor_id: string
  budget_quote_id: string | null
  contract_number: string
  revision: number
  contract_amount: number
  payment_schedule: SubContractPaymentMilestone[]
  retention_percent: number
  start_date: string | null
  completion_date: string | null
  liquidated_damages_per_day: number | null
  required_gl_amount: number
  required_wc: boolean
  additional_insured: boolean
  template_version: string
  status: SubContractStatus
  attorney_approved_template: boolean
  attorney_reviewed: boolean
  sub_signed_at: string | null
  akr_signed_at: string | null
  created_at: string
}

export const MOCK_SUB_SCOPES: SubScope[] = [
  {
    id: 'sow-1',
    project_id: 'proj-2',
    budget_trade_id: 'bt-1',
    budget_quote_id: 'bq-1',
    subcontractor_id: 'sub-2',
    scope_number: 'SOW-2026-001',
    trade: 'Excavation',
    revision: 1,
    scope_sections: {
      header: {
        scope_number: 'SOW-2026-001',
        project_name: 'Thompson Kitchen Addition',
        project_address: '88 Crestwood Lane, Stow, OH 44224',
        client_name: 'Dave & Lisa Thompson',
        trade: 'Excavation',
        subcontractor: 'ABC Concrete & Found',
        contract_amount: 11500,
        date_prepared: '2026-03-20',
        prepared_by: 'AK Renovations, Adam Kilgore',
      },
      scope_summary: 'Complete site excavation, grading, and spoils haul-away for the Thompson kitchen addition foundation footprint per approved plans.',
      inclusions: [
        'Ohio 811 utility locate coordination before dig',
        'Topsoil strip and stockpile on site',
        'Excavation to design depth per foundation plan',
        'Spoils haul-away to approved off-site location',
        'Rough grading within addition footprint',
        'Backfill and compaction around foundation walls after concrete inspection',
      ],
      exclusions: [
        'Tree removal beyond addition footprint',
        'Hazardous soil remediation if encountered',
        'Retaining walls of any kind',
        'Finish grading and landscaping',
      ],
      materials: {
        furnished_by_sub: ['All equipment, fuel, and disposal fees'],
        furnished_by_akr: ['Site access and staging area'],
        client_selections: [],
      },
      quality_standards: [
        'Excavation within 2 inches of design elevations',
        'Subgrade approved by AK Renovations before concrete sub mobilizes',
        'All work per Summit County grading and erosion control requirements',
      ],
      coordination_requirements: [
        'Coordinate start date with concrete sub to minimize open-hole exposure',
        'Notify AK Renovations 48 hours before mobilization',
      ],
      inspection_requirements: [
        'Subgrade walk and approval by AK Renovations before pour',
      ],
      schedule: {
        mobilization_date: '2026-04-15',
        substantial_completion: '2026-04-18',
        milestones: ['Strip topsoil day 1', 'Excavate to depth day 2', 'Haul-away and rough grade day 3'],
      },
      payment_terms: {
        total_amount: 11500,
        schedule: '50% mobilization, 50% completion',
        retention: '10% retention released at project closeout',
      },
      special_conditions: [
        'Sub responsible for Ohio 811 ticket and utility locate verification',
        'All work per OBC 2024 and Summit County requirements',
      ],
    },
    status: 'reviewed',
    ai_generated: true,
    attorney_reviewed: false,
    attorney_reviewed_at: null,
    created_at: '2026-03-20T14:00:00Z',
    updated_at: '2026-03-21T10:00:00Z',
  },
  {
    id: 'sow-2',
    project_id: 'proj-2',
    budget_trade_id: 'bt-2',
    budget_quote_id: 'bq-3',
    subcontractor_id: 'sub-2',
    scope_number: 'SOW-2026-002',
    trade: 'Concrete / Foundation',
    revision: 1,
    scope_sections: {
      header: {
        scope_number: 'SOW-2026-002',
        project_name: 'Thompson Kitchen Addition',
        project_address: '88 Crestwood Lane, Stow, OH 44224',
        client_name: 'Dave & Lisa Thompson',
        trade: 'Concrete / Foundation',
        subcontractor: 'ABC Concrete & Found',
        contract_amount: 23800,
        date_prepared: '2026-03-20',
        prepared_by: 'AK Renovations, Adam Kilgore',
      },
      scope_summary: 'Poured concrete footings and foundation walls for the Thompson kitchen addition, including waterproofing both sides per code. Footings deepened per engineer due to soil conditions.',
      inclusions: [
        'Footing forms, rebar per engineering, and pour',
        'Foundation wall forms, rebar, and pour',
        'Waterproofing membrane on exterior foundation wall',
        'Damp proofing on interior face per code',
        'Anchor bolt layout per framing plan',
        'Strip and clean up after inspections',
      ],
      exclusions: [
        'Backfill around foundation (excavation sub)',
        'Foundation drain tile',
      ],
      materials: {
        furnished_by_sub: ['Concrete, rebar, forms, waterproofing membrane', 'All equipment and labor'],
        furnished_by_akr: ['Engineered plans and anchor bolt schedule'],
        client_selections: [],
      },
      quality_standards: [
        'Concrete minimum 3,000 psi, air-entrained',
        'Foundation walls plumb within 1/4 inch per 8 feet',
        'All work per OBC 2024 Chapter R403 and engineer specifications',
      ],
      coordination_requirements: [
        'Coordinate anchor bolt layout with framing sub before pour',
        'Schedule footing and foundation inspections with AK Renovations',
      ],
      inspection_requirements: [
        'Footing inspection before concrete pour',
        'Foundation inspection before backfill',
      ],
      schedule: {
        mobilization_date: '2026-04-21',
        substantial_completion: '2026-05-02',
        milestones: ['Footings poured and inspected', 'Walls poured', 'Waterproofing complete'],
      },
      payment_terms: {
        total_amount: 23800,
        schedule: '40% mobilization, 40% after foundation pour, 20% completion',
        retention: '10% retention released at project closeout',
      },
      special_conditions: [
        'Deeper footings approved per soil engineer letter dated 2026-03-15',
        'All work per OBC 2024 and Summit County requirements',
      ],
    },
    status: 'sent',
    ai_generated: true,
    attorney_reviewed: true,
    attorney_reviewed_at: '2026-03-22T15:00:00Z',
    created_at: '2026-03-20T14:30:00Z',
    updated_at: '2026-03-22T15:00:00Z',
  },
  {
    id: 'sow-3',
    project_id: 'proj-2',
    budget_trade_id: 'bt-3',
    budget_quote_id: 'bq-4',
    subcontractor_id: null,
    scope_number: 'SOW-2026-003',
    trade: 'Framing',
    revision: 1,
    scope_sections: {
      header: {
        scope_number: 'SOW-2026-003',
        project_name: 'Thompson Kitchen Addition',
        project_address: '88 Crestwood Lane, Stow, OH 44224',
        client_name: 'Dave & Lisa Thompson',
        trade: 'Framing',
        subcontractor: 'Summit Framing',
        contract_amount: 34500,
        date_prepared: '2026-04-01',
        prepared_by: 'AK Renovations, Adam Kilgore',
      },
      scope_summary: 'Complete structural framing for the Thompson kitchen addition including all walls, LVL beams, roof framing, and lumber package per plans.',
      inclusions: [
        'All structural framing per architectural plans',
        'LVL beams and engineered lumber as specified',
        'Hurricane ties and seismic straps per code',
        'Temporary bracing during construction',
        'Blocking for cabinets and fixtures',
        'Stair framing if applicable',
        'Roof framing with trusses per truss package',
        'Complete lumber package included',
      ],
      exclusions: [
        'Exterior sheathing (separate trade)',
        'Roofing and roof sheathing',
        'Window and door installation',
        'Insulation, drywall',
      ],
      materials: {
        furnished_by_sub: ['All framing lumber', 'Engineered LVLs per plan', 'Hardware and fasteners'],
        furnished_by_akr: ['Architectural and structural plans', 'Anchor bolt layout'],
        client_selections: [],
      },
      quality_standards: [
        'All framing lumber to be #2 or better Douglas Fir or SPF',
        'Maximum 1/4 inch variance in wall plumb per 8 feet',
        'All work to meet or exceed OBC 2024 R602 wood wall framing requirements',
      ],
      coordination_requirements: [
        'Coordinate rough opening sizes with window and door supplier',
        'Notify AK Renovations 48 hours before framing inspection',
        'Coordinate beam sizing with structural engineer if deviation required',
      ],
      inspection_requirements: [
        'Framing inspection required before insulation',
        'Sub is responsible for scheduling with Summit County AHJ',
      ],
      schedule: {
        mobilization_date: '2026-05-05',
        substantial_completion: '2026-05-26',
        milestones: ['Floor system complete', 'Wall framing complete', 'Roof framing complete'],
      },
      payment_terms: {
        total_amount: 34500,
        schedule: '40% mobilization, 40% at roof dry-in, 20% on completion',
        retention: '10% retention released at project closeout',
      },
      special_conditions: [
        'Sub verified Ohio HIC license on file',
        'All work per OBC 2024',
      ],
    },
    status: 'draft',
    ai_generated: true,
    attorney_reviewed: false,
    attorney_reviewed_at: null,
    created_at: '2026-04-01T09:00:00Z',
    updated_at: '2026-04-01T09:00:00Z',
  },
]

export const MOCK_SUB_CONTRACTS: SubContract[] = [
  {
    id: 'sc-1',
    project_id: 'proj-2',
    scope_id: 'sow-2',
    subcontractor_id: 'sub-2',
    budget_quote_id: 'bq-3',
    contract_number: 'SC-2026-001',
    revision: 1,
    contract_amount: 23800,
    payment_schedule: [
      { milestone: 'Mobilization', amount: 9520, due_condition: 'Upon mobilization to site' },
      { milestone: 'Foundation pour complete', amount: 9520, due_condition: 'After foundation inspection passes' },
      { milestone: 'Final', amount: 4760, due_condition: 'Upon backfill and cleanup complete' },
    ],
    retention_percent: 10,
    start_date: '2026-04-21',
    completion_date: '2026-05-02',
    liquidated_damages_per_day: null,
    required_gl_amount: 1000000,
    required_wc: true,
    additional_insured: true,
    template_version: 'v1.0-draft',
    status: 'sent',
    attorney_approved_template: false,
    attorney_reviewed: true,
    sub_signed_at: null,
    akr_signed_at: null,
    created_at: '2026-03-22T16:00:00Z',
  },
]

export type ComplianceCategory =
  | 'business_registration'
  | 'licensing'
  | 'insurance'
  | 'tax'
  | 'employment'
  | 'safety'
  | 'bonding'
  | 'permits'
  | 'banking'
  | 'contracts'
  | 'website_digital'

export type ComplianceJurisdiction = 'federal' | 'ohio_state' | 'summit_county' | 'city' | 'other'
export type CompliancePriority = 'critical' | 'high' | 'medium' | 'low'
export type ComplianceStatus = 'not_started' | 'in_progress' | 'completed' | 'not_applicable' | 'needs_renewal'
export type ComplianceFrequency = 'one_time' | 'annual' | 'biennial' | 'monthly' | 'quarterly' | 'as_needed'

export interface ComplianceItem {
  id: string
  category: ComplianceCategory
  jurisdiction: ComplianceJurisdiction
  title: string
  description: string
  priority: CompliancePriority
  frequency: ComplianceFrequency
  estimated_cost: string
  where_to_go: string
  how_to_complete: string
  ai_help_prompt: string
  status: ComplianceStatus
  expiry_date: string | null
  account_number: string | null
  notes: string | null
}

export const MOCK_COMPLIANCE_ITEMS: ComplianceItem[] = [
  // BUSINESS REGISTRATION
  { id: 'comp-1', category: 'business_registration', jurisdiction: 'ohio_state', title: 'Ohio LLC Registration', description: 'AK Renovations LLC must be registered with the Ohio Secretary of State', priority: 'critical', frequency: 'one_time', estimated_cost: '$99 filing fee', where_to_go: 'https://www.ohiosos.gov/businesses/business-filings/', how_to_complete: '1. Go to Ohio SOS website 2. File Articles of Organization 3. Choose LLC 4. Pay $99 fee 5. Receive Certificate of Organization', ai_help_prompt: 'Help me register AK Renovations LLC with the Ohio Secretary of State. Walk me through each step.', status: 'completed', expiry_date: null, account_number: 'LLC-2045888', notes: null },
  { id: 'comp-2', category: 'business_registration', jurisdiction: 'ohio_state', title: 'Ohio Registered Agent', description: 'Ohio LLCs must maintain a registered agent with an Ohio address', priority: 'critical', frequency: 'annual', estimated_cost: '$0-$150/year', where_to_go: 'https://www.ohiosos.gov', how_to_complete: 'Can be Adam personally (if Ohio resident) or a registered agent service', ai_help_prompt: 'Explain what a registered agent is and whether Adam needs to hire one or can serve as his own.', status: 'completed', expiry_date: '2027-01-15', account_number: null, notes: 'Adam serves as own registered agent' },
  { id: 'comp-3', category: 'business_registration', jurisdiction: 'ohio_state', title: 'Ohio Operating Agreement', description: 'Written operating agreement defining LLC ownership and operations', priority: 'high', frequency: 'one_time', estimated_cost: '$0 (DIY) or $300-500 (attorney)', where_to_go: 'Internal document, not filed with state', how_to_complete: 'Draft an operating agreement or have attorney prepare one', ai_help_prompt: 'Generate a basic single-member LLC operating agreement for AK Renovations.', status: 'in_progress', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-4', category: 'business_registration', jurisdiction: 'summit_county', title: 'Summit County Business Registration', description: 'Register the business with Summit County Fiscal Office', priority: 'high', frequency: 'one_time', estimated_cost: '$25-50', where_to_go: 'https://fiscal.summitoh.net', how_to_complete: 'Register trade name/DBA if operating as AK Renovations (not the LLC legal name)', ai_help_prompt: 'Help me register AK Renovations as a trade name in Summit County Ohio.', status: 'not_started', expiry_date: null, account_number: null, notes: null },

  // TAX
  { id: 'comp-5', category: 'tax', jurisdiction: 'federal', title: 'Federal EIN (Employer Identification Number)', description: 'Required for business banking, payroll, and tax filing. Like a SSN for your business.', priority: 'critical', frequency: 'one_time', estimated_cost: '$0', where_to_go: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online', how_to_complete: 'Apply online at IRS.gov, takes 15 minutes, EIN issued immediately', ai_help_prompt: 'Walk me through applying for a Federal EIN for AK Renovations LLC.', status: 'completed', expiry_date: null, account_number: '82-xxxxxxx', notes: null },
  { id: 'comp-6', category: 'tax', jurisdiction: 'ohio_state', title: 'Ohio Commercial Activity Tax (CAT) Registration', description: 'Ohio businesses with over $150,000 gross receipts must register for CAT', priority: 'critical', frequency: 'annual', estimated_cost: '$0 registration, tax varies', where_to_go: 'https://gateway.ohio.gov', how_to_complete: 'Register through Ohio Business Gateway', ai_help_prompt: 'Help me register for Ohio Commercial Activity Tax for AK Renovations.', status: 'in_progress', expiry_date: '2027-01-01', account_number: null, notes: null },
  { id: 'comp-7', category: 'tax', jurisdiction: 'ohio_state', title: 'Ohio Withholding Tax Account', description: 'Required to withhold and remit Ohio income tax from employee wages', priority: 'critical', frequency: 'quarterly', estimated_cost: '$0 registration', where_to_go: 'https://gateway.ohio.gov', how_to_complete: 'Register as employer through Ohio Business Gateway', ai_help_prompt: 'Help me set up Ohio employer withholding tax account.', status: 'not_started', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-8', category: 'tax', jurisdiction: 'federal', title: 'Federal Quarterly Estimated Taxes', description: 'As S-corp owner, Adam pays quarterly estimated taxes on distributions and salary', priority: 'high', frequency: 'quarterly', estimated_cost: 'Varies, typically 25-30% of net profit', where_to_go: 'https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes', how_to_complete: 'Calculate using Form 1040-ES, pay via IRS Direct Pay', ai_help_prompt: 'Calculate my estimated quarterly tax payment based on current revenue and expenses.', status: 'in_progress', expiry_date: '2026-04-15', account_number: null, notes: 'Q1 2026 payment due' },
  { id: 'comp-9', category: 'tax', jurisdiction: 'ohio_state', title: 'Ohio S-Corporation Election', description: 'If operating as S-corp, file Ohio form IT 4708 or IT 1140', priority: 'high', frequency: 'annual', estimated_cost: '$0', where_to_go: 'https://tax.ohio.gov', how_to_complete: 'File Ohio pass-through entity tax forms annually', ai_help_prompt: 'Explain the Ohio S-corp tax filing requirements for AK Renovations.', status: 'not_started', expiry_date: null, account_number: null, notes: null },

  // LICENSING
  { id: 'comp-10', category: 'licensing', jurisdiction: 'ohio_state', title: 'Ohio Contractor License (HIC)', description: 'Ohio Home Improvement Contractor license required for residential work over $1,000', priority: 'critical', frequency: 'biennial', estimated_cost: '$200 biennial renewal', where_to_go: 'https://www.com.ohio.gov/dico/contractor/', how_to_complete: '1. Complete application 2. Provide proof of insurance 3. Pay fee 4. Pass background check', ai_help_prompt: 'Help me apply for or renew my Ohio Home Improvement Contractor license.', status: 'completed', expiry_date: '2026-05-30', account_number: 'HIC-88412', notes: 'Renewal due in May' },
  { id: 'comp-11', category: 'licensing', jurisdiction: 'ohio_state', title: 'Ohio Construction Industry Licensing Board (CILB)', description: 'Required for commercial work, check if any projects qualify', priority: 'medium', frequency: 'annual', estimated_cost: 'Varies by license type', where_to_go: 'https://www.com.ohio.gov/dico/', how_to_complete: 'Review project types to determine if CILB license is needed', ai_help_prompt: 'Do I need an Ohio CILB license for the type of work AK Renovations does?', status: 'not_applicable', expiry_date: null, account_number: null, notes: 'Residential only, not required' },

  // INSURANCE
  { id: 'comp-12', category: 'insurance', jurisdiction: 'ohio_state', title: 'Ohio Workers Compensation (BWC)', description: 'Mandatory for all W-2 employees in Ohio. Cannot legally have employees without this.', priority: 'critical', frequency: 'annual', estimated_cost: '$800-2,500/year depending on payroll and classification', where_to_go: 'https://www.bwc.ohio.gov', how_to_complete: '1. Register at BWC.ohio.gov 2. Get employer account 3. Pay premiums based on payroll', ai_help_prompt: 'Help me register AK Renovations with Ohio Bureau of Workers Compensation.', status: 'completed', expiry_date: '2026-12-31', account_number: 'BWC-4491102', notes: null },
  { id: 'comp-13', category: 'insurance', jurisdiction: 'other', title: 'General Liability Insurance', description: 'Minimum $1M per occurrence, $2M aggregate. Required by most subs and clients.', priority: 'critical', frequency: 'annual', estimated_cost: '$2,000-4,000/year for a contractor at this revenue level', where_to_go: 'Contact insurance broker, Westfield, Erie, or Frankenmuth recommended for Ohio contractors', how_to_complete: 'Get quotes from 3 brokers. Specify: residential renovation, $1.5M-2M revenue, 2 employees', ai_help_prompt: 'What should I look for in a general liability policy for a residential renovation contractor in Ohio?', status: 'completed', expiry_date: '2026-06-15', account_number: 'GL-WS-2299851', notes: 'Westfield policy' },
  { id: 'comp-14', category: 'insurance', jurisdiction: 'other', title: 'Commercial Auto Insurance', description: 'Required for any vehicle used for business purposes', priority: 'critical', frequency: 'annual', estimated_cost: '$1,500-2,500/year per vehicle', where_to_go: 'Same broker as GL, often bundled for discount', how_to_complete: 'Add commercial auto to GL policy or get separate policy', ai_help_prompt: 'Do I need commercial auto insurance for my trucks used on job sites?', status: 'completed', expiry_date: '2026-06-15', account_number: 'CA-WS-2299851', notes: null },
  { id: 'comp-15', category: 'insurance', jurisdiction: 'other', title: 'Builder Risk Insurance (Per Project)', description: 'Required for addition and new construction projects over $100K', priority: 'high', frequency: 'as_needed', estimated_cost: '$500-1,500 per project depending on value', where_to_go: 'Your GL broker or Markel/Philadelphia Insurance for builders risk', how_to_complete: 'Get builder risk quote for each addition project at contract signing', ai_help_prompt: 'Explain builder risk insurance and when AK Renovations needs it.', status: 'in_progress', expiry_date: null, account_number: null, notes: 'Thompson addition quote in progress' },
  { id: 'comp-16', category: 'insurance', jurisdiction: 'other', title: 'Umbrella / Excess Liability', description: 'Additional liability coverage above GL limits, recommended at $1-2M revenue', priority: 'medium', frequency: 'annual', estimated_cost: '$500-1,000/year for $1M umbrella', where_to_go: 'Same broker as GL', how_to_complete: 'Add umbrella policy on top of existing GL', ai_help_prompt: 'Does AK Renovations need an umbrella liability policy?', status: 'not_started', expiry_date: null, account_number: null, notes: null },

  // EMPLOYMENT
  { id: 'comp-17', category: 'employment', jurisdiction: 'federal', title: 'Federal I-9 Employment Eligibility Verification', description: 'Required for every new hire. Must verify identity and work authorization.', priority: 'critical', frequency: 'as_needed', estimated_cost: '$0', where_to_go: 'https://www.uscis.gov/i-9', how_to_complete: 'Complete I-9 within 3 days of each new hire start date. Keep on file.', ai_help_prompt: 'Walk me through the I-9 process for a new employee.', status: 'completed', expiry_date: null, account_number: null, notes: 'Jeff and Steven on file' },
  { id: 'comp-18', category: 'employment', jurisdiction: 'federal', title: 'Federal W-4 Employee Withholding', description: 'Every employee must complete a W-4 before first paycheck', priority: 'critical', frequency: 'as_needed', estimated_cost: '$0', where_to_go: 'https://www.irs.gov/forms-pubs/about-form-w-4', how_to_complete: 'Have each new employee complete Form W-4 on or before first day', ai_help_prompt: 'Generate a checklist for new employee paperwork at AK Renovations.', status: 'completed', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-19', category: 'employment', jurisdiction: 'ohio_state', title: 'Ohio New Hire Reporting', description: 'Must report every new hire to Ohio within 20 days of hire date', priority: 'critical', frequency: 'as_needed', estimated_cost: '$0', where_to_go: 'https://oh.newhirereporting.com', how_to_complete: 'Report online within 20 days of each new hire', ai_help_prompt: 'Help me report a new hire to Ohio.', status: 'completed', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-20', category: 'employment', jurisdiction: 'federal', title: 'Payroll Service Setup (Gusto)', description: 'Automated payroll, tax filing, W-2s, and direct deposit for Jeff and Steven', priority: 'critical', frequency: 'monthly', estimated_cost: '$40/mo base + $6/employee', where_to_go: 'https://gusto.com', how_to_complete: '1. Sign up at Gusto 2. Connect bank account 3. Add employees 4. Set pay schedule', ai_help_prompt: 'Help me set up Gusto payroll for AK Renovations with two employees.', status: 'completed', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-21', category: 'employment', jurisdiction: 'ohio_state', title: 'Ohio Unemployment Insurance (UI) Account', description: 'Required as an employer in Ohio, fund unemployment benefits for laid-off employees', priority: 'critical', frequency: 'quarterly', estimated_cost: '~2.7% of wages for new employers', where_to_go: 'https://unemploymenthelp.ohio.gov/employers', how_to_complete: 'Register online through Ohio Job & Family Services', ai_help_prompt: 'Help me register for Ohio Unemployment Insurance as an employer.', status: 'completed', expiry_date: null, account_number: 'OH-UI-551288', notes: null },
  { id: 'comp-22', category: 'employment', jurisdiction: 'federal', title: 'OSHA Safety Program', description: 'Written safety program required for construction employers in Ohio', priority: 'high', frequency: 'annual', estimated_cost: '$0 (DIY) or $500-1,000 (consultant)', where_to_go: 'https://www.osha.gov/small-business', how_to_complete: 'Create written safety plan covering: fall protection, PPE, tool safety, hazcom', ai_help_prompt: 'Generate a basic OSHA safety program for a residential renovation contractor with 2 employees.', status: 'in_progress', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-23', category: 'employment', jurisdiction: 'other', title: 'Employee Handbook', description: 'Written policies for: PTO, vehicle use, tool policy, drug testing, termination', priority: 'high', frequency: 'one_time', estimated_cost: '$0 (DIY) or $300-500 (HR consultant)', where_to_go: 'Internal document', how_to_complete: 'Draft handbook covering Ohio-specific requirements', ai_help_prompt: 'Generate an employee handbook for AK Renovations covering Ohio requirements.', status: 'not_started', expiry_date: null, account_number: null, notes: null },

  // BANKING
  { id: 'comp-24', category: 'banking', jurisdiction: 'federal', title: 'Business Checking Account', description: 'Separate business bank account required. Never comingle personal and business funds.', priority: 'critical', frequency: 'one_time', estimated_cost: '$0-25/month', where_to_go: 'Relay Bank (relay.fi), recommended for small business, free, built-in expense tracking', how_to_complete: '1. Open at relay.fi 2. Use EIN (not SSN) 3. Set up operating account', ai_help_prompt: 'What should I look for in a business bank account for AK Renovations?', status: 'completed', expiry_date: null, account_number: 'RELAY-xxxx3042', notes: null },
  { id: 'comp-25', category: 'banking', jurisdiction: 'federal', title: 'Business Tax Reserve Account', description: 'Separate account to hold quarterly tax payments, prevents spending tax money', priority: 'high', frequency: 'one_time', estimated_cost: '$0', where_to_go: 'Same bank as operating account, open as second account', how_to_complete: 'Transfer 25-30% of every client payment into this account immediately', ai_help_prompt: 'How much should I set aside in my tax reserve account based on current revenue?', status: 'completed', expiry_date: null, account_number: 'RELAY-xxxx3048', notes: null },
  { id: 'comp-26', category: 'banking', jurisdiction: 'federal', title: 'Business Credit Card', description: 'Dedicated card for materials and business expenses, builds credit, earns rewards', priority: 'high', frequency: 'one_time', estimated_cost: '$0-95/year', where_to_go: 'Home Depot Pro Xtra card + general business card (Chase Ink or Capital One Spark)', how_to_complete: 'Apply with EIN once business is registered', ai_help_prompt: 'What business credit cards make the most sense for a renovation contractor?', status: 'completed', expiry_date: null, account_number: null, notes: 'Chase Ink + Home Depot Pro' },
  { id: 'comp-27', category: 'banking', jurisdiction: 'federal', title: 'Business Line of Credit', description: 'Credit line for cash flow gaps between milestone payments. Critical at this project size.', priority: 'high', frequency: 'one_time', estimated_cost: 'Interest only when drawn', where_to_go: 'Your business bank or a local credit union in Summit County', how_to_complete: 'Apply after 6-12 months of business banking history', ai_help_prompt: 'Help me prepare a business line of credit application for AK Renovations.', status: 'not_started', expiry_date: null, account_number: null, notes: null },

  // WEBSITE & DIGITAL
  { id: 'comp-28', category: 'website_digital', jurisdiction: 'other', title: 'Website Launch — akrenovationsohio.com', description: 'Website must be live for Google Ads, SEO, and credibility with clients', priority: 'critical', frequency: 'one_time', estimated_cost: 'Domain registered at Porkbun', where_to_go: 'akrenovationsohio.com (registered)', how_to_complete: 'Build and launch, this is already in progress', ai_help_prompt: 'What pages does AK Renovations website need at minimum?', status: 'in_progress', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-29', category: 'website_digital', jurisdiction: 'other', title: 'Google Business Profile Optimization', description: 'Complete GBP with photos, hours, services, and active review responses', priority: 'high', frequency: 'as_needed', estimated_cost: '$0', where_to_go: 'https://business.google.com', how_to_complete: 'Add 10+ photos, complete all fields, respond to every review within 24 hours', ai_help_prompt: 'Help me write a response to this Google review for AK Renovations.', status: 'completed', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-30', category: 'website_digital', jurisdiction: 'other', title: 'Google Local Service Ads Verification', description: 'Google background check and license verification for LSA badge', priority: 'high', frequency: 'annual', estimated_cost: '$0 to verify, pay per lead', where_to_go: 'https://ads.google.com/local-services-ads', how_to_complete: 'Submit license, insurance, and background check through Google', ai_help_prompt: 'Walk me through the Google Local Service Ads verification process for a contractor.', status: 'in_progress', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-31', category: 'website_digital', jurisdiction: 'federal', title: 'Privacy Policy & Terms of Service', description: 'Required on website if collecting any user data (contact forms, etc.)', priority: 'medium', frequency: 'one_time', estimated_cost: '$0 (generated) or $300-500 (attorney)', where_to_go: 'Website pages', how_to_complete: 'Generate privacy policy and terms of service for the website', ai_help_prompt: 'Generate a privacy policy and terms of service for akrenovationsohio.com.', status: 'not_started', expiry_date: null, account_number: null, notes: null },

  // CONTRACTS & LEGAL
  { id: 'comp-32', category: 'contracts', jurisdiction: 'ohio_state', title: 'Client Contract Template — Attorney Review', description: 'Standard client contract reviewed by Ohio construction attorney', priority: 'high', frequency: 'one_time', estimated_cost: '$500-1,000 attorney review', where_to_go: 'Ohio construction attorney, find via Ohio State Bar Association', how_to_complete: 'Generate contract template, have attorney review, finalize', ai_help_prompt: 'What should be in a residential renovation contract in Ohio?', status: 'in_progress', expiry_date: null, account_number: null, notes: null },
  { id: 'comp-33', category: 'contracts', jurisdiction: 'ohio_state', title: 'Subcontractor Agreement Template — Attorney Review', description: 'Standard sub agreement reviewed by Ohio construction attorney', priority: 'high', frequency: 'one_time', estimated_cost: 'Covered by same attorney review as client contract', where_to_go: 'Same attorney as client contract', how_to_complete: 'Generate sub agreement template (AK Ops does this), have attorney review', ai_help_prompt: 'Generate a subcontractor agreement template for AK Renovations.', status: 'in_progress', expiry_date: null, account_number: null, notes: 'Template v1.0-draft in AK Ops awaiting attorney review' },
  { id: 'comp-34', category: 'contracts', jurisdiction: 'ohio_state', title: 'Mechanic Lien Process Document', description: 'Written process for filing mechanic liens in Ohio on non-paying clients', priority: 'high', frequency: 'one_time', estimated_cost: '$0 (documented process) + filing fees if needed', where_to_go: 'Ohio Revised Code Chapter 1311', how_to_complete: 'Document the lien process: notice requirements, deadlines, filing steps', ai_help_prompt: 'Explain the Ohio mechanic lien process and deadlines for a residential contractor.', status: 'not_started', expiry_date: null, account_number: null, notes: null },
]

// ── Phase I — Payroll Mock Data ──────────────────────────────────────────────

export type PayrollWorkerType = 'w2_fulltime' | 'w2_parttime' | 'contractor_1099' | 'owner'
export type PayrollPeriodStatus = 'upcoming' | 'open' | 'processing' | 'submitted' | 'paid' | 'closed'
export type PayrollRecordStatus = 'calculated' | 'reviewed' | 'approved' | 'submitted' | 'paid'
export type PayType = 'salary' | 'hourly'

export interface PayrollWorker {
  profile_id: string
  full_name: string
  worker_type: PayrollWorkerType
  pay_type: PayType
  annual_salary: number | null
  hourly_rate: number | null
  standard_hours_per_week: number
  overtime_eligible: boolean
  hire_date: string
  termination_date: string | null
  filing_status: 'single' | 'married_jointly' | 'married_separately' | 'head_of_household'
  pay_frequency: 'biweekly'
  suta_rate: number
  gusto_employee_id: string | null
  gusto_contractor_id: string | null
}

export interface CompensationComponent {
  id: string
  profile_id: string
  component_type:
    | 'base_salary'
    | 'hourly_base'
    | 'vehicle_allowance'
    | 'health_employer'
    | 'retirement_employer'
    | 'phone_stipend'
    | 'tool_allowance'
    | 'other_recurring'
  amount: number
  amount_frequency: 'per_hour' | 'per_pay_period' | 'monthly' | 'annual'
  is_taxable: boolean
  is_pre_tax: boolean
  effective_from: string
  effective_to: string | null
  is_active: boolean
  notes?: string
}

export interface BenefitsEnrollment {
  id: string
  profile_id: string
  benefit_type: 'health' | 'dental' | 'vision' | 'retirement_simple_ira' | 'retirement_401k' | 'life_insurance' | 'other'
  plan_name: string
  carrier: string
  employee_contribution_amount: number
  employee_contribution_frequency: 'per_pay_period' | 'monthly' | 'annual' | 'percent_of_gross'
  employer_contribution_amount: number
  employer_contribution_frequency: 'per_pay_period' | 'monthly' | 'annual' | 'percent_of_gross'
  employee_contribution_percent: number | null
  is_pre_tax: boolean
  is_active: boolean
  effective_from: string
}

export interface PayPeriod {
  id: string
  period_start: string
  period_end: string
  pay_date: string
  period_number: number
  year: number
  status: PayrollPeriodStatus
  gusto_payroll_id: string | null
  submitted_at: string | null
}

export interface PayrollRecord {
  id: string
  pay_period_id: string
  profile_id: string
  worker_type: PayrollWorkerType
  regular_hours: number
  overtime_hours: number
  pto_hours: number
  holiday_hours: number
  total_hours: number
  base_pay: number
  overtime_pay: number
  vehicle_allowance: number
  phone_stipend: number
  other_allowances: number
  bonus_amount: number
  gross_pay: number
  health_deduction: number
  retirement_deduction: number
  other_deductions: number
  total_deductions: number
  employer_health_cost: number
  employer_retirement_cost: number
  employer_ss_tax: number
  employer_medicare_tax: number
  employer_futa: number
  employer_suta: number
  total_employer_cost: number
  est_federal_withholding: number
  est_state_withholding: number
  est_employee_ss: number
  est_employee_medicare: number
  est_net_pay: number
  contractor_payment: number
  contractor_payment_memo?: string | null
  status: PayrollRecordStatus
  approved_at: string | null
}

export interface PayrollAdjustment {
  id: string
  payroll_record_id: string | null
  pay_period_id: string
  profile_id: string
  adjustment_type:
    | 'bonus'
    | 'commission'
    | 'expense_reimbursement'
    | 'advance'
    | 'advance_repayment'
    | 'correction'
    | 'garnishment'
    | 'other_addition'
    | 'other_deduction'
  amount: number
  is_taxable: boolean
  description: string
  reference_id: string | null
  project_id: string | null
  created_at: string
}

export interface PayrollYTD {
  profile_id: string
  year: number
  gross_pay_ytd: number
  federal_withholding_ytd: number
  state_withholding_ytd: number
  employee_ss_ytd: number
  employee_medicare_ytd: number
  retirement_employee_ytd: number
  retirement_employer_ytd: number
  health_employee_ytd: number
  health_employer_ytd: number
  net_pay_ytd: number
}

// Workers — Adam (owner), Jeff (W-2), Steven (W-2), one example 1099 contractor
export const MOCK_PAYROLL_WORKERS: PayrollWorker[] = [
  {
    profile_id: 'admin-1',
    full_name: 'Adam Kilgore',
    worker_type: 'owner',
    pay_type: 'salary',
    annual_salary: 65000,
    hourly_rate: null,
    standard_hours_per_week: 40,
    overtime_eligible: false,
    hire_date: '2020-01-01',
    termination_date: null,
    filing_status: 'married_jointly',
    pay_frequency: 'biweekly',
    suta_rate: 0.027,
    gusto_employee_id: null,
    gusto_contractor_id: null,
  },
  {
    profile_id: 'employee-1',
    full_name: 'Jeff Miller',
    worker_type: 'w2_fulltime',
    pay_type: 'salary',
    annual_salary: 80000,
    hourly_rate: null,
    standard_hours_per_week: 40,
    overtime_eligible: false,
    hire_date: '2023-03-01',
    termination_date: null,
    filing_status: 'married_jointly',
    pay_frequency: 'biweekly',
    suta_rate: 0.027,
    gusto_employee_id: null,
    gusto_contractor_id: null,
  },
  {
    profile_id: 'employee-2',
    full_name: 'Steven Clark',
    worker_type: 'w2_fulltime',
    pay_type: 'salary',
    annual_salary: 56000,
    hourly_rate: null,
    standard_hours_per_week: 40,
    overtime_eligible: false,
    hire_date: '2023-06-01',
    termination_date: null,
    filing_status: 'single',
    pay_frequency: 'biweekly',
    suta_rate: 0.027,
    gusto_employee_id: null,
    gusto_contractor_id: null,
  },
  {
    profile_id: 'contractor-1',
    full_name: 'Mike Rodriguez (Plumbing)',
    worker_type: 'contractor_1099',
    pay_type: 'hourly',
    annual_salary: null,
    hourly_rate: null,
    standard_hours_per_week: 0,
    overtime_eligible: false,
    hire_date: '2024-01-01',
    termination_date: null,
    filing_status: 'single',
    pay_frequency: 'biweekly',
    suta_rate: 0,
    gusto_employee_id: null,
    gusto_contractor_id: null,
  },
]

export const MOCK_COMPENSATION_COMPONENTS: CompensationComponent[] = [
  // Jeff
  { id: 'cc-1', profile_id: 'employee-1', component_type: 'base_salary',         amount: 80000, amount_frequency: 'annual',  is_taxable: true,  is_pre_tax: false, effective_from: '2023-03-01', effective_to: null, is_active: true, notes: 'Annual base salary' },
  { id: 'cc-2', profile_id: 'employee-1', component_type: 'vehicle_allowance',   amount: 300,   amount_frequency: 'monthly', is_taxable: true,  is_pre_tax: false, effective_from: '2023-03-01', effective_to: null, is_active: true, notes: 'Fixed vehicle allowance — taxable per IRS' },
  { id: 'cc-3', profile_id: 'employee-1', component_type: 'retirement_employer', amount: 3500,  amount_frequency: 'annual',  is_taxable: false, is_pre_tax: false, effective_from: '2023-03-01', effective_to: null, is_active: true, notes: 'Flat $3,500/year SIMPLE IRA employer contribution' },
  // Steven
  { id: 'cc-4', profile_id: 'employee-2', component_type: 'base_salary',       amount: 56000, amount_frequency: 'annual',  is_taxable: true,  is_pre_tax: false, effective_from: '2023-06-01', effective_to: null, is_active: true, notes: 'Annual base salary' },
  { id: 'cc-5', profile_id: 'employee-2', component_type: 'vehicle_allowance', amount: 300,   amount_frequency: 'monthly', is_taxable: true,  is_pre_tax: false, effective_from: '2023-06-01', effective_to: null, is_active: true, notes: 'Fixed vehicle allowance — taxable per IRS' },
  { id: 'cc-6', profile_id: 'employee-2', component_type: 'health_employer',   amount: 200,   amount_frequency: 'monthly', is_taxable: false, is_pre_tax: false, effective_from: '2023-06-01', effective_to: null, is_active: true, notes: 'Employer health insurance contribution' },
  // Adam
  { id: 'cc-7', profile_id: 'admin-1', component_type: 'base_salary', amount: 65000, amount_frequency: 'annual', is_taxable: true, is_pre_tax: false, effective_from: '2020-01-01', effective_to: null, is_active: true, notes: 'S-corp owner salary (W-2)' },
]

export const MOCK_BENEFITS_ENROLLMENT: BenefitsEnrollment[] = [
  {
    id: 'be-1',
    profile_id: 'employee-1',
    benefit_type: 'retirement_simple_ira',
    plan_name: 'AK Renovations SIMPLE IRA',
    carrier: 'TBD',
    employee_contribution_amount: 0,
    employee_contribution_frequency: 'percent_of_gross',
    employer_contribution_amount: 3500,
    employer_contribution_frequency: 'annual',
    employee_contribution_percent: 3,
    is_pre_tax: true,
    is_active: true,
    effective_from: '2023-03-01',
  },
  {
    id: 'be-2',
    profile_id: 'employee-2',
    benefit_type: 'health',
    plan_name: 'Anthem Bronze HSA',
    carrier: 'Anthem',
    employee_contribution_amount: 200,
    employee_contribution_frequency: 'monthly',
    employer_contribution_amount: 200,
    employer_contribution_frequency: 'monthly',
    employee_contribution_percent: null,
    is_pre_tax: true,
    is_active: true,
    effective_from: '2023-06-01',
  },
]

// 26 bi-weekly pay periods for 2026, anchored to Friday Jan 9, 2026.
function generateMockPayPeriods(): PayPeriod[] {
  const out: PayPeriod[] = []
  // Jan 9, 2026 = first pay date
  const baseEpoch = Date.UTC(2026, 0, 9)
  const today = new Date('2026-04-07')
  for (let i = 1; i <= 26; i++) {
    const payDate = new Date(baseEpoch + (i - 1) * 14 * 86400000)
    const periodEnd = new Date(payDate.getTime())
    const periodStart = new Date(payDate.getTime() - 13 * 86400000)
    let status: PayrollPeriodStatus = 'upcoming'
    if (today > periodEnd) status = 'closed'
    else if (today >= periodStart && today <= periodEnd) status = 'open'
    out.push({
      id: `pp-${i}`,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      pay_date: payDate.toISOString().split('T')[0],
      period_number: i,
      year: 2026,
      status,
      gusto_payroll_id: null,
      submitted_at: null,
    })
  }
  return out
}

export const MOCK_PAY_PERIODS: PayPeriod[] = generateMockPayPeriods()

// Find the current "open" period
export const MOCK_CURRENT_PAY_PERIOD: PayPeriod =
  MOCK_PAY_PERIODS.find((p) => p.status === 'open') ?? MOCK_PAY_PERIODS[6]

// Calculated payroll records for the current open period
function calcMockRecord(profile_id: string, periodId: string): PayrollRecord {
  const w = MOCK_PAYROLL_WORKERS.find((x) => x.profile_id === profile_id)!
  if (w.worker_type === 'contractor_1099') {
    return {
      id: `pr-${periodId}-${profile_id}`,
      pay_period_id: periodId,
      profile_id,
      worker_type: w.worker_type,
      regular_hours: 0,
      overtime_hours: 0,
      pto_hours: 0,
      holiday_hours: 0,
      total_hours: 0,
      base_pay: 0,
      overtime_pay: 0,
      vehicle_allowance: 0,
      phone_stipend: 0,
      other_allowances: 0,
      bonus_amount: 0,
      gross_pay: 0,
      health_deduction: 0,
      retirement_deduction: 0,
      other_deductions: 0,
      total_deductions: 0,
      employer_health_cost: 0,
      employer_retirement_cost: 0,
      employer_ss_tax: 0,
      employer_medicare_tax: 0,
      employer_futa: 0,
      employer_suta: 0,
      total_employer_cost: 0,
      est_federal_withholding: 0,
      est_state_withholding: 0,
      est_employee_ss: 0,
      est_employee_medicare: 0,
      est_net_pay: 0,
      contractor_payment: 0,
      contractor_payment_memo: null,
      status: 'calculated',
      approved_at: null,
    }
  }

  const PER = 26
  const basePay = (w.annual_salary ?? 0) / PER
  const comps = MOCK_COMPENSATION_COMPONENTS.filter((c) => c.profile_id === profile_id)
  const vehicleAllowance =
    comps
      .filter((c) => c.component_type === 'vehicle_allowance')
      .reduce((s, c) => s + (c.amount * 12) / PER, 0)
  const empHealth = comps
    .filter((c) => c.component_type === 'health_employer')
    .reduce((s, c) => s + (c.amount * 12) / PER, 0)
  const empRetirement = comps
    .filter((c) => c.component_type === 'retirement_employer')
    .reduce((s, c) => s + c.amount / PER, 0)

  const benefits = MOCK_BENEFITS_ENROLLMENT.filter((b) => b.profile_id === profile_id)
  const healthBenefit = benefits.find((b) => b.benefit_type === 'health')
  const retirementBenefit = benefits.find((b) => b.benefit_type === 'retirement_simple_ira')

  const grossPay = basePay + vehicleAllowance
  const healthDeduction = healthBenefit
    ? (healthBenefit.employee_contribution_amount * 12) / PER
    : 0
  const retirementDeduction = retirementBenefit?.employee_contribution_percent
    ? grossPay * (retirementBenefit.employee_contribution_percent / 100)
    : 0
  const taxableGross = grossPay - healthDeduction - retirementDeduction

  const estFederal = taxableGross * 0.143
  const estState = taxableGross * 0.035
  const estSS = taxableGross * 0.062
  const estMedicare = taxableGross * 0.0145

  const totalDeductions = healthDeduction + retirementDeduction + estFederal + estState + estSS + estMedicare
  const estNetPay = grossPay - totalDeductions

  const employerHealthCost = empHealth + (healthBenefit ? (healthBenefit.employer_contribution_amount * 12) / PER : 0)
  const employerRetirementCost = empRetirement + (retirementBenefit ? retirementBenefit.employer_contribution_amount / PER : 0)
  const employerSS = estSS
  const employerMedicare = estMedicare
  const employerFUTA = Math.min(grossPay, 7000) * 0.006
  const employerSUTA = grossPay * w.suta_rate
  const totalEmployerCost =
    grossPay + employerHealthCost + employerRetirementCost + employerSS + employerMedicare + employerFUTA + employerSUTA

  return {
    id: `pr-${periodId}-${profile_id}`,
    pay_period_id: periodId,
    profile_id,
    worker_type: w.worker_type,
    regular_hours: 80,
    overtime_hours: 0,
    pto_hours: 0,
    holiday_hours: 0,
    total_hours: 80,
    base_pay: round2(basePay),
    overtime_pay: 0,
    vehicle_allowance: round2(vehicleAllowance),
    phone_stipend: 0,
    other_allowances: 0,
    bonus_amount: 0,
    gross_pay: round2(grossPay),
    health_deduction: round2(healthDeduction),
    retirement_deduction: round2(retirementDeduction),
    other_deductions: 0,
    total_deductions: round2(totalDeductions),
    employer_health_cost: round2(employerHealthCost),
    employer_retirement_cost: round2(employerRetirementCost),
    employer_ss_tax: round2(employerSS),
    employer_medicare_tax: round2(employerMedicare),
    employer_futa: round2(employerFUTA),
    employer_suta: round2(employerSUTA),
    total_employer_cost: round2(totalEmployerCost),
    est_federal_withholding: round2(estFederal),
    est_state_withholding: round2(estState),
    est_employee_ss: round2(estSS),
    est_employee_medicare: round2(estMedicare),
    est_net_pay: round2(estNetPay),
    contractor_payment: 0,
    contractor_payment_memo: null,
    status: 'calculated',
    approved_at: null,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const MOCK_PAYROLL_RECORDS: PayrollRecord[] = [
  calcMockRecord('admin-1', MOCK_CURRENT_PAY_PERIOD.id),
  calcMockRecord('employee-1', MOCK_CURRENT_PAY_PERIOD.id),
  calcMockRecord('employee-2', MOCK_CURRENT_PAY_PERIOD.id),
  calcMockRecord('contractor-1', MOCK_CURRENT_PAY_PERIOD.id),
]

export const MOCK_PAYROLL_ADJUSTMENTS: PayrollAdjustment[] = []

// YTD totals (estimated through period 6 of 2026)
const PERIODS_PROCESSED = Math.max(MOCK_CURRENT_PAY_PERIOD.period_number - 1, 0)
function buildYTD(profile_id: string): PayrollYTD {
  const rec = calcMockRecord(profile_id, MOCK_CURRENT_PAY_PERIOD.id)
  const m = PERIODS_PROCESSED
  return {
    profile_id,
    year: 2026,
    gross_pay_ytd: round2(rec.gross_pay * m),
    federal_withholding_ytd: round2(rec.est_federal_withholding * m),
    state_withholding_ytd: round2(rec.est_state_withholding * m),
    employee_ss_ytd: round2(rec.est_employee_ss * m),
    employee_medicare_ytd: round2(rec.est_employee_medicare * m),
    retirement_employee_ytd: round2(rec.retirement_deduction * m),
    retirement_employer_ytd: round2(rec.employer_retirement_cost * m),
    health_employee_ytd: round2(rec.health_deduction * m),
    health_employer_ytd: round2(rec.employer_health_cost * m),
    net_pay_ytd: round2(rec.est_net_pay * m),
  }
}

export const MOCK_PAYROLL_YTD: PayrollYTD[] = [
  buildYTD('admin-1'),
  buildYTD('employee-1'),
  buildYTD('employee-2'),
  buildYTD('contractor-1'),
]

// Past payroll runs (closed periods) — for "Recent payroll history"
export const MOCK_PAST_PAYROLL_RUNS = MOCK_PAY_PERIODS.filter((p) => p.status === 'closed')
  .slice(-4)
  .map((p) => ({
    period: p,
    total_paid: round2(
      MOCK_PAYROLL_WORKERS.filter((w) => w.worker_type !== 'contractor_1099').reduce(
        (s, w) => s + ((w.annual_salary ?? 0) / 26 + 138.46),
        0,
      ),
    ),
  }))


// ── Phase J: Estimate Templates ─────────────────────────────────────────────

export type EstimateTemplateFinishLevel = 'builder' | 'mid_range' | 'high_end' | 'luxury'
export type EstimateTemplateConfidence = 'industry' | 'regional' | 'actual'

export interface EstimateTemplate {
  id: string
  project_type: string
  name: string
  finish_level: EstimateTemplateFinishLevel
  size_range_min_sqft: number
  size_range_max_sqft: number
  total_cost_min: number
  total_cost_max: number
  total_cost_typical: number
  duration_weeks_min: number
  duration_weeks_max: number
  duration_weeks_typical: number
  projects_count: number
  last_calibrated_at: string | null
  confidence_level: EstimateTemplateConfidence
  unit_costs: Record<string, { min: number; max: number; typical: number; unit: string }>
  trade_breakdown: Record<string, { pct_typical: number }>
}

export const MOCK_ESTIMATE_TEMPLATES: EstimateTemplate[] = [
  {
    id: 'tpl-k-mid',
    project_type: 'kitchen',
    name: 'Kitchen Remodel — Mid-Range',
    finish_level: 'mid_range',
    size_range_min_sqft: 100,
    size_range_max_sqft: 250,
    total_cost_min: 35000,
    total_cost_max: 75000,
    total_cost_typical: 52000,
    duration_weeks_min: 4,
    duration_weeks_max: 8,
    duration_weeks_typical: 6,
    projects_count: 0,
    last_calibrated_at: null,
    confidence_level: 'industry',
    unit_costs: {
      cabinet_linear_ft: { min: 450, max: 750, typical: 575, unit: 'per linear ft' },
      countertop_sqft: { min: 50, max: 120, typical: 75, unit: 'per sqft' },
      backsplash_sqft: { min: 15, max: 35, typical: 22, unit: 'per sqft installed' },
      flooring_sqft: { min: 8, max: 20, typical: 13, unit: 'per sqft installed' },
      appliance_allowance: { min: 4000, max: 12000, typical: 7000, unit: 'allowance' },
      plumbing: { min: 3500, max: 7000, typical: 5000, unit: 'rough and finish' },
      electrical: { min: 2500, max: 5500, typical: 3800, unit: 'rough and finish' },
      demo_disposal: { min: 1200, max: 2800, typical: 1800, unit: 'flat' },
      painting: { min: 800, max: 2000, typical: 1200, unit: 'flat' },
    },
    trade_breakdown: {
      cabinets_hardware: { pct_typical: 0.32 },
      countertops: { pct_typical: 0.12 },
      flooring_tile: { pct_typical: 0.08 },
      plumbing: { pct_typical: 0.10 },
      electrical: { pct_typical: 0.07 },
      appliances: { pct_typical: 0.13 },
      demo_drywall_paint: { pct_typical: 0.07 },
      crew_labor_pm: { pct_typical: 0.11 },
    },
  },
  {
    id: 'tpl-k-high',
    project_type: 'kitchen',
    name: 'Kitchen Remodel — High-End',
    finish_level: 'high_end',
    size_range_min_sqft: 150,
    size_range_max_sqft: 400,
    total_cost_min: 75000,
    total_cost_max: 180000,
    total_cost_typical: 115000,
    duration_weeks_min: 6,
    duration_weeks_max: 14,
    duration_weeks_typical: 10,
    projects_count: 0,
    last_calibrated_at: null,
    confidence_level: 'industry',
    unit_costs: {
      cabinet_linear_ft: { min: 800, max: 2500, typical: 1400, unit: 'per linear ft' },
      countertop_sqft: { min: 100, max: 350, typical: 180, unit: 'per sqft' },
      backsplash_sqft: { min: 30, max: 120, typical: 60, unit: 'per sqft installed' },
      flooring_sqft: { min: 15, max: 45, typical: 28, unit: 'per sqft installed' },
      appliance_allowance: { min: 15000, max: 60000, typical: 30000, unit: 'allowance' },
      plumbing: { min: 6000, max: 15000, typical: 9000, unit: 'rough and finish' },
      electrical: { min: 5000, max: 14000, typical: 8500, unit: 'rough and finish' },
      demo_disposal: { min: 2000, max: 5000, typical: 3200, unit: 'flat' },
      painting: { min: 1500, max: 5000, typical: 2800, unit: 'flat' },
    },
    trade_breakdown: {
      cabinets_hardware: { pct_typical: 0.35 },
      countertops: { pct_typical: 0.14 },
      flooring_tile: { pct_typical: 0.07 },
      plumbing: { pct_typical: 0.08 },
      electrical: { pct_typical: 0.07 },
      appliances: { pct_typical: 0.18 },
      demo_drywall_paint: { pct_typical: 0.05 },
      crew_labor_pm: { pct_typical: 0.06 },
    },
  },
  {
    id: 'tpl-b-mid',
    project_type: 'bathroom',
    name: 'Bathroom Remodel — Mid-Range',
    finish_level: 'mid_range',
    size_range_min_sqft: 35,
    size_range_max_sqft: 100,
    total_cost_min: 18000,
    total_cost_max: 45000,
    total_cost_typical: 28000,
    duration_weeks_min: 2,
    duration_weeks_max: 5,
    duration_weeks_typical: 3,
    projects_count: 0,
    last_calibrated_at: null,
    confidence_level: 'industry',
    unit_costs: {
      vanity_each: { min: 800, max: 3500, typical: 1800, unit: 'each installed' },
      shower_tile_sqft: { min: 18, max: 40, typical: 26, unit: 'per sqft installed' },
      floor_tile_sqft: { min: 12, max: 28, typical: 18, unit: 'per sqft installed' },
      shower_door_each: { min: 600, max: 2500, typical: 1200, unit: 'each' },
      tub_each: { min: 500, max: 4000, typical: 1500, unit: 'each installed' },
      fixtures_allowance: { min: 800, max: 3500, typical: 1800, unit: 'allowance' },
      plumbing: { min: 3000, max: 7000, typical: 4800, unit: 'rough and finish' },
      electrical: { min: 1200, max: 3000, typical: 1800, unit: 'rough and finish' },
      demo_disposal: { min: 800, max: 2000, typical: 1200, unit: 'flat' },
    },
    trade_breakdown: {
      tile_materials_install: { pct_typical: 0.28 },
      plumbing: { pct_typical: 0.18 },
      vanity_fixtures: { pct_typical: 0.16 },
      electrical: { pct_typical: 0.07 },
      shower_door_tub: { pct_typical: 0.08 },
      demo_drywall_paint: { pct_typical: 0.10 },
      crew_labor_pm: { pct_typical: 0.13 },
    },
  },
  {
    id: 'tpl-add-std',
    project_type: 'addition',
    name: 'Home Addition — Standard',
    finish_level: 'mid_range',
    size_range_min_sqft: 200,
    size_range_max_sqft: 800,
    total_cost_min: 150000,
    total_cost_max: 450000,
    total_cost_typical: 280000,
    duration_weeks_min: 16,
    duration_weeks_max: 36,
    duration_weeks_typical: 24,
    projects_count: 0,
    last_calibrated_at: null,
    confidence_level: 'industry',
    unit_costs: {
      cost_per_sqft: { min: 200, max: 380, typical: 280, unit: 'per sqft finished' },
      foundation_linear_ft: { min: 180, max: 380, typical: 260, unit: 'per linear ft' },
      framing_sqft: { min: 28, max: 55, typical: 38, unit: 'per sqft' },
      roofing_sqft: { min: 8, max: 18, typical: 13, unit: 'per sqft' },
      windows_each: { min: 450, max: 1800, typical: 900, unit: 'each installed' },
      exterior_door_each: { min: 800, max: 3500, typical: 1600, unit: 'each installed' },
      hvac_per_ton: { min: 3500, max: 7000, typical: 5000, unit: 'per ton capacity' },
      electrical_sqft: { min: 18, max: 38, typical: 26, unit: 'per sqft' },
      plumbing_fixture: { min: 800, max: 2500, typical: 1400, unit: 'per fixture' },
    },
    trade_breakdown: {
      excavation_foundation: { pct_typical: 0.12 },
      framing: { pct_typical: 0.14 },
      exterior_envelope: { pct_typical: 0.16 },
      mechanical_electrical_plumbing: { pct_typical: 0.20 },
      interior_finishes: { pct_typical: 0.22 },
      crew_labor_pm: { pct_typical: 0.10 },
      contingency: { pct_typical: 0.06 },
    },
  },
  {
    id: 'tpl-bsmt-std',
    project_type: 'basement',
    name: 'Basement Finish — Standard',
    finish_level: 'mid_range',
    size_range_min_sqft: 400,
    size_range_max_sqft: 1200,
    total_cost_min: 35000,
    total_cost_max: 95000,
    total_cost_typical: 58000,
    duration_weeks_min: 5,
    duration_weeks_max: 10,
    duration_weeks_typical: 7,
    projects_count: 0,
    last_calibrated_at: null,
    confidence_level: 'industry',
    unit_costs: {
      cost_per_sqft: { min: 50, max: 100, typical: 68, unit: 'per sqft finished' },
      framing_sqft: { min: 4, max: 10, typical: 6.5, unit: 'per sqft' },
      electrical_sqft: { min: 8, max: 18, typical: 12, unit: 'per sqft' },
      drywall_sqft: { min: 2.5, max: 5, typical: 3.5, unit: 'per sqft' },
      flooring_sqft: { min: 4, max: 18, typical: 9, unit: 'per sqft installed' },
      bathroom_rough_in: { min: 4000, max: 12000, typical: 7500, unit: 'if adding bath' },
      egress_window_each: { min: 2500, max: 5500, typical: 3800, unit: 'each' },
    },
    trade_breakdown: {
      framing_insulation: { pct_typical: 0.10 },
      electrical: { pct_typical: 0.14 },
      drywall_paint: { pct_typical: 0.16 },
      flooring: { pct_typical: 0.14 },
      bathroom_if_applicable: { pct_typical: 0.18 },
      trim_doors: { pct_typical: 0.10 },
      crew_labor_pm: { pct_typical: 0.18 },
    },
  },
  {
    id: 'tpl-ff-std',
    project_type: 'first_floor',
    name: 'First-Floor Transformation',
    finish_level: 'mid_range',
    size_range_min_sqft: 800,
    size_range_max_sqft: 2000,
    total_cost_min: 65000,
    total_cost_max: 180000,
    total_cost_typical: 110000,
    duration_weeks_min: 8,
    duration_weeks_max: 18,
    duration_weeks_typical: 12,
    projects_count: 0,
    last_calibrated_at: null,
    confidence_level: 'industry',
    unit_costs: {
      cost_per_sqft: { min: 65, max: 130, typical: 90, unit: 'per sqft affected' },
      wall_removal_each: { min: 2500, max: 8000, typical: 4500, unit: 'per bearing wall' },
      flooring_sqft: { min: 6, max: 22, typical: 12, unit: 'per sqft installed' },
      trim_linear_ft: { min: 6, max: 16, typical: 10, unit: 'per linear ft' },
      painting_sqft: { min: 1.5, max: 4, typical: 2.5, unit: 'per sqft wall area' },
      electrical_updates: { min: 4000, max: 14000, typical: 7500, unit: 'allowance' },
      kitchen_if_included: { min: 35000, max: 120000, typical: 55000, unit: 'if in scope' },
    },
    trade_breakdown: {
      structural_demo: { pct_typical: 0.08 },
      flooring: { pct_typical: 0.16 },
      kitchen_if_applicable: { pct_typical: 0.30 },
      electrical: { pct_typical: 0.08 },
      drywall_paint: { pct_typical: 0.14 },
      trim_doors: { pct_typical: 0.10 },
      crew_labor_pm: { pct_typical: 0.14 },
    },
  },
]

// ── Phase J: Checklist Templates & Items ────────────────────────────────────

export type ChecklistCategory =
  | 'marketing'
  | 'sales_prep'
  | 'sales_call'
  | 'client_meeting'
  | 'client_onboarding'
  | 'project_kickoff'
  | 'project_sop'
  | 'project_closeout'
  | 'post_project'
  | 'employee_onboarding'
  | 'subcontractor_onboarding'
  | 'compliance'

export type ChecklistTriggerEvent =
  | 'manual'
  | 'lead_created'
  | 'consultation_scheduled'
  | 'proposal_sent'
  | 'contract_signed'
  | 'project_started'
  | 'project_phase_change'
  | 'project_complete'
  | 'employee_hired'
  | 'sub_awarded'

export type ChecklistItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked'
export type ChecklistInstanceStatus = 'active' | 'completed' | 'skipped' | 'archived'

export interface ChecklistTemplate {
  id: string
  name: string
  description: string
  category: ChecklistCategory
  project_type: string | null
  applies_to_role: ('admin' | 'employee')[]
  trigger_event: ChecklistTriggerEvent
  due_days_from_trigger: number | null
  sort_order: number
  is_active: boolean
  item_count: number
}

export interface ChecklistTemplateItem {
  id: string
  template_id: string
  title: string
  description: string | null
  assigned_role: 'admin' | 'employee' | 'any'
  is_required: boolean
  requires_upload: boolean
  requires_signature: boolean
  requires_note: boolean
  ai_help_available: boolean
  external_link: string | null
  sort_order: number
}

export interface ChecklistInstance {
  id: string
  template_id: string
  template_name: string
  entity_type: 'project' | 'lead' | 'employee' | 'subcontractor' | 'general'
  entity_id: string
  entity_label: string
  status: ChecklistInstanceStatus
  completion_percent: number
  triggered_by: string
  triggered_at: string
  due_date: string | null
}

export interface ChecklistInstanceItem {
  id: string
  instance_id: string
  title: string
  description: string | null
  assigned_role: 'admin' | 'employee' | 'any'
  assigned_to: string | null
  due_date: string | null
  is_required: boolean
  status: ChecklistItemStatus
  completion_note: string | null
  ai_help_available: boolean
  ai_help_prompt: string | null
  external_link: string | null
  sort_order: number
}

// Mirror the seeded templates from the migration file (same ids structure, simplified).
// Keeps the UI functional pre-Supabase-connection.
const TPL_IDS = {
  marketing: 'ctpl-01',
  salesPrep: 'ctpl-02',
  salesCall: 'ctpl-03',
  clientMeeting: 'ctpl-04',
  clientOnboarding: 'ctpl-05',
  employeeOnboarding: 'ctpl-06',
  subOnboarding: 'ctpl-07',
  kitchenSop: 'ctpl-08',
  bathroomSop: 'ctpl-09',
  additionSop: 'ctpl-10',
  basementSop: 'ctpl-11',
  firstFloorSop: 'ctpl-12',
  closeout: 'ctpl-13',
  postProject: 'ctpl-14',
} as const

export const MOCK_CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  { id: TPL_IDS.marketing, name: 'Monthly Marketing Checklist', description: 'Review marketing performance and execute routine marketing tasks monthly.', category: 'marketing', project_type: null, applies_to_role: ['admin'], trigger_event: 'manual', due_days_from_trigger: null, sort_order: 10, is_active: true, item_count: 10 },
  { id: TPL_IDS.salesPrep, name: 'Sales Call Prep Checklist', description: 'Prepare for an upcoming consultation.', category: 'sales_prep', project_type: null, applies_to_role: ['admin'], trigger_event: 'consultation_scheduled', due_days_from_trigger: null, sort_order: 20, is_active: true, item_count: 8 },
  { id: TPL_IDS.salesCall, name: 'Sales Call / Site Visit Checklist', description: 'Execute the on-site consultation.', category: 'sales_call', project_type: null, applies_to_role: ['admin'], trigger_event: 'manual', due_days_from_trigger: null, sort_order: 30, is_active: true, item_count: 10 },
  { id: TPL_IDS.clientMeeting, name: 'Client Meeting Checklist', description: 'Prepare for and document any in-progress project meeting.', category: 'client_meeting', project_type: null, applies_to_role: ['admin'], trigger_event: 'manual', due_days_from_trigger: null, sort_order: 40, is_active: true, item_count: 10 },
  { id: TPL_IDS.clientOnboarding, name: 'Client Onboarding Checklist', description: 'Welcome the client, collect deposit, prep the project, and set kickoff.', category: 'client_onboarding', project_type: null, applies_to_role: ['admin'], trigger_event: 'contract_signed', due_days_from_trigger: 14, sort_order: 50, is_active: true, item_count: 14 },
  { id: TPL_IDS.employeeOnboarding, name: 'Employee Onboarding Checklist', description: 'Onboarding workflow for a new crew member.', category: 'employee_onboarding', project_type: null, applies_to_role: ['admin', 'employee'], trigger_event: 'employee_hired', due_days_from_trigger: 20, sort_order: 60, is_active: true, item_count: 18 },
  { id: TPL_IDS.subOnboarding, name: 'Subcontractor Onboarding Checklist', description: 'Collect insurance, license, W-9, and agreement paperwork.', category: 'subcontractor_onboarding', project_type: null, applies_to_role: ['admin'], trigger_event: 'sub_awarded', due_days_from_trigger: null, sort_order: 70, is_active: true, item_count: 11 },
  { id: TPL_IDS.kitchenSop, name: 'Kitchen SOP Checklist', description: 'Standard operating procedure for kitchen remodels.', category: 'project_sop', project_type: 'kitchen', applies_to_role: ['admin', 'employee'], trigger_event: 'project_started', due_days_from_trigger: null, sort_order: 80, is_active: true, item_count: 41 },
  { id: TPL_IDS.bathroomSop, name: 'Bathroom SOP Checklist', description: 'Standard operating procedure for bathroom remodels.', category: 'project_sop', project_type: 'bathroom', applies_to_role: ['admin', 'employee'], trigger_event: 'project_started', due_days_from_trigger: null, sort_order: 90, is_active: true, item_count: 33 },
  { id: TPL_IDS.additionSop, name: 'Home Addition SOP Checklist', description: 'Standard operating procedure for home additions.', category: 'project_sop', project_type: 'addition', applies_to_role: ['admin', 'employee'], trigger_event: 'project_started', due_days_from_trigger: null, sort_order: 100, is_active: true, item_count: 36 },
  { id: TPL_IDS.basementSop, name: 'Basement Finish SOP Checklist', description: 'Standard operating procedure for basement finishes.', category: 'project_sop', project_type: 'basement', applies_to_role: ['admin', 'employee'], trigger_event: 'project_started', due_days_from_trigger: null, sort_order: 110, is_active: true, item_count: 20 },
  { id: TPL_IDS.firstFloorSop, name: 'First-Floor Transformation SOP Checklist', description: 'Standard operating procedure for first-floor transformations.', category: 'project_sop', project_type: 'first_floor', applies_to_role: ['admin', 'employee'], trigger_event: 'project_started', due_days_from_trigger: null, sort_order: 120, is_active: true, item_count: 21 },
  { id: TPL_IDS.closeout, name: 'Project Closeout Checklist', description: 'Final closeout steps for every completed project.', category: 'project_closeout', project_type: null, applies_to_role: ['admin', 'employee'], trigger_event: 'project_complete', due_days_from_trigger: null, sort_order: 130, is_active: true, item_count: 17 },
  { id: TPL_IDS.postProject, name: 'Post-Project Sequence', description: '12-month follow-up sequence after project completion.', category: 'post_project', project_type: null, applies_to_role: ['admin'], trigger_event: 'project_complete', due_days_from_trigger: 365, sort_order: 140, is_active: true, item_count: 8 },
]

// Active checklist instances (samples for UI — Johnson Bath + Thompson Kitchen)
export const MOCK_CHECKLIST_INSTANCES: ChecklistInstance[] = [
  {
    id: 'cinst-1',
    template_id: TPL_IDS.clientOnboarding,
    template_name: 'Client Onboarding Checklist',
    entity_type: 'project',
    entity_id: 'proj-1',
    entity_label: 'Johnson Master Bath Remodel',
    status: 'active',
    completion_percent: 71,
    triggered_by: 'contract_signed',
    triggered_at: '2026-03-01T10:00:00Z',
    due_date: '2026-03-15',
  },
  {
    id: 'cinst-2',
    template_id: TPL_IDS.bathroomSop,
    template_name: 'Bathroom SOP Checklist',
    entity_type: 'project',
    entity_id: 'proj-1',
    entity_label: 'Johnson Master Bath Remodel',
    status: 'active',
    completion_percent: 55,
    triggered_by: 'project_started',
    triggered_at: '2026-03-10T09:00:00Z',
    due_date: null,
  },
  {
    id: 'cinst-3',
    template_id: TPL_IDS.additionSop,
    template_name: 'Home Addition SOP Checklist',
    entity_type: 'project',
    entity_id: 'proj-2',
    entity_label: 'Thompson Kitchen Addition',
    status: 'active',
    completion_percent: 32,
    triggered_by: 'project_started',
    triggered_at: '2026-02-15T08:00:00Z',
    due_date: null,
  },
  {
    id: 'cinst-4',
    template_id: TPL_IDS.clientOnboarding,
    template_name: 'Client Onboarding Checklist',
    entity_type: 'project',
    entity_id: 'proj-3',
    entity_label: 'Martinez Basement Finish',
    status: 'active',
    completion_percent: 20,
    triggered_by: 'contract_signed',
    triggered_at: '2026-04-02T14:00:00Z',
    due_date: '2026-04-16',
  },
]

// Sample items for the Johnson onboarding instance — enough to drive the UI
export const MOCK_CHECKLIST_INSTANCE_ITEMS: ChecklistInstanceItem[] = [
  { id: 'citem-1', instance_id: 'cinst-1', title: 'Send welcome message and introduction to how we work', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-02', is_required: true, status: 'completed', completion_note: null, ai_help_available: true, ai_help_prompt: 'Draft the client welcome message for the Johnson Master Bath project', external_link: null, sort_order: 1 },
  { id: 'citem-2', instance_id: 'cinst-1', title: 'Collect deposit payment — confirm receipt', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-04', is_required: true, status: 'completed', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 2 },
  { id: 'citem-3', instance_id: 'cinst-1', title: 'Schedule kickoff/selections meeting — within first week', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-08', is_required: true, status: 'completed', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 3 },
  { id: 'citem-4', instance_id: 'cinst-1', title: 'Send selections checklist to client — what they need to choose and by when', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-06', is_required: true, status: 'completed', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 4 },
  { id: 'citem-5', instance_id: 'cinst-1', title: 'Submit permit applications — pull list from project type', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-08', is_required: true, status: 'completed', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 5 },
  { id: 'citem-6', instance_id: 'cinst-1', title: 'Order any long-lead materials (cabinets, windows — 6-8 week lead time)', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-04', is_required: true, status: 'completed', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 6 },
  { id: 'citem-7', instance_id: 'cinst-1', title: 'Confirm subcontractor schedules — framing, plumbing, electrical booked?', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-11', is_required: true, status: 'completed', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 7 },
  { id: 'citem-8', instance_id: 'cinst-1', title: 'Add project to master schedule — crew assigned?', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-03', is_required: true, status: 'completed', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 8 },
  { id: 'citem-9', instance_id: 'cinst-1', title: 'Create project folder in Google Drive', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-02', is_required: true, status: 'completed', completion_note: null, ai_help_available: true, ai_help_prompt: 'Set up Google Drive folder structure for Johnson Master Bath', external_link: null, sort_order: 9 },
  { id: 'citem-10', instance_id: 'cinst-1', title: 'Set up client portal access — send login link', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-03', is_required: true, status: 'pending', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 10 },
  { id: 'citem-11', instance_id: 'cinst-1', title: 'Add client to Twilio — ensure business number is their contact', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-03', is_required: true, status: 'pending', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 11 },
  { id: 'citem-12', instance_id: 'cinst-1', title: 'Schedule pre-construction walkthrough — take baseline photos', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-08', is_required: true, status: 'pending', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 12 },
  { id: 'citem-13', instance_id: 'cinst-1', title: 'Confirm all selections are due 2 weeks before that trade starts', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-08', is_required: true, status: 'pending', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 13 },
  { id: 'citem-14', instance_id: 'cinst-1', title: 'Brief Jeff and Steven on project scope and start date', description: null, assigned_role: 'admin', assigned_to: 'admin-1', due_date: '2026-03-06', is_required: true, status: 'pending', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 14 },

  // Jeff's current bathroom SOP items — visible in employee launchpad
  { id: 'citem-sop-1', instance_id: 'cinst-2', title: 'Install shower pan and verify slope to drain', description: 'Waterproofing', assigned_role: 'employee', assigned_to: 'employee-1', due_date: '2026-04-08', is_required: true, status: 'completed', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 16 },
  { id: 'citem-sop-2', instance_id: 'cinst-2', title: 'Install waterproofing membrane — Kerdi, RedGard, or equivalent', description: 'Waterproofing', assigned_role: 'employee', assigned_to: 'employee-1', due_date: '2026-04-09', is_required: true, status: 'completed', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 17 },
  { id: 'citem-sop-3', instance_id: 'cinst-2', title: 'Waterproofing inspection before tile: take photo of membrane', description: 'Waterproofing', assigned_role: 'employee', assigned_to: 'employee-1', due_date: '2026-04-10', is_required: true, status: 'pending', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 18 },
  { id: 'citem-sop-4', instance_id: 'cinst-2', title: 'Dry lay tile layout — confirm with Adam before setting', description: 'Tile', assigned_role: 'employee', assigned_to: 'employee-1', due_date: '2026-04-11', is_required: true, status: 'pending', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 19 },
  { id: 'citem-sop-5', instance_id: 'cinst-2', title: 'Set shower wall tile — full tile cuts on visible edges', description: 'Tile', assigned_role: 'employee', assigned_to: 'employee-1', due_date: '2026-04-14', is_required: true, status: 'pending', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 20 },
  { id: 'citem-sop-6', instance_id: 'cinst-2', title: 'Set floor tile with proper slope to drain', description: 'Tile', assigned_role: 'employee', assigned_to: 'employee-1', due_date: '2026-04-15', is_required: true, status: 'pending', completion_note: null, ai_help_available: false, ai_help_prompt: null, external_link: null, sort_order: 21 },
]

// ─────────────────────────────────────────────────────────────────────────────
// PHASE K — Features Expansion
// ─────────────────────────────────────────────────────────────────────────────

// ── Crew board / schedule events with crew_members ───────────────────────────
export type CrewScheduleEvent = {
  id: string
  project_id: string
  project_title: string
  project_color: string
  date: string         // YYYY-MM-DD
  employee_id: string
  start_time: string   // '7:00 AM'
  end_time: string     // '3:00 PM'
  task: string
  phase?: string
}

export const MOCK_CREW_SCHEDULE: CrewScheduleEvent[] = [
  { id: 'cs-1', project_id: 'proj-1', project_title: 'Johnson Bath',     project_color: '#1B2B4D', date: '2026-04-06', employee_id: 'employee-1', start_time: '7:00 AM', end_time: '3:00 PM', task: 'Tile installation – shower floor', phase: 'Tile' },
  { id: 'cs-2', project_id: 'proj-1', project_title: 'Johnson Bath',     project_color: '#1B2B4D', date: '2026-04-07', employee_id: 'employee-1', start_time: '7:00 AM', end_time: '3:30 PM', task: 'Tile walls – shower surround',    phase: 'Tile' },
  { id: 'cs-3', project_id: 'proj-2', project_title: 'Thompson Add.',    project_color: '#B7410E', date: '2026-04-06', employee_id: 'employee-2', start_time: '7:30 AM', end_time: '4:00 PM', task: 'Framing — exterior wall',         phase: 'Framing' },
  { id: 'cs-4', project_id: 'proj-2', project_title: 'Thompson Add.',    project_color: '#B7410E', date: '2026-04-07', employee_id: 'employee-2', start_time: '7:30 AM', end_time: '4:00 PM', task: 'Framing — exterior wall',         phase: 'Framing' },
  { id: 'cs-5', project_id: 'proj-2', project_title: 'Thompson Add.',    project_color: '#B7410E', date: '2026-04-08', employee_id: 'employee-2', start_time: '7:30 AM', end_time: '4:00 PM', task: 'Roof structure',                  phase: 'Framing' },
  { id: 'cs-6', project_id: 'proj-1', project_title: 'Johnson Bath',     project_color: '#1B2B4D', date: '2026-04-08', employee_id: 'employee-1', start_time: '8:00 AM', end_time: '3:00 PM', task: 'Grouting',                        phase: 'Tile' },
  { id: 'cs-7', project_id: 'proj-2', project_title: 'Thompson Add.',    project_color: '#B7410E', date: '2026-04-09', employee_id: 'employee-1', start_time: '7:30 AM', end_time: '4:00 PM', task: 'Help with framing',               phase: 'Framing' },
  { id: 'cs-8', project_id: 'proj-2', project_title: 'Thompson Add.',    project_color: '#B7410E', date: '2026-04-10', employee_id: 'employee-1', start_time: '7:30 AM', end_time: '4:00 PM', task: 'Help with framing',               phase: 'Framing' },
  { id: 'cs-9', project_id: 'proj-2', project_title: 'Thompson Add.',    project_color: '#B7410E', date: '2026-04-09', employee_id: 'employee-2', start_time: '7:30 AM', end_time: '4:00 PM', task: 'Roof structure',                  phase: 'Framing' },
  { id: 'cs-10',project_id: 'proj-2', project_title: 'Thompson Add.',    project_color: '#B7410E', date: '2026-04-10', employee_id: 'employee-2', start_time: '7:30 AM', end_time: '4:00 PM', task: 'Roof structure',                  phase: 'Framing' },
]

// Standard hours per employee per week
export const MOCK_CREW_CAPACITY: Record<string, number> = {
  'employee-1': 40,
  'employee-2': 40,
}

// ── Tool requests ────────────────────────────────────────────────────────────
export type ToolRequest = {
  id: string
  requested_by: string
  requester_name: string
  project_id: string | null
  project_title?: string
  tool_name: string
  needed_by: string | null
  urgency: 'normal' | 'urgent'
  notes: string | null
  status: 'pending' | 'approved' | 'declined' | 'purchased' | 'on_site'
  admin_response: string | null
  estimated_cost: number | null
  purchase_location: string | null
  created_at: string
}

export const MOCK_TOOL_REQUESTS: ToolRequest[] = [
  { id: 'tr-1', requested_by: 'employee-1', requester_name: 'Jeff', project_id: 'proj-1', project_title: 'Johnson Master Bath', tool_name: '4-foot tile leveling system', needed_by: '2026-04-08', urgency: 'urgent', notes: 'Need for shower wall tile next two days', status: 'pending', admin_response: null, estimated_cost: 85, purchase_location: 'Lowe\u2019s Stow', created_at: '2026-04-06T08:30:00Z' },
  { id: 'tr-2', requested_by: 'employee-2', requester_name: 'Steven', project_id: 'proj-2', project_title: 'Thompson Addition', tool_name: '12" miter saw blade — finish carbide', needed_by: '2026-04-12', urgency: 'normal', notes: 'Current blade getting dull', status: 'approved', admin_response: 'Pick up at Home Depot Cuyahoga Falls', estimated_cost: 65, purchase_location: 'Home Depot Cuyahoga Falls', created_at: '2026-04-04T09:15:00Z' },
  { id: 'tr-3', requested_by: 'employee-1', requester_name: 'Jeff', project_id: 'proj-2', project_title: 'Thompson Addition', tool_name: 'Hammer drill (rental)', needed_by: '2026-04-15', urgency: 'normal', notes: 'For concrete anchors on the addition footings', status: 'pending', admin_response: null, estimated_cost: 60, purchase_location: 'Sunbelt Rentals Akron', created_at: '2026-04-05T16:00:00Z' },
]

// ── Portfolio photos ─────────────────────────────────────────────────────────
export type PortfolioPhoto = {
  id: string
  project_id: string
  project_title: string
  image_url: string
  category: 'kitchen' | 'bathroom' | 'addition' | 'basement' | 'first_floor' | 'before_after' | 'detail' | 'exterior'
  caption: string
  featured: boolean
  taken_at: string
}

export const MOCK_PORTFOLIO_PHOTOS: PortfolioPhoto[] = [
  { id: 'pp-1', project_id: 'proj-4', project_title: 'Williams Guest Bath', image_url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=640', category: 'bathroom', caption: 'Custom tile shower with built-in niche and brushed nickel fixtures', featured: true, taken_at: '2026-02-12' },
  { id: 'pp-2', project_id: 'proj-4', project_title: 'Williams Guest Bath', image_url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=640&hue=10', category: 'bathroom', caption: 'Floating walnut vanity with quartz countertop', featured: false, taken_at: '2026-02-12' },
  { id: 'pp-3', project_id: 'proj-1', project_title: 'Johnson Master Bath', image_url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=640', category: 'bathroom', caption: 'Curbless walk-in shower with matte black trim', featured: true, taken_at: '2026-03-30' },
  { id: 'pp-4', project_id: 'proj-2', project_title: 'Thompson Addition', image_url: 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=640', category: 'addition', caption: 'Open-concept kitchen addition with vaulted ceilings', featured: false, taken_at: '2026-03-22' },
  { id: 'pp-5', project_id: 'proj-3', project_title: 'Martinez Basement', image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=640', category: 'basement', caption: 'Finished basement bar and entertainment area', featured: false, taken_at: '2026-03-18' },
]

// ── Suppliers ────────────────────────────────────────────────────────────────
export type Supplier = {
  id: string
  company_name: string
  category: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string
  account_number: string | null
  contractor_discount_percent: number | null
  payment_terms: string | null
  rep_name: string | null
  rep_phone: string | null
  notes: string | null
  rating: number | null
  is_preferred: boolean
  annual_spend: number
  ytd_spend: number
}

export const MOCK_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', company_name: 'Lowe\u2019s Pro Stow',           category: 'lumber_building', contact_name: 'Pro Desk', phone: '(330) 555-1100', email: 'prostow@lowes.com',     address: '4267 Kent Rd',  city: 'Stow',           state: 'OH', account_number: 'PRO-188742', contractor_discount_percent: 5,    payment_terms: 'Net 30',        rep_name: 'Mike Jensen',   rep_phone: '(330) 555-1101', notes: 'Best for last-minute lumber, hardware, paint.',         rating: 4, is_preferred: true,  annual_spend: 41200, ytd_spend: 11800 },
  { id: 'sup-2', company_name: 'Home Depot Pro Cuyahoga Falls',  category: 'lumber_building', contact_name: 'Pro Desk', phone: '(330) 555-1200', email: 'pro@homedepot.com',     address: '1900 State Rd', city: 'Cuyahoga Falls', state: 'OH', account_number: 'HDP-994221', contractor_discount_percent: 5,    payment_terms: 'Credit card',  rep_name: 'Tara Lopez',    rep_phone: '(330) 555-1201', notes: 'Backup for lumber, plumbing parts.',                    rating: 4, is_preferred: false, annual_spend: 28400, ytd_spend: 7800 },
  { id: 'sup-3', company_name: 'Ferguson Plumbing Akron',        category: 'plumbing',        contact_name: 'Counter',  phone: '(330) 555-1300', email: 'akron@ferguson.com',    address: '2600 Romig Rd', city: 'Akron',          state: 'OH', account_number: 'FRG-CC-7124', contractor_discount_percent: 12.5, payment_terms: 'Net 30',       rep_name: 'Jen Carlisle',  rep_phone: '(330) 555-1301', notes: 'Best showroom in town. Great for spec fixtures.',       rating: 5, is_preferred: true,  annual_spend: 36500, ytd_spend: 9200 },
  { id: 'sup-4', company_name: 'Rexel Electrical',               category: 'electrical',      contact_name: 'Counter',  phone: '(330) 555-1400', email: 'akron@rexel.com',       address: '1450 East Ave', city: 'Akron',          state: 'OH', account_number: 'RX-AKR-441',  contractor_discount_percent: 18,   payment_terms: 'Net 30',       rep_name: 'Brad Sims',     rep_phone: '(330) 555-1401', notes: 'Electrician supply for sub work and our installs.',     rating: 4, is_preferred: true,  annual_spend: 18900, ytd_spend: 5100 },
  { id: 'sup-5', company_name: 'Mosaic Tile & Stone',            category: 'tile_flooring',   contact_name: 'Showroom', phone: '(330) 555-1500', email: 'sales@mosaictile.com',  address: '4101 Main St',  city: 'Hudson',         state: 'OH', account_number: 'MTS-002201',  contractor_discount_percent: 15,   payment_terms: 'Net 15',       rep_name: 'Ellie Brunner', rep_phone: '(330) 555-1501', notes: 'Best high-end tile selection in Summit County.',        rating: 5, is_preferred: true,  annual_spend: 22300, ytd_spend: 6800 },
  { id: 'sup-6', company_name: 'Sherwin-Williams Stow',          category: 'paint',           contact_name: 'Counter',  phone: '(330) 555-1600', email: 'stow@sherwin.com',      address: '4400 Kent Rd',  city: 'Stow',           state: 'OH', account_number: 'SW-PRO-7755', contractor_discount_percent: 25,   payment_terms: 'Credit card',  rep_name: 'Drew Patel',    rep_phone: '(330) 555-1601', notes: 'Use for all paint, stain, and primer.',                 rating: 5, is_preferred: true,  annual_spend: 9800,  ytd_spend: 2400 },
  { id: 'sup-7', company_name: 'Sunbelt Rentals Akron',          category: 'rental',          contact_name: 'Counter',  phone: '(330) 555-1700', email: 'akron@sunbelt.com',     address: '850 Brittain Rd', city: 'Akron',        state: 'OH', account_number: 'SUN-CC-228',  contractor_discount_percent: 10,   payment_terms: 'Credit card',  rep_name: 'Drew Mendez',   rep_phone: '(330) 555-1701', notes: 'Equipment rental — lifts, scaffolding, demo tools.',    rating: 4, is_preferred: true,  annual_spend: 6700,  ytd_spend: 1850 },
  { id: 'sup-8', company_name: 'Republic Services Dumpsters',    category: 'dumpster',        contact_name: 'Dispatch', phone: '(330) 555-1800', email: 'orders@republic.com',   address: 'N/A',           city: 'Akron',          state: 'OH', account_number: 'RPS-44820',   contractor_discount_percent: null, payment_terms: 'Net 15',       rep_name: null,            rep_phone: null,            notes: '20-yard rolloff for kitchen/bath demos.',               rating: 4, is_preferred: true,  annual_spend: 4200,  ytd_spend: 1100 },
]

// ── Communication log entries ────────────────────────────────────────────────
export type CommLogEntry = {
  id: string
  project_id: string | null
  lead_id: string | null
  comm_type: 'call' | 'sms' | 'email' | 'meeting' | 'voice_note' | 'in_app' | 'logged_conversation'
  direction: 'inbound' | 'outbound'
  participant_name: string
  date: string
  duration_seconds: number | null
  has_audio: boolean
  summary: string
  transcript: string | null
  action_items: { task: string; due_date?: string; done?: boolean }[]
  client_sentiment: 'positive' | 'neutral' | 'concerned' | 'negative' | null
}

export const MOCK_COMM_LOG: CommLogEntry[] = [
  {
    id: 'cl-1', project_id: 'proj-1', lead_id: null,
    comm_type: 'logged_conversation', direction: 'outbound',
    participant_name: 'Sarah Johnson',
    date: '2026-04-04T10:30:00Z',
    duration_seconds: 420,
    has_audio: true,
    summary: 'Walked through tile selections with Sarah. Confirmed she wants the matte black trim and the niche shelf. Asked about adding a heated floor — out of scope, gave a ballpark.',
    transcript: '[Adam]: So I wanted to confirm the tile choice for the walls... [Sarah]: Yes, the matte black trim looks great...',
    action_items: [
      { task: 'Send heated floor add-on quote ($2,400)', due_date: '2026-04-08', done: false },
      { task: 'Confirm grout color before Friday', due_date: '2026-04-10', done: false },
    ],
    client_sentiment: 'positive',
  },
  {
    id: 'cl-2', project_id: 'proj-2', lead_id: null,
    comm_type: 'logged_conversation', direction: 'outbound',
    participant_name: 'Dave Thompson',
    date: '2026-04-02T14:15:00Z',
    duration_seconds: 690,
    has_audio: true,
    summary: 'Site walk with Dave. Reviewed framing progress. Dave asked about rerouting an HVAC run — needs sub coordination. Discussed change order timing.',
    transcript: null,
    action_items: [
      { task: 'Get HVAC sub on site for reroute pricing', due_date: '2026-04-09', done: true },
      { task: 'Draft change order for HVAC reroute', done: false },
    ],
    client_sentiment: 'neutral',
  },
  {
    id: 'cl-3', project_id: 'proj-1', lead_id: null,
    comm_type: 'sms', direction: 'inbound',
    participant_name: 'Sarah Johnson',
    date: '2026-04-05T08:12:00Z',
    duration_seconds: null,
    has_audio: false,
    summary: 'Quick text — Sarah asked if we can be there at 7:30 instead of 8 tomorrow.',
    transcript: null,
    action_items: [],
    client_sentiment: 'neutral',
  },
]

// ── Labor benchmarks ─────────────────────────────────────────────────────────
export type LaborBenchmark = {
  id: string
  task_name: string
  category: string
  unit: string
  hours_min: number
  hours_max: number
  hours_typical: number
  projects_count: number
  confidence_level: 'industry' | 'calibrated'
}

export const MOCK_LABOR_BENCHMARKS: LaborBenchmark[] = [
  { id: 'lb-1',  task_name: 'Cabinet installation — upper',     category: 'cabinets',    unit: 'per linear ft',     hours_min: 0.4,  hours_max: 0.8,  hours_typical: 0.55, projects_count: 6, confidence_level: 'calibrated' },
  { id: 'lb-2',  task_name: 'Cabinet installation — lower',     category: 'cabinets',    unit: 'per linear ft',     hours_min: 0.3,  hours_max: 0.6,  hours_typical: 0.45, projects_count: 6, confidence_level: 'calibrated' },
  { id: 'lb-3',  task_name: 'Tile installation — floor',        category: 'tile',        unit: 'per sqft',          hours_min: 0.15, hours_max: 0.35, hours_typical: 0.22, projects_count: 9, confidence_level: 'calibrated' },
  { id: 'lb-4',  task_name: 'Tile installation — wall/shower',  category: 'tile',        unit: 'per sqft',          hours_min: 0.25, hours_max: 0.55, hours_typical: 0.38, projects_count: 8, confidence_level: 'calibrated' },
  { id: 'lb-5',  task_name: 'Tile installation — mosaic',       category: 'tile',        unit: 'per sqft',          hours_min: 0.45, hours_max: 0.90, hours_typical: 0.65, projects_count: 3, confidence_level: 'industry' },
  { id: 'lb-6',  task_name: 'Hardwood floor installation',      category: 'flooring',    unit: 'per sqft',          hours_min: 0.08, hours_max: 0.18, hours_typical: 0.12, projects_count: 4, confidence_level: 'industry' },
  { id: 'lb-7',  task_name: 'LVP installation',                 category: 'flooring',    unit: 'per sqft',          hours_min: 0.05, hours_max: 0.12, hours_typical: 0.08, projects_count: 5, confidence_level: 'calibrated' },
  { id: 'lb-8',  task_name: 'Base trim installation',           category: 'trim',        unit: 'per linear ft',     hours_min: 0.12, hours_max: 0.25, hours_typical: 0.17, projects_count: 11,confidence_level: 'calibrated' },
  { id: 'lb-9',  task_name: 'Crown molding installation',       category: 'trim',        unit: 'per linear ft',     hours_min: 0.20, hours_max: 0.45, hours_typical: 0.30, projects_count: 5, confidence_level: 'calibrated' },
  { id: 'lb-10', task_name: 'Door installation — prehung',      category: 'doors',       unit: 'per door',          hours_min: 1.5,  hours_max: 3.0,  hours_typical: 2.0,  projects_count: 7, confidence_level: 'calibrated' },
  { id: 'lb-11', task_name: 'Drywall hanging',                  category: 'drywall',     unit: 'per sqft',          hours_min: 0.04, hours_max: 0.09, hours_typical: 0.06, projects_count: 4, confidence_level: 'industry' },
  { id: 'lb-12', task_name: 'Light fixture installation',       category: 'electrical',  unit: 'per fixture',       hours_min: 0.5,  hours_max: 1.5,  hours_typical: 0.75, projects_count: 9, confidence_level: 'calibrated' },
  { id: 'lb-13', task_name: 'Vanity installation',              category: 'plumbing',    unit: 'per vanity',        hours_min: 2.0,  hours_max: 4.0,  hours_typical: 2.75, projects_count: 6, confidence_level: 'calibrated' },
  { id: 'lb-14', task_name: 'Shower door installation',         category: 'glass',       unit: 'per door',          hours_min: 2.5,  hours_max: 5.0,  hours_typical: 3.5,  projects_count: 5, confidence_level: 'calibrated' },
  { id: 'lb-15', task_name: 'Countertop installation',          category: 'countertops', unit: 'per linear ft',     hours_min: 0.5,  hours_max: 1.0,  hours_typical: 0.7,  projects_count: 5, confidence_level: 'calibrated' },
  { id: 'lb-16', task_name: 'Backsplash tile',                  category: 'tile',        unit: 'per sqft',          hours_min: 0.20, hours_max: 0.45, hours_typical: 0.30, projects_count: 4, confidence_level: 'calibrated' },
  { id: 'lb-17', task_name: 'Demo — kitchen',                   category: 'demo',        unit: 'per room',          hours_min: 8,    hours_max: 20,   hours_typical: 13,   projects_count: 5, confidence_level: 'calibrated' },
  { id: 'lb-18', task_name: 'Demo — bathroom',                  category: 'demo',        unit: 'per room',          hours_min: 4,    hours_max: 10,   hours_typical: 6,    projects_count: 8, confidence_level: 'calibrated' },
  { id: 'lb-19', task_name: 'Paint — walls',                    category: 'paint',       unit: 'per sqft wall area',hours_min: 0.03, hours_max: 0.07, hours_typical: 0.05, projects_count: 12,confidence_level: 'calibrated' },
  { id: 'lb-20', task_name: 'Caulk and touch-up',               category: 'finish',      unit: 'per room',          hours_min: 1.5,  hours_max: 4.0,  hours_typical: 2.5,  projects_count: 11,confidence_level: 'calibrated' },
]

export const MOCK_CREW_HOURLY_RATE = 65 // combined crew billable rate

// ── Warranty claims (extends MOCK_WARRANTY_CLAIMS) ───────────────────────────
export type WarrantyClaim = {
  id: string
  claim_number: string
  project_id: string
  project_title: string
  description: string
  area: string
  reported_at: string
  reported_via: 'phone' | 'text' | 'email' | 'in_person' | 'client_portal'
  status: 'reported' | 'scheduled' | 'in_progress' | 'resolved' | 'denied'
  sub_responsible: boolean
  sub_name: string | null
  estimated_repair_cost: number | null
  actual_repair_cost: number | null
  resolution: string | null
  photos: string[]
}

export const MOCK_WARRANTY_CLAIMS_FULL: WarrantyClaim[] = [
  { id: 'wc-1', claim_number: 'WAR-2026-001', project_id: 'proj-4', project_title: 'Williams Guest Bath', description: 'Caulk pulling away around shower curb', area: 'Shower', reported_at: '2026-03-22', reported_via: 'text', status: 'resolved', sub_responsible: false, sub_name: null, estimated_repair_cost: 80, actual_repair_cost: 65, resolution: 'Recaulked. Took 30 min on a Saturday morning.', photos: [] },
  { id: 'wc-2', claim_number: 'WAR-2026-002', project_id: 'proj-4', project_title: 'Williams Guest Bath', description: 'Hairline crack in grout joint near drain', area: 'Floor', reported_at: '2026-04-01', reported_via: 'client_portal', status: 'scheduled', sub_responsible: false, sub_name: null, estimated_repair_cost: 120, actual_repair_cost: null, resolution: 'Will swing by Saturday morning to regrout the joint.', photos: [] },
]

// Project warranty status for global view
export type WarrantyProject = {
  project_id: string
  project_title: string
  client_name: string
  completion_date: string
  warranty_expiry: string
  days_remaining: number
  open_claims: number
}

export const MOCK_WARRANTY_PROJECTS: WarrantyProject[] = [
  { project_id: 'proj-4', project_title: 'Williams Guest Bath', client_name: 'Tom & Karen Williams', completion_date: '2026-02-15', warranty_expiry: '2027-02-15', days_remaining: 314, open_claims: 1 },
]

// ── Material specs ──────────────────────────────────────────────────────────
export type MaterialSpec = {
  id: string
  category: string
  brand: string | null
  product_name: string
  product_line: string | null
  unit: string
  price_min: number | null
  price_max: number | null
  price_typical: number | null
  supplier_id: string | null
  supplier_name: string | null
  finish_level: 'builder' | 'mid_range' | 'high_end' | 'luxury'
  is_preferred: boolean
  times_specified: number
  notes: string | null
}

export const MOCK_MATERIAL_SPECS: MaterialSpec[] = [
  { id: 'ms-1', category: 'tile_floor',          brand: 'Daltile',          product_name: 'Marazzi Travisano Trevi 12x12', product_line: 'Travisano',  unit: 'per sqft', price_min: 3.5, price_max: 5.5, price_typical: 4.50, supplier_id: 'sup-5', supplier_name: 'Mosaic Tile & Stone', finish_level: 'mid_range', is_preferred: true,  times_specified: 7, notes: 'Reliable, easy to install, looks great.' },
  { id: 'ms-2', category: 'tile_wall',           brand: 'Schluter',         product_name: 'Kerdi Subway 3x12 Matte White',  product_line: 'Kerdi',      unit: 'per sqft', price_min: 7.0, price_max: 9.0, price_typical: 8.00, supplier_id: 'sup-5', supplier_name: 'Mosaic Tile & Stone', finish_level: 'mid_range', is_preferred: true,  times_specified: 5, notes: 'Classic look, easy spec.' },
  { id: 'ms-3', category: 'plumbing_fixtures',   brand: 'Kohler',           product_name: 'Purist Shower Trim Kit',         product_line: 'Purist',     unit: 'each',     price_min: 380, price_max: 520, price_typical: 450,  supplier_id: 'sup-3', supplier_name: 'Ferguson Plumbing',    finish_level: 'high_end',  is_preferred: true,  times_specified: 6, notes: 'Adam\u2019s go-to bathroom trim.' },
  { id: 'ms-4', category: 'cabinets',            brand: 'Wellborn',         product_name: 'Premier Series Shaker Maple',    product_line: 'Premier',    unit: 'per linear ft', price_min: 220, price_max: 340, price_typical: 285, supplier_id: null, supplier_name: null,                  finish_level: 'high_end',  is_preferred: true,  times_specified: 4, notes: 'Mid-line semi-custom; great value.' },
  { id: 'ms-5', category: 'countertops',         brand: 'Cambria',          product_name: 'Brittanicca Quartz',              product_line: 'Brittanicca', unit: 'per sqft', price_min: 75,  price_max: 110, price_typical: 92,   supplier_id: null, supplier_name: null,                  finish_level: 'luxury',    is_preferred: false, times_specified: 3, notes: 'Beautiful but pricey.' },
  { id: 'ms-6', category: 'paint',               brand: 'Sherwin-Williams', product_name: 'Emerald Interior Acrylic',        product_line: 'Emerald',    unit: 'per gallon', price_min: 65,  price_max: 80,  price_typical: 72,  supplier_id: 'sup-6', supplier_name: 'Sherwin-Williams',     finish_level: 'high_end',  is_preferred: true,  times_specified: 14,notes: 'Standard premium paint for interior walls.' },
  { id: 'ms-7', category: 'light_fixtures',      brand: 'Visual Comfort',   product_name: 'Bryant 2-Light Vanity',            product_line: 'Bryant',     unit: 'each',     price_min: 240, price_max: 320, price_typical: 280,  supplier_id: null, supplier_name: null,                  finish_level: 'high_end',  is_preferred: false, times_specified: 2, notes: 'Looks higher-end than the price.' },
]

// ── Inspection reports ───────────────────────────────────────────────────────
export type InspectionReport = {
  id: string
  project_id: string
  project_title: string
  inspection_type: string
  conducted_at: string
  conducted_by_name: string
  overall_condition: 'ready_to_proceed' | 'minor_issues' | 'major_issues' | 'do_not_proceed'
  area_count: number
  ai_summary: string | null
  has_pdf: boolean
}

export const MOCK_INSPECTION_REPORTS: InspectionReport[] = [
  { id: 'ir-1', project_id: 'proj-1', project_title: 'Johnson Master Bath', inspection_type: 'pre_drywall', conducted_at: '2026-03-22T11:00:00Z', conducted_by_name: 'Adam', overall_condition: 'ready_to_proceed', area_count: 6, ai_summary: 'All rough-in plumbing inspected, slope to drain confirmed, blocking installed for grab bar locations. Ready to close walls.', has_pdf: true },
  { id: 'ir-2', project_id: 'proj-2', project_title: 'Thompson Addition',   inspection_type: 'rough_in',    conducted_at: '2026-03-30T14:00:00Z', conducted_by_name: 'Adam', overall_condition: 'minor_issues',     area_count: 8, ai_summary: 'Rough framing inspected. Two questions for the engineer about beam pocket detail at the south wall. Not blocking but needs answer before drywall.', has_pdf: true },
]

// ── Project reels ────────────────────────────────────────────────────────────
export type ProjectReel = {
  project_id: string
  project_title: string
  generated_at: string
  photo_count: number
  gallery_token: string
  pdf_url: string | null
}

export const MOCK_PROJECT_REELS: ProjectReel[] = [
  { project_id: 'proj-4', project_title: 'Williams Guest Bath', generated_at: '2026-02-20T15:00:00Z', photo_count: 16, gallery_token: 'a3f1c8d2-7b9e-4c4f-9e2a-2f1c4b8a9d6e', pdf_url: '#' },
]

// ── Referrals (existing leads + extra metadata) ──────────────────────────────
export type ClientReferral = {
  id: string
  referrer_lead_id: string
  referrer_name: string
  referred_name: string
  referred_phone: string
  referred_email: string | null
  project_type: string
  status: 'pending' | 'contacted' | 'consultation' | 'lost'
  submitted_at: string
}

export const MOCK_CLIENT_REFERRALS: ClientReferral[] = [
  { id: 'rf-1', referrer_lead_id: 'lead-4', referrer_name: 'Tom & Karen Williams', referred_name: 'Anne Boswell',     referred_phone: '(330) 555-0411', referred_email: 'a.boswell@email.com', project_type: 'kitchen',  status: 'pending',     submitted_at: '2026-04-04T10:00:00Z' },
  { id: 'rf-2', referrer_lead_id: 'lead-4', referrer_name: 'Tom & Karen Williams', referred_name: 'Mark Pulaski',     referred_phone: '(330) 555-0533', referred_email: null,                 project_type: 'bathroom', status: 'consultation',submitted_at: '2026-03-12T16:30:00Z' },
]
