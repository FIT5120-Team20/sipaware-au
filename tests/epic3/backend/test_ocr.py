"""Drink-label extraction, API contract, and Baidu transport checks."""

import asyncio
import base64

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api import ocr as api
from app.main import app
from app.schemas.ocr import DrinkLabelResult, OcrLine
from app.services import ocr


def line(text, confidence=0.99, y=0, height=40):
    return OcrLine(text=text, confidence=confidence, box=[0, y, 500, y + height])


def test_label_fields_come_from_visible_text_not_catalog():
    result = ocr.extract_fields([
        line("DEMO BREWERY"), line("PALE ALE", y=60),
        line("375 mL", y=200), line("4.5% ALC/VOL", y=250),
        line("1.3 STANDARD DRINKS", y=290, height=20),
    ])
    assert result.fields.model_dump() == dict(drinkName="DEMO BREWERY PALE ALE",
        drinkType="beer", containerVolumeMl=375, abvPercent=4.5)


@pytest.mark.parametrize("text,expected", [("0.75 L", 750), ("75 cL", 750), ("6 x 330mL", 330)])
def test_metric_volume_normalization(text, expected):
    assert ocr.extract_fields([line(text)]).fields.containerVolumeMl == expected


@pytest.mark.parametrize("text,expected", [("ABV: 4.5%", 4.5), ("ALC. 13,5% VOL", 13.5), ("0.0% ABV", 0)])
def test_abv_formats(text, expected):
    assert ocr.extract_fields([line(text)]).fields.abvPercent == expected


def test_ambiguous_low_confidence_and_nutrition_numbers_are_not_prefilled():
    result = ocr.extract_fields([line("375mL"), line("750mL"), line("4.5% ABV"),
        line("5.0% ABV"), line("20% JUICE"), line("PER 100mL"), line("BEER", 0.3)])
    assert result.fields.containerVolumeMl is None
    assert result.fields.abvPercent is None
    assert result.fields.drinkType is None
    assert len(result.warnings) >= 2
    assert ocr.extract_fields([line("20% JUICE"), line("PER 100mL")]).fields.abvPercent is None
    assert ocr.extract_fields([line("PER 100mL")]).fields.containerVolumeMl is None


def test_empty_output_keeps_fields_empty():
    result = ocr.extract_fields([])
    assert all(value is None for value in result.fields.model_dump().values())
    assert result.warnings


@pytest.fixture(autouse=True)
def isolated_baidu_configuration(monkeypatch, tmp_path):
    monkeypatch.setattr(ocr, "_token_cache", None)
    monkeypatch.setattr(ocr, "LOCAL_ENV_FILE", tmp_path / "missing.env")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("BAIDU_OCR_API_KEY", "test-api-key")
    monkeypatch.setenv("BAIDU_OCR_SECRET_KEY", "test-secret-key")
    with TestClient(app) as value:
        yield value


@pytest.mark.parametrize("prefix", ["", "/iteration3"])
def test_api_accepts_only_image_body_and_returns_no_store(client, monkeypatch, prefix):
    seen = []
    result = ocr.extract_fields([line("375mL"), line("5% ABV")])

    async def recognize(content):
        seen.append(content)
        return result

    monkeypatch.setattr(api, "recognize_label", recognize)
    response = client.post(prefix + "/api/ocr/drink-label", content=b"synthetic pixels",
                           headers={"Content-Type": "image/png"})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert seen == [b"synthetic pixels"]
    assert DrinkLabelResult.model_validate(response.json()).fields.abvPercent == 5


@pytest.mark.parametrize("body,media,status", [(b"url", "application/json", 415), (b"", "image/png", 400)])
def test_invalid_uploads_never_invoke_provider(client, monkeypatch, body, media, status):
    async def unexpected(_):
        pytest.fail("Unexpected provider request")

    monkeypatch.setattr(api, "recognize_label", unexpected)
    assert client.post("/api/ocr/drink-label", content=body, headers={"Content-Type": media}).status_code == status


def test_oversize_upload_is_rejected_before_provider_request(client, monkeypatch):
    async def unexpected(_):
        pytest.fail("Unexpected provider request")

    monkeypatch.setattr(api, "MAX_IMAGE_BYTES", 3)
    monkeypatch.setattr(api, "recognize_label", unexpected)
    assert client.post("/api/ocr/drink-label", content=b"1234", headers={"Content-Type": "image/png"}).status_code == 413


def test_service_errors_do_not_expose_internal_paths(client, monkeypatch):
    async def unavailable(_):
        raise RuntimeError("/private/fixture_value")

    monkeypatch.setattr(api, "recognize_label", unavailable)
    response = client.post("/api/ocr/drink-label", content=b"x", headers={"Content-Type": "image/png"})
    assert response.status_code == 500 and "fixture_value" not in response.text


def test_missing_baidu_credentials_returns_503(client, monkeypatch):
    monkeypatch.delenv("BAIDU_OCR_API_KEY")
    monkeypatch.delenv("BAIDU_OCR_SECRET_KEY")
    response = client.post("/api/ocr/drink-label", content=b"x", headers={"Content-Type": "image/png"})
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


class FakeBaiduClient:
    responses = []
    calls = []

    def __init__(self, **options):
        self.options = options

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        payload = self.responses.pop(0)
        return httpx.Response(200, json=payload, request=httpx.Request("POST", url))


def install_fake_baidu(monkeypatch, *responses):
    FakeBaiduClient.responses = list(responses)
    FakeBaiduClient.calls = []
    monkeypatch.setenv("BAIDU_OCR_API_KEY", "private-api-key")
    monkeypatch.setenv("BAIDU_OCR_SECRET_KEY", "private-secret-key")
    monkeypatch.setattr(ocr.httpx, "AsyncClient", FakeBaiduClient)


def baidu_lines():
    return {"words_result": [
        {"words": "DEMO PALE ALE", "probability": {"average": 0.98}},
        {"words": "375 mL", "probability": {"average": 0.96}},
        {"words": "4.5% ALC/VOL", "probability": {"average": 0.97}},
    ]}


def test_baidu_transport_keeps_credentials_server_side_and_parses_result(monkeypatch):
    install_fake_baidu(monkeypatch,
        {"access_token": "temporary-access-token", "expires_in": 2_592_000},
        baidu_lines(),
    )
    result = asyncio.run(ocr.recognize_label(b"image bytes"))
    assert result.fields.model_dump() == dict(
        drinkName="DEMO PALE ALE", drinkType="beer", containerVolumeMl=375, abvPercent=4.5,
    )
    token_url, token_request = FakeBaiduClient.calls[0]
    ocr_url, ocr_request = FakeBaiduClient.calls[1]
    assert token_url == ocr.BAIDU_TOKEN_URL
    assert "private-api-key" not in token_url and "private-secret-key" not in token_url
    assert token_request["data"] == {
        "grant_type": "client_credentials",
        "client_id": "private-api-key",
        "client_secret": "private-secret-key",
    }
    assert ocr_url == ocr.BAIDU_OCR_URL
    assert ocr_request["params"] == {"access_token": "temporary-access-token"}
    assert base64.b64decode(ocr_request["data"]["image"]) == b"image bytes"
    assert ocr_request["data"]["probability"] == "true"


def test_access_token_is_reused_within_its_lifetime(monkeypatch):
    install_fake_baidu(monkeypatch,
        {"access_token": "temporary-access-token", "expires_in": 2_592_000},
        baidu_lines(), baidu_lines(),
    )
    asyncio.run(ocr.recognize_label(b"first"))
    asyncio.run(ocr.recognize_label(b"second"))
    assert [url for url, _ in FakeBaiduClient.calls].count(ocr.BAIDU_TOKEN_URL) == 1
    assert [url for url, _ in FakeBaiduClient.calls].count(ocr.BAIDU_OCR_URL) == 2


def test_expired_access_token_is_refreshed_once(monkeypatch):
    install_fake_baidu(monkeypatch,
        {"access_token": "expired-token", "expires_in": 2_592_000},
        {"error_code": 110, "error_msg": "Access token invalid or no longer valid"},
        {"access_token": "fresh-token", "expires_in": 2_592_000},
        baidu_lines(),
    )
    result = asyncio.run(ocr.recognize_label(b"image"))
    assert result.fields.abvPercent == 4.5
    assert [url for url, _ in FakeBaiduClient.calls].count(ocr.BAIDU_TOKEN_URL) == 2
    assert FakeBaiduClient.calls[-1][1]["params"] == {"access_token": "fresh-token"}


def test_baidu_image_error_is_safe_422(client, monkeypatch):
    install_fake_baidu(monkeypatch,
        {"access_token": "temporary-access-token", "expires_in": 2_592_000},
        {"error_code": 216201, "error_msg": "image format error"},
    )
    response = client.post("/api/ocr/drink-label", content=b"not an image",
                           headers={"Content-Type": "image/png"})
    assert response.status_code == 422
    assert "baidu" not in response.text.lower()


def test_local_post_preflight(client):
    response = client.options("/api/ocr/drink-label", headers={
        "Origin": "http://127.0.0.1:5173", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
