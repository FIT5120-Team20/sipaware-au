-- Apply explicitly to a dedicated writable reminders database, never at app startup.
CREATE TABLE IF NOT EXISTS reminder_subscriptions (
 token_hash text PRIMARY KEY,
 endpoint text NOT NULL UNIQUE,
 p256dh text NOT NULL,
 auth text NOT NULL,
 reminder_time char(5) NOT NULL,
 timezone text NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reminder_deliveries (
 token_hash text NOT NULL REFERENCES reminder_subscriptions(token_hash),
 local_date date NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (token_hash, local_date)
);
