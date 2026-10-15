# Release channels: Iteration 2 completion candidate

This document describes the prepared transition. Publication evidence must confirm
its execution before the URLs below are described as promoted or retained.

| Entry | Version after the transition |
| --- | --- |
| https://sipaware.app | Accepted Iteration 2; homepage remains at `/` |
| https://sipaware.app/iteration2 | The same retained Iteration 2 code |
| https://sipaware.app/iteration3 | Active development from main |

The accepted Iteration 2 product source is
`71bdc2514ec603074fc9310309368763f460f7ef` (PR #24).
Preserve `Team20/Iteration2/final-build` and its pinned deployment. Root and
Iteration 2 must use that deployment's HTML, compiled assets and API implementation;
never redirect these entries to the moving Iteration 3 application.

The freeze is **code only**, as explicitly requested by the project owner:
- Keep the current OCR implementation. Its teammate-operated external service may
  stop working; no OCR hosting migration or replacement API belongs in this release.
- The shared read-only reference database remains mutable. This is not a database
  snapshot or a guarantee of fully reproducible external responses.
- Personal drinking records remain in same-origin browser IndexedDB. Paths are not
  separate accounts or independent personal-data stores. Never export these records
  into Git, build artifacts, or a reference-data snapshot.

Preserve the existing shared login and the separate frozen Iteration 1 project.
Normal feature PRs into main develop Iteration 3 only. Updating the stable root or
replacing a retained deployment needs a later explicit iteration-completion decision.
Teammates should start new feature branches from main after the transition and must
not commit further work to `Team20/Iteration2/final-build`.


## Explicit teacher-root snapshot promotion — 2026-09-28

The owner requested promotion of the currently published Iteration 3 functionality
without declaring Iteration 3 complete. This prepared promotion supersedes the root
mapping above only after its deployment and live verification.

- Root `https://sipaware.app` serves source `8d0eb65986f638d28a7494ad4f15d3b5da3b0298`,
  retained independently at `sipaware-au-root-8d0eb65.vercel.app`. Its build uses bare
  root asset and API paths, so future main changes do not replace its chunks or API.
- `/iteration3` remains the active main development version. No I3 freeze occurs.
- `/iteration2` retains `sipaware-au-iteration2.vercel.app` and its existing deployment.
- Shared website login, same-origin local IndexedDB and external reference/OCR
  services remain as configured. Pinning code does not freeze external data/services.
- Later stable-root updates still need the owner's explicit promotion instruction.

The retained upload differs from the source only in `vercel.json` (serve its own
frontend/API) and `frontend/vite.config.ts` (bare-root build base). Product behavior,
including the current OCR integration and History pagination, is unchanged.


## Root-only Iteration 3 promotion candidate - 2026-10-15

This section takes effect only after the release receipt confirms deployment.
Root https://sipaware.app is promoted to current source bccfa823ad444a8f7150c7e0ed9407715d66d2db
through the independent root build at sipaware-au-root-i3-bccfa82.vercel.app.
Root packaging adapts the build base, notification click destination and routing.
/iteration3 remains active from main. No Iteration 3 final branch, frozen alias
or frozen deployment is created by this promotion. Freeze requires a separate
explicit user confirmation after inspecting the promoted root.
Preserve previous root and Iteration 1/2 aliases and deployment identities.
Catalog and Learn reference data remain shared and mutable. Personal records
remain in same-origin browser IndexedDB. Reminder scheduling, Web Push and OCR
remain live services; the current /iteration3/api/reminders/dispatch callback
must stay operational. Pinning the root code does not freeze these services.


## Iteration 3 freeze following the verified root promotion - 2026-10-15

The owner explicitly confirmed the second phase after inspecting the promoted root.
This section takes effect when the separate freeze publication receipt is complete.
- Root remains the independently verified bccfa82 root build at
  sipaware-au-root-i3-bccfa82.vercel.app (dpl_7wL72TDeD3KZJBBGVS4FG9qw3riT).
- /iteration3 is pinned to its independent snapshot at
  sipaware-au-iteration3.vercel.app, including HTML, assets and API implementation.
- Team20/Iteration3/final-build records source bccfa823ad444a8f7150c7e0ed9407715d66d2db.
  Do not push further changes to this final ref or move its retained alias.
- The frozen upload changes only vercel.json from that product source, so it serves
  its own frontend and backend rather than recursively using channel rewrites.
- Shared catalog/Learn data, OCR, and reminder runtime services remain mutable.
  Personal records remain in same-origin IndexedDB and are not part of the snapshot.
- Root reminders still use /iteration3/api/reminders/dispatch. Preserve this API
  and its existing authentication and service configuration on the retained copy.
- Existing Iteration 1/2 and prior root copies remain assigned and unchanged.
- No new project, environment scope, retention policy, or global protection change.
  Only the retained I3 alias receives the reviewed Vercel protection exception;
  the application's shared login remains required.
- Existing /iteration3/ trailing-slash 404 and prior full-suite failures are not
  silently declared fixed by this code/deployment freeze. Use /iteration3.

Future source changes to main must not replace the retained root or I3 build.
Any later revision to a retained channel needs its own explicit reviewed decision.


## Public teacher root; retained iterations unchanged - 2026-10-15

This section takes effect only after its separate publication receipt is complete.
The owner requested removal of the shared username/password from sipaware.app.
Root uses an independent copy of the verified bccfa82 root package at
sipaware-au-root-public-bccfa82.vercel.app. Only that copy's deployment proxy is
removed; frontend, backend, service worker and existing service configuration
remain unchanged. The main request boundary allows root pages/assets/APIs while
keeping /access and /iterationN namespaces behind the classroom gate.
Frozen Iteration 1/2/3 sources, aliases and final refs are not replaced or rebuilt.
They retain login because the deployed authentication has no disable setting.
Root reminder device ownership and the authenticated frozen I3 scheduler callback
remain enforced. Personal records remain in browser IndexedDB; reference data
continues to be shared. Previous retained aliases remain assigned for history.
No dependencies, secrets, database schema, global protection or retention change.
