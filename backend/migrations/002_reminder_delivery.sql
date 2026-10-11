-- Add ordered current-day snapshots and a delivery outcome to existing subscriptions.
-- Date-level status suppresses a reminder without uploading drinking history.
ALTER TABLE reminder_subscriptions ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
ALTER TABLE reminder_subscriptions ADD COLUMN IF NOT EXISTS checkin_date date;
ALTER TABLE reminder_subscriptions ADD COLUMN IF NOT EXISTS checked_in boolean;
ALTER TABLE reminder_subscriptions ADD COLUMN IF NOT EXISTS synced_at timestamptz;
ALTER TABLE reminder_deliveries ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'claimed';
