# Epic 6: award rules foundation

This foundation implements calculation and a standalone local earned-award repository.
The Awards page now evaluates and persists eligible awards on entry and on
returning to the tab. Record/Trends action hooks remain a separate integration step.

## Contract

`frontend/src/features/awards/awardRules.ts` exports `AWARDS` and
`calculateAwards`. The caller supplies valid local records, check-in rows,
previously earned award IDs and an explicit current time. Invalid rows and
future calendar dates are excluded. Tracking-start metadata is not a check-in.

- Engagement counts distinct creation dates: `createdAt` for drinks and
  `confirmedAt` for No alcohol. Backfilling multiple days in one session counts
  as one creation day. Days need not be consecutive.
- Alcohol-free progress counts explicit No alcohol dates. Missing dates never
  qualify. Existing drink records require positive ABV, servings and volume;
  they override stale No alcohol rows even when display rounding produces 0.0.
- Unearned progress is recalculated. Supplied earned IDs stay earned, even
  after every source record is deleted. The caller must persist new earned IDs
  after a successful evaluation; this function does not store them.
- No rule rewards drinking quantity or product variety.

## Decisions required before integration

Creation-day grouping currently uses the device timezone at evaluation time.
Existing data stores consumption offsets, but not creation-time timezone offsets.
Do not claim that unearned creation-day progress is invariant across travel.

The document does not define sufficient history for Know Your Patterns. The
caller must supply a positive integer `trendsMinimumDays` and confirm an actual
Trends view. Leaving that threshold unset disables new grants of that award.
Seven days in the tests is an example parameter, not an approved product rule.

The production check-in repository currently removes No alcohol metadata when
alcohol is recorded on the same date. This evaluator matches that reconciliation
rule. A future durable engagement-event ledger would require a separate decision.

## Validation

From `frontend/`:

```powershell
npm run lint
npm test -- ../tests/epic6/frontend/awardRules.test.ts
npm test
npm run build
```

In restricted Windows execution environments, Vite config bundling or process
workers may be blocked. These equivalent validation commands avoid those paths:

```powershell
npm test -- --configLoader native --pool threads --maxWorkers 2
npm run build -- --configLoader native
```

Tests cover creation-date deduplication, nonconsecutive thresholds, backfill,
No alcohol conflicts, tiny positive consumption, deletion, retained earned IDs,
future/invalid data, local midnight, consumption offsets and Trends prerequisites.
There is no new browser UI to manually exercise in this foundation change.

## Earned-award storage (second slice)

`awardRepository.ts` stores `{ id, earnedAt }` in the `earned_awards` object store
of a separate version-1 `sipaware_awards` IndexedDB database. It does not upgrade
or write to the retained drink database and does not send personal data anywhere.

- `list()` reads validated earned rows. A corrupt row produces an error rather
  than silently making an earned award disappear or assigning it a new date.
- `grant(ids, now)` is for IDs already qualified by the rule calculator. It
  cannot establish eligibility itself. All IDs are validated before writing.
- A single read/write transaction preserves the first grant timestamp, serializes
  competing connections, and commits the whole batch or none of it.
- The result includes all `earned` rows plus only this transaction's
  `newlyEarned` rows. UI feedback must wait for the returned promise to resolve.
- There is deliberately no update/delete operation. Progress toward unearned
  awards is still calculated from current history, not stored in this database.
- Persistence is local to this browser and origin. Clearing site data removes
  awards, and another browser/device does not share them. This is not cloud sync.

The Awards page now calls the calculator and repository. Importing the storage
module alone does not grant awards. The page persists eligible IDs before
displaying earned status and newly-earned feedback.
Storage errors must not cause users to resubmit an already saved drink.

## Awards page (third slice)

The main navigation links to `/awards`, preserving `/iteration3` on the active
build. The page follows the supplied mobile prototype's progress summary,
recent-award feature and two-column cards, with three columns on wide screens.
All six badges have accessible detail dialogs; displayed values are real local
data rather than prototype examples. No backend request is needed.

`awardOverview.ts` reads the two local history stores under the current app's
daily-data lock, calculates eligibility, persists grants, then returns the view.
The page refreshes on focus/visibility return and supports loading/error/retry.
Do not interpret these page-entry checks as complete automatic grant integration:
a user who earns an award and deletes qualifying history before visiting Awards
will not have that event captured yet. Record-change hooks are still required.
Know Your Patterns is not newly granted until the team approves its threshold
and the actual Trends-view event is connected.

Test coverage includes empty state, populated progress, detail dialogs, retained
awards after deletion/reopen, failed load/retry, focus refresh, iteration-aware
navigation and preventing an Awards visit from granting the Trends badge.
