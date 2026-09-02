"""Unit tests for SELECT-only alcohol-guideline reference mapping."""

from __future__ import annotations

import re
from contextlib import contextmanager
from decimal import Decimal
from typing import Any

import pytest

from app.services.reference_repository import (
    GUIDELINE_SELECT,
    GUIDELINE_SELECT_STATEMENTS,
    ReferenceDataIntegrityError,
    ReferenceRepository,
)


class FakeCursor:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.executed_statements: list[str] = []

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def execute(self, statement: str) -> None:
        self.executed_statements.append(statement)

    def fetchall(self) -> list[dict[str, Any]]:
        return self.rows


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor

    def cursor(self) -> FakeCursor:
        return self._cursor


def guideline_row(
    guideline_type: str,
    threshold: str,
    guideline_id: int,
) -> dict[str, Any]:
    return {
        "guideline_id": guideline_id,
        "guideline_type": guideline_type,
        "threshold_standard_drinks": Decimal(threshold),
        "period_description": (
            "Any one day" if guideline_type == "DAILY" else "One week"
        ),
        "guideline_text": f"Public {guideline_type.lower()} guideline text",
        "source_id": 4,
        "source_name": "Australian Guidelines",
        "organisation": "National Health and Medical Research Council (NHMRC)",
        "source_url": "https://example.invalid/nhmrc",
    }


def repository_for(rows: list[dict[str, Any]]) -> tuple[ReferenceRepository, FakeCursor]:
    cursor = FakeCursor(rows)
    connection = FakeConnection(cursor)

    @contextmanager
    def fake_connection_factory():
        yield connection

    return ReferenceRepository(fake_connection_factory), cursor


def test_repository_returns_daily_and_weekly_guidelines_with_sources() -> None:
    repository, cursor = repository_for(
        [guideline_row("DAILY", "4.00", 1), guideline_row("WEEKLY", "10.00", 2)]
    )

    payload = repository.fetch_alcohol_guidelines().model_dump(by_alias=True)

    assert [item["guidelineType"] for item in payload["guidelines"]] == [
        "DAILY",
        "WEEKLY",
    ]
    assert [
        item["thresholdStandardDrinks"] for item in payload["guidelines"]
    ] == [4.0, 10.0]
    assert payload["guidelines"][0]["source"] == {
        "id": 4,
        "name": "Australian Guidelines",
        "organisation": "National Health and Medical Research Council (NHMRC)",
        "url": "https://example.invalid/nhmrc",
    }
    assert cursor.executed_statements == [GUIDELINE_SELECT]


@pytest.mark.parametrize(
    "rows",
    [
        [],
        [guideline_row("DAILY", "4.00", 1)],
        [guideline_row("WEEKLY", "10.00", 2)],
        [
            guideline_row("DAILY", "4.00", 1),
            guideline_row("DAILY", "5.00", 3),
            guideline_row("WEEKLY", "10.00", 2),
        ],
        [
            guideline_row("DAILY", "0.00", 1),
            guideline_row("WEEKLY", "10.00", 2),
        ],
    ],
)
def test_repository_rejects_missing_or_duplicate_required_rows(
    rows: list[dict[str, Any]],
) -> None:
    repository, _ = repository_for(rows)

    with pytest.raises(ReferenceDataIntegrityError):
        repository.fetch_alcohol_guidelines()


def test_guideline_sql_is_select_only_and_uses_public_reference_tables() -> None:
    mutation_keyword = re.compile(
        r"\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|CREATE|ALTER|DROP)\b",
        re.IGNORECASE,
    )

    assert GUIDELINE_SELECT_STATEMENTS == (GUIDELINE_SELECT,)
    assert GUIDELINE_SELECT.lstrip().upper().startswith("SELECT ")
    assert mutation_keyword.search(GUIDELINE_SELECT) is None
    assert "public.guideline_reference" in GUIDELINE_SELECT
    assert "public.source" in GUIDELINE_SELECT
