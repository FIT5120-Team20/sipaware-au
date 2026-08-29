# Architecture Overview

## Application Architecture

- The frontend uses React, TypeScript, and Vite.
- The backend uses Python 3.12+ and FastAPI.
- `GET /api/health` is the only current API and contains no personal data.
- The frontend repository interfaces isolate UI code from browser persistence.

Epic 1 personal-data flow is:

```text
React components
  -> SavedDrinkRepository / DrinkingRecordRepository
  -> idb Promise wrapper
  -> browser-native IndexedDB
```

The `idb` package is a lightweight typed wrapper, not a separate database. The
browser's native IndexedDB implementation remains the persistence engine.

## Browser Personal-Data Database

Saved Drinks and Drinking Records stay on the user's browser/device in:

- database: `alcohol_user_data`
- version: `1`
- object store: `saved_drinks`
- object store: `drinking_records`

Both application repositories expose asynchronous `list`, `add`, `update`, and
`delete` methods. React hydrates both collections before enabling the feature,
waits for writes to commit before changing visible state, and shows an
understandable device-storage error when persistence fails. A rejected write
does not clear form values or falsely show success.

`SavedDrink` remains a reusable definition containing drink type, name, serving
volume, ABV, ID, and timestamps. `DrinkingRecord` remains an independent
historical snapshot containing those drink values plus servings consumed,
consumption time, the original wall-clock timezone offset, ID, and creation
time. Editing or deleting either collection never cascades into the other.

## Prototype-to-Iteration-1 Decision

An early development prototype used LocalStorage. SipAware AU had not been
deployed to production users, and those values contained development test data
only. The team therefore chose not to carry a legacy-data migration into the
final architecture.

Iteration 1 starts with IndexedDB as its production persistence baseline. The
application does not inspect the prototype LocalStorage keys, import their
contents, or use LocalStorage as a persistence fallback. Old prototype values
can be discarded during development.

## Privacy and AWS Boundary

Saved Drinks and Drinking Records are personal data. They are not sent to
FastAPI, analytics, external APIs, or AWS RDS. Amazon RDS for PostgreSQL is
reserved for project-managed reference/content data only.

Keeping personal data local minimises disclosure and matches the Data Science
browser-storage handover. IndexedDB replaced LocalStorage because it offers a
structured transactional database and asynchronous operations while retaining
the same device-local privacy boundary. The existing repository abstraction
limited the persistence refactor's impact to storage implementations and
promise-aware UI integration rather than requiring a feature redesign.

## Data Science Contract Phase Boundary

This phase aligns the persistence technology, database name, object-store
names, and privacy architecture. It intentionally retains the existing
camelCase Epic 1 application models.

Future reference fields such as `category_id`, `variant_id`,
`abv_source_type`, and `abv_reference_id` are deferred until real AWS RDS
reference values and mappings are available. No IDs are invented or guessed.
Full field-contract mapping belongs to the later RDS reference-integration
task.

Standard-drink calculations, guideline logic, and other health calculations
remain Epic 2 scope and are not implemented here.
