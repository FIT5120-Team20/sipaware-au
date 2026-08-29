# SipAware AU

Alcohol Consumption and Preventive Health

FIT5120 Team20

## Project Overview

SipAware AU is a web application focused on alcohol-consumption awareness and preventive health. The repository contains a React frontend, a FastAPI health-check backend, lightweight architecture documentation, and the Epic 1 US1.1 through US1.4 manual drink-capture features.

## Technology Stack

- Frontend: React, TypeScript, and Vite
- Backend: Python 3.12+ and FastAPI
- Planned frontend hosting: AWS Amplify
- Planned backend hosting: AWS Elastic Beanstalk
- Planned reference database: Amazon RDS for PostgreSQL
- Application communication: REST over HTTPS in hosted environments

Cloud deployment and database integration have not been implemented.

## Repository Structure

```text
.
|-- frontend/           React + TypeScript + Vite application
|-- backend/            FastAPI application and backend tests
|-- data/               Data Science integration placeholder
|-- docs/               Architecture, requirements, and data-contract notes
|-- infrastructure/     Future hosting-direction placeholder
`-- .github/            Pull request template
```

## Local Development

Prerequisites:

- Node.js `^20.19.0`, `^22.13.0`, or `>=24.0.0`, with npm
- Python 3.12 or later

The frontend and backend run as separate local processes. The default example configuration expects the frontend at `http://localhost:5173` and the backend at `http://localhost:8000`.

The frontend environment example contains only browser-visible, non-secret configuration. Copy it before running the frontend:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

The local `.env` is ignored by Git. Values prefixed with `VITE_` are included in client-side code and must never contain secrets.

## Frontend Setup

```powershell
Set-Location frontend
npm install
npm run dev
```

Open `http://localhost:5173` to use the manual drink-entry page. The existing backend health endpoint remains available independently at `GET /api/health`.

Create a production build with:

```powershell
npm run build
```

## Backend Setup

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Its bootstrap endpoint is `GET /api/health`.

## Running Tests

From `backend/` with the virtual environment activated:

```powershell
python -m pytest
```

Frontend static checks can be run from `frontend/`:

```powershell
npm run lint
npm run build
npm test
```

## Current Scope

The current product scope covers Epic 1 US1.1 through US1.4. Users can manually record a drink in browser-local drinking history, explicitly save reusable drink definitions to My Drinks, select a saved drink to create a new history snapshot, manage saved definitions, and correct or delete displayed recent drinking records.

Authentication, health calculations, guideline logic, safety guidance, and Epic 2 functionality are not implemented.

## Data / Database Status

The Data Science browser-persistence contract is implemented for Epic 1 personal data using IndexedDB. Server-side datasets, PostgreSQL schemas, ingestion logic, and real reference-data mappings remain pending team agreement. Amazon RDS for PostgreSQL is reserved only for approved project-managed reference/content data.

See [data/README.md](data/README.md) and [docs/data-contracts/README.md](docs/data-contracts/README.md).

## Privacy Architecture

Personal drinking records and reusable saved drinks remain on the user's device in browser-native IndexedDB. The database is `alcohol_user_data` version 1, with separate `drinking_records` and `saved_drinks` object stores. The lightweight `idb` package provides typed Promise APIs over IndexedDB; it is not a separate data service. Neither collection is sent to FastAPI, analytics, external APIs, or Amazon RDS.

A `SavedDrink` contains only reusable drink type, name, serving volume and ABV data plus local identifiers and timestamps. It excludes servings consumed and consumption date/time. When it is used, its reusable values are copied into a new independent `DrinkingRecord` historical snapshot.

Editing or deleting a `SavedDrink` changes only its reusable definition in `saved_drinks`. It never updates or removes an existing `DrinkingRecord` snapshot.

Editing or deleting a `DrinkingRecord` changes only drinking history in `drinking_records`. A correction preserves that record's ID and creation time, and neither correction nor deletion changes a reusable definition in My Drinks.

An early, undeployed prototype used LocalStorage for development test data. No legacy migration is required: Iteration 1 starts with IndexedDB as the production persistence baseline, and the application does not read the old prototype keys or fall back to LocalStorage.

For US1.1, `amountConsumed` means the number of servings consumed. For example, a serving volume of 375 mL and an amount of 1.5 represents 1.5 servings of 375 mL each. No standard-drink or health calculation is performed.

This phase does not guess future Data Science reference fields such as category, variant, or ABV reference IDs. Those fields are deferred until a later RDS reference-integration task has approved real values. Standard-drink calculation remains Epic 2 scope.

## Branching Convention

Feature branches should follow:

```text
Team20/Epic<NUMBER>/feature-<feature-name>
```

Examples:

- `Team20/Epic1/feature-manual-record-drink`
- `Team20/Epic2/feature-driving-safety-guidance`

Feature work should be completed on its corresponding feature branch and merged through a Pull Request. The bootstrap itself was prepared on `main` for review as requested.
