-- F23: Trigger on time_entries clock-out to write memory via update-operational-memory

CREATE OR REPLACE FUNCTION notify_time_entry_clockout()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_user_name TEXT;
  v_project_title TEXT;
  v_hours NUMERIC;
  v_memory_text TEXT;
BEGIN
  -- Only fire when clock_out is being set (transition from NULL to non-NULL)
  IF OLD.clock_out IS NULL AND NEW.clock_out IS NOT NULL THEN

    -- Look up user name
    SELECT full_name INTO v_user_name
    FROM profiles WHERE id = NEW.user_id;

    -- Look up project title (may be null for overhead entries)
    IF NEW.project_id IS NOT NULL THEN
      SELECT title INTO v_project_title
      FROM projects WHERE id = NEW.project_id;
    ELSE
      v_project_title := 'overhead (unbillable)';
    END IF;

    -- Calculate hours
    v_hours := ROUND((NEW.total_minutes::NUMERIC / 60.0)::NUMERIC, 2);

    -- Build memory text
    v_memory_text := format(
      '%s logged %sh of %s at %s on %s%s',
      COALESCE(v_user_name, 'Unknown'),
      v_hours,
      NEW.work_type,
      COALESCE(v_project_title, 'unknown project'),
      TO_CHAR(NEW.clock_in AT TIME ZONE 'America/New_York', 'YYYY-MM-DD'),
      CASE
        WHEN NEW.is_billable AND NEW.billing_rate IS NOT NULL
        THEN format(', billed at $%s/hr ($%s)', NEW.billing_rate, ROUND((v_hours * NEW.billing_rate)::NUMERIC, 2))
        ELSE ', not billed'
      END
    );

    -- Post to update-operational-memory edge function
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object(
        'memory_text', v_memory_text,
        'memory_type', 'time_entry',
        'project_id', NEW.project_id,
        'user_id', NEW.user_id,
        'metadata', jsonb_build_object(
          'work_type', NEW.work_type,
          'total_minutes', NEW.total_minutes,
          'is_billable', NEW.is_billable,
          'billing_rate', NEW.billing_rate,
          'billed_amount', NEW.billed_amount,
          'clock_in', NEW.clock_in,
          'clock_out', NEW.clock_out
        )
      )::text
    );

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER time_entry_clockout_memory
  AFTER UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION notify_time_entry_clockout();
