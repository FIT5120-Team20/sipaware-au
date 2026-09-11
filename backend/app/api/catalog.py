"""Bounded public browsing/search; this endpoint never accepts personal records."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from app.core.config import DatabaseConfigurationError
from app.integrations.database import DatabaseUnavailableError
from app.schemas.catalog import CatalogCategory, CatalogPage
from app.services.catalog_repository import CatalogDataIntegrityError, CatalogRepository

router = APIRouter(prefix="/api/drinks", tags=["drinks"])


def get_catalog_repository() -> CatalogRepository:
    return CatalogRepository()


@router.get('/catalog', response_model=CatalogPage, response_model_by_alias=True)
def browse_catalog(
    response: Response,
    repository: Annotated[CatalogRepository, Depends(get_catalog_repository)],
    category: CatalogCategory = 'all',
    q: Annotated[str, Query(max_length=200)] = '',
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
    limit: Annotated[int, Query(ge=1, le=48)] = 24,
) -> CatalogPage:
    try:
        page = repository.browse(category, q, offset, limit)
    except (DatabaseConfigurationError, DatabaseUnavailableError, CatalogDataIntegrityError):
        raise HTTPException(status_code=503, detail='Product catalog is temporarily unavailable.') from None
    response.headers['Cache-Control'] = 'no-store'
    return page
