"""Public GET barcode boundary; no photos or personal drinking data accepted."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.core.config import DatabaseConfigurationError
from app.integrations.database import DatabaseUnavailableError
from app.schemas.barcode import BarcodeMatch, BarcodeNotFound
from app.services.barcode_repository import BarcodeDataIntegrityError, BarcodeRepository

router = APIRouter(prefix="/api/drinks", tags=["drinks"])


def get_barcode_repository() -> BarcodeRepository:
    return BarcodeRepository()


@router.get("/barcode", response_model=BarcodeMatch | BarcodeNotFound, response_model_by_alias=True)
def find_barcode(
    response: Response,
    barcode: Annotated[str, Query(min_length=1, max_length=200)],
    repository: Annotated[BarcodeRepository, Depends(get_barcode_repository)],
) -> BarcodeMatch | BarcodeNotFound:
    # Text is deliberately not trimmed, cast to a number or UPC/EAN-normalized.
    # Even an unsupported decoded string gets an exact, parameterized lookup;
    # a completed absence is different from a connection or integrity failure.
    try:
        product = repository.find_by_barcode(barcode)
    except (DatabaseConfigurationError, DatabaseUnavailableError, BarcodeDataIntegrityError):
        raise HTTPException(status_code=503, detail="Drink lookup is temporarily unavailable.") from None
    response.headers["Cache-Control"] = "no-store"
    return BarcodeMatch(product=product) if product is not None else BarcodeNotFound()
