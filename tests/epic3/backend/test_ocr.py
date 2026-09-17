"""Rule/API contract checks; the separate demo script uses the actual CPU model."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api import ocr as api
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


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SIPAWARE_OCR_ENABLED", "1")
    with TestClient(app) as value:
        yield value


@pytest.mark.parametrize("prefix", ["", "/iteration2"])
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
        raise RuntimeError("/private/secret")
    monkeypatch.setattr(api, "recognize_label", unavailable)
    response = client.post("/api/ocr/drink-label", content=b"x", headers={"Content-Type": "image/png"})
    assert response.status_code == 500 and "secret" not in response.text


def test_disabled_without_loading_paddle(client, monkeypatch):
    monkeypatch.delenv("SIPAWARE_OCR_ENABLED")
    assert client.post("/api/ocr/drink-label", content=b"x", headers={"Content-Type": "image/png"}).status_code == 503


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
