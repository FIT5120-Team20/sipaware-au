# SipAware AU

Alcohol Consumption and Preventive Health

FIT5120 Team20

## Project Overview

SipAware AU is a web application focused on alcohol-consumption awareness and preventive health. The repository contains a React frontend, a FastAPI health-check backend, lightweight architecture documentation, and the Epic 1 US1.1 manual drink-capture feature.

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

The current product scope is limited to Epic 1 US1.1: manually recording a drink in browser-local drinking history. The form captures drink type, drink name, serving volume, ABV, number of servings consumed, date, and time. A small read-only recent-records section verifies local saves.

My Drinks, reusable saved drinks, editing, deletion, full history management, authentication, health calculations, guideline logic, safety guidance, and Epic 2 functionality are not implemented.

## Data / Database Status

Data Science datasets, schemas, ingestion logic, reference-data contracts, and PostgreSQL tables are pending team agreement. No database or sample dataset is included. Amazon RDS for PostgreSQL is intended only for approved official or public reference data.

See [data/README.md](data/README.md) and [docs/data-contracts/README.md](docs/data-contracts/README.md).

## Privacy Architecture

Personal drinking records remain on the user's device and are stored in browser LocalStorage under the versioned key `sipaware.drinkingRecords.v1`. They are not sent to FastAPI or stored in Amazon RDS, this repository's `data/` directory, or another server-side store.

For US1.1, `amountConsumed` means the number of servings consumed. For example, a serving volume of 375 mL and an amount of 1.5 represents 1.5 servings of 375 mL each. No standard-drink or health calculation is performed.

## Branching Convention

Feature branches should follow:

```text
Team20/Epic<NUMBER>/feature-<feature-name>
```

Examples:

- `Team20/Epic1/feature-manual-record-drink`
- `Team20/Epic2/feature-driving-safety-guidance`

Feature work should be completed on its corresponding feature branch and merged through a Pull Request. The bootstrap itself was prepared on `main` for review as requested.
