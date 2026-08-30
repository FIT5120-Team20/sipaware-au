"""API tests for the aggregate drink-options contract and failure boundary."""

import asyncio

import httpx

from app.api.reference import (
    REFERENCE_CACHE_CONTROL,
    UNAVAILABLE_DETAIL,
    get_reference_repository,
)
from app.core.config import DatabaseConfigurationError
from app.integrations.database import DatabaseUnavailableError
from app.main import app
from app.schemas.reference import (
    AbvOption,
    DrinkCategoryOption,
    DrinkOptionsResponse,
    DrinkVariantOption,
    ServingSizeOption,
    SourceSummary,
)


SENSITIVE_SENTINEL = "opaque-sensitive-value"


def request(path: str) -> httpx.Response:
    """Issue one in-process request without starting a network server."""

    async def send_request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            return await client.get(path)

    return asyncio.run(send_request())


def sample_response() -> DrinkOptionsResponse:
    """Build a compact DTO spanning all frontend-relevant nested types."""
    source = SourceSummary(
        id=3,
        name="Reference source",
        organisation="Reference organisation",
        url="https://example.invalid/reference",
    )
    return DrinkOptionsResponse(
        categories=[
            DrinkCategoryOption(
                id=1,
                name="Beer",
                variants=[DrinkVariantOption(id=1, name="Light beer")],
                serving_sizes=[
                    ServingSizeOption(
                        id=1,
                        name="Small glass",
                        volume_ml=285,
                        variant_id=None,
                        source=source,
                    )
                ],
                abv_options=[
                    AbvOption(
                        id=1,
                        abv_percent=2.7,
                        reference_level="SUBTYPE",
                        reference_option="Light beer",
                        variant_id=1,
                        application_treatment="Treat as an estimate",
                        source=source,
                    )
                ],
            )
        ]
    )


def test_drink_options_endpoint_returns_camel_case_dto_and_cache_header() -> None:
    class SuccessfulRepository:
        def fetch_drink_options(self) -> DrinkOptionsResponse:
            return sample_response()

    app.dependency_overrides[get_reference_repository] = SuccessfulRepository
    try:
        response = request("/api/reference/drink-options")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["cache-control"] == REFERENCE_CACHE_CONTROL
    payload = response.json()
    assert payload["categories"][0]["servingSizes"][0] == {
        "id": 1,
        "name": "Small glass",
        "volumeMl": 285,
        "variantId": None,
        "source": {
            "id": 3,
            "name": "Reference source",
            "organisation": "Reference organisation",
            "url": "https://example.invalid/reference",
        },
    }
    assert payload["categories"][0]["abvOptions"][0]["referenceLevel"] == (
        "SUBTYPE"
    )


def test_drink_options_endpoint_sanitizes_database_failure(caplog) -> None:
    class FailingRepository:
        def fetch_drink_options(self) -> DrinkOptionsResponse:
            raise DatabaseUnavailableError(SENSITIVE_SENTINEL)

    app.dependency_overrides[get_reference_repository] = FailingRepository
    try:
        response = request("/api/reference/drink-options")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": UNAVAILABLE_DETAIL}
    assert SENSITIVE_SENTINEL not in response.text
    assert SENSITIVE_SENTINEL not in caplog.text


def test_drink_options_endpoint_sanitizes_missing_configuration() -> None:
    class MissingConfigurationRepository:
        def fetch_drink_options(self) -> DrinkOptionsResponse:
            raise DatabaseConfigurationError(SENSITIVE_SENTINEL)

    app.dependency_overrides[
        get_reference_repository
    ] = MissingConfigurationRepository
    try:
        response = request("/api/reference/drink-options")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": UNAVAILABLE_DETAIL}
    assert SENSITIVE_SENTINEL not in response.text


def test_health_endpoint_does_not_resolve_database_dependency() -> None:
    def fail_if_resolved():
        raise AssertionError("Database dependency should not run for health")

    app.dependency_overrides[get_reference_repository] = fail_if_resolved
    try:
        response = request("/api/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "sipaware-au-api",
    }
