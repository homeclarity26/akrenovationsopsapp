-- J16: Database triggers that call the generate-checklists edge function.
-- Uses pg_net to make async HTTP POST requests into the edge function.
-- If pg_net is not available, these triggers degrade gracefully into no-ops
-- and checklists can be generated manually from the UI.

-- Helper: post an event to the generate-checklists edge function
CREATE OR REPLACE FUNCTION trigger_generate_checklists(
  trigger_event TEXT,
  entity_id UUID,
  entity_type TEXT
) RETURNS VOID AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Read settings from GUCs. If not configured, fail silently so dev doesn't break.
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    supabase_url := NULL;
  END;

  IF supabase_url IS NULL OR supabase_url = '' THEN
    RETURN;
  END IF;

  -- Best-effort async post via pg_net if available
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/generate-checklists',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'trigger_event', trigger_event,
        'entity_id', entity_id,
        'entity_type', entity_type
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------- leads: INSERT → lead_created --------
CREATE OR REPLACE FUNCTION on_lead_insert_checklists() RETURNS TRIGGER AS $$
BEGIN
  PERFORM trigger_generate_checklists('lead_created', NEW.id, 'lead');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_checklist ON leads;
CREATE TRIGGER trg_leads_checklist
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION on_lead_insert_checklists();

-- -------- projects: status → active → project_started --------
CREATE OR REPLACE FUNCTION on_project_status_checklists() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      PERFORM trigger_generate_checklists('project_started', NEW.id, 'project');
    ELSIF NEW.status = 'complete' THEN
      PERFORM trigger_generate_checklists('project_complete', NEW.id, 'project');

      -- Also fire calibration
      BEGIN
        PERFORM net.http_post(
          url := current_setting('app.settings.supabase_url', true) || '/functions/v1/agent-calibrate-templates',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body := jsonb_build_object('project_id', NEW.id)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_status_checklist ON projects;
CREATE TRIGGER trg_projects_status_checklist
  AFTER INSERT OR UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION on_project_status_checklists();

-- -------- contracts: status → signed → contract_signed --------
-- (sub_contracts is the phase H table; wire both if present)
CREATE OR REPLACE FUNCTION on_contract_signed_checklists() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'signed' THEN
      -- Prefer project_id if contract links to a project
      IF NEW.project_id IS NOT NULL THEN
        PERFORM trigger_generate_checklists('contract_signed', NEW.project_id, 'project');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts') THEN
    DROP TRIGGER IF EXISTS trg_contracts_signed_checklist ON contracts;
    CREATE TRIGGER trg_contracts_signed_checklist
      AFTER UPDATE OF status ON contracts
      FOR EACH ROW EXECUTE FUNCTION on_contract_signed_checklists();
  END IF;
END $$;

-- -------- profiles: INSERT role=employee → employee_hired --------
CREATE OR REPLACE FUNCTION on_profile_employee_insert_checklists() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'employee' THEN
    PERFORM trigger_generate_checklists('employee_hired', NEW.id, 'employee');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_employee_checklist ON profiles;
CREATE TRIGGER trg_profiles_employee_checklist
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION on_profile_employee_insert_checklists();

-- -------- schedule_events: INSERT consultation → consultation_scheduled --------
CREATE OR REPLACE FUNCTION on_consultation_scheduled_checklists() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'consultation' THEN
    -- Attach to lead if present, else project
    IF NEW.project_id IS NOT NULL THEN
      PERFORM trigger_generate_checklists('consultation_scheduled', NEW.project_id, 'project');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule_events') THEN
    DROP TRIGGER IF EXISTS trg_schedule_consultation_checklist ON schedule_events;
    CREATE TRIGGER trg_schedule_consultation_checklist
      AFTER INSERT ON schedule_events
      FOR EACH ROW EXECUTE FUNCTION on_consultation_scheduled_checklists();
  END IF;
END $$;
