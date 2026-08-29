"""FastAPI composition root for SipAware AU's public API.

Vercel imports ``app`` from this module and routes same-origin ``/api`` traffic
to it. Feature routes own their HTTP contracts; this module only assembles the
application and retains local-development CORS support. It does not handle
personal SavedDrink or DrinkingRecord data, which remains in browser IndexedDB.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.health import router as health_router
from .api.reference import router as reference_router

LOCAL_FRONTEND_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)

app = FastAPI(
    title="SipAware AU API",
    description="Public health and drink-reference API for SipAware AU.",
    version="0.1.0",
)

# These origins support only the separate local Vite/FastAPI workflow. Vercel
# routes production browser calls through the same origin, so no hosted origin
# or wildcard permission belongs in this allowlist.
app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)

app.include_router(health_router)
app.include_router(reference_router)
