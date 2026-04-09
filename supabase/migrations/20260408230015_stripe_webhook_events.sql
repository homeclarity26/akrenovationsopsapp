-- stripe_webhook_events table
-- Stores incoming Stripe webhook events for debugging and idempotency.
-- STATUS: READY TO PUSH — requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET secrets to be active.
-- Do not push until Stripe is configured (see SESSION_STATE.md "Remaining optional secrets").

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only" ON stripe_webhook_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
