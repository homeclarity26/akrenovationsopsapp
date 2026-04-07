-- K63: Database triggers for Phase K agents

-- Tool request → agent notification
CREATE OR REPLACE FUNCTION on_tool_request_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/agent-tool-request',
    body := jsonb_build_object('request_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tool_request_agent ON tool_requests;
CREATE TRIGGER tool_request_agent
  AFTER INSERT ON tool_requests
  FOR EACH ROW EXECUTE FUNCTION on_tool_request_created();

-- Communication log → transcription agent
CREATE OR REPLACE FUNCTION on_conversation_logged()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recording_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/agent-conversation-transcriber',
      body := jsonb_build_object('log_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conversation_transcription_agent ON communication_log;
CREATE TRIGGER conversation_transcription_agent
  AFTER INSERT ON communication_log
  FOR EACH ROW EXECUTE FUNCTION on_conversation_logged();

-- Warranty claim → intake agent
CREATE OR REPLACE FUNCTION on_warranty_claim_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/agent-warranty-intake',
    body := jsonb_build_object('claim_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS warranty_intake_agent ON warranty_claims;
CREATE TRIGGER warranty_intake_agent
  AFTER INSERT ON warranty_claims
  FOR EACH ROW EXECUTE FUNCTION on_warranty_claim_created();

-- Project complete → reel generation
CREATE OR REPLACE FUNCTION on_project_complete_reel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/agent-generate-reel',
      body := jsonb_build_object('project_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_reel_agent ON projects;
CREATE TRIGGER project_reel_agent
  AFTER UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION on_project_complete_reel();
