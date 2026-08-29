"""Process-health HTTP boundary for the SipAware AU API.

This route proves that FastAPI is reachable without loading database settings
or querying Neon. It reports service availability only and owns no reference or
personal-data behavior.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=dict[str, str])
def get_health() -> dict[str, str]:
    """Confirm that the API process is available."""
    return {
        "status": "ok",
        "service": "sipaware-au-api",
    }
