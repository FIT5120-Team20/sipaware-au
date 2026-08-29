"""HTTP boundary for Epic 1 public drink-reference options.

The route translates repository DTOs and sanitized infrastructure failures into
one stable frontend contract. SQL, credentials, and personal browser records
remain outside this module.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.config import DatabaseConfigurationError
from app.integrations.database import DatabaseUnavailableError
from app.schemas.reference import DrinkOptionsResponse
from app.services.reference_repository import (
    ReferenceDataIntegrityError,
    ReferenceRepository,
)


router = APIRouter(prefix="/api/reference", tags=["reference"])
REFERENCE_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600"
UNAVAILABLE_DETAIL = "Reference data is temporarily unavailable."


def get_reference_repository() -> ReferenceRepository:
    """Create a lightweight repository; connections remain request-scoped."""
    return ReferenceRepository()


@router.get(
    "/drink-options",
    response_model=DrinkOptionsResponse,
    response_model_by_alias=True,
)
def get_drink_options(
    response: Response,
    repository: Annotated[
        ReferenceRepository,
        Depends(get_reference_repository),
    ],
) -> DrinkOptionsResponse:
    """Return public form options or a credential-free temporary failure."""
    try:
        drink_options = repository.fetch_drink_options()
    except (
        DatabaseConfigurationError,
        DatabaseUnavailableError,
        ReferenceDataIntegrityError,
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=UNAVAILABLE_DETAIL,
        ) from None

    response.headers["Cache-Control"] = REFERENCE_CACHE_CONTROL
    return drink_options
