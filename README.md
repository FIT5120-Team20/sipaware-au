# SipAware AU

Alcohol Consumption and Preventive Health

FIT5120 Team20

## Project Overview

SipAware AU is a web application focused on alcohol-consumption awareness and preventive health. This repository currently contains the project bootstrap only: a React frontend, a FastAPI backend, and lightweight documentation for the agreed architecture.

No Epic 1 or Epic 2 product functionality is included in this bootstrap.

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

Open `http://localhost:5173`. The bootstrap page reports whether it can reach the backend health endpoint.

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
```

## Current Scope

This initial foundation verifies that the frontend starts, the backend starts, and the two applications can communicate through a health endpoint. Authentication, accounts, product workflows, health calculations, safety guidance, and other Epic 1 or Epic 2 functionality are not part of this bootstrap.

## Data / Database Status

Data Science datasets, schemas, ingestion logic, reference-data contracts, and PostgreSQL tables are pending team agreement. No database or sample dataset is included. Amazon RDS for PostgreSQL is intended only for approved official or public reference data.

See [data/README.md](data/README.md) and [docs/data-contracts/README.md](docs/data-contracts/README.md).

## Privacy Architecture

Personal drinking records must remain on the user's device. They must not be sent to or stored in Amazon RDS, this repository's `data/` directory, or another server-side store. A future approved implementation may use browser-side storage such as LocalStorage or IndexedDB.

## Branching Convention

Feature branches should follow:

```text
Team20/Epic<NUMBER>/feature-<feature-name>
```

Examples:

- `Team20/Epic1/feature-manual-record-drink`
- `Team20/Epic2/feature-driving-safety-guidance`

Feature work should be completed on its corresponding feature branch and merged through a Pull Request. The bootstrap itself was prepared on `main` for review as requested.
