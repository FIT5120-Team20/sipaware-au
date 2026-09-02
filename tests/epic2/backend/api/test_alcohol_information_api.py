'''API tests for public alcohol information and sanitized failures.'''

import asyncio
from datetime import date

import httpx
import pytest

from app.api.reference import (
    REFERENCE_CACHE_CONTROL,
    UNAVAILABLE_DETAIL,
    get_reference_repository,
)
from app.core.config import DatabaseConfigurationError
from app.integrations.database import DatabaseUnavailableError
from app.main import app
from app.schemas.reference import (
    AlcoholInformationContent,
    AlcoholInformationResponse,
    AlcoholInformationSource,
    AlcoholInformationTopic,
)
from app.services.reference_repository import ReferenceDataIntegrityError


SENSITIVE_SENTINEL = 'opaque-sensitive-information-value'


def request(path: str, method: str = 'GET') -> httpx.Response:
    async def send_request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url='http://testserver',
        ) as client:
            return await client.request(method, path)

    return asyncio.run(send_request())


def sample_response() -> AlcoholInformationResponse:
    return AlcoholInformationResponse(
        topics=[
            AlcoholInformationTopic(
                topic_code='STANDARD_DRINK',
                display_name='What is a Standard Drink?',
                display_order=1,
                content=[
                    AlcoholInformationContent(
                        id=1,
                        title='Understanding a standard drink',
                        content_type='PROJECT_SUMMARY',
                        body_text='Verified public information.',
                        display_order=1,
                        last_verified=date(2026, 8, 29),
                        sources=[
                            AlcoholInformationSource(
                                id=2,
                                role='PRIMARY',
                                name='Australian standard drink guide',
                                organisation='Australian Government',
                                url='https://example.invalid/standard-drinks',
                            ),
                            AlcoholInformationSource(
                                id=3,
                                role='SUPPORTING',
                                name='Australian alcohol guidelines',
                                organisation='NHMRC',
                                url='https://example.invalid/guidelines',
                            ),
                        ],
                    )
                ],
            )
        ]
    )


def test_endpoint_returns_camel_case_public_dto_and_cache_header() -> None:
    class SuccessfulRepository:
        def fetch_alcohol_information(self) -> AlcoholInformationResponse:
            return sample_response()

    app.dependency_overrides[get_reference_repository] = SuccessfulRepository
    try:
        response = request('/api/reference/alcohol-information')
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers['cache-control'] == REFERENCE_CACHE_CONTROL
    assert response.json() == {
        'topics': [
            {
                'topicCode': 'STANDARD_DRINK',
                'displayName': 'What is a Standard Drink?',
                'displayOrder': 1,
                'content': [
                    {
                        'id': 1,
                        'title': 'Understanding a standard drink',
                        'contentType': 'PROJECT_SUMMARY',
                        'bodyText': 'Verified public information.',
                        'displayOrder': 1,
                        'lastVerified': '2026-08-29',
                        'sources': [
                            {
                                'id': 2,
                                'role': 'PRIMARY',
                                'name': 'Australian standard drink guide',
                                'organisation': 'Australian Government',
                                'url': 'https://example.invalid/standard-drinks',
                            },
                            {
                                'id': 3,
                                'role': 'SUPPORTING',
                                'name': 'Australian alcohol guidelines',
                                'organisation': 'NHMRC',
                                'url': 'https://example.invalid/guidelines',
                            },
                        ],
                    }
                ],
            }
        ]
    }
    assert 'drinkName' not in response.text
    assert 'consumedAt' not in response.text
    assert 'dailyStandardDrinks' not in response.text


def test_endpoint_accepts_get_only() -> None:
    response = request('/api/reference/alcohol-information', method='POST')

    assert response.status_code == 405


@pytest.mark.parametrize(
    'error',
    [
        DatabaseConfigurationError(SENSITIVE_SENTINEL),
        DatabaseUnavailableError(SENSITIVE_SENTINEL),
        ReferenceDataIntegrityError(SENSITIVE_SENTINEL),
    ],
)
def test_endpoint_sanitizes_configuration_database_and_integrity_failures(
    error: RuntimeError,
    caplog,
) -> None:
    class FailingRepository:
        def fetch_alcohol_information(self) -> AlcoholInformationResponse:
            raise error

    app.dependency_overrides[get_reference_repository] = FailingRepository
    try:
        response = request('/api/reference/alcohol-information')
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {'detail': UNAVAILABLE_DETAIL}
    assert SENSITIVE_SENTINEL not in response.text
    assert SENSITIVE_SENTINEL not in caplog.text
