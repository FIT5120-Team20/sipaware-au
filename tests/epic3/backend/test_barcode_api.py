"""In-process HTTP boundary tests with explicit synthetic repository results."""
import asyncio
from unittest.mock import Mock

import httpx
import pytest

from app.api.barcode import get_barcode_repository
from app.core.config import DatabaseConfigurationError
from app.integrations.database import DatabaseUnavailableError
from app.main import app
from app.schemas.barcode import BarcodeProduct
from app.services.barcode_repository import BarcodeDataIntegrityError


@pytest.fixture
def repository():
    repo = Mock()
    app.dependency_overrides[get_barcode_repository] = lambda: repo
    yield repo
    app.dependency_overrides.pop(get_barcode_repository, None)


def request(barcode=None, method="GET"):
    async def send():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            params = {} if barcode is None else {"barcode": barcode}
            return await client.request(method, "/api/drinks/barcode", params=params)
    return asyncio.run(send())


def test_exact_match_public_dto(repository):
    repository.find_by_barcode.return_value = BarcodeProduct(
        product_id="fixture", barcode="00024594", drink_name="Test beer", drink_type="beer",
        volume_ml=330, abv_percent=5, source_name="Synthetic source", source_url="https://example.org/data",
        pack_quantity=6, total_package_volume_ml=1980,
    )
    response = request("00024594")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {"kind": "match", "product": {
        "productId": "fixture", "barcode": "00024594", "drinkName": "Test beer", "drinkType": "beer",
        "volumeMl": 330, "abvPercent": 5, "sourceName": "Synthetic source", "sourceUrl": "https://example.org/data",
        "packQuantity": 6, "totalPackageVolumeMl": 1980,
    }}
    repository.find_by_barcode.assert_called_once_with("00024594")


@pytest.mark.parametrize("barcode", ["24594", "00024594 ", "unknown"])
def test_completed_miss_keeps_input_text(repository, barcode):
    repository.find_by_barcode.return_value = None
    response = request(barcode)
    assert response.status_code == 200 and response.json() == {"kind": "not-found"}
    repository.find_by_barcode.assert_called_once_with(barcode)


@pytest.mark.parametrize("barcode", [None, "", "0" * 201])
def test_invalid_input_never_queries(repository, barcode):
    assert request(barcode).status_code == 422
    repository.find_by_barcode.assert_not_called()


@pytest.mark.parametrize("error", [DatabaseConfigurationError, DatabaseUnavailableError, BarcodeDataIntegrityError])
def test_service_failure_is_sanitized_503_not_miss(repository, error):
    repository.find_by_barcode.side_effect = error("private-driver-sentinel")
    response = request("00024594")
    assert response.status_code == 503
    assert response.json() == {"detail": "Drink lookup is temporarily unavailable."}
    assert "private-driver-sentinel" not in response.text


def test_endpoint_does_not_accept_photo_uploads(repository):
    assert request("00024594", "POST").status_code == 405
    repository.find_by_barcode.assert_not_called()
