# SipAware Recording Reminder Technical Discussion

Project: FIT5120 Team 20 | Source date: 10 October 2026 | Status: Historical discussion draft, not an approved specification

English translation prepared on 13 October 2026 from `SipAware_Reminder_Technical_Discussion_2026-10-10(2).docx`.

> Repository note added on 13 October 2026: This document preserves the original proposal and its status as of 10 October. It is not the current deployment guide. The current main branch documents QStash one-off delayed messages rather than cron-job.org or a recurring database scan. Follow [Background reminder deployment and implementation](background-reminders.md) for the current architecture. Service quotas, prices and compatibility statements below reflect the original discussion and require verification before use.

## Executive summary

The goal is to deliver daily check-in notifications on supported devices even when the website is closed, and to suppress reminders when today's check-in has successfully synchronized.

The original discussion identified two obstacles: Vercel Hobby's built-in scheduling frequency and the backend's inability to read browser IndexedDB directly. It proposed retaining Vercel, React and FastAPI, using an external scheduler, and synchronizing only the minimum reminder metadata. The team needed to decide the scheduling platform, timing tolerance, offline synchronization policy, supported devices and acceptance criteria.

## 1 Project background and status at the time

SipAware provides mobile-first drinking records and health information for Australian users aged 50 to 69. Recording Reminder lets users choose a daily reminder time and receive a system notification to support regular check-ins.

- Users can enable, disable and change their daily reminder time. Saving a time does not by itself enable notifications.
- Supported devices should receive real Web Push when the website is closed. Clicking the notification should return to the relevant page under `/iteration3/`.
- A valid drinking record or an explicit No alcohol confirmation should suppress that day's reminder when synchronization succeeds.
- Send at most one regular reminder per device per local date. Time suggestions may become available after at least seven distinct creation dates, but must not enable reminders automatically.

The following is the original code assessment, not a current completion checklist.

| Observed capability on 10 October | Work still identified in the original assessment |
| --- | --- |
| Save, change and remove a reminder time locally | Service Worker push reception and notification click routing |
| Eligibility checks through `evaluateReminder()` | Browser Push Subscription and VAPID |
| Suggest a time from check-in behaviour | Server scheduling and real push delivery |
| Daily Check-in, History and IndexedDB | Minimal backend synchronization, duplicate prevention and device testing |

## 2 Why frontend timers or Vercel Hobby alone were insufficient

### Browser timers

JavaScript timers depend on the page continuing to run. Closing the page, putting the phone to sleep or browser background restrictions prevent them from serving as reliable server scheduling. Notifications while the site is closed generally require a Push Subscription, a server sender, a browser push service and a Service Worker.

### Vercel Hobby scheduling limits described in the source

The original discussion cites Vercel documentation describing Hobby Cron Jobs as limited to daily execution without exact-minute guarantees. This is a scheduling-frequency limit, not a restriction to one Web Push message per day, and does not prevent multiple manual calls to a test endpoint.

| Example device | Selected daily time |
| --- | --- |
| Device A | 18:00 |
| Device B | 19:30 |
| Device C | 21:00 |

One backend execution per day cannot check and deliver independently at all three times. The proposal therefore considered a frequent external scheduler, a paid plan with more frequent Cron, or another environment with reliable scheduling.

## 3 Options considered in the original proposal

### Option A cron job service

Configure cron-job.org to call a protected Vercel FastAPI reminder endpoint every one to five minutes using dedicated authentication. FastAPI identifies devices whose reminders are due and sends Web Push.

Advantages include retaining the existing website, quick setup, manual test execution and a short path to a real push prototype. Costs include an additional service account, external availability dependency and the need to protect the endpoint.

### Option B Cloudflare Workers Cron Triggers

Keep the frontend and backend on Vercel and use a small Cloudflare Worker to call FastAPI securely at a fixed interval. Scheduler code and configuration can be versioned in the repository.

Advantages include reviewable configuration, recorded changes and easier automation. Costs include another Worker project and secret configuration. Free-tier limits must be checked against the actual account.

### Options C and D paid scheduling or migration

Upgrading Vercel reduces dependence on an external scheduler but incurs a cost. Moving the backend requires changes to APIs, database connections, deployment variables, authentication and regression testing. Neither choice automatically solves synchronization between local IndexedDB and the backend.

| Option | Cost and quota assumptions in the source | Change effort | Original assessment |
| --- | --- | --- | --- |
| A Vercel and cron-job.org | Free service with minute-level scheduling | Low | Suitable for a quick prototype and semester project |
| B Vercel and Cloudflare Workers | Free allowance with minute-level Cron | Low to medium | Suitable for configuration as code and ongoing maintenance |
| C Vercel Pro | Paid | Low | Direct option if a paid plan already exists |
| D Backend migration | Depends on provider | High | Not the initial preference |

## 4 How the backend knows a user has checked in

Drinking records and No alcohol confirmations are mainly stored in the current browser's IndexedDB. FastAPI cannot directly read that storage when the website is closed. A scheduler can run on time without knowing whether the user has completed today's check-in.

### Minimal backend synchronization

Do not upload the full drinking history. Only after the user explicitly enables reminders should the frontend synchronize metadata needed for delivery: an anonymous device identifier, Push Subscription, reminder time, timezone, enabled state, today's completion status, a state version and delivery records.

A completed check-in means either a valid drinking record or an explicit No alcohol confirmation. Missing records do not automatically mean an alcohol-free day. Date-level activity information still requires protection even if drink quantities are not uploaded.

| Backend data required by the proposal | Data not to upload |
| --- | --- |
| Anonymous device subscription identifier and valid Push Subscription | Drink names, quantities and ABV |
| Daily time, timezone and enabled state | Full drinking history and Awards data |
| Necessary date-level completion state, update time and version | Unnecessary tracking or behavioural analytics |

### Synchronization failure policy

| Policy | Benefit | Tradeoff |
| --- | --- | --- |
| Best effort delivery | Fewer missed reminders and closer alignment with the reminder goal | May remind after a local check-in that failed to synchronize |
| Fail closed when uncertain | Fewer incorrect reminders and more conservative handling | May miss reminders after long periods without visiting the site or while offline |

Whichever policy is chosen, synchronize immediately after the local transaction commits and retain work for retry after failure. Older requests must not overwrite newer completion state. Acceptance criteria should qualify suppression with successful synchronization and normal connectivity rather than promise unconditional suppression.

### Why local Service Worker filtering is insufficient

A Service Worker can access IndexedDB. However, sending every push and silently discarding it on the client when a check-in exists cannot be assumed reliable across platforms. The source highlights Apple restrictions on push events that do not produce a visible notification. Prefer server-side eligibility and suppression, followed by real-device validation.

## 5 Proposed workflow

1. The user explicitly enables notifications and the browser obtains permission and a Push Subscription.
2. The frontend sends subscription details, reminder time and timezone to a protected FastAPI endpoint. Drinking history remains in IndexedDB.
3. After a drinking record or No alcohol confirmation, the frontend sends a minimal date-level state update and retains retryable work on failure.
4. An external scheduler authenticates and invokes the reminder endpoint every one to five minutes.
5. FastAPI evaluates device-local date, reminder time, synchronized state and delivery records, with atomic duplicate prevention.
6. FastAPI sends through the browser push service. The Service Worker displays the notification and opens `/iteration3/` when clicked.

This is the historical proposed workflow. See the linked current guide for the QStash implementation now documented on main.

## 6 Compatibility and security

### Device compatibility

The original proposal recommends Android Chrome, desktop Chrome and Edge, and iOS or iPadOS Home Screen web apps. It cites support for eligible Home Screen web apps on iOS 16.4 and later. A normal Safari tab must not be treated as equivalent to an installed Home Screen web app.

Delivery also depends on permission, connectivity, operating system notification settings and Focus Mode. Distinguish a server accepting a send task, a push service accepting a message, and the device actually displaying it. Do not promise exact-second timing or guaranteed delivery.

### Security and privacy requirements

- Authenticate scheduler calls using an independent secret or an equivalent mechanism. Do not expose a public broadcast endpoint.
- Do not expose VAPID private keys, database credentials or subscription encryption material in frontend source code or logs. Handle the browser-generated subscription through the protected API only.
- Do not give the existing Neon reference-data read account write access. Use writable reminder storage with minimum permissions.
- Review classroom access-control middleware so it neither blocks legitimate scheduler calls nor weakens unrelated public endpoints.
- Preserve the account-free design. Manage subscriptions on the current device; do not introduce cross-device record synchronization by default.

## 7 Implementation phases and acceptance evidence

| Phase | Work | Evidence |
| --- | --- | --- |
| 1 Proof of concept | Permission, subscription, manual push, closed page, notification reception and click on one real device | Device observations and backend invocation logs |
| 2 Scheduling | External scheduler, eligibility, duplicate prevention and expired subscription handling | Scheduled execution logs and concurrency tests |
| 3 Synchronization | Minimal state synchronization for add, edit, delete and No alcohol | Integration tests for normal connectivity and failed synchronization retries |
| 4 Regression | Integrate settings and suggestions; check Record, History, Trends and Awards | Frontend and backend tests, build results and device matrix |

Key scenarios:

- Manually invoke testing multiple times without waiting for the next day, while separately verifying real automatic scheduling.
- Set a reminder a few minutes ahead, close the website and verify real notification reception on supported devices.
- Before the due time, separately test a drinking record and No alcohol. Confirm that successful synchronization suppresses delivery.
- Test repeated scheduling on the same day, timezones and daylight saving, enable and disable, denied permission, expired subscriptions, offline operation and synchronization failures.
- Limit deployment changes to `/iteration3/`; preserve `/iteration2/` and teacher-root.

## 8 Decisions requested from the team in the source

| Decision | Options or discussion points |
| --- | --- |
| D1 Scheduler | cron-job.org for faster setup or Cloudflare Workers for configuration as code |
| D2 Timing tolerance | Accept an approximately five-minute checking interval plus variable push latency? |
| D3 Synchronization failures | Best effort with possible incorrect reminders, or fail closed with possible missed reminders? |
| D4 Device scope | Prioritize Android and desktop; decide whether iOS Home Screen support is mandatory |
| D5 Feature boundary | Start with ordinary notifications and navigation; defer interaction buttons and visual refinements |
| D6 Operational ownership | Assign scheduler account, environment variables, database migrations and deployment testing |

The initial recommendation was to retain Vercel, FastAPI and Neon, use cron-job.org or Cloudflare for a real background push proof of concept, and then integrate state synchronization and complete reminder logic. Unless another need arose, the proposal did not recommend migrating the application or expanding into a UI redesign.

## 9 References retained from the source

- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [cron-job.org FAQ](https://cron-job.org/en/faq/)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [WebKit Web Push for iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [WebKit Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)
- [SipAware repository](https://github.com/FIT5120-Team20/sipaware-au)

The source was an unapproved discussion draft. Its repository assessment referred to main as inspected on 10 October 2026. Verify provider quotas, pricing and device support using the actual accounts and current official documentation before implementation.
