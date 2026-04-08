-- Phase N: Universal Template System
-- N19-N23: Seed data for new template tables

-- N19: Seed scope_templates
INSERT INTO scope_templates (trade, name, scope_sections, is_active, finish_level) VALUES

('plumbing', 'Standard Bathroom Plumbing Scope', '[
  {"title": "Rough-In Plumbing", "items": [
    "Demo and cap existing supply and drain lines as required",
    "Rough in new supply lines (hot and cold) per plan",
    "Rough in drain, waste, and vent per plan",
    "Install blocking for wall-mount fixtures",
    "Pressure test all supply lines before closing walls"
  ]},
  {"title": "Trim-Out Plumbing", "items": [
    "Install shower valve and trim per client selection",
    "Install tub spout and diverter",
    "Install lavatory faucet per client selection",
    "Install toilet per client selection",
    "Install all supply stops and flexible supplies",
    "Set tub or shower pan and connect drain",
    "Final water test on all fixtures"
  ]},
  {"title": "Exclusions", "items": [
    "Water heater replacement (separate scope if needed)",
    "Main water line or service entry work",
    "Any work outside the bathroom footprint"
  ]}
]', true, 'mid_range'),

('electrical', 'Standard Kitchen Electrical Scope', '[
  {"title": "Rough-In Electrical", "items": [
    "Demo existing wiring as required",
    "Install new 20A circuits for countertop receptacles (per code)",
    "Install circuit for dishwasher",
    "Install circuit for refrigerator",
    "Install circuit for microwave or range hood",
    "Install rough wiring for under-cabinet lighting",
    "Install rough wiring for recessed cans per plan",
    "Install GFCI protection at all countertop locations",
    "Rough in for island receptacles if applicable"
  ]},
  {"title": "Trim-Out Electrical", "items": [
    "Install all recessed lighting per plan",
    "Install under-cabinet lighting and controls",
    "Install all receptacles and switches",
    "Install island receptacles if applicable",
    "Final connection of all appliances",
    "Label all new circuits in panel"
  ]},
  {"title": "Exclusions", "items": [
    "Panel upgrade (separate scope if required)",
    "Any work outside kitchen footprint",
    "Low voltage or smart home integration"
  ]}
]', true, 'mid_range'),

('tile', 'Standard Bathroom Tile Scope', '[
  {"title": "Tile Installation", "items": [
    "Install cement board backer on all wet areas",
    "Waterproof shower walls and pan transition with RedGard or equivalent",
    "Set floor tile per client selection — layout approved before setting",
    "Set shower wall tile per client selection",
    "Set tub surround tile if applicable",
    "Install tile on vanity backsplash if applicable",
    "Grout all tile — color per client selection",
    "Caulk all changes of plane and transitions"
  ]},
  {"title": "Exclusions", "items": [
    "Tile material supply (by owner or allowance)",
    "Heated floor mat supply and wiring",
    "Any tile work outside bathroom footprint"
  ]}
]', true, 'mid_range'),

('carpentry', 'Standard Kitchen Carpentry Scope', '[
  {"title": "Cabinet Installation", "items": [
    "Protect floors and adjacent surfaces before installation",
    "Install upper cabinets per plan — level, plumb, and scribed",
    "Install base cabinets per plan — level, plumb, and scribed",
    "Install island base if applicable",
    "Install filler strips, scribe moldings, and trim pieces",
    "Install crown molding on uppers if specified",
    "Hang all doors — adjusted for alignment",
    "Install all drawer boxes and adjust slides",
    "Install all hardware per client selection",
    "Scribe and notch around any plumbing or electrical"
  ]},
  {"title": "Countertop Coordination", "items": [
    "Template countertops after cabinets are set",
    "Coordinate install date with countertop fabricator",
    "Install countertops upon delivery"
  ]},
  {"title": "Exclusions", "items": [
    "Cabinet supply (by owner or separate purchase order)",
    "Countertop supply (by fabricator)",
    "Appliance installation (unless included in separate scope)"
  ]}
]', true, 'mid_range')

ON CONFLICT DO NOTHING;

-- N20: Seed proposal_templates
INSERT INTO proposal_templates (project_type, name, sections, payment_schedule_template, terms_template) VALUES

('bathroom', 'Standard Bathroom Remodel', '[
  {"title": "Project Overview", "bullets": [
    "Complete gut renovation of existing bathroom",
    "New tile throughout — floor, shower walls, and backsplash",
    "New vanity, toilet, and all plumbing fixtures",
    "New lighting, mirrors, and accessories",
    "Paint, trim, and door hardware"
  ]},
  {"title": "Demolition", "bullets": [
    "Remove existing tile, vanity, toilet, and fixtures",
    "Remove drywall in wet areas down to studs",
    "Haul away all demo debris",
    "Document existing conditions before demo"
  ]},
  {"title": "Rough-In Work", "bullets": [
    "Install cement board backer in all wet areas",
    "Waterproof shower and tub areas",
    "Rough plumbing per plan",
    "Rough electrical per code"
  ]},
  {"title": "Finish Work", "bullets": [
    "Tile installation per client selections",
    "Vanity and fixture installation",
    "Painting — walls and ceiling",
    "Trim, door hardware, and accessories"
  ]}
]', '[
  {"label": "Deposit — project start", "percent": 30},
  {"label": "Rough-in complete", "percent": 30},
  {"label": "Tile and fixtures complete", "percent": 25},
  {"label": "Final completion", "percent": 15}
]', 'All work is warranted for 12 months from the date of final completion. AK Renovations carries general liability insurance and all required Ohio contractor licenses. Payment is due within 5 days of each milestone completion. Material selections must be finalized before work begins.'),

('kitchen', 'Standard Kitchen Remodel', '[
  {"title": "Project Overview", "bullets": [
    "Complete kitchen renovation including cabinets, countertops, and appliances",
    "New tile backsplash and flooring",
    "Updated lighting — recessed, under-cabinet, and pendants",
    "New plumbing fixtures and electrical to current code"
  ]},
  {"title": "Demolition", "bullets": [
    "Remove existing cabinets, countertops, and appliances",
    "Remove existing flooring",
    "Haul away all demo debris"
  ]},
  {"title": "Rough-In Work", "bullets": [
    "Electrical: new circuits for appliances and countertop receptacles",
    "Plumbing: relocate or modify supply and drain as needed",
    "Structural: modify walls per plan if applicable"
  ]},
  {"title": "Finish Work", "bullets": [
    "Cabinet installation per plan",
    "Countertop templating and installation",
    "Backsplash tile per client selection",
    "Appliance installation and connection",
    "Lighting installation",
    "Paint and trim"
  ]}
]', '[
  {"label": "Deposit — project start", "percent": 30},
  {"label": "Demo and rough-in complete", "percent": 25},
  {"label": "Cabinets and countertops installed", "percent": 25},
  {"label": "Final completion", "percent": 20}
]', 'All work is warranted for 12 months from the date of final completion. AK Renovations carries general liability insurance and all required Ohio contractor licenses. Payment is due within 5 days of each milestone completion.')

ON CONFLICT DO NOTHING;

-- N21: Seed punch_list_templates
INSERT INTO punch_list_templates (project_type, name, items) VALUES

('bathroom', 'Standard Bathroom Punch List', '[
  {"description": "All tile grout lines clean and consistent", "location": "Shower"},
  {"description": "All tile caulk lines neat at changes of plane", "location": "Shower"},
  {"description": "Shower door or curtain rod installed and functional", "location": "Shower"},
  {"description": "Shower valve operates correctly — hot/cold, diverter", "location": "Shower"},
  {"description": "No visible silicone smears on tile faces", "location": "Shower"},
  {"description": "Floor tile grout consistent and clean", "location": "Floor"},
  {"description": "Transition strip at doorway installed and secure", "location": "Floor"},
  {"description": "Vanity level and properly scribed to wall", "location": "Vanity"},
  {"description": "Vanity doors and drawers open/close smoothly", "location": "Vanity"},
  {"description": "All hardware installed and tight — no wobble", "location": "Vanity"},
  {"description": "Faucet operates correctly — no drips", "location": "Vanity"},
  {"description": "Drain stopper operates correctly", "location": "Vanity"},
  {"description": "Mirror installed level and secure", "location": "Vanity"},
  {"description": "Toilet seated properly — no rocking", "location": "Toilet"},
  {"description": "Toilet flush and fill operating correctly", "location": "Toilet"},
  {"description": "All outlets and switches have cover plates", "location": "Electrical"},
  {"description": "Exhaust fan operational", "location": "Electrical"},
  {"description": "All lights operational", "location": "Electrical"},
  {"description": "Paint — no drips, missed spots, or roller texture", "location": "Paint"},
  {"description": "All trim caulked and painted", "location": "Trim"},
  {"description": "Door swings freely and latches correctly", "location": "Door"},
  {"description": "No visible nail holes or screws in finished surfaces", "location": "General"},
  {"description": "All debris and tools removed from jobsite", "location": "General"},
  {"description": "Floors protected and cleaned", "location": "General"}
]'),

('kitchen', 'Standard Kitchen Punch List', '[
  {"description": "Cabinets level, plumb, and tight to wall — no gaps", "location": "Cabinets"},
  {"description": "All cabinet doors aligned and adjusted", "location": "Cabinets"},
  {"description": "All drawers operate smoothly on slides", "location": "Cabinets"},
  {"description": "All hardware installed and tight", "location": "Cabinets"},
  {"description": "Crown and scribe moldings clean and caulked", "location": "Cabinets"},
  {"description": "Countertop seams tight and polished", "location": "Countertops"},
  {"description": "Countertop caulked at wall — consistent bead", "location": "Countertops"},
  {"description": "Sink mounted and sealed — no gap at deck", "location": "Countertops"},
  {"description": "Backsplash tile grouted and caulked at counter", "location": "Backsplash"},
  {"description": "Backsplash grout consistent and clean", "location": "Backsplash"},
  {"description": "Faucet operates correctly — hot/cold", "location": "Plumbing"},
  {"description": "Garbage disposal operational and quiet", "location": "Plumbing"},
  {"description": "Dishwasher installed, sealed, and operational", "location": "Appliances"},
  {"description": "Refrigerator in place and operational", "location": "Appliances"},
  {"description": "Range or cooktop installed and operational", "location": "Appliances"},
  {"description": "Range hood vented and operational", "location": "Appliances"},
  {"description": "Recessed lights all operational", "location": "Electrical"},
  {"description": "Under-cabinet lights operational and aimed correctly", "location": "Electrical"},
  {"description": "All outlets and switches have cover plates", "location": "Electrical"},
  {"description": "GFCI outlets all test correctly", "location": "Electrical"},
  {"description": "Floor transition at entry installed and secure", "location": "Flooring"},
  {"description": "Paint — no drips or missed spots", "location": "Paint"},
  {"description": "Trim caulked and painted", "location": "Trim"},
  {"description": "All debris and tools removed from jobsite", "location": "General"},
  {"description": "Floors cleaned and protected surfaces removed", "location": "General"}
]')

ON CONFLICT DO NOTHING;

-- N22: Seed payment_schedule_templates
INSERT INTO payment_schedule_templates (project_type, name, milestones, retention_percent) VALUES

('bathroom', 'Standard Bathroom — 4 Milestones', '[
  {"label": "Deposit — project start", "percent": 30, "description": "Due before materials ordered"},
  {"label": "Rough-in complete", "percent": 30, "description": "After plumbing and electrical rough-in pass inspection"},
  {"label": "Tile and fixtures complete", "percent": 25, "description": "After all tile set and fixtures installed"},
  {"label": "Final completion", "percent": 15, "description": "After punch list complete and client walkthrough"}
]', 0),

('kitchen', 'Standard Kitchen — 4 Milestones', '[
  {"label": "Deposit — project start", "percent": 30, "description": "Due before materials ordered"},
  {"label": "Demo and rough-in complete", "percent": 25, "description": "After demo, plumbing, and electrical rough-in"},
  {"label": "Cabinets and countertops installed", "percent": 25, "description": "After cabinets set and countertops installed"},
  {"label": "Final completion", "percent": 20, "description": "After punch list complete and client walkthrough"}
]', 0),

('addition', 'Addition — 5 Milestones', '[
  {"label": "Deposit — mobilization", "percent": 20, "description": "Due before permit application and materials"},
  {"label": "Foundation complete", "percent": 20, "description": "After foundation poured and cured"},
  {"label": "Framing and rough-in complete", "percent": 25, "description": "After framing, roof, plumbing, electrical rough-in"},
  {"label": "Drywall and insulation complete", "percent": 20, "description": "After insulation and drywall hung and taped"},
  {"label": "Final completion", "percent": 15, "description": "After finish work, punch list, and final inspection"}
]', 0),

('basement', 'Basement Finish — 4 Milestones', '[
  {"label": "Deposit — project start", "percent": 25, "description": "Due before materials ordered"},
  {"label": "Framing and rough-in complete", "percent": 30, "description": "After framing, HVAC, plumbing, electrical rough-in"},
  {"label": "Drywall and flooring complete", "percent": 25, "description": "After drywall, flooring, and paint"},
  {"label": "Final completion", "percent": 20, "description": "After trim, fixtures, punch list complete"}
]', 0)

ON CONFLICT DO NOTHING;

-- N23: Seed shopping_list_templates
INSERT INTO shopping_list_templates (project_type, phase, name, items) VALUES

('bathroom', 'demo', 'Bathroom Demo Phase Materials', '[
  {"item_name": "Plastic sheeting (6 mil)", "quantity": 2, "unit": "roll", "notes": "Protect floors and doorways"},
  {"item_name": "Painter tape (2 in)", "quantity": 4, "unit": "roll", "notes": "Secure sheeting"},
  {"item_name": "Contractor bags (55 gal)", "quantity": 1, "unit": "box", "notes": "Debris bags"},
  {"item_name": "Knee pads", "quantity": 1, "unit": "pair", "notes": "Demo work"},
  {"item_name": "Dust masks (N95)", "quantity": 1, "unit": "box", "notes": ""}
]'),

('bathroom', 'rough_in', 'Bathroom Rough-In Materials', '[
  {"item_name": "1/2 in cement board (3x5 sheets)", "quantity": 10, "unit": "sheet", "notes": "Wet areas — adjust qty to actual sqft"},
  {"item_name": "Cement board screws (1-5/8 in)", "quantity": 1, "unit": "box", "notes": "For cement board"},
  {"item_name": "Fiberglass mesh tape", "quantity": 2, "unit": "roll", "notes": "Cement board seams"},
  {"item_name": "RedGard waterproofing membrane", "quantity": 1, "unit": "gallon", "notes": "Shower pan and lower walls"},
  {"item_name": "Rubber gloves", "quantity": 2, "unit": "pair", "notes": "For RedGard"}
]'),

('kitchen', 'demo', 'Kitchen Demo Phase Materials', '[
  {"item_name": "Plastic sheeting (6 mil)", "quantity": 4, "unit": "roll", "notes": "Protect adjacent rooms and floors"},
  {"item_name": "Painter tape (2 in)", "quantity": 6, "unit": "roll", "notes": "Secure sheeting"},
  {"item_name": "Contractor bags (55 gal)", "quantity": 2, "unit": "box", "notes": "Debris bags"},
  {"item_name": "Cabinet removal screws (assorted)", "quantity": 1, "unit": "bag", "notes": "Keep for temporary use if needed"}
]'),

('kitchen', 'rough_in', 'Kitchen Rough-In Materials', '[
  {"item_name": "Wire nuts (assorted)", "quantity": 1, "unit": "bag", "notes": "Electrical splices"},
  {"item_name": "20A outlets (white)", "quantity": 6, "unit": "each", "notes": "Countertop circuits — adjust qty to layout"},
  {"item_name": "Romex 12/2 (100 ft)", "quantity": 1, "unit": "roll", "notes": "New circuits — verify qty with electrician"},
  {"item_name": "P-trap (1-1/2 in)", "quantity": 1, "unit": "each", "notes": "Sink drain"},
  {"item_name": "Shut-off valves (1/2 in)", "quantity": 2, "unit": "each", "notes": "Hot and cold under sink"}
]')

ON CONFLICT DO NOTHING;
