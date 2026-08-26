"""Bootstrap health route."""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=dict[str, str])
def get_health() -> dict[str, str]:
    """Confirm that the API process is available."""
    return {
        "status": "ok",
        "service": "sipaware-au-api",
    }
