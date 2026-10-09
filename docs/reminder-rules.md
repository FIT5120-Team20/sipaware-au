# Reminder eligibility (Epic5)

`evaluateReminder` is a pure decision helper. It cannot send notifications or
activate saved preferences. It requires an explicitly enabled subscription,
delivery readiness, loaded current history, no current-day check-in, a reached
local reminder time and no sent-day ledger entry.

The scheduler must supply dates and times in the same configured timezone.
A delayed evaluation is eligible later on the same day; previous days are not
replayed. This is an implementation assumption, pending end-to-end scheduling.
Missing/unavailable history must not be passed as an unrecorded day.

Delivery is NOT implemented. Two callers can both receive `due`; the eventual
server must atomically claim the subscription/day, persist delivery state and
handle retries without duplicate notifications. Saved preferences do not imply
an active subscription. Browser permission, service worker, push subscription,
background scheduler, check-in suppression sync, notification click routing and
timezone/DST integration remain to be implemented and tested.
