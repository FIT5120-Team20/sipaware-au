-- Apply explicitly after 001 and 002 in the dedicated reminders database.
-- This row is a small durable outbox: queue_pending survives a timeout/crash so
-- retries can publish the same appointment. A fresh generation invalidates all
-- callbacks from superseded settings without scanning other devices.
ALTER TABLE reminder_subscriptions ADD COLUMN IF NOT EXISTS schedule_generation uuid;
ALTER TABLE reminder_subscriptions ADD COLUMN IF NOT EXISTS next_due_at timestamptz;
ALTER TABLE reminder_subscriptions ADD COLUMN IF NOT EXISTS queue_message_id text;
ALTER TABLE reminder_subscriptions ADD COLUMN IF NOT EXISTS queue_pending boolean NOT NULL DEFAULT false;
-- Existing polling-era subscriptions require explicit re-enablement so a
-- migration cannot silently claim they have a delayed appointment registered.
UPDATE reminder_subscriptions SET enabled=false
 WHERE schedule_generation IS NULL AND enabled;

-- A disable may arrive before a delayed initial enable. Persist its revision as
-- a tombstone without inventing a push endpoint or retaining obsolete keys.
ALTER TABLE reminder_subscriptions ALTER COLUMN endpoint DROP NOT NULL;
ALTER TABLE reminder_subscriptions ALTER COLUMN p256dh DROP NOT NULL;
ALTER TABLE reminder_subscriptions ALTER COLUMN auth DROP NOT NULL;
ALTER TABLE reminder_subscriptions ALTER COLUMN reminder_time DROP NOT NULL;
ALTER TABLE reminder_subscriptions ALTER COLUMN timezone DROP NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reminder_enabled_complete'
                AND conrelid='reminder_subscriptions'::regclass) THEN
  ALTER TABLE reminder_subscriptions ADD CONSTRAINT reminder_enabled_complete CHECK
   (NOT enabled OR (endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL
    AND reminder_time IS NOT NULL AND timezone IS NOT NULL
    AND schedule_generation IS NOT NULL AND next_due_at IS NOT NULL));
 END IF;
END $$;
