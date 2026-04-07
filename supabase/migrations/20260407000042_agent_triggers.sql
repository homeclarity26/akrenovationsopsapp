-- D10: Database triggers for reactive agents
-- Also includes C10: triggers for PDF generation

-- ── REACTIVE AGENT TRIGGERS ───────────────────────────────────────────────────

-- Photo uploaded → agent-photo-tagger
CREATE OR REPLACE FUNCTION notify_photo_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-photo-tagger',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := jsonb_build_object('photo_id', NEW.id, 'project_id', NEW.project_id, 'image_url', NEW.image_url)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_photo_uploaded
  AFTER INSERT ON project_photos
  FOR EACH ROW EXECUTE FUNCTION notify_photo_uploaded();

-- File uploaded → agent-document-classifier
CREATE OR REPLACE FUNCTION notify_file_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-document-classifier',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := jsonb_build_object('file_id', NEW.id, 'project_id', NEW.project_id, 'file_url', NEW.file_url, 'file_type', NEW.file_type)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_file_uploaded
  AFTER INSERT ON project_files
  FOR EACH ROW EXECUTE FUNCTION notify_file_uploaded();

-- Sub invoice classified → agent-sub-invoice-matcher
CREATE OR REPLACE FUNCTION notify_sub_invoice_classified()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.budget_category = 'sub_invoice' AND (OLD.budget_category IS DISTINCT FROM 'sub_invoice') THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/agent-sub-invoice-matcher',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
      body := jsonb_build_object('file_id', NEW.id, 'project_id', NEW.project_id, 'extracted_amount', NEW.extracted_amount, 'extraction_data', NEW.extraction_data)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sub_invoice_classified
  AFTER UPDATE ON project_files
  FOR EACH ROW EXECUTE FUNCTION notify_sub_invoice_classified();

-- Lead inserted → agent-lead-intake
CREATE OR REPLACE FUNCTION notify_lead_inserted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source IN ('website', 'google_ads') THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/agent-lead-intake',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
      body := jsonb_build_object('lead_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_lead_inserted
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION notify_lead_inserted();

-- Project completed → agent-bonus-qualification + agent-review-request (7 days later via cron)
CREATE OR REPLACE FUNCTION notify_project_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS DISTINCT FROM 'complete') THEN
    -- Bonus qualification (immediate)
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/agent-bonus-qualification',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
      body := jsonb_build_object('project_id', NEW.id)
    );
    -- Schedule review request (7 days)
    -- pg_cron single-shot: run once at now() + 7 days
    PERFORM cron.schedule(
      'review-request-' || NEW.id,
      extract(minute from now() + interval '7 days')::text || ' ' ||
      extract(hour from now() + interval '7 days')::text || ' ' ||
      extract(day from now() + interval '7 days')::text || ' ' ||
      extract(month from now() + interval '7 days')::text || ' *',
      format(
        $cron$ SELECT net.http_post(
          url := current_setting('app.supabase_url', true) || '/functions/v1/agent-review-request',
          headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
          body := '%s'::jsonb
        ) $cron$,
        jsonb_build_object('project_id', NEW.id)::text
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_completed
  AFTER UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION notify_project_completed();

-- ── PDF GENERATION TRIGGERS (Phase C) ────────────────────────────────────────

-- Invoice sent or paid → generate-pdf
CREATE OR REPLACE FUNCTION on_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status IN ('sent', 'paid')) AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/generate-pdf',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'document_type', 'invoice',
        'document_id', NEW.id,
        'options', jsonb_build_object(
          'watermark', CASE WHEN NEW.status = 'paid' THEN 'PAID' ELSE NULL END
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_generate_pdf
  AFTER UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION on_invoice_status_change();

-- Proposal sent → generate-pdf
CREATE OR REPLACE FUNCTION on_proposal_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/generate-pdf',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
      body := jsonb_build_object('document_type', 'proposal', 'document_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposal_generate_pdf
  AFTER UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION on_proposal_status_change();

-- Contract sent or signed → generate-pdf
CREATE OR REPLACE FUNCTION on_contract_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('sent', 'signed') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/generate-pdf',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'document_type', 'contract',
        'document_id', NEW.id,
        'options', jsonb_build_object(
          'include_signature_block', true
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contract_generate_pdf
  AFTER UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION on_contract_status_change();

-- Change order sent or approved → generate-pdf
CREATE OR REPLACE FUNCTION on_change_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('sent', 'approved') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/generate-pdf',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'document_type', 'change_order',
        'document_id', NEW.id,
        'options', jsonb_build_object('include_signature_block', true)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER change_order_generate_pdf
  AFTER UPDATE ON change_orders
  FOR EACH ROW EXECUTE FUNCTION on_change_order_status_change();

-- Daily log submitted → generate-pdf
CREATE OR REPLACE FUNCTION on_daily_log_inserted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/generate-pdf',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := jsonb_build_object('document_type', 'daily_log', 'document_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_log_generate_pdf
  AFTER INSERT ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION on_daily_log_inserted();
