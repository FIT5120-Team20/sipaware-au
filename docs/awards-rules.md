# Epic 6: award rules foundation

This change implements calculation only. It does not complete Epic 6 and does
not add an Awards page, persistence, notifications or automatic evaluation.

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
