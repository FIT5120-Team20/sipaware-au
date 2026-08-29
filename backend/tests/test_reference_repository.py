"""Unit tests for SELECT-only reference aggregation and DTO mapping."""

from __future__ import annotations

import re
from contextlib import contextmanager
from decimal import Decimal
from typing import Any

from app.services.reference_repository import (
    REFERENCE_SELECT_STATEMENTS,
    ReferenceRepository,
)


class FakeCursor:
    """Return one prepared result set for each repository SELECT."""

    def __init__(self, result_sets: list[list[dict[str, Any]]]) -> None:
        self._result_sets = result_sets
        self._current_rows: list[dict[str, Any]] = []
        self.executed_statements: list[str] = []

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def execute(self, statement: str) -> None:
        self.executed_statements.append(statement)
        self._current_rows = self._result_sets[len(self.executed_statements) - 1]

    def fetchall(self) -> list[dict[str, Any]]:
        return self._current_rows


class FakeConnection:
    """Expose only the cursor surface required by the repository."""

    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor

    def cursor(self) -> FakeCursor:
        return self._cursor


def source_fields(source_id: int) -> dict[str, Any]:
    """Build consistent joined provenance fields for fake database rows."""
    return {
        "source_id": source_id,
        "source_name": f"Source {source_id}",
        "organisation": "Reference organisation",
        "source_url": f"https://example.invalid/source/{source_id}",
    }


def test_repository_nests_variants_and_preserves_reference_scope() -> None:
    result_sets = [
        [
            {"category_id": 1, "category_name": "Beer"},
            {"category_id": 2, "category_name": "Wine"},
        ],
        [
            {"variant_id": 1, "category_id": 1, "variant_name": "Light beer"},
            {"variant_id": 4, "category_id": 2, "variant_name": "Red wine"},
        ],
        [
            {
                "serving_size_reference_id": 1,
                "category_id": 1,
                "variant_id": None,
                "option_name": "Small glass",
                "volume_ml": 285,
                **source_fields(5),
            },
            {
                "serving_size_reference_id": 4,
                "category_id": 2,
                "variant_id": 4,
                "option_name": "Standard serve",
                "volume_ml": 100,
                **source_fields(5),
            },
        ],
        [
            {
                "abv_reference_id": 1,
                "category_id": 1,
                "variant_id": 1,
                "reference_level": "SUBTYPE",
                "reference_option": "Light beer",
                "abv_percent": Decimal("2.70"),
                "application_treatment": "Subtype estimate",
                **source_fields(3),
            },
            {
                "abv_reference_id": 4,
                "category_id": 1,
                "variant_id": 3,
                "reference_level": "FALLBACK",
                "reference_option": "Full-strength beer reference",
                "abv_percent": Decimal("4.90"),
                "application_treatment": "Fallback estimate",
                **source_fields(3),
            },
            {
                "abv_reference_id": 5,
                "category_id": 2,
                "variant_id": None,
                "reference_level": "GENERAL",
                "reference_option": "Wine",
                "abv_percent": Decimal("13.00"),
                "application_treatment": "General estimate",
                **source_fields(3),
            },
        ],
    ]
    cursor = FakeCursor(result_sets)
    connection = FakeConnection(cursor)

    @contextmanager
    def fake_connection_factory():
        yield connection

    response = ReferenceRepository(fake_connection_factory).fetch_drink_options()
    payload = response.model_dump(by_alias=True)

    assert [category["name"] for category in payload["categories"]] == [
        "Beer",
        "Wine",
    ]
    beer, wine = payload["categories"]
    assert beer["variants"] == [{"id": 1, "name": "Light beer"}]
    assert wine["variants"] == [{"id": 4, "name": "Red wine"}]

    assert beer["servingSizes"][0]["variantId"] is None
    assert wine["servingSizes"][0]["variantId"] == 4
    assert wine["servingSizes"][0]["volumeMl"] == 100

    assert [option["referenceLevel"] for option in beer["abvOptions"]] == [
        "SUBTYPE",
        "FALLBACK",
    ]
    assert wine["abvOptions"][0]["referenceLevel"] == "GENERAL"
    assert wine["abvOptions"][0]["variantId"] is None
    assert beer["abvOptions"][0]["abvPercent"] == 2.7
    assert beer["abvOptions"][0]["source"] == {
        "id": 3,
        "name": "Source 3",
        "organisation": "Reference organisation",
        "url": "https://example.invalid/source/3",
    }

    assert cursor.executed_statements == list(REFERENCE_SELECT_STATEMENTS)


def test_repository_sql_is_select_only() -> None:
    mutation_keyword = re.compile(
        r"\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE)\b",
        re.IGNORECASE,
    )

    assert len(REFERENCE_SELECT_STATEMENTS) == 4
    for statement in REFERENCE_SELECT_STATEMENTS:
        assert statement.lstrip().upper().startswith("SELECT ")
        assert mutation_keyword.search(statement) is None

    combined_sql = " ".join(REFERENCE_SELECT_STATEMENTS)
    for table in (
        "drink_category",
        "drink_variant",
        "serving_size_reference",
        "abv_reference",
        "source",
    ):
        assert f"public.{table}" in combined_sql

    for excluded_table in (
        "guideline_reference",
        "information_topic",
        "information_content",
        "information_content_source",
    ):
        assert excluded_table not in combined_sql
