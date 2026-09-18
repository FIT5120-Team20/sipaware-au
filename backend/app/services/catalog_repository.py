"""Read the imported product table; never join sales packs into duplicate cards."""
from collections.abc import Callable
from contextlib import AbstractContextManager
from pydantic import ValidationError
from app.integrations.database import DatabaseConnection, open_database_connection
from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct
from app.services.barcode_repository import CATEGORY_TYPES

# The existing UI has no Cocktail or Liqueur tab; both belong under Other.
CATEGORY_IDS = {"all": list(CATEGORY_TYPES), "beer": [1], "wine": [2],
                "spirits": [4], "cider": [3], "rtd": [5], "other": [6, 7, 8]}
FILTER_SQL = """
 FROM public.drink_product p
 WHERE p.is_active = TRUE AND p.category_id = ANY(%s)
 AND (p.product_name ILIKE %s ESCAPE '!' OR p.brand_name ILIKE %s ESCAPE '!')
"""
# Within each match tier, the visible drink name outranks a brand-only match.
# Rank the full filtered catalog before LIMIT, then retain that order after the
# source join. Ranking only a fetched page could hide exact matches on later pages.
PAGE_SQL = """
 SELECT p.product_key AS product_id, p.product_name AS drink_name, p.brand_name,
        p.category_id, p.container_volume_ml AS volume_ml, p.abv_percent,
        s.source_name, s.source_url
 FROM (SELECT p.*,
              CASE WHEN %s = '' THEN 0
                   WHEN p.product_name ILIKE %s ESCAPE '!' THEN 0
                   WHEN p.brand_name ILIKE %s ESCAPE '!' THEN 1
                   WHEN p.product_name ILIKE %s ESCAPE '!' THEN 2
                   WHEN p.brand_name ILIKE %s ESCAPE '!' THEN 3
                   WHEN p.product_name ILIKE %s ESCAPE '!' THEN 4
                   ELSE 5 END AS search_rank """ + FILTER_SQL + """
       ORDER BY search_rank, lower(p.product_name), p.product_key LIMIT %s OFFSET %s) p
 LEFT JOIN public.source s ON s.source_id = p.source_id
 ORDER BY p.search_rank, lower(p.product_name), p.product_key
"""


class CatalogDataIntegrityError(RuntimeError):
    """Hide invalid database values at the public API boundary."""


class CatalogRepository:
    def __init__(self, connect: Callable[[], AbstractContextManager[DatabaseConnection]] = open_database_connection):
        self.connect = connect

    def browse(self, category: CatalogCategory, query: str, offset: int, limit: int) -> CatalogPage:
        # Escape LIKE metacharacters independently from SQL parameterization so
        # searching '%' or '_' means those characters, not the entire catalog.
        normalized = query.strip()
        exact = normalized.replace('!', '!!').replace('%', '!%').replace('_', '!_')
        pattern = '%' + exact + '%'
        ranking = (normalized, exact, exact, exact + '%', exact + '%', pattern)
        params = (CATEGORY_IDS[category], pattern, pattern)
        with self.connect() as connection:
            # Count and page share a snapshot if DS updates the imported data.
            connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            connection.execute("SET LOCAL statement_timeout = '5s'")
            total = connection.execute('SELECT count(*) AS total ' + FILTER_SQL, params).fetchone()['total']
            rows = connection.execute(PAGE_SQL, (*ranking, *params, limit, offset)).fetchall()
        try:
            products = [CatalogProduct.model_validate({**row, 'drink_type': CATEGORY_TYPES[row['category_id']]}) for row in rows]
            return CatalogPage(products=products, total=total, offset=offset, limit=limit)
        except (ValidationError, KeyError, TypeError):
            raise CatalogDataIntegrityError('Product catalog is temporarily unavailable.') from None
