# Architecture Overview

## Hosted Application Architecture

- One Vercel Services project builds the React/Vite frontend and FastAPI backend.
- `/api/*` is routed to FastAPI before the frontend catch-all is considered.
- Remaining requests enter the Vite service, with `index.html` as the SPA
  history fallback.
- The browser uses relative API paths on the shared Vercel origin.
- FastAPI reads project-managed public reference data from Neon PostgreSQL.

The public reference-data flow is:

```text
React form options
  -> GET /api/reference/drink-options
  -> FastAPI reference repository
  -> short-lived read-only Psycopg connection
  -> Neon public reference tables
```

The health route is independent of database configuration:

```text
GET /api/health -> FastAPI process status
```

## Browser Personal-Data Architecture

Epic 1 personal-data flow is separate:

```text
React components
  -> SavedDrinkRepository / DrinkingRecordRepository
  -> idb Promise wrapper
  -> browser-native IndexedDB
```

The `idb` package is a lightweight typed wrapper, not a separate database. The
browser's native IndexedDB implementation remains the persistence engine.

SavedDrinks and DrinkingRecords stay on the user's browser/device in:

- database: `alcohol_user_data`
- version: `1`
- object store: `saved_drinks`
- object store: `drinking_records`

Both repositories expose asynchronous `list`, `add`, `update`, and `delete`
methods. React hydrates both stores before enabling the feature, waits for writes
to commit before changing visible state, and preserves form values after a
rejected write.

A SavedDrink is a reusable definition containing drink type, name, serving
volume, ABV, ID, and timestamps. A DrinkingRecord is an independent historical
snapshot containing those values plus servings consumed, consumption time, the
original wall-clock timezone offset, ID, and creation time. Editing or deleting
either collection never cascades into the other.

## Reference Compatibility Boundary

The frontend validates the public response at runtime, then maps known Neon
category IDs to stable browser values. Existing personal records continue to use
values such as `spirits` even when the reference display label is "Straight
Spirits". Reference subtypes and serving choices guide data entry but do not
alter the version 1 IndexedDB schema or rewrite historical values.

FastAPI isolates physical PostgreSQL SQL in the reference repository. Database
errors are sanitized before reaching HTTP responses, connection values are
redacted from settings diagnostics, and each reference operation closes its
connection at the request boundary.

## Privacy Boundary

SavedDrinks and DrinkingRecords are personal data. They are not sent to FastAPI,
Neon, analytics, or external APIs. Neon is limited to project-managed public
reference content.

Keeping personal data local minimises disclosure and matches the Data Science
browser-storage handover. IndexedDB provides structured transactional storage
and asynchronous operations while retaining the device-local privacy boundary.

## Prototype and Scope Decisions

An early development prototype used LocalStorage and held test data only. It was
not deployed to production users, so Iteration 1 starts directly with IndexedDB
and does not inspect, import, or fall back to prototype keys.

Standard-drink calculations, guideline logic, automatic ABV estimates, and other
health calculations remain Epic 2 scope and are not implemented here.
