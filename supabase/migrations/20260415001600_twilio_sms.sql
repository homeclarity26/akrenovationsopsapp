-- Twilio SMS integration: add sms_sid column and ensure 'sms' in channel check
--
-- messages.sms_sid stores the Twilio MessageSid for inbound/outbound SMS.
-- The channel CHECK constraint already includes 'sms' from the base schema,
-- but we guard with an idempotent check just in case.

-- 1. Add sms_sid column if it doesn't already exist
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sms_sid TEXT;

-- 2. Ensure 'sms' is in the channel CHECK constraint (idempotent)
DO $$
BEGIN
  -- The base schema defines: CHECK (channel IN ('in_app', 'sms', 'email'))
  -- If 'sms' is already present (it is), this is a no-op.
  -- If a future migration altered the constraint without 'sms', re-add it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'messages'
      AND c.contype = 'c'
      AND c.consrc LIKE '%sms%'
  ) THEN
    -- Drop the old check and recreate with sms included
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_channel_check;
    ALTER TABLE messages ADD CONSTRAINT messages_channel_check
      CHECK (channel IN ('in_app', 'sms', 'email'));
  END IF;
END $$;

-- 3. Index for webhook phone lookups on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles (phone) WHERE phone IS NOT NULL;

-- 4. Rate limit entry for the new functions
-- (rate_limit_events is keyed by endpoint string; no DDL needed — just noting
--  that send-sms and twilio-webhook are registered in _shared/rate-limit.ts)

COMMENT ON COLUMN messages.sms_sid IS 'Twilio MessageSid for SMS messages';
