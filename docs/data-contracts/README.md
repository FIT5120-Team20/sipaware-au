# Data Contract Status

## Browser-Local Personal Data

The implemented portion of the Data Science browser contract is:

| Setting | Value |
| --- | --- |
| Technology | Browser-native IndexedDB (`idb` is a thin Promise wrapper) |
| Database | `alcohol_user_data` |
| Version | `1` |
| Saved Drinks store | `saved_drinks` |
| Drinking Records store | `drinking_records` |

Saved Drinks and Drinking Records are personal device-local data. They are not
server data and must never be written to FastAPI or AWS RDS.

The current camelCase `SavedDrink` and `DrinkingRecord` models are retained so
US1.1-US1.4 continue to work, including IDs, timestamps, consumption wall-clock
timezone offsets, and independent historical snapshot values.

An early LocalStorage prototype held development test data only and was never
deployed to production users. No production data migration is required; the
final Iteration 1 persistence baseline starts directly with IndexedDB.

## Deferred Reference-Data Fields

The Data Science handover also describes future fields including
`category_id`, `variant_id`, `abv_source_type`, and `abv_reference_id`. The
frontend does not yet have the real RDS reference IDs, so this phase does
not add, infer, or guess them. Field-level alignment will occur in a later RDS
reference-integration task using approved real values.

AWS RDS is reserved for project-managed reference/content data. Its datasets,
tables, ingestion process, and frontend mapping remain pending team agreement.
Standard-drink calculation remains Epic 2 scope.
