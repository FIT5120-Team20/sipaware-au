"""SELECT-only repository for public drink and guideline reference information.

All physical PostgreSQL knowledge stays in this module. The API route receives
an application DTO, while the React application will continue to persist all
SavedDrink and DrinkingRecord personal data directly in browser IndexedDB.
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager
from typing import Any

from app.integrations.database import DatabaseConnection, open_database_connection
from app.schemas.reference import (
    AbvOption,
    AlcoholGuideline,
    AlcoholGuidelinesResponse,
    DrinkCategoryOption,
    DrinkOptionsResponse,
    DrinkVariantOption,
    ServingSizeOption,
    SourceSummary,
)


CATEGORY_SELECT = """
    SELECT category_id, category_name
    FROM public.drink_category
    ORDER BY category_id
"""

VARIANT_SELECT = """
    SELECT variant_id, category_id, variant_name
    FROM public.drink_variant
    ORDER BY category_id, variant_id
"""

SERVING_SIZE_SELECT = """
    SELECT serving.serving_size_reference_id,
           serving.category_id,
           serving.variant_id,
           serving.option_name,
           serving.volume_ml,
           source.source_id,
           source.source_name,
           source.organisation,
           source.source_url
    FROM public.serving_size_reference AS serving
    JOIN public.source AS source ON source.source_id = serving.source_id
    ORDER BY serving.category_id,
             serving.variant_id NULLS FIRST,
             serving.serving_size_reference_id
"""

ABV_SELECT = """
    SELECT abv.abv_reference_id,
           abv.category_id,
           abv.variant_id,
           abv.reference_level,
           abv.reference_option,
           abv.abv_percent,
           abv.application_treatment,
           source.source_id,
           source.source_name,
           source.organisation,
           source.source_url
    FROM public.abv_reference AS abv
    JOIN public.source AS source ON source.source_id = abv.source_id
    ORDER BY abv.category_id, abv.abv_reference_id
"""

GUIDELINE_SELECT = """
    SELECT guideline.guideline_id,
           guideline.guideline_type,
           guideline.threshold_standard_drinks,
           guideline.period_description,
           guideline.guideline_text,
           source.source_id,
           source.source_name,
           source.organisation,
           source.source_url
    FROM public.guideline_reference AS guideline
    JOIN public.source AS source ON source.source_id = guideline.source_id
    WHERE guideline.guideline_type IN ('DAILY', 'WEEKLY')
    ORDER BY CASE guideline.guideline_type
                 WHEN 'DAILY' THEN 1
                 WHEN 'WEEKLY' THEN 2
             END
"""

# Keeping every executed statement in one exported tuple makes the read-only
# contract easy to inspect and regression-test without connecting to Neon.
REFERENCE_SELECT_STATEMENTS = (
    CATEGORY_SELECT,
    VARIANT_SELECT,
    SERVING_SIZE_SELECT,
    ABV_SELECT,
)

# Guideline SQL stays separate so the Epic 1 drink-options query contract keeps
# its original four statements and the two endpoints can fail independently.
GUIDELINE_SELECT_STATEMENTS = (GUIDELINE_SELECT,)


class ReferenceDataIntegrityError(RuntimeError):
    """Indicate that selected reference rows violate expected relationships."""


ConnectionFactory = Callable[[], AbstractContextManager[DatabaseConnection]]


def _source_from_row(row: dict[str, Any]) -> SourceSummary:
    """Map joined provenance fields to the deliberately small source DTO."""
    return SourceSummary(
        id=row["source_id"],
        name=row["source_name"],
        organisation=row["organisation"],
        url=row["source_url"],
    )


class ReferenceRepository:
    """Read public reference DTOs without exposing SQL to API routes."""

    def __init__(
        self,
        connection_factory: ConnectionFactory = open_database_connection,
    ) -> None:
        self._connection_factory = connection_factory

    def fetch_drink_options(self) -> DrinkOptionsResponse:
        """Return categories with their real variants, serving sizes, and ABVs."""
        with self._connection_factory() as connection:
            with connection.cursor() as cursor:
                cursor.execute(CATEGORY_SELECT)
                category_rows = cursor.fetchall()
                cursor.execute(VARIANT_SELECT)
                variant_rows = cursor.fetchall()
                cursor.execute(SERVING_SIZE_SELECT)
                serving_size_rows = cursor.fetchall()
                cursor.execute(ABV_SELECT)
                abv_rows = cursor.fetchall()

        categories_by_id = {
            row["category_id"]: DrinkCategoryOption(
                id=row["category_id"],
                name=row["category_name"],
                variants=[],
                serving_sizes=[],
                abv_options=[],
            )
            for row in category_rows
        }

        # Scope is preserved exactly as stored: nullable variant IDs remain
        # category-wide records and no inheritance policy is invented here.
        try:
            for row in variant_rows:
                categories_by_id[row["category_id"]].variants.append(
                    DrinkVariantOption(
                        id=row["variant_id"],
                        name=row["variant_name"],
                    )
                )

            for row in serving_size_rows:
                categories_by_id[row["category_id"]].serving_sizes.append(
                    ServingSizeOption(
                        id=row["serving_size_reference_id"],
                        name=row["option_name"],
                        volume_ml=row["volume_ml"],
                        variant_id=row["variant_id"],
                        source=_source_from_row(row),
                    )
                )

            for row in abv_rows:
                categories_by_id[row["category_id"]].abv_options.append(
                    AbvOption(
                        id=row["abv_reference_id"],
                        abv_percent=float(row["abv_percent"]),
                        reference_level=row["reference_level"],
                        reference_option=row["reference_option"],
                        variant_id=row["variant_id"],
                        application_treatment=row["application_treatment"],
                        source=_source_from_row(row),
                    )
                )
        except KeyError:
            # Foreign keys should prevent this in Neon. The generic error keeps
            # malformed row details away from HTTP responses if drift occurs.
            raise ReferenceDataIntegrityError(
                "Reference data relationships are inconsistent."
            ) from None

        return DrinkOptionsResponse(categories=list(categories_by_id.values()))

    def fetch_alcohol_guidelines(self) -> AlcoholGuidelinesResponse:
        """Return exactly one DAILY and one WEEKLY public guideline."""
        with self._connection_factory() as connection:
            with connection.cursor() as cursor:
                cursor.execute(GUIDELINE_SELECT)
                guideline_rows = cursor.fetchall()

        guidelines_by_type: dict[str, AlcoholGuideline] = {}
        try:
            for row in guideline_rows:
                guideline_type = row["guideline_type"]
                if (
                    guideline_type not in {"DAILY", "WEEKLY"}
                    or guideline_type in guidelines_by_type
                ):
                    raise ReferenceDataIntegrityError(
                        "Alcohol guideline rows are inconsistent."
                    )

                guidelines_by_type[guideline_type] = AlcoholGuideline(
                    id=row["guideline_id"],
                    guideline_type=guideline_type,
                    threshold_standard_drinks=float(
                        row["threshold_standard_drinks"]
                    ),
                    period_description=row["period_description"],
                    guideline_text=row["guideline_text"],
                    source=_source_from_row(row),
                )
        except (KeyError, TypeError, ValueError):
            raise ReferenceDataIntegrityError(
                "Alcohol guideline rows are inconsistent."
            ) from None

        if set(guidelines_by_type) != {"DAILY", "WEEKLY"}:
            raise ReferenceDataIntegrityError(
                "Alcohol guideline rows are inconsistent."
            )

        return AlcoholGuidelinesResponse(
            guidelines=[
                guidelines_by_type["DAILY"],
                guidelines_by_type["WEEKLY"],
            ]
        )
