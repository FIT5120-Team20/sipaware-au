"""Exact, read-only catalog lookup using the DS-managed barcode mapping.

No format conversion, fuzzy search, external lookup or database mutation occurs
here. Multiple sales-pack barcodes may point to the same minimal-unit product.
"""
from collections.abc import Callable
from contextlib import AbstractContextManager

from pydantic import ValidationError

from app.integrations.database import DatabaseConnection, open_database_connection
from app.schemas.barcode import BarcodeProduct

# These stable IDs are shared with the existing drink reference/form contract.
CATEGORY_TYPES = {
    1: "beer", 2: "wine", 3: "cider", 4: "spirits", 5: "rtd-premixed",
    6: "cocktail", 7: "liqueur", 8: "other",
}
LOOKUP_SQL = """
    SELECT p.product_key AS product_id, b.barcode, p.product_name AS drink_name,
           p.category_id, p.container_volume_ml AS volume_ml, p.abv_percent,
           b.pack_quantity, b.total_package_volume_ml,
           s.source_name, s.source_url
    FROM public.drink_product_barcode b
    JOIN public.drink_product p ON p.product_key = b.product_key
    LEFT JOIN public.source s ON s.source_id = p.source_id
    WHERE b.barcode = %s AND p.is_active = TRUE
"""


class BarcodeDataIntegrityError(RuntimeError):
    """Sanitized data failure, never reported as a confirmed catalog miss."""


class BarcodeRepository:
    def __init__(self, connection_factory: Callable[[], AbstractContextManager[DatabaseConnection]] = open_database_connection):
        self._connect = connection_factory

    def find_by_barcode(self, barcode: str) -> BarcodeProduct | None:
        # Keep the string parameter unchanged, including leading zeros. A query
        # timeout complements the connection timeout on the shared read-only adapter.
        with self._connect() as connection:
            connection.execute("SET LOCAL statement_timeout = '5s'")
            row = connection.execute(LOOKUP_SQL, (barcode,)).fetchone()
        if row is None:
            return None
        try:
            product = BarcodeProduct.model_validate({
                **row, "drink_type": CATEGORY_TYPES[row["category_id"]],
            })
            if product.barcode != barcode:
                raise ValueError("Non-exact match")
            return product
        except (ValidationError, KeyError, ValueError, TypeError):
            raise BarcodeDataIntegrityError("Barcode product data is unavailable.") from None
