-- Defensive EXCEPTION handling for trigger functions calling net.http_post.
-- A failing HTTP call (missing config, bad URL, dead edge function, etc.)
-- must not abort the parent INSERT/UPDATE/DELETE. Pattern matches the
-- sister trigger fn_project_memory_sync and on_project_status_checklists
-- which already ship with this defense.

CREATE OR REPLACE FUNCTION public.fn_change_order_memory_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    begin
  if (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'project',
        'entity_id',   new.project_id::text,
        'event',       'change_order_' || new.status,
        'old_value',   old.status,
        'new_value',   new.status,
        'metadata',    jsonb_build_object(
          'change_order_id', new.id,
          'title',           new.title,
          'cost_change',     new.cost_change
        )
      )
    );
  end if;
  return new;
end;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.fn_invoice_memory_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    begin
  if (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'project',
        'entity_id',   new.project_id::text,
        'event',       'invoice_' || new.status,
        'old_value',   old.status,
        'new_value',   new.status,
        'metadata',    jsonb_build_object(
          'invoice_id',     new.id,
          'invoice_number', new.invoice_number,
          'amount',         new.total,
          'paid_amount',    new.paid_amount
        )
      )
    );
  end if;
  return new;
end;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.fn_lead_memory_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    begin
  if (TG_OP = 'UPDATE' and new.stage is distinct from old.stage) then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'lead',
        'entity_id',   new.id::text,
        'event',       'stage_change',
        'old_value',   old.stage,
        'new_value',   new.stage
      )
    );
  end if;

  if (TG_OP = 'INSERT') then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'lead',
        'entity_id',   new.id::text,
        'event',       'lead_created',
        'new_value',   new.stage
      )
    );
  end if;

  return new;
end;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.fn_proposal_memory_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    begin
  if (TG_OP = 'UPDATE' and new.status is distinct from old.status) then
    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/update-operational-memory',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := jsonb_build_object(
        'entity_type', 'lead',
        'entity_id',   new.lead_id::text,
        'event',       'proposal_' || new.status,
        'old_value',   old.status,
        'new_value',   new.status,
        'metadata',    jsonb_build_object(
          'proposal_id',  new.id,
          'title',        new.title,
          'total_price',  new.total_price
        )
      )
    );
  end if;
  return new;
end;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.notify_file_uploaded()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-document-classifier',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := jsonb_build_object('file_id', NEW.id, 'project_id', NEW.project_id, 'file_url', NEW.file_url, 'file_type', NEW.file_type)
  );
  RETURN NEW;
END;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.notify_lead_inserted()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.notify_photo_uploaded()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/agent-photo-tagger',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := jsonb_build_object('photo_id', NEW.id, 'project_id', NEW.project_id, 'image_url', NEW.image_url)
  );
  RETURN NEW;
END;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.notify_project_completed()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.notify_sub_invoice_classified()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.notify_time_entry_clockout()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.on_change_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.on_contract_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.on_conversation_logged()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    BEGIN
  IF NEW.recording_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/agent-conversation-transcriber',
      body := jsonb_build_object('log_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.on_daily_log_inserted()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/generate-pdf',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true), 'Content-Type', 'application/json'),
    body := jsonb_build_object('document_type', 'daily_log', 'document_id', NEW.id)
  );
  RETURN NEW;
END;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.on_invoice_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.on_project_complete_reel()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    BEGIN
  IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/agent-generate-reel',
      body := jsonb_build_object('project_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.on_proposal_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.on_tool_request_created()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/agent-tool-request',
    body := jsonb_build_object('request_id', NEW.id)
  );
  RETURN NEW;
END;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;


CREATE OR REPLACE FUNCTION public.on_warranty_claim_created()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN
  -- Original body follows; wrapped so a failing net.http_post or any
  -- EXCEPTION inside does not abort the parent write.
  BEGIN
    BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/agent-warranty-intake',
    body := jsonb_build_object('claim_id', NEW.id)
  );
  RETURN NEW;
END;
  EXCEPTION WHEN OTHERS THEN
    -- swallow; trigger is best-effort signal
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;

$function$;

