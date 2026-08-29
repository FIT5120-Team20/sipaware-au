"""Application DTOs for Epic 1 public drink-reference data.

These models deliberately isolate the frontend contract from PostgreSQL column
layout. They contain only reference values needed for later form integration;
personal drink templates and consumption history are never represented here.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


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


class SourceSummary(ReferenceModel):
    """Minimal attribution for a serving-size or ABV reference."""

    id: int
    name: str
    organisation: str
    url: str


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
