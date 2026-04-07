-- H4: Seed contract_templates with initial Ohio subcontractor agreement template

INSERT INTO contract_templates (template_type, version, content, attorney_approved, is_current, notes)
VALUES (
  'subcontractor_agreement',
  'v1.0-draft',
  jsonb_build_object(
    'title', 'SUBCONTRACTOR AGREEMENT',
    'preamble', E'Contract No: {{contract_number}}\nDate: {{date}}',
    'sections', jsonb_build_array(
      jsonb_build_object(
        'heading', 'PARTIES',
        'body', E'Contractor: AK Renovations LLC\n             Adam Kilgore, Owner\n             Summit County, Ohio\n             [License No.]\n             [Insurance Policy No.]\n\nSubcontractor: {{sub_company_name}}\n               {{sub_contact_name}}\n               {{sub_address}}\n               {{sub_license_number}}\n               {{sub_insurance_policy}}'
      ),
      jsonb_build_object(
        'heading', 'PROJECT',
        'body', E'Project Name: {{project_name}}\nProject Address: {{project_address}}\nOwner: {{client_name}}'
      ),
      jsonb_build_object(
        'heading', 'SCOPE OF WORK',
        'body', E'This Agreement incorporates by reference the Scope of Work document titled\n"{{scope_title}}", Scope No. {{scope_number}}, dated {{scope_date}},\nwhich is attached hereto as Exhibit A and made a part of this Agreement.\nSubcontractor agrees to perform all work described therein.'
      ),
      jsonb_build_object(
        'heading', 'CONTRACT AMOUNT',
        'body', 'Total Contract Amount: {{contract_amount}}'
      ),
      jsonb_build_object(
        'heading', 'PAYMENT SCHEDULE',
        'body', E'{{payment_schedule_table}}\n\nRetention of {{retention_percent}}% shall be withheld from each payment and\nreleased within 30 days of final completion and acceptance of all work.'
      ),
      jsonb_build_object(
        'heading', 'INSURANCE REQUIREMENTS',
        'body', E'Subcontractor shall maintain throughout the duration of this Agreement:\n  (a) Commercial General Liability: minimum ${{required_gl_amount}} per occurrence\n  (b) Workers Compensation: as required by Ohio law\n  (c) Automobile Liability: minimum $1,000,000 combined single limit\nAK Renovations LLC shall be named as Additional Insured on all policies.\nCertificates of insurance must be provided before commencement of work.'
      ),
      jsonb_build_object(
        'heading', 'SCHEDULE',
        'body', E'Work shall commence on or about {{start_date}} and reach Substantial Completion\nby {{completion_date}}.'
      ),
      jsonb_build_object(
        'heading', 'LIQUIDATED DAMAGES',
        'body', E'Time is of the essence. For each calendar day beyond the Substantial Completion\ndate that work remains incomplete due to Subcontractor''s fault, Subcontractor\nshall pay AK Renovations ${{liquidated_damages_per_day}} per day as liquidated\ndamages, not as a penalty.',
        'conditional', 'liquidated_damages'
      ),
      jsonb_build_object(
        'heading', 'OHIO MECHANIC''S LIEN RIGHTS',
        'body', E'Subcontractor acknowledges that it may have lien rights under Ohio Revised Code\nChapter 1311. Subcontractor agrees to provide lien waivers with each payment\nrequest. Subcontractor shall not file a mechanic''s lien without first providing\nAK Renovations written notice and a 10-day opportunity to cure.'
      ),
      jsonb_build_object(
        'heading', 'INDEMNIFICATION',
        'body', E'Subcontractor shall indemnify, defend, and hold harmless AK Renovations, its\nofficers, agents, and employees from any claims, damages, or expenses arising\nfrom Subcontractor''s work, including attorney''s fees, except to the extent caused\nby AK Renovations'' negligence.'
      ),
      jsonb_build_object(
        'heading', 'INDEPENDENT CONTRACTOR',
        'body', E'Subcontractor is an independent contractor and not an employee of AK Renovations.\nSubcontractor is responsible for all federal, state, and local taxes on amounts\npaid under this Agreement.'
      ),
      jsonb_build_object(
        'heading', 'OHIO LAW / DISPUTE RESOLUTION',
        'body', E'This Agreement shall be governed by Ohio law. Any disputes shall first be\nsubmitted to non-binding mediation in Summit County, Ohio before litigation.'
      ),
      jsonb_build_object(
        'heading', 'TERMINATION',
        'body', E'AK Renovations may terminate this Agreement for convenience upon 3 days written\nnotice, paying Subcontractor for work completed to date. AK Renovations may\nterminate for cause immediately upon written notice if Subcontractor fails to\nperform, abandons the work, or becomes insolvent.'
      ),
      jsonb_build_object(
        'heading', 'CHANGES',
        'body', E'No changes to the scope or contract amount shall be binding unless agreed in\nwriting and signed by both parties.'
      ),
      jsonb_build_object(
        'heading', 'ENTIRE AGREEMENT',
        'body', E'This Agreement, together with Scope of Work No. {{scope_number}}, constitutes\nthe entire agreement between the parties.'
      ),
      jsonb_build_object(
        'heading', 'SIGNATURES',
        'body', E'AK Renovations LLC                    {{sub_company_name}}\n\n_______________________________       _______________________________\nAdam Kilgore, Owner                   {{sub_contact_name}}, {{sub_title}}\n\nDate: _________________________       Date: _________________________'
      )
    )
  ),
  false,
  true,
  'Initial draft seeded at system setup. Requires Ohio construction attorney review before marking attorney_approved.'
)
ON CONFLICT DO NOTHING;
