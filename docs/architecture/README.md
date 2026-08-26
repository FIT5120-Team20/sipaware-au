# Architecture Overview

## Agreed Bootstrap Architecture

- The frontend uses React, TypeScript, and Vite.
- The backend uses Python 3.12+ and FastAPI.
- The frontend communicates with the backend through a REST API. Hosted communication is intended to use HTTPS.
- The only bootstrap API is `GET /api/health`, used to verify local connectivity.

## Privacy Boundary

Personal drinking data is local-only and must remain on the user's device. Epic 1 US1.1 stores drinking-record snapshots in browser LocalStorage using the versioned key `sipaware.drinkingRecords.v1`. Epic 1 US1.2 stores reusable `SavedDrink` definitions separately under `sipaware.savedDrinks.v1`. Both use frontend repository abstractions and are never sent to FastAPI or another backend data store. Each drinking-record snapshot stores the offset at the entered date and time so the original local wall-clock time remains stable if the device timezone later changes.

`SavedDrink` contains reusable drink type, name, serving volume and ABV data, but no servings-consumed or consumption date/time fields. Creating history from My Drinks copies those reusable values into an independent `DrinkingRecord` snapshot. Historical rendering therefore does not depend on the saved definition continuing to exist or remaining unchanged.

For the current data model, `amountConsumed` is the number of servings consumed. It is stored alongside the per-serving volume in millilitres. No standard-drink, guideline, or health value is calculated.

Amazon RDS for PostgreSQL is intended only for approved official or public reference data.

## Pending Decisions

Data Science database integration is pending. No datasets, schemas, tables, ingestion processes, or reference-data contracts have been defined in this repository.

No authentication is in scope for Iteration 1 unless later approved requirements state otherwise.

Cloud deployment, production CORS, and hosted-environment configuration remain future design work.
