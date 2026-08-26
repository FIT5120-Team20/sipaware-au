"""FastAPI application entry point for the SipAware AU bootstrap."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.health import router as health_router

LOCAL_FRONTEND_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)

app = FastAPI(
    title="SipAware AU API",
    description="Bootstrap API for SipAware AU.",
    version="0.1.0",
)

# These origins intentionally support only the documented local Vite setup.
# Hosted-environment CORS must be configured when deployment is designed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)

app.include_router(health_router)
