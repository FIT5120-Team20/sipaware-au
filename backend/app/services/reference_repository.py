"""SELECT-only repository for public drink and guideline reference information.

All physical PostgreSQL knowledge stays in this module. The API route receives
an application DTO, while the React application will continue to persist all
SavedDrink and DrinkingRecord personal data directly in browser IndexedDB.
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager
from typing import Any

from pydantic import ValidationError

from app.integrations.database import DatabaseConnection, open_database_connection
from app.schemas.reference import (
    AbvOption,
    AlcoholGuideline,
    AlcoholGuidelinesResponse,
    AlcoholInformationContent,
    AlcoholInformationResponse,
    AlcoholInformationSource,
    AlcoholInformationTopic,
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

INFORMATION_SELECT = '''
    SELECT topic.topic_id,
           topic.topic_code,
           topic.display_name,
           topic.display_order AS topic_display_order,
           content.content_id,
           content.content_title,
           content.body_text,
           content.content_type,
           content.display_order AS content_display_order,
           content.last_verified,
           link.source_role,
           source.source_id,
           source.source_name,
           source.organisation,
           source.source_url
    FROM public.information_topic AS topic
    JOIN public.information_content AS content
      ON content.topic_id = topic.topic_id
    LEFT JOIN public.information_content_source AS link
      ON link.content_id = content.content_id
    LEFT JOIN public.source AS source
      ON source.source_id = link.source_id
    WHERE content.is_active IS TRUE
    ORDER BY topic.display_order,
             topic.topic_id,
             content.display_order,
             content.content_id,
             CASE link.source_role
                 WHEN 'PRIMARY' THEN 1
                 WHEN 'SUPPORTING' THEN 2
                 ELSE 3
             END,
             source.source_id
'''

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

# US2.3 deliberately uses one joined SELECT: LEFT JOIN keeps missing provenance
# visible for validation, while a separate tuple protects earlier query audits.
INFORMATION_SELECT_STATEMENTS = (INFORMATION_SELECT,)


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

    def fetch_alcohol_information(self) -> AlcoholInformationResponse:
        '''Aggregate active topic content and provenance from one joined query.'''
        with self._connection_factory() as connection:
            with connection.cursor() as cursor:
                cursor.execute(INFORMATION_SELECT)
                information_rows = cursor.fetchall()

        if not information_rows:
            raise ReferenceDataIntegrityError(
                'Alcohol information rows are inconsistent.'
            )

        topic_fields_by_id: dict[int, tuple[Any, ...]] = {}
        topic_ids_by_code: dict[str, int] = {}
        topic_builders: dict[int, dict[str, Any]] = {}
        content_fields_by_id: dict[int, tuple[Any, ...]] = {}
        content_topic_ids: dict[int, int] = {}
        content_builders: dict[int, dict[str, Any]] = {}
        source_ids_by_content: dict[int, set[int]] = {}

        try:
            for row in information_rows:
                topic_id = row['topic_id']
                topic_code = row['topic_code']
                topic_fields = (
                    topic_code,
                    row['display_name'],
                    row['topic_display_order'],
                )
                if topic_id in topic_fields_by_id:
                    if topic_fields_by_id[topic_id] != topic_fields:
                        raise ReferenceDataIntegrityError(
                            'Alcohol information rows are inconsistent.'
                        )
                else:
                    if topic_code in topic_ids_by_code:
                        raise ReferenceDataIntegrityError(
                            'Alcohol information rows are inconsistent.'
                        )
                    topic_fields_by_id[topic_id] = topic_fields
                    topic_ids_by_code[topic_code] = topic_id
                    topic_builders[topic_id] = {
                        'topic_code': topic_code,
                        'display_name': row['display_name'],
                        'display_order': row['topic_display_order'],
                        'content': [],
                    }

                content_id = row['content_id']
                content_fields = (
                    row['content_title'],
                    row['body_text'],
                    row['content_type'],
                    row['content_display_order'],
                    row['last_verified'],
                )
                if content_id in content_fields_by_id:
                    if (
                        content_fields_by_id[content_id] != content_fields
                        or content_topic_ids[content_id] != topic_id
                    ):
                        raise ReferenceDataIntegrityError(
                            'Alcohol information rows are inconsistent.'
                        )
                else:
                    content_fields_by_id[content_id] = content_fields
                    content_topic_ids[content_id] = topic_id
                    content_builders[content_id] = {
                        'id': content_id,
                        'title': row['content_title'],
                        'content_type': row['content_type'],
                        'body_text': row['body_text'],
                        'display_order': row['content_display_order'],
                        'last_verified': row['last_verified'],
                        'sources': [],
                    }
                    source_ids_by_content[content_id] = set()
                    topic_builders[topic_id]['content'].append(
                        content_builders[content_id]
                    )

                # The LEFT JOIN intentionally yields nulls when active content
                # lacks provenance; failing here avoids silently dropping it.
                source_values = (
                    row['source_id'],
                    row['source_role'],
                    row['source_name'],
                    row['organisation'],
                    row['source_url'],
                )
                if any(value is None for value in source_values):
                    raise ReferenceDataIntegrityError(
                        'Alcohol information rows are inconsistent.'
                    )

                source_id = row['source_id']
                if source_id in source_ids_by_content[content_id]:
                    raise ReferenceDataIntegrityError(
                        'Alcohol information rows are inconsistent.'
                    )
                source_ids_by_content[content_id].add(source_id)
                content_builders[content_id]['sources'].append(
                    AlcoholInformationSource(
                        id=source_id,
                        role=row['source_role'],
                        name=row['source_name'],
                        organisation=row['organisation'],
                        url=row['source_url'],
                    )
                )

            topics = [
                AlcoholInformationTopic(
                    topic_code=builder['topic_code'],
                    display_name=builder['display_name'],
                    display_order=builder['display_order'],
                    content=[
                        AlcoholInformationContent(**content)
                        for content in builder['content']
                    ],
                )
                for builder in topic_builders.values()
            ]
            return AlcoholInformationResponse(topics=topics)
        except (KeyError, TypeError, ValueError, ValidationError):
            raise ReferenceDataIntegrityError(
                'Alcohol information rows are inconsistent.'
            ) from None

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
