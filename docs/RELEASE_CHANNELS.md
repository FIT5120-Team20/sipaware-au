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
