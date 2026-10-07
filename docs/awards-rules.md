# Epic 6: awards

## Implemented behavior

The Awards page displays all six awards, current progress, recently earned awards
and accessible detail dialogs. The active route is `/iteration3/awards`.

After successful drinking-record additions, edits, deletions and No alcohol
confirmations, awards are evaluated and persisted without requiring an Awards
page visit. A polite, dismissible App-level notice survives navigation. Failed
award storage never rejects an already committed history write or asks the user
to record it again. My Drinks templates do not grant awards.

Know Your Patterns now requires **7 distinct eligible represented dates** and an
actual view of the Trends tab. This threshold was explicitly approved by the
project owner. Backfilled and No alcohol dates count; missing and future dates do
not. Opening History, Report or Awards is not a Trends view. Changing records
while viewing Trends also reevaluates eligibility.

## Rules and local storage

`awardRules.ts` contains the definitions and pure calculation. Creation dates use
`createdAt` for drinks and `confirmedAt` for No alcohol. Multiple retrospective
entries created on one day count as only one engagement day. Days need not be
consecutive. No award rewards drinking quantity or variety.

Explicit alcohol-free dates count toward alcohol-free awards. Any valid positive
alcohol record overrides conflicting No alcohol metadata, even if displayed
standard drinks round to 0.0. Tracking-start metadata is not a check-in.

`awardRepository.ts` stores `{ id, earnedAt }` in the separate `sipaware_awards`
version-1 IndexedDB database. It never upgrades the retained drink database.
One transaction serializes grants across connections, preserves the first earning
time, and either commits the whole batch or none. Corrupt saved awards produce
an error rather than being silently replaced. There is no award delete/update API.

Earned awards remain earned after history changes. Unearned progress is derived
from current history. Clearing site data removes local awards; other browsers or
devices do not share them. No backend request or notification permission is used.
Creation-day grouping uses the current device timezone because historical records
do not store creation-time timezone offsets; unearned grouping may change when
travelling across timezones.

`awardOverview.ts` reads committed history under the current app's daily-data
lock, calculates eligibility and saves grants before returning earned status.
`awardFeedbackEvents.ts` handles award failures separately from history writes.
`AwardNotice.tsx` displays nonblocking feedback with View Awards and Dismiss.

## Verification

From `frontend/`, run `npm run lint`, `npm test`, and `npm run build`.
For restricted Windows environments use:

```powershell
npm test -- --configLoader native --pool threads --maxWorkers 2
npm run build -- --configLoader native
```

Coverage includes backfill/creation-date deduplication, thresholds, positive
alcohol conflicts, invalid/future rows, atomic storage failure and concurrency,
retention after history deletion, page error/retry, automatic grants and feedback,
and History-versus-Trends activation at six and seven represented dates.
