'''Unit tests for active, sourced alcohol-information aggregation.'''

from __future__ import annotations

import re
from contextlib import contextmanager
from datetime import date
from typing import Any

import pytest

from app.services.reference_repository import (
    INFORMATION_SELECT,
    INFORMATION_SELECT_STATEMENTS,
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


def information_row(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        'topic_id': 1,
        'topic_code': 'STANDARD_DRINK',
        'display_name': 'What is a Standard Drink?',
        'topic_display_order': 1,
        'content_id': 1,
        'content_title': 'Understanding a standard drink',
        'body_text': 'Verified public information.',
        'content_type': 'PROJECT_SUMMARY',
        'content_display_order': 1,
        'last_verified': date(2026, 8, 29),
        'source_role': 'PRIMARY',
        'source_id': 2,
        'source_name': 'Primary reference',
        'organisation': 'Australian Government',
        'source_url': 'https://example.invalid/source/2',
    }
    row.update(overrides)
    return row


def repository_for(
    rows: list[dict[str, Any]],
) -> tuple[ReferenceRepository, FakeCursor]:
    cursor = FakeCursor(rows)
    connection = FakeConnection(cursor)

    @contextmanager
    def fake_connection_factory():
        yield connection

    return ReferenceRepository(fake_connection_factory), cursor


def test_repository_preserves_order_and_aggregates_multiple_sources_once() -> None:
    rows = [
        information_row(),
        information_row(
            source_role='SUPPORTING',
            source_id=3,
            source_name='Supporting reference',
            source_url='https://example.invalid/source/3',
        ),
        information_row(
            content_id=2,
            content_title='Standard drink source excerpt',
            body_text='A second verified item.',
            content_type='SOURCE_EXCERPT',
            content_display_order=2,
            source_id=5,
            source_name='Standard drink guide',
            source_url='https://example.invalid/source/5',
        ),
        information_row(
            topic_id=2,
            topic_code='ALCOHOL_GUIDELINES',
            display_name='Australian alcohol guidelines',
            topic_display_order=2,
            content_id=3,
            content_title='Guideline summary',
            body_text='Verified guideline information.',
            source_id=4,
            source_name='Australian alcohol guidelines',
            organisation='NHMRC',
            source_url='https://example.invalid/source/4',
        ),
    ]
    repository, cursor = repository_for(rows)

    payload = repository.fetch_alcohol_information().model_dump(
        mode='json',
        by_alias=True,
    )

    assert [topic['topicCode'] for topic in payload['topics']] == [
        'STANDARD_DRINK',
        'ALCOHOL_GUIDELINES',
    ]
    standard_content = payload['topics'][0]['content']
    assert [item['id'] for item in standard_content] == [1, 2]
    assert standard_content[0]['bodyText'] == 'Verified public information.'
    assert [source['role'] for source in standard_content[0]['sources']] == [
        'PRIMARY',
        'SUPPORTING',
    ]
    assert cursor.executed_statements == [INFORMATION_SELECT]
    assert 'drinkName' not in str(payload)
    assert 'consumedAt' not in str(payload)


def test_repository_rejects_empty_results_and_missing_provenance() -> None:
    empty_repository, _ = repository_for([])
    missing_source_repository, _ = repository_for(
        [
            information_row(
                source_role=None,
                source_id=None,
                source_name=None,
                organisation=None,
                source_url=None,
            )
        ]
    )

    with pytest.raises(ReferenceDataIntegrityError):
        empty_repository.fetch_alcohol_information()
    with pytest.raises(ReferenceDataIntegrityError):
        missing_source_repository.fetch_alcohol_information()


@pytest.mark.parametrize(
    ('field', 'value'),
    [
        ('topic_code', 'UNKNOWN_TOPIC'),
        ('content_type', 'UNKNOWN_CONTENT'),
        ('source_role', 'SECONDARY'),
        ('display_name', '   '),
        ('content_title', ''),
        ('body_text', '  '),
        ('topic_display_order', 0),
        ('content_display_order', -1),
        ('last_verified', 'not-a-date'),
        ('source_url', 'ftp://example.invalid/source'),
    ],
)
def test_repository_rejects_unknown_or_malformed_required_values(
    field: str,
    value: object,
) -> None:
    repository, _ = repository_for([information_row(**{field: value})])

    with pytest.raises(ReferenceDataIntegrityError):
        repository.fetch_alcohol_information()


def test_repository_rejects_duplicate_source_attachment() -> None:
    row = information_row()
    repository, _ = repository_for([row, row.copy()])

    with pytest.raises(ReferenceDataIntegrityError):
        repository.fetch_alcohol_information()


@pytest.mark.parametrize(
    'changed_fields',
    [
        {'display_name': 'Conflicting topic name'},
        {'body_text': 'Conflicting content body'},
        {'topic_id': 2},
    ],
)
def test_repository_rejects_inconsistent_repeated_join_rows(
    changed_fields: dict[str, object],
) -> None:
    original = information_row()
    conflicting = information_row(
        source_role='SUPPORTING',
        source_id=3,
        source_name='Supporting reference',
        source_url='https://example.invalid/source/3',
        **changed_fields,
    )
    repository, _ = repository_for([original, conflicting])

    with pytest.raises(ReferenceDataIntegrityError):
        repository.fetch_alcohol_information()


def test_repository_rejects_duplicate_topic_code_for_different_ids() -> None:
    repository, _ = repository_for(
        [
            information_row(),
            information_row(
                topic_id=2,
                content_id=2,
                source_id=3,
                source_url='https://example.invalid/source/3',
            ),
        ]
    )

    with pytest.raises(ReferenceDataIntegrityError):
        repository.fetch_alcohol_information()


def test_information_sql_is_one_select_over_only_the_four_information_tables() -> None:
    mutation_keyword = re.compile(
        r'\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE)\b',
        re.IGNORECASE,
    )

    assert INFORMATION_SELECT_STATEMENTS == (INFORMATION_SELECT,)
    assert INFORMATION_SELECT.lstrip().upper().startswith('SELECT ')
    assert mutation_keyword.search(INFORMATION_SELECT) is None
    for table in (
        'information_topic',
        'information_content',
        'information_content_source',
        'source',
    ):
        assert f'public.{table}' in INFORMATION_SELECT

    for excluded_table in (
        'drink_category',
        'drink_variant',
        'serving_size_reference',
        'abv_reference',
        'guideline_reference',
        'drinking_record',
        'saved_drink',
    ):
        assert f'public.{excluded_table}' not in INFORMATION_SELECT

    assert 'WHERE content.is_active IS TRUE' in INFORMATION_SELECT
    assert 'LEFT JOIN public.information_content_source' in INFORMATION_SELECT
    assert 'LEFT JOIN public.source' in INFORMATION_SELECT
    assert 'topic.display_order' in INFORMATION_SELECT
    assert 'content.display_order' in INFORMATION_SELECT
    assert 'CASE link.source_role' in INFORMATION_SELECT
