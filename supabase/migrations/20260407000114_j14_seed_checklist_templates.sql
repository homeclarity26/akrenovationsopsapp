-- J14: Seed ALL 14 checklist templates and their items verbatim from the Phase J spec.
-- Templates use deterministic UUIDs so items can reference them inline.

-- ============================================================================
-- 1. MARKETING CHECKLIST (manual, monthly) — 10 items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000101'::uuid,
  'Monthly Marketing Checklist',
  'Review marketing performance and execute routine marketing tasks monthly.',
  'marketing', NULL, ARRAY['admin'], 'manual', 10
) ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_template_items (template_id, title, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Review Google Ads performance — clicks, leads, cost per lead this month', 'admin', 1),
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Respond to all Google reviews from this month', 'admin', 2),
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Post 2 project photos to Instagram with AI-generated caption', 'admin', 3),
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Post 1 Facebook update (project progress or completed project)', 'admin', 4),
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Check Google Business Profile for completeness — photos current?', 'admin', 5),
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Review website contact form submissions — any missed?', 'admin', 6),
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Follow up with any leads that went cold in the last 30 days', 'admin', 7),
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Send referral thank-you to anyone who sent a referral this month', 'admin', 8),
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Review top 3 competitor GBP profiles — anything to learn?', 'admin', 9),
('aaaaaaaa-0000-0000-0000-000000000101'::uuid, 'Update website portfolio with best photos from recently completed projects', 'admin', 10);

-- ============================================================================
-- 2. SALES CALL PREP CHECKLIST (trigger: consultation_scheduled) — 8 items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000102'::uuid,
  'Sales Call Prep Checklist',
  'Prepare for an upcoming consultation. Research, materials, questions.',
  'sales_prep', NULL, ARRAY['admin'], 'consultation_scheduled', 20
) ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_template_items (template_id, title, assigned_role, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000102'::uuid, 'Research the neighborhood — Zillow estimate, typical home value, renovation activity', 'admin', 1),
('aaaaaaaa-0000-0000-0000-000000000102'::uuid, 'Review lead source and any notes from initial inquiry', 'admin', 2),
('aaaaaaaa-0000-0000-0000-000000000102'::uuid, 'Prepare 3 project examples similar to their scope — pull photos from portfolio', 'admin', 3),
('aaaaaaaa-0000-0000-0000-000000000102'::uuid, 'Print or pull up current material and cost estimates for this project type', 'admin', 4),
('aaaaaaaa-0000-0000-0000-000000000102'::uuid, 'Check your schedule — what''s your earliest realistic start date?', 'admin', 5),
('aaaaaaaa-0000-0000-0000-000000000102'::uuid, 'Review any client-submitted photos or inspiration images they sent', 'admin', 6),
('aaaaaaaa-0000-0000-0000-000000000102'::uuid, 'Prepare your questions: scope, timeline expectation, budget range, decision maker', 'admin', 7),
('aaaaaaaa-0000-0000-0000-000000000102'::uuid, 'Confirm appointment time and address — send confirmation text the day before', 'admin', 8);

-- ============================================================================
-- 3. SALES CALL / SITE VISIT CHECKLIST (trigger: manual, day of) — 10 items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000103'::uuid,
  'Sales Call / Site Visit Checklist',
  'Execute the on-site consultation and capture everything needed for a proposal.',
  'sales_call', NULL, ARRAY['admin'], 'manual', 30
) ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_template_items (template_id, title, assigned_role, requires_upload, requires_note, ai_help_available, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Arrive 5 minutes early — drive the neighborhood first', 'admin', false, false, false, 1),
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Take before photos of every space being discussed', 'admin', true, false, false, 2),
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Measure key dimensions — note on phone or paper', 'admin', false, false, false, 3),
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Ask: what''s driving this project? Timeline? Budget range? Other bids?', 'admin', false, false, false, 4),
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Walk every area of the home that might be affected', 'admin', false, false, false, 5),
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Note any issues that could affect scope — plumbing, electrical, structural', 'admin', false, false, false, 6),
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Discuss payment structure and deposit requirements', 'admin', false, false, false, 7),
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Set follow-up expectation — "I''ll have a proposal to you within 48 hours"', 'admin', false, false, false, 8),
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Take exterior photo of the home for the project file', 'admin', true, false, false, 9),
('aaaaaaaa-0000-0000-0000-000000000103'::uuid, 'Log call summary in AK Ops within 1 hour of leaving', 'admin', false, true, true, 10);

-- ============================================================================
-- 4. CLIENT MEETING CHECKLIST (trigger: manual) — 10 items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000104'::uuid,
  'Client Meeting Checklist',
  'Prepare for and document any in-progress project meeting with a client.',
  'client_meeting', NULL, ARRAY['admin'], 'manual', 40
) ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_template_items (template_id, title, assigned_role, requires_note, ai_help_available, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Pull up client''s project file before meeting', 'admin', false, false, 1),
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Review any open items from last communication', 'admin', false, false, 2),
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Bring or pull up current selections list — what''s decided, what''s pending', 'admin', false, false, 3),
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Have the project schedule visible — show them where they are', 'admin', false, false, 4),
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Review any change orders in progress or pending', 'admin', false, false, 5),
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Address any open questions from client messages', 'admin', false, false, 6),
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Take notes on any decisions made during meeting', 'admin', true, false, 7),
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Confirm next steps and who is responsible for each', 'admin', false, false, 8),
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Update project record with meeting summary', 'admin', false, true, 9),
('aaaaaaaa-0000-0000-0000-000000000104'::uuid, 'Send follow-up message confirming decisions within 24 hours', 'admin', false, true, 10);

-- ============================================================================
-- 5. CLIENT ONBOARDING CHECKLIST (trigger: contract_signed) — 14 items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, due_days_from_trigger, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000105'::uuid,
  'Client Onboarding Checklist',
  'Welcome the client, collect deposit, prep the project, and set kickoff.',
  'client_onboarding', NULL, ARRAY['admin'], 'contract_signed', 14, 50
) ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_template_items (template_id, title, assigned_role, requires_upload, ai_help_available, due_days_from_trigger, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Send welcome message and introduction to how we work', 'admin', false, true, 1, 1),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Collect deposit payment — confirm receipt', 'admin', false, false, 3, 2),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Schedule kickoff/selections meeting — within first week', 'admin', false, false, 7, 3),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Send selections checklist to client — what they need to choose and by when', 'admin', false, false, 5, 4),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Submit permit applications — pull list from project type', 'admin', false, false, 7, 5),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Order any long-lead materials (cabinets, windows — 6-8 week lead time)', 'admin', false, false, 3, 6),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Confirm subcontractor schedules — framing, plumbing, electrical booked?', 'admin', false, false, 10, 7),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Add project to master schedule — crew assigned?', 'admin', false, false, 2, 8),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Create project folder in Google Drive', 'admin', false, true, 1, 9),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Set up client portal access — send login link', 'admin', false, false, 2, 10),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Add client to Twilio — ensure business number is their contact', 'admin', false, false, 2, 11),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Schedule pre-construction walkthrough — take baseline photos', 'admin', true, false, 7, 12),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Confirm all selections are due 2 weeks before that trade starts', 'admin', false, false, 7, 13),
('aaaaaaaa-0000-0000-0000-000000000105'::uuid, 'Brief Jeff and Steven on project scope and start date', 'admin', false, false, 5, 14);

-- ============================================================================
-- 6. EMPLOYEE ONBOARDING CHECKLIST (trigger: employee_hired) — 11 admin + 7 employee = 18 items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, due_days_from_trigger, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000106'::uuid,
  'Employee Onboarding Checklist',
  'Onboarding workflow for a new crew member. Admin handles paperwork, employee completes self-serve items.',
  'employee_onboarding', NULL, ARRAY['admin', 'employee'], 'employee_hired', 20, 60
) ON CONFLICT (id) DO NOTHING;

-- ADMIN items (1-11)
INSERT INTO checklist_template_items (template_id, title, assigned_role, requires_upload, requires_note, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Complete I-9 verification on or before start date', 'admin', true, false, 1),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Collect completed W-4', 'admin', true, false, 2),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Report new hire to Ohio within 20 days — oh.newhirereporting.com', 'admin', false, false, 3),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Add to Gusto payroll — set up direct deposit', 'admin', false, false, 4),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Add to Ohio BWC workers compensation', 'admin', false, false, 5),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Set up AK Ops account — send login and demo link', 'admin', false, false, 6),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Add to project assignments for current jobs', 'admin', false, false, 7),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Issue any company tools — document with serial numbers', 'admin', false, true, 8),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Provide employee handbook — get signed acknowledgment', 'admin', true, false, 9),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Add vehicle allowance to compensation in payroll module', 'admin', false, false, 10),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Enroll in benefits if eligible — health and retirement', 'admin', false, false, 11);

-- EMPLOYEE items (12-18)
INSERT INTO checklist_template_items (template_id, title, assigned_role, requires_upload, requires_note, external_link, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Complete the AK Ops demo walkthrough — akrenovationsohio.com/demo', 'employee', false, false, 'https://akrenovationsohio.com/demo', 12),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Clock in for the first time with Adam present', 'employee', false, false, NULL, 13),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Upload a photo of your driver''s license', 'employee', true, false, NULL, 14),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Confirm direct deposit bank information in Gusto (link provided)', 'employee', false, false, NULL, 15),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Download the AK Ops app to your phone — add to home screen', 'employee', false, false, NULL, 16),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Review safety guidelines and sign acknowledgment', 'employee', true, false, NULL, 17),
('aaaaaaaa-0000-0000-0000-000000000106'::uuid, 'Confirm vehicle and insurance information', 'employee', false, true, NULL, 18);

-- ============================================================================
-- 7. SUBCONTRACTOR ONBOARDING CHECKLIST (trigger: sub_awarded) — 11 items
-- ============================================================================
INSERT INTO checklist_templates (id, name, description, category, project_type, applies_to_role, trigger_event, sort_order)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000107'::uuid,
  'Subcontractor Onboarding Checklist',
  'Collect insurance, license, W-9, and agreement paperwork for a new subcontractor.',
  'subcontractor_onboarding', NULL, ARRAY['admin'], 'sub_awarded', 70
) ON CONFLICT (id) DO NOTHING;

INSERT INTO checklist_template_items (template_id, title, assigned_role, requires_upload, ai_help_available, sort_order) VALUES
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Collect certificate of insurance — verify coverage amounts', 'admin', true, false, 1),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Collect contractor license number — verify active on Ohio DLRS website', 'admin', false, false, 2),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Collect W-9 for 1099 purposes', 'admin', true, false, 3),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Verify business is in good standing — Ohio SOS lookup', 'admin', false, false, 4),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Add subcontractor record to AK Ops with all details', 'admin', false, false, 5),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Generate and send subcontractor agreement for this project', 'admin', false, true, 6),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Collect signed subcontractor agreement', 'admin', true, false, 7),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Confirm scope of work document sent and acknowledged', 'admin', false, false, 8),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Confirm start date and schedule', 'admin', false, false, 9),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Add to emergency contact list for this project', 'admin', false, false, 10),
('aaaaaaaa-0000-0000-0000-000000000107'::uuid, 'Brief on site rules: cleanliness standards, communication expectations, photo protocol', 'admin', false, false, 11);
