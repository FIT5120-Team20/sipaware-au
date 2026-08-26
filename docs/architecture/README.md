# Architecture Overview

## Agreed Bootstrap Architecture

- The frontend uses React, TypeScript, and Vite.
- The backend uses Python 3.12+ and FastAPI.
- The frontend communicates with the backend through a REST API. Hosted communication is intended to use HTTPS.
- The only bootstrap API is `GET /api/health`, used to verify local connectivity.

## Privacy Boundary

Personal drinking data is local-only and must remain on the user's device. It must not be stored in Amazon RDS or another backend data store. A future approved implementation may use LocalStorage or IndexedDB, but no browser persistence is implemented in this bootstrap.

Amazon RDS for PostgreSQL is intended only for approved official or public reference data.

## Pending Decisions

Data Science database integration is pending. No datasets, schemas, tables, ingestion processes, or reference-data contracts have been defined in this repository.

No authentication is in scope for Iteration 1 unless later approved requirements state otherwise.

Cloud deployment, production CORS, and hosted-environment configuration remain future design work.
