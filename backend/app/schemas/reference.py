"""Application DTOs for public drink and alcohol-guideline reference data.

These models deliberately isolate the frontend contract from PostgreSQL column
layout. They contain only reference values needed for later form integration;
personal drink templates and consumption history are never represented here.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints


def to_camel_case(value: str) -> str:
    """Convert internal snake_case fields to frontend-friendly JSON names."""
    first, *remaining = value.split("_")
    return first + "".join(part.capitalize() for part in remaining)


class ReferenceModel(BaseModel):
    """Apply one consistent JSON naming policy to all reference DTOs."""

    model_config = ConfigDict(
        alias_generator=to_camel_case,
        populate_by_name=True,
    )


# Information DTOs reject blank display content at the application boundary so
# malformed public data cannot become unsourced health or legal presentation.
NonEmptyText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1),
]

AlcoholInformationTopicCode = Literal[
    'STANDARD_DRINK',
    'ALCOHOL_GUIDELINES',
    'ALCOHOL_AGEING',
    'ALCOHOL_DRIVING',
    'ALCOHOL_MEDICINES',
    'ALCOHOL_LEGAL',
]
AlcoholInformationContentType = Literal[
    'PROJECT_SUMMARY',
    'SOURCE_EXCERPT',
    'LINK_ONLY',
]
AlcoholInformationSourceRole = Literal['PRIMARY', 'SUPPORTING']


class AlcoholInformationSource(ReferenceModel):
    '''Trusted source attached to one public information content item.'''

    id: int = Field(gt=0)
    role: AlcoholInformationSourceRole
    name: NonEmptyText
    organisation: NonEmptyText
    url: HttpUrl


class AlcoholInformationContent(ReferenceModel):
    '''One verified content item and all of its many-to-many provenance.'''

    id: int = Field(gt=0)
    title: NonEmptyText
    content_type: AlcoholInformationContentType
    body_text: NonEmptyText
    display_order: int = Field(gt=0)
    last_verified: date
    sources: list[AlcoholInformationSource] = Field(min_length=1)


class AlcoholInformationTopic(ReferenceModel):
    '''Stable topic-code contract separated from physical Neon identifiers.'''

    topic_code: AlcoholInformationTopicCode
    display_name: NonEmptyText
    display_order: int = Field(gt=0)
    content: list[AlcoholInformationContent] = Field(min_length=1)


class AlcoholInformationResponse(ReferenceModel):
    '''All active public alcohol information required by the US2.3 page.'''

    topics: list[AlcoholInformationTopic] = Field(min_length=1)


class SourceSummary(ReferenceModel):
    """Minimal attribution for a serving-size or ABV reference."""

    id: int
    name: str
    organisation: str
    url: str


class AlcoholGuideline(ReferenceModel):
    """One public Australian alcohol-guideline threshold and attribution."""

    id: int
    guideline_type: Literal["DAILY", "WEEKLY"]
    threshold_standard_drinks: float = Field(gt=0)
    period_description: str
    guideline_text: str
    source: SourceSummary


class AlcoholGuidelinesResponse(ReferenceModel):
    """The DAILY and WEEKLY public guideline rows required by US2.1."""

    guidelines: list[AlcoholGuideline]


class DrinkVariantOption(ReferenceModel):
    """One database-defined subtype belonging to its containing category."""

    id: int
    name: str


class ServingSizeOption(ReferenceModel):
    """One category-wide or variant-specific predefined volume."""

    id: int
    name: str
    volume_ml: int
    variant_id: int | None
    source: SourceSummary


class AbvOption(ReferenceModel):
    """Evidence needed for later ABV selection without resolving it here."""

    id: int
    abv_percent: float
    reference_level: Literal["SUBTYPE", "GENERAL", "FALLBACK"]
    reference_option: str
    variant_id: int | None
    application_treatment: str
    source: SourceSummary


class DrinkCategoryOption(ReferenceModel):
    """Aggregate all current reference choices under one stable category."""

    id: int
    name: str
    variants: list[DrinkVariantOption]
    serving_sizes: list[ServingSizeOption]
    abv_options: list[AbvOption]


class DrinkOptionsResponse(ReferenceModel):
    """Complete small reference payload required by the Epic 1 drink form."""

    categories: list[DrinkCategoryOption]
