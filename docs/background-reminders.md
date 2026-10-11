# Iteration 3: background reminders with one-off appointments

## Scope and data flow

Home reminder settings -> authenticated FastAPI device API -> dedicated writable
PostgreSQL reminder metadata -> QStash one-off delayed message -> protected
FastAPI callback -> Web Push -> device Service Worker.

Each callback addresses ONE device, schedules its next local-calendar-day
appointment, then claims today's delivery. There is no cron-job.org schedule and
no recurring full-database scan. QStash receives only a hashed device identifier,
schedule generation and due timestamp. Drinking records, drink quantities,
check-in history and awards remain in browser IndexedDB.

The separate database stores subscription endpoint/keys, time, timezone, enabled
state, revision, current-day completion status and delivery/appointment metadata.
An absent or yesterday's check-in does not suppress today's reminder. An offline
check-in cannot be known by the server; notification wording is conditional.

## Readiness is not production acceptance

Local implementation and tests do not enable production delivery. Real provider
configuration, database migration, protected callback verification and actual
phone/browser notification receipt must be recorded before claiming delivery.
The complete Epic5/US5.2 scope is NOT claimed: accepting a suggested time still
saves a preference; users must explicitly enable/update background delivery.

## Server configuration (no secret values in source or chat)

Install backend/requirements.txt in the backend environment. The existing
backend/scripts/generate_reminder_keys.py creates a new gitignored local key file
and refuses to overwrite existing keys. Retain existing VAPID keys when upgrading
an existing push deployment. Never commit real .env files or key material.

Configure the following SERVER-only variables:

- REMINDER_DATABASE_URL: dedicated writable reminder database, not the reference
  catalog read-only connection. Business role needs SELECT/INSERT/UPDATE on these
  tables; migrations use an appropriately authorized database owner.
- REMINDER_VAPID_PUBLIC_KEY, REMINDER_VAPID_PRIVATE_KEY, REMINDER_VAPID_SUBJECT
  (maintainer mailto: address).
- `REMINDER_CRON_SECRET`: independent random secret of at least 32 characters.
  The historical variable name is retained for middleware compatibility. Both
  Vercel middleware and FastAPI must receive the same value.
- REMINDER_QSTASH_URL: regional API base from the QStash console, restricted to
  https://qstash.upstash.io, https://qstash-us-east-1.upstash.io or
  https://qstash-eu-central-1.upstash.io.
- `REMINDER_QSTASH_TOKEN`: provider API token, backend only.
- REMINDER_CALLBACK_URL: https://sipaware.app/iteration3/api/reminders/dispatch.
  Exact target is pinned to the active iteration; preview must not use its own
  database to schedule callbacks into production. Preview testing uses fixtures
  until the concrete production package and configuration are accepted.
- REMINDER_DELIVERY_READY: leave 0 until configuration and migration are ready;
  set 1 for the separately reviewed activation. It is not proof of device delivery.

Do NOT create a recurring schedule in QStash or cron-job.org. The backend calls
QStash's publish API with an absolute Not-Before time. The forwarded Authorization
header contains the independent callback secret, never a URL query parameter.
Only authenticated POST /iteration3/api/reminders/dispatch bypasses the website's
classroom cookie gate; FastAPI authenticates it again. Vercel platform Deployment
Protection, if enabled, is an additional layer and needs a reviewed automation
access configuration; do not disable protection project-wide.

## Database migration and compatibility

Run backend/migrations/001_reminders.sql, 002_reminder_delivery.sql and
003_reminder_appointments.sql explicitly, in that order, on the authorized reminder
database. They do not run at application startup. No cloud SQL has been executed
as part of preparing this code. The third migration adds generation, next due
instant, queue message ID and publication-pending columns. Existing legacy
subscriptions with no appointment generation are disabled for explicit re-enable.
Disabled revision tombstones may omit endpoint/key fields; a database constraint
requires complete subscription and appointment data whenever enabled=true. This
prevents a late initial enable from undoing an earlier acknowledged disable.
Stop any existing recurring cron dispatcher before activating the appointment
version. Existing IndexedDB tables and reference catalog schema are untouched.

## Ordering, failures and usage

- Client operations carry monotonically increasing revisions. An older disable
  cannot cancel newer settings. Settings changes rotate generation; queued old
  callbacks become harmless even if provider cancellation fails.
- Database intent is committed before provider publication. A failed/uncertain
  publication leaves queue_pending visible. A retry or subsequent client sync
  repairs it. Identical callback retries can repair the next day's publication.
- Provider deduplication is short-lived; database generation and the unique
  (device, local date) delivery claim provide durable duplicate protection.
- A daily claim is committed before the external push. A crash or uncertain push
  result after that claim can miss that day's notification; it is not retried to
  avoid duplicates. Provider acceptance is NOT device display confirmation.
- The next day is scheduled before sending today. Callbacks get at most three
  retries with 1/2/4-minute delays. A longer provider outage can break the chain;
  refresh status and restore the reminder, or inspect/retry the provider's failed
  message. No continuous database polling is hidden as a recovery mechanism.
- Scheduling follows the saved IANA timezone. DST gaps move to the first real
  minute; repeated times use the first occurrence. Changing device timezone
  requires Update active reminder to apply it.
- Local commits, reconnect/focus and one local midnight boundary trigger sync.
  Unchanged date/completed snapshots are skipped; acknowledgements are stored
  only after success. Failures are visible and get four bounded retries; expired
  website login requires reauthentication rather than a repeated failing loop.

For 10 active devices, the normal scheduling workload is about 10 callback
messages/day plus user setting changes and retries. One global one-minute cron
would make 1,440 calls/day; per-minute sync from 10 continuously open clients would
make 14,400 calls/day. Neither polling pattern is used by this implementation.
At a 0.25-CU minimum and five-minute idle tail, 10 separate wakes/day over 14 days
illustrate about 2.9 CU-hours for the reminder callbacks alone. This is NOT a total
usage promise: reference queries, syncs, other branches, increased compute,
retries, cold starts and provider plan changes add usage. Check actual dashboard
usage during testing. There is no perpetual-free or precise-delivery SLA.

## Validation and operational checks

Frontend: npm test -- --configLoader native --pool threads --maxWorkers 2;
npm run lint; npm run build -- --configLoader native.
Backend: python -m pytest -q from backend.
Root: node --test tests/epic5/frontend/reminderScheduler.test.mjs
tests/epic5/frontend/reminderWorker.test.mjs.

Real PostgreSQL tests require SIPAWARE_TEST_POSTGRES_URL pointing to a disposable
LOCALHOST database. Tests create and drop only their random isolated schema;
nonlocal hosts are refused. If unavailable they are SKIP, never simulated PASS.

Actual deployment/device checks still required:
1. Enable a future reminder, confirm queue receipt and next_due_at, close the site
   and verify actual notification. Verify another day without reopening the site.
2. Confirm a drink or No alcohol, wait for successful minimal sync, then verify
   the due callback suppresses today's push but schedules tomorrow.
3. Update/disable with a pending callback; replay callbacks and verify a single
   daily claim. Test expired push subscriptions and provider failure recovery.
4. Test offline check-in, expired classroom login, DST, and local midnight.
5. iOS/iPadOS uses an installed Home Screen web app on a supported version. A
   standalone manifest is included; real installation, icon and push rendering
   remain device acceptance checks. Grant permission through a user gesture.
6. Verify the pinned active callback and unchanged root/frozen channels. Retain
   website protection, configure rate limits/body limits in the actual hosting
   environment, and review quota/error dashboards before classroom testing.

Official references (checked 2026-10-11):
- https://upstash.com/docs/qstash/api-reference/messages/publish-a-message
- https://upstash.com/docs/qstash/features/retry
- https://upstash.com/docs/qstash/features/deduplication
- https://upstash.com/pricing/qstash
- https://neon.com/docs/introduction/plans
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
