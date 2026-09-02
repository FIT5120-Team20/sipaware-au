# SipAware AU

Alcohol Consumption and Preventive Health

FIT5120 Team20

## Project Overview

SipAware AU is a web application focused on alcohol-consumption awareness and
preventive health. The repository contains a React frontend, a FastAPI backend
for public reference data, architecture documentation, Epic 1 manual
drink-capture features, and Epic 2 consumption and educational information.

## Technology Stack

- Frontend: React, TypeScript, and Vite
- Backend: Python 3.12+ and FastAPI
- Hosting target: one Vercel project using Vercel Services
- Reference database: Neon PostgreSQL
- Hosted application communication: same-origin REST over HTTPS
- Personal-data persistence: browser-native IndexedDB

The repository is deployment-ready configuration only; no Vercel deployment is
performed by source changes.

## Repository Structure

```text
.
|-- frontend/           React + TypeScript + Vite service
|   `-- src/            Production frontend source
|-- backend/            FastAPI service
|   `-- app/            Production backend source
|-- tests/              Automated tests and test-only support code
|-- data/               Data boundary documentation
|-- docs/               Architecture, requirements, and data-contract notes
|-- infrastructure/     Hosting-direction documentation
|-- vercel.json         Vercel Services and public routing configuration
`-- .github/            Pull request template
```

## Local Development

Prerequisites:

- Node.js `^20.19.0`, `^22.13.0`, or `>=24.0.0`, with npm
- Python 3.12 or later

The frontend and backend run as separate local processes. The default example
configuration expects the frontend at `http://localhost:5173` and FastAPI at
`http://localhost:8000`.

The frontend environment example contains only browser-visible, non-secret
configuration. Copy it before using the separate local backend:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

Local `.env` files are ignored by Git. Values prefixed with `VITE_` are included
in client code and must never contain secrets. In particular, never rename or
copy `DATABASE_URL` to a `VITE_` variable.

### Frontend

```powershell
Set-Location frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The configured local API base URL sends public
reference requests to the standalone FastAPI process.

Create the normal Vite `dist/` production output with:

```powershell
npm run build
```

### Backend

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000` and exposes:

- `GET /api/health`
- `GET /api/reference/drink-options`
- `GET /api/reference/alcohol-guidelines`
- `GET /api/reference/alcohol-information`

The health route does not require database configuration. The reference route
requires `DATABASE_URL` in the process environment or untracked `backend/.env`.
Use only the private pooled Neon connection for the read-only `app_reader` role.

## Vercel Deployment Preparation

Import the repository root as one Vercel project and select the **Services**
framework preset in the project's Build and Deployment settings. Root
`vercel.json` defines:

- a Vite service rooted at `frontend/`, including SPA history fallback;
- a FastAPI service rooted at `backend/`, using `app.main:app`;
- API-first routing from `/api/*` to FastAPI; and
- all remaining public paths to the frontend.

Vercel detects the existing frontend build and backend dependency manifests, so
no duplicate build system, Python requirements file, wrapper entrypoint, Docker
configuration, or host name is required.

Configure `DATABASE_URL` as a private Vercel Environment Variable for each
deployment environment that needs the reference endpoint. Its value must be the
pooled Neon connection URL for `app_reader`; never commit or paste the value into
`vercel.json`, documentation, frontend environment files, tests, or source code.
Only backend code reads this unprefixed variable, and Vite does not expose it to
browser code.

`VITE_API_BASE_URL` should normally remain unset on Vercel. The frontend then
uses relative `/api/...` URLs on the shared deployment domain, so production
does not require cross-origin CORS permissions.

## Running Tests

From `backend/` with the virtual environment activated:

```powershell
python -m pytest
```

Frontend checks can be run from `frontend/`:

```powershell
npm run lint
npm test
npm run build
```

## Current Scope

Epic 1 US1.1 through US1.4 let users manually record a drink in browser-local
history, explicitly save reusable drink definitions to My Drinks, select a saved
drink to create a new history snapshot, manage saved definitions, and correct or
delete recent drinking records. Current categories, variants, serving sizes, and
reference attribution are loaded from the public FastAPI endpoint. Epic 2 US2.1
derives standard-drink totals for today and a rolling seven-local-calendar-day
window, then compares eligible recorded history with public Australian
guideline values from FastAPI.

Epic 2 US2.2 adds general driving-safety guidance when at least one eligible
DrinkingRecord exists for the current local date. It does not estimate BAC or
provide personalised driving clearance.

Epic 2 US2.3 adds an API-driven Alcohol Guidelines & Legal Information page at
`/alcohol-guidelines`. Six stable topic sections present active Neon content,
verification dates, and PRIMARY/SUPPORTING Australian source links. The
US2.1 explanation controls and US2.2 driving link use native deep links to
these real destinations.

Authentication, automatic ABV estimates, personalised medical advice, and
personalised legal advice are not implemented.

## Data and Privacy Architecture

Neon stores project-managed public reference data only. FastAPI uses short-lived
read-only connections and SELECT-only repository queries to return that data.

Personal DrinkingRecords and reusable SavedDrinks remain on the user's device in
browser-native IndexedDB. The database is `alcohol_user_data` version 1, with
separate `drinking_records` and `saved_drinks` object stores. Neither collection
is sent to FastAPI, Neon, analytics, or another external API.

A SavedDrink contains reusable drink type, name, serving volume and ABV data plus
local identifiers and timestamps. It excludes servings consumed and consumption
date/time. Using it copies those reusable values into a new independent
DrinkingRecord snapshot.

Editing or deleting either collection never cascades into the other. Existing
browser records retain stable drink-type values even when current public labels
or serving suggestions change. Optional reference subtypes are selection aids
and are not added to the version 1 personal-data schema.

An early undeployed prototype used LocalStorage for development test data. No
legacy migration is required: Iteration 1 uses IndexedDB as its persistence
baseline and does not read or fall back to the old keys.

For US1.1, `amountConsumed` means the number of servings consumed. For example,
a serving volume of 375 mL and an amount of 1.5 represents 1.5 servings of 375
mL each. US2.1 derives standard drinks locally as
`servingVolumeMl * amountConsumed * abvPercent * 0.789 / 1000`, sums values
before one-decimal display rounding, and never persists the result.

US2.2 derives its today-record presence trigger from that same eligible local
record collection. The trigger is neither persisted nor sent to the backend.

US2.3 independently issues a bodyless public-reference GET. It does not read
IndexedDB or send DrinkingRecords, SavedDrinks, totals, driving triggers, or
personal attributes to FastAPI or Neon.

See [data/README.md](data/README.md) and
[docs/data-contracts/README.md](docs/data-contracts/README.md).

## Branching Convention

Feature branches should follow:

```text
Team20/Epic<NUMBER>/feature-<feature-name>
```

Examples:

- `Team20/Epic1/feature-manual-record-drink`
- `Team20/Epic2/feature-driving-safety-guidance`

Feature work should be merged through a pull request after review.
