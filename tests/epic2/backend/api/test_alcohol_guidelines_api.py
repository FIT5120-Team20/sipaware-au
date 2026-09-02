"""API tests for public guideline values and sanitized failures."""

import asyncio

import httpx
import pytest

from app.api.reference import (
    REFERENCE_CACHE_CONTROL,
    UNAVAILABLE_DETAIL,
    get_reference_repository,
)
from app.integrations.database import DatabaseUnavailableError
from app.main import app
from app.schemas.reference import (
    AlcoholGuideline,
    AlcoholGuidelinesResponse,
    SourceSummary,
)
from app.services.reference_repository import ReferenceDataIntegrityError


SENSITIVE_SENTINEL = "opaque-sensitive-guideline-value"


def request(path: str) -> httpx.Response:
    async def send_request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            return await client.get(path)

    return asyncio.run(send_request())


def sample_response() -> AlcoholGuidelinesResponse:
    source = SourceSummary(
        id=4,
        name="Australian Guidelines",
        organisation="NHMRC",
        url="https://example.invalid/nhmrc",
    )
    return AlcoholGuidelinesResponse(
        guidelines=[
            AlcoholGuideline(
                id=1,
                guideline_type="DAILY",
                threshold_standard_drinks=4,
                period_description="Any one day",
                guideline_text="Daily public guideline",
                source=source,
            ),
            AlcoholGuideline(
                id=2,
                guideline_type="WEEKLY",
                threshold_standard_drinks=10,
                period_description="One week",
                guideline_text="Weekly public guideline",
                source=source,
            ),
        ]
    )


def test_endpoint_returns_daily_and_weekly_camel_case_dto() -> None:
    class SuccessfulRepository:
        def fetch_alcohol_guidelines(self) -> AlcoholGuidelinesResponse:
            return sample_response()

    app.dependency_overrides[get_reference_repository] = SuccessfulRepository
    try:
        response = request("/api/reference/alcohol-guidelines")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["cache-control"] == REFERENCE_CACHE_CONTROL
    assert response.json() == {
        "guidelines": [
            {
                "id": 1,
                "guidelineType": "DAILY",
                "thresholdStandardDrinks": 4.0,
                "periodDescription": "Any one day",
                "guidelineText": "Daily public guideline",
                "source": {
                    "id": 4,
                    "name": "Australian Guidelines",
                    "organisation": "NHMRC",
                    "url": "https://example.invalid/nhmrc",
                },
            },
            {
                "id": 2,
                "guidelineType": "WEEKLY",
                "thresholdStandardDrinks": 10.0,
                "periodDescription": "One week",
                "guidelineText": "Weekly public guideline",
                "source": {
                    "id": 4,
                    "name": "Australian Guidelines",
                    "organisation": "NHMRC",
                    "url": "https://example.invalid/nhmrc",
                },
            },
        ]
    }
    assert "drinkName" not in response.text
    assert "consumedAt" not in response.text


@pytest.mark.parametrize(
    "error",
    [
        DatabaseUnavailableError(SENSITIVE_SENTINEL),
        ReferenceDataIntegrityError(SENSITIVE_SENTINEL),
    ],
)
def test_endpoint_sanitizes_reference_failures(error: RuntimeError, caplog) -> None:
    class FailingRepository:
        def fetch_alcohol_guidelines(self) -> AlcoholGuidelinesResponse:
            raise error

    app.dependency_overrides[get_reference_repository] = FailingRepository
    try:
        response = request("/api/reference/alcohol-guidelines")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": UNAVAILABLE_DETAIL}
    assert SENSITIVE_SENTINEL not in response.text
    assert SENSITIVE_SENTINEL not in caplog.text
