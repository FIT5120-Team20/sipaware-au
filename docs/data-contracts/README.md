# Data Contract Status

## Browser-Local Personal Data

| Setting | Value |
| --- | --- |
| Technology | Browser-native IndexedDB (`idb` is a thin Promise wrapper) |
| Database | `alcohol_user_data` |
| Version | `1` |
| Saved Drinks store | `saved_drinks` |
| Drinking Records store | `drinking_records` |

SavedDrinks and DrinkingRecords are personal device-local data. They are not
server data and must never be written to FastAPI or Neon.

The camelCase personal models retain IDs, timestamps, consumption wall-clock
timezone offsets, and independent historical snapshot values. Reference subtype
selection is not persisted, and current reference changes do not migrate or
rewrite existing objects.

An early LocalStorage prototype held development test data only and was never
deployed to production users. No production migration is required; Iteration 1
starts directly with IndexedDB.

## Public Reference Data

`GET /api/reference/drink-options` returns project-managed public metadata from
Neon. The response contains categories, variants, category/variant-scoped serving
sizes, ABV reference options, and source attribution. It contains no personal
drink template or consumption-history fields.

`GET /api/reference/alcohol-guidelines` returns the public DAILY and WEEKLY
thresholds, guideline wording, period descriptions, and NHMRC source
attribution. The bodyless request carries no browser-local personal data.

The frontend validates this response before mapping database category IDs to
stable local DrinkType values. FastAPI keeps database column names behind DTOs,
uses SELECT-only SQL, and opens short-lived read-only connections through the
pooled `app_reader` URL supplied as `DATABASE_URL`.

Standard-drink totals, local-calendar history spans, and the US2.2 eligible
today-record presence flag are derived in React. They are not added to IndexedDB
or sent to FastAPI or Neon. Automatic ABV selection remains future scope.
