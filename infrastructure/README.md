# Deployment Direction

The current hosted architecture is prepared as one Vercel Services project:

- frontend service: React + Vite from `frontend/`;
- backend service: FastAPI from `backend/`;
- public routing: `/api/*` to FastAPI and all other paths to Vite;
- reference database: Neon PostgreSQL through a pooled read-only connection;
- transport security: Vercel-managed HTTPS; and
- personal data: browser IndexedDB only.

Root `vercel.json` contains the service and routing configuration. This directory
contains no infrastructure-as-code, provider credentials, database secrets, or
deployment scripts. Deployment and environment-variable setup remain manual
review steps.

`DATABASE_URL` must be configured privately in Vercel for the backend runtime
and must use the Neon `app_reader` role. It must never be placed in frontend
configuration or committed files.
