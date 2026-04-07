-- J14b: Seed project SOP checklists, project closeout, and post-project sequence (templates 8-14).

-- ============================================================================
-- 8. KITCHEN SOP CHECKLIST (trigger: project_started, project_type: kitchen)
-- Pre-construction (6) + Demo (7) + Rough-in (5) + Cabinet install (6)
-- + Countertop (4) + Finish (7) + Closeout (6) = 41 items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000108'::uuid,
  'Kitchen SOP Checklist',
  'Standard operating procedure for kitchen remodels — pre-construction through closeout.',
  'project_sop', 'kitchen', ARRAY['admin', 'employee'], 'project_started', 80
) ON CONFLICT (id) DO NOTHING;

-- PRE-CONSTRUCTION (admin) — 6
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Confirm all selections finalized — cabinets, countertops, tile, fixtures, hardware', 'Pre-Construction', 'admin', 1),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Confirm cabinet order placed and lead time confirmed', 'Pre-Construction', 'admin', 2),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Confirm countertop template date scheduled (after cabinet install)', 'Pre-Construction', 'admin', 3),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Confirm all subs scheduled — plumber, electrician', 'Pre-Construction', 'admin', 4),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Order tile, flooring, fixtures if not client-supplied', 'Pre-Construction', 'admin', 5),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Confirm demo start date with crew', 'Pre-Construction', 'admin', 6);

-- DEMO PHASE (employee) — 7
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, requires_note, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Protect flooring and adjacent areas before demo', 'Demo Phase', 'employee', false, false, 7),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Take pre-demo photos of all existing conditions', 'Demo Phase', 'employee', true, false, 8),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Shut off water supply to kitchen — tag shutoff location', 'Demo Phase', 'employee', false, true, 9),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Cap all plumbing rough-ins after fixture removal', 'Demo Phase', 'employee', false, false, 10),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Demo cabinets — note any structural surprises', 'Demo Phase', 'employee', false, true, 11),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Demo flooring to subfloor — inspect subfloor condition', 'Demo Phase', 'employee', false, true, 12),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Haul debris — confirm dumpster scheduled', 'Demo Phase', 'employee', false, false, 13);

-- ROUGH-IN PHASE (admin) — 5
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Confirm plumber has rough-in drawings and fixture schedule', 'Rough-In Phase', 'admin', 14),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Confirm electrician has appliance locations and outlet plan', 'Rough-In Phase', 'admin', 15),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Verify permit posted on site before rough-in begins', 'Rough-In Phase', 'admin', 16),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Schedule rough plumbing inspection', 'Rough-In Phase', 'admin', 17),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Schedule rough electrical inspection', 'Rough-In Phase', 'admin', 18);

-- CABINET INSTALL (employee) — 6
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_note, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Verify all cabinet boxes received — check against order', 'Cabinet Install', 'employee', true, 19),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Snap chalk line for level upper cabinets', 'Cabinet Install', 'employee', false, 20),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Locate and mark all studs', 'Cabinet Install', 'employee', false, 21),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Install uppers before lowers', 'Cabinet Install', 'employee', false, 22),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Check level and plumb on every cabinet', 'Cabinet Install', 'employee', false, 23),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Install cabinet hardware after countertop template', 'Cabinet Install', 'employee', false, 24);

-- COUNTERTOP (admin) — 4
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Schedule countertop template appointment', 'Countertop', 'admin', 25),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Confirm template date with fabricator', 'Countertop', 'admin', 26),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Confirm countertop material and edge profile locked in', 'Countertop', 'admin', 27),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Expected install date: typically 2-3 weeks after template', 'Countertop', 'admin', 28);

-- FINISH PHASE (employee) — 7
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Install backsplash tile — confirm layout with Adam before starting', 'Finish Phase', 'employee', 29),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Install flooring', 'Finish Phase', 'employee', 30),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Install plumbing fixtures — test all connections', 'Finish Phase', 'employee', 31),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Install light fixtures and switches', 'Finish Phase', 'employee', 32),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Install appliances', 'Finish Phase', 'employee', 33),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Final caulking and touch-up paint', 'Finish Phase', 'employee', 34),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Clean — every surface wiped, floors swept and mopped', 'Finish Phase', 'employee', 35);

-- CLOSEOUT (admin) — 6
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, ai_help_available, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Final walkthrough with client — punch list if needed', 'Closeout', 'admin', false, false, 36),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Take completion photos — every angle', 'Closeout', 'admin', true, false, 37),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Collect final payment', 'Closeout', 'admin', false, false, 38),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Generate and send final invoice', 'Closeout', 'admin', false, true, 39),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Submit warranty start date to warranty tracker', 'Closeout', 'admin', false, false, 40),
('aaaaaaaa-0000-0000-0000-000000000108'::uuid, 'Request Google review — 7 days after completion', 'Closeout', 'admin', false, true, 41);

-- ============================================================================
-- 9. BATHROOM SOP CHECKLIST (trigger: project_started, project_type: bathroom)
-- Structure mirrors kitchen: Demo → Rough-in → Waterproofing → Tile → Fixture → Glass/door → Punch list → Closeout
-- Key bathroom-specific items from spec.
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000109'::uuid,
  'Bathroom SOP Checklist',
  'Standard operating procedure for bathroom remodels — demo, rough-in, waterproofing, tile, fixtures, closeout.',
  'project_sop', 'bathroom', ARRAY['admin', 'employee'], 'project_started', 90
) ON CONFLICT (id) DO NOTHING;

-- PRE-CONSTRUCTION (admin)
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Confirm all selections finalized — tile, vanity, shower door, fixtures, hardware', 'Pre-Construction', 'admin', 1),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Confirm toilet rough-in dimension (12" standard, verify before ordering)', 'Pre-Construction', 'admin', 2),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Confirm all subs scheduled — plumber, electrician, tile setter if used', 'Pre-Construction', 'admin', 3),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Confirm shower niche location with client before tile starts', 'Pre-Construction', 'admin', 4),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Confirm grout color selection confirmed before grouting', 'Pre-Construction', 'admin', 5),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Confirm demo start date with crew', 'Pre-Construction', 'admin', 6);

-- DEMO (employee)
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, requires_note, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Protect adjacent hall/floor surfaces before demo', 'Demo', 'employee', false, false, 7),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Take pre-demo photos of all existing conditions', 'Demo', 'employee', true, false, 8),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Shut off water supply — tag shutoff location', 'Demo', 'employee', false, true, 9),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Demo tile, tub/shower, vanity, toilet — cap plumbing', 'Demo', 'employee', false, false, 10),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Inspect subfloor for rot or water damage', 'Demo', 'employee', false, true, 11);

-- ROUGH-IN (admin/employee)
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Plumber rough-in — verify drain locations against fixtures', 'Rough-In', 'admin', 12),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Pressure test plumbing before closing walls', 'Rough-In', 'admin', 13),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Electrical rough-in — vanity lights, exhaust fan, outlets per code', 'Rough-In', 'admin', 14),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Schedule rough plumbing and electrical inspections', 'Rough-In', 'admin', 15);

-- WATERPROOFING (employee) — key bathroom-specific
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Install shower pan and verify slope to drain', 'Waterproofing', 'employee', false, 16),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Install waterproofing membrane — Kerdi, RedGard, or equivalent', 'Waterproofing', 'employee', false, 17),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Waterproofing inspection before tile: take photo of membrane', 'Waterproofing', 'employee', true, 18);

-- TILE (employee)
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Dry lay tile layout — confirm with Adam before setting', 'Tile', 'employee', 19),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Set shower wall tile — full tile cuts on visible edges', 'Tile', 'employee', 20),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Set floor tile with proper slope to drain', 'Tile', 'employee', 21),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Grout, clean, and seal', 'Tile', 'employee', 22);

-- FIXTURE INSTALL (employee)
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Install vanity, sink, faucet, and drain', 'Fixture Install', 'employee', 23),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Install toilet, supply line, and wax ring', 'Fixture Install', 'employee', 24),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Install shower valve trim, showerhead, and body sprays', 'Fixture Install', 'employee', 25),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Install exhaust fan and vanity lights', 'Fixture Install', 'employee', 26);

-- GLASS / DOOR (admin)
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Schedule shower glass template after tile is complete', 'Glass / Door', 'admin', 27),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Confirm shower glass install date with client', 'Glass / Door', 'admin', 28);

-- PUNCH LIST / CLOSEOUT
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, ai_help_available, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Final caulking, touch-up paint, deep clean', 'Punch List', 'employee', false, false, 29),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Final walkthrough with client — complete punch list', 'Closeout', 'admin', false, false, 30),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Take completion photos — every angle', 'Closeout', 'admin', true, false, 31),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Generate and send final invoice', 'Closeout', 'admin', false, true, 32),
('aaaaaaaa-0000-0000-0000-000000000109'::uuid, 'Submit warranty start date to warranty tracker', 'Closeout', 'admin', false, false, 33);

-- ============================================================================
-- 10. ADDITION SOP CHECKLIST (trigger: project_started, project_type: addition)
-- Most complex — pre-construction → permits → excavation/foundation → framing →
-- rough-in (MEP) → inspections → insulation/drywall → interior finishes → exterior → punch list → closeout
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-00000000010a'::uuid,
  'Home Addition SOP Checklist',
  'Standard operating procedure for home additions — permits through final grading.',
  'project_sop', 'addition', ARRAY['admin', 'employee'], 'project_started', 100
) ON CONFLICT (id) DO NOTHING;

-- PRE-CONSTRUCTION / PERMITS (admin)
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Confirm survey/property lines before excavation', 'Pre-Construction', 'admin', 1),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Submit building, electrical, plumbing, mechanical permit applications', 'Permits', 'admin', 2),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Confirm all permits approved and on site before work begins', 'Permits', 'admin', 3),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Confirm window and door schedule locked in for order', 'Pre-Construction', 'admin', 4),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Confirm subcontractors scheduled — excavation, concrete, framing, MEP, roofing', 'Pre-Construction', 'admin', 5);

-- EXCAVATION / FOUNDATION
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Stake out addition footprint — verify setbacks', 'Excavation / Foundation', 'admin', false, 6),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Schedule footing inspection before pour', 'Excavation / Foundation', 'admin', false, 7),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Inspect footings before backfill — photograph', 'Excavation / Foundation', 'employee', true, 8),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Foundation walls poured or block laid and waterproofed', 'Excavation / Foundation', 'admin', false, 9),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Backfill and compact around foundation', 'Excavation / Foundation', 'employee', false, 10);

-- FRAMING
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Frame floor system — joists, rim, subfloor', 'Framing', 'employee', 11),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Frame walls per plan — verify dimensions against drawings', 'Framing', 'employee', 12),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Frame roof — trusses or stick-built per plan', 'Framing', 'employee', 13),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Schedule framing inspection before sheathing', 'Framing', 'admin', 14),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Install sheathing, house wrap, and roof underlayment', 'Framing', 'employee', 15),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Confirm window/door deliveries timed with framing completion', 'Framing', 'admin', 16);

-- ROUGH-IN MEP
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Coordinate HVAC ductwork with framing', 'Rough-In MEP', 'admin', 17),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Plumbing rough-in per plan — pressure test', 'Rough-In MEP', 'admin', 18),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Electrical rough-in — panel, circuits, outlets, switches, lighting', 'Rough-In MEP', 'admin', 19),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Low-voltage rough-in — data, CATV, security, smoke/CO', 'Rough-In MEP', 'admin', 20),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Schedule rough MEP inspections', 'Rough-In MEP', 'admin', 21);

-- INSULATION / DRYWALL
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Install insulation — walls, ceilings, rim joists', 'Insulation / Drywall', 'employee', 22),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Schedule insulation inspection if required', 'Insulation / Drywall', 'admin', 23),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Blower door test if energy code requires', 'Insulation / Drywall', 'admin', 24),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Hang, tape, and finish drywall', 'Insulation / Drywall', 'employee', 25);

-- INTERIOR FINISHES
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Install flooring per room', 'Interior Finishes', 'employee', 26),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Install interior doors, trim, and baseboards', 'Interior Finishes', 'employee', 27),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Prime and paint walls and ceilings', 'Interior Finishes', 'employee', 28),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Install plumbing and electrical finish — fixtures, trim, devices', 'Interior Finishes', 'employee', 29);

-- EXTERIOR FINISHES
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Install siding, trim, and flashing', 'Exterior Finishes', 'employee', 30),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Install gutters and downspouts', 'Exterior Finishes', 'employee', 31),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Paint exterior trim and siding', 'Exterior Finishes', 'employee', 32),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Final grading and landscaping restoration', 'Exterior Finishes', 'employee', 33);

-- PUNCH LIST / CLOSEOUT
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Schedule final building inspection', 'Closeout', 'admin', false, 34),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Final walkthrough with client — complete punch list', 'Closeout', 'admin', false, 35),
('aaaaaaaa-0000-0000-0000-00000000010a'::uuid, 'Take completion photos — every angle interior and exterior', 'Closeout', 'admin', true, 36);

-- ============================================================================
-- 11. BASEMENT FINISH SOP (trigger: project_started, project_type: basement)
-- Pre-construction → Framing → Electrical → Drywall → Flooring → Trim/Doors → Punch → Closeout
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-00000000010b'::uuid,
  'Basement Finish SOP Checklist',
  'Standard operating procedure for basement finishes — framing through closeout.',
  'project_sop', 'basement', ARRAY['admin', 'employee'], 'project_started', 110
) ON CONFLICT (id) DO NOTHING;

-- PRE-CONSTRUCTION
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_note, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Check for water/moisture issues before starting', 'Pre-Construction', 'admin', true, 1),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Verify egress window requirement for bedroom', 'Pre-Construction', 'admin', false, 2),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Confirm ceiling height clearance — 7'' minimum required', 'Pre-Construction', 'admin', false, 3),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Locate and protect existing mechanical systems', 'Pre-Construction', 'admin', false, 4),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Confirm sump pump and drainage functional before closing walls', 'Pre-Construction', 'admin', false, 5);

-- FRAMING
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Frame walls per plan — maintain access to mechanicals', 'Framing', 'employee', 6),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Frame soffits to conceal beams and ductwork', 'Framing', 'employee', 7),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Install egress window if required', 'Framing', 'employee', 8);

-- ELECTRICAL
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Electrical rough-in — outlets, switches, lighting per plan', 'Electrical', 'admin', 9),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Schedule rough electrical inspection', 'Electrical', 'admin', 10),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Install insulation and vapor barrier where required', 'Electrical', 'employee', 11);

-- DRYWALL
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Hang, tape, and finish drywall', 'Drywall', 'employee', 12),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Prime and paint walls and ceilings', 'Drywall', 'employee', 13);

-- FLOORING
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Install moisture barrier underlayment if required', 'Flooring', 'employee', 14),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Install flooring per plan', 'Flooring', 'employee', 15);

-- TRIM / DOORS
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Install interior doors, trim, and baseboards', 'Trim / Doors', 'employee', 16),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Install electrical finish — devices, covers, lighting', 'Trim / Doors', 'employee', 17);

-- PUNCH / CLOSEOUT
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Final clean and punch list walk', 'Closeout', 'employee', false, 18),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Schedule final inspection', 'Closeout', 'admin', false, 19),
('aaaaaaaa-0000-0000-0000-00000000010b'::uuid, 'Take completion photos', 'Closeout', 'admin', true, 20);

-- ============================================================================
-- 12. FIRST-FLOOR TRANSFORMATION SOP (trigger: project_started, project_type: first_floor)
-- Pre-construction → Demo/Structural → Mechanical updates → Drywall/Paint → Flooring → Trim → Kitchen (if in scope) → Closeout
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-00000000010c'::uuid,
  'First-Floor Transformation SOP Checklist',
  'Standard operating procedure for first-floor transformations — structural through closeout.',
  'project_sop', 'first_floor', ARRAY['admin', 'employee'], 'project_started', 120
) ON CONFLICT (id) DO NOTHING;

-- PRE-CONSTRUCTION
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Structural engineer review if removing walls', 'Pre-Construction', 'admin', 1),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Confirm all selections finalized and lead times verified', 'Pre-Construction', 'admin', 2),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Confirm permits in hand before demo begins', 'Pre-Construction', 'admin', 3);

-- DEMO / STRUCTURAL
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Protect adjacent areas not in scope of work', 'Demo / Structural', 'employee', false, 4),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Take pre-demo photos of all areas', 'Demo / Structural', 'employee', true, 5),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Temporary support structure during bearing wall removal', 'Demo / Structural', 'employee', false, 6),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Install permanent beam per structural plan', 'Demo / Structural', 'employee', false, 7),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Confirm all mechanical paths after demo before closing walls', 'Demo / Structural', 'admin', false, 8);

-- MECHANICAL UPDATES
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Update electrical as needed — new circuits, outlets, lighting', 'Mechanical Updates', 'admin', 9),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Update plumbing as needed — rough in for new fixtures', 'Mechanical Updates', 'admin', 10),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Update HVAC as needed — relocate or add runs', 'Mechanical Updates', 'admin', 11),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Schedule inspections for MEP changes', 'Mechanical Updates', 'admin', 12);

-- DRYWALL / PAINT
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Patch or replace drywall affected by demo', 'Drywall / Paint', 'employee', 13),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Prime and paint ceilings and walls', 'Drywall / Paint', 'employee', 14);

-- FLOORING
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Flooring transition planning between rooms', 'Flooring', 'admin', 15),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Install flooring — maintain level transitions', 'Flooring', 'employee', 16);

-- TRIM
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Install trim, baseboards, and door casing', 'Trim', 'employee', 17),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Touch-up paint on all trim', 'Trim', 'employee', 18);

-- KITCHEN (if in scope)
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, is_required, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'If kitchen is in scope, run kitchen SOP checklist in parallel', 'Kitchen', 'admin', false, 19);

-- CLOSEOUT
INSERT INTO checklist_template_items (template_id, title, description, assigned_role, requires_upload, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Final walkthrough with client — complete punch list', 'Closeout', 'admin', false, 20),
('aaaaaaaa-0000-0000-0000-00000000010c'::uuid, 'Take completion photos — every space', 'Closeout', 'admin', true, 21);

-- ============================================================================
-- 13. PROJECT CLOSEOUT CHECKLIST (trigger: project_complete) — 6 employee + 11 admin = 17 items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-00000000010d'::uuid,
  'Project Closeout Checklist',
  'Final closeout steps for every completed project — clean, final payment, photos, warranty start.',
  'project_closeout', NULL, ARRAY['admin', 'employee'], 'project_complete', 130
) ON CONFLICT (id) DO NOTHING;

-- EMPLOYEE items
INSERT INTO checklist_template_items (template_id, title, assigned_role, requires_upload, requires_note, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Final clean — every surface, floors, windows', 'employee', false, false, 1),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Remove all tools and equipment from site', 'employee', false, false, 2),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Take final completion photos', 'employee', true, false, 3),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Note any items not completed or needing follow-up', 'employee', false, true, 4),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Return any client-supplied materials or extras', 'employee', false, false, 5),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Final walk with Adam (or submit for remote review)', 'employee', false, false, 6);

-- ADMIN items
INSERT INTO checklist_template_items (template_id, title, assigned_role, requires_signature, ai_help_available, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Conduct final punch list walkthrough with client', 'admin', false, false, 7),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Confirm all punch list items resolved', 'admin', false, false, 8),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Collect signed punch list completion', 'admin', true, false, 9),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Issue final invoice — confirm all change orders included', 'admin', false, false, 10),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Collect final payment', 'admin', false, false, 11),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Upload all completion photos to project portfolio', 'admin', false, false, 12),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Update project status to Complete', 'admin', false, false, 13),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Set warranty start date — 12 months from completion', 'admin', false, false, 14),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Send project closeout summary to client', 'admin', false, true, 15),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Log final project margin in financial dashboard', 'admin', false, false, 16),
('aaaaaaaa-0000-0000-0000-00000000010d'::uuid, 'Add to estimate template actuals (triggers auto-calibration)', 'admin', false, false, 17);

-- ============================================================================
-- 14. POST-PROJECT SEQUENCE (trigger: project_complete, auto-sequenced over 12 months)
-- 8 time-staggered items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, due_days_from_trigger, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-00000000010e'::uuid,
  'Post-Project Sequence',
  'Automated follow-up sequence spanning 12 months after project completion — thank you, satisfaction, reviews, warranty.',
  'post_project', NULL, ARRAY['admin'], 'project_complete', 365, 140
) ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_template_items (template_id, title, assigned_role, ai_help_available, due_days_from_trigger, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-00000000010e'::uuid, 'Day 1: Send completion thank-you message', 'admin', true, 1, 1),
('aaaaaaaa-0000-0000-0000-00000000010e'::uuid, 'Day 3: Send satisfaction survey link', 'admin', false, 3, 2),
('aaaaaaaa-0000-0000-0000-00000000010e'::uuid, 'Day 7: Send Google review request (only if survey was positive)', 'admin', true, 7, 3),
('aaaaaaaa-0000-0000-0000-00000000010e'::uuid, 'Day 14: Check in — "everything holding up well?"', 'admin', false, 14, 4),
('aaaaaaaa-0000-0000-0000-00000000010e'::uuid, 'Day 30: Follow up on any referrals they mentioned', 'admin', false, 30, 5),
('aaaaaaaa-0000-0000-0000-00000000010e'::uuid, 'Day 90: Check in — "any questions as you settle in?"', 'admin', false, 90, 6),
('aaaaaaaa-0000-0000-0000-00000000010e'::uuid, 'Month 11: Warranty expiry reminder — offer final walkthrough', 'admin', false, 330, 7),
('aaaaaaaa-0000-0000-0000-00000000010e'::uuid, 'Month 12: Warranty expires — note in client record', 'admin', false, 365, 8);
