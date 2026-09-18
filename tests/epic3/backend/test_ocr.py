"""Rule/API contract checks; the separate demo script uses the actual CPU model."""

import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api import ocr as api
from app.schemas.ocr import DrinkLabelResult, OcrLine
from app.services import ocr, ocr_proxy


OCR_HEADER_NAME = "X-Sipaware-Ocr-Token"

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


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SIPAWARE_OCR_ENABLED", "1")
    monkeypatch.delenv("SIPAWARE_OCR_UPSTREAM_URL", raising=False)
    monkeypatch.delenv("SIPAWARE_OCR_REQUIRE_TOKEN", raising=False)
    monkeypatch.delenv("SIPAWARE_OCR_SHARED_SECRET", raising=False)
    with TestClient(app) as value:
        yield value


@pytest.mark.parametrize("prefix", ["", "/iteration3"])
def test_api_accepts_only_image_body_and_returns_no_store(client, monkeypatch, prefix):
    seen = []
    result = ocr.extract_fields([line("375mL"), line("5% ABV")])
    def recognize(content):
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
def test_invalid_uploads_never_invoke_model(client, monkeypatch, body, media, status):
    monkeypatch.setattr(api, "recognize_label", lambda _: pytest.fail("Unexpected inference"))
    assert client.post("/api/ocr/drink-label", content=body, headers={"Content-Type": media}).status_code == status


def test_oversize_upload_is_rejected_before_inference(client, monkeypatch):
    monkeypatch.setattr(api, "MAX_IMAGE_BYTES", 3)
    monkeypatch.setattr(api, "recognize_label", lambda _: pytest.fail("Unexpected inference"))
    assert client.post("/api/ocr/drink-label", content=b"1234", headers={"Content-Type": "image/png"}).status_code == 413


def test_service_errors_do_not_expose_internal_paths(client, monkeypatch):
    def unavailable(_):
        raise RuntimeError("/private/fixture_value")
    monkeypatch.setattr(api, "recognize_label", unavailable)
    response = client.post("/api/ocr/drink-label", content=b"x", headers={"Content-Type": "image/png"})
    assert response.status_code == 500 and "fixture_value" not in response.text


def test_disabled_without_loading_paddle(client, monkeypatch):
    monkeypatch.delenv("SIPAWARE_OCR_ENABLED")
    assert client.post("/api/ocr/drink-label", content=b"x", headers={"Content-Type": "image/png"}).status_code == 503


def test_vercel_proxy_mode_does_not_load_local_model(client, monkeypatch):
    seen = []
    monkeypatch.delenv("SIPAWARE_OCR_ENABLED")
    monkeypatch.setenv("SIPAWARE_OCR_UPSTREAM_URL", "https://demo.trycloudflare.com")
    monkeypatch.setenv("SIPAWARE_OCR_SHARED_SECRET", "a" * 64)

    async def forward(content, content_type):
        seen.append((content, content_type))
        return ocr.extract_fields([line("SHIRAZ"), line("750mL"), line("14% ABV")])

    monkeypatch.setattr(api, "proxy_label", forward)
    monkeypatch.setattr(api, "recognize_label", lambda _: pytest.fail("Unexpected local inference"))
    response = client.post("/api/ocr/drink-label", content=b"photo",
                           headers={"Content-Type": "image/jpeg"})
    assert response.status_code == 200
    assert response.json()["fields"]["drinkType"] == "wine"
    assert seen == [(b"photo", "image/jpeg")]


def test_tunnel_origin_requires_matching_secret(client, monkeypatch):
    fixture_value = "correct-" + "x" * 40
    monkeypatch.setenv("SIPAWARE_OCR_REQUIRE_TOKEN", "1")
    monkeypatch.setenv("SIPAWARE_OCR_SHARED_SECRET", fixture_value)
    monkeypatch.setattr(api, "recognize_label", lambda _: ocr.extract_fields([line("BEER")]))

    missing = client.post("/api/ocr/drink-label", content=b"photo",
                          headers={"Content-Type": "image/png"})
    wrong = client.post("/api/ocr/drink-label", content=b"photo", headers={
        "Content-Type": "image/png", OCR_HEADER_NAME: "wrong",
    })
    accepted = client.post("/api/ocr/drink-label", content=b"photo", headers={
        "Content-Type": "image/png", OCR_HEADER_NAME: fixture_value,
    })
    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert accepted.status_code == 200


def test_proxy_uses_https_and_keeps_shared_secret_server_side(monkeypatch):
    fixture_value = "proxy-" + "s" * 40
    captured = {}
    expected = ocr.extract_fields([line("PALE ALE"), line("375mL")])
    monkeypatch.setenv("SIPAWARE_OCR_UPSTREAM_URL", "https://demo.trycloudflare.com")
    monkeypatch.setenv("SIPAWARE_OCR_SHARED_SECRET", fixture_value)

    class FakeClient:
        def __init__(self, **options):
            captured["options"] = options

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, content, headers):
            captured.update(url=url, content=content, headers=headers)
            return httpx.Response(200, json=expected.model_dump(),
                                  request=httpx.Request("POST", url))

    monkeypatch.setattr(ocr_proxy.httpx, "AsyncClient", FakeClient)
    result = asyncio.run(ocr_proxy.proxy_label(b"photo", "image/webp"))
    assert result.fields.drinkType == "beer"
    assert captured["url"] == "https://demo.trycloudflare.com/api/ocr/drink-label"
    assert captured["content"] == b"photo"
    assert captured["headers"][ocr_proxy.TOKEN_HEADER] == fixture_value
    assert captured["headers"]["Content-Type"] == "image/webp"


def test_proxy_rejects_non_https_origin(monkeypatch):
    monkeypatch.setenv("SIPAWARE_OCR_UPSTREAM_URL", "http://127.0.0.1:8010")
    monkeypatch.setenv("SIPAWARE_OCR_SHARED_SECRET", "s" * 64)
    with pytest.raises(ocr_proxy.OcrProxyError, match="URL is invalid"):
        asyncio.run(ocr_proxy.proxy_label(b"photo", "image/png"))


def test_corrupt_image_is_rejected_without_loading_paddle(client, monkeypatch):
    pytest.importorskip("PIL")
    monkeypatch.setattr(ocr, "_load_pipeline", lambda: pytest.fail("Unexpected model load"))
    response = client.post("/api/ocr/drink-label", content=b"not an image", headers={"Content-Type": "image/png"})
    assert response.status_code == 422


def test_local_post_preflight(client):
    response = client.options("/api/ocr/drink-label", headers={
        "Origin": "http://127.0.0.1:5173", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
