"""Baidu OCR integration with conservative drink-label field extraction."""

from __future__ import annotations

import base64
import hashlib
import logging
import math
import os
import re
import time
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import httpx
from dotenv import dotenv_values

from ..schemas.ocr import DrinkLabelFields, DrinkLabelResult, OcrLine

logger = logging.getLogger(__name__)
MAX_IMAGE_BYTES = 4 * 1024 * 1024
MIN_TEXT_SCORE = 0.75
BAIDU_TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"
BAIDU_OCR_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic"
BAIDU_API_KEY_VARIABLE = "BAIDU_OCR_API_KEY"
BAIDU_SECRET_KEY_VARIABLE = "BAIDU_OCR_SECRET_KEY"
LOCAL_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
TOKEN_REFRESH_MARGIN_SECONDS = 300
_token_cache: tuple[str, float, bytes] | None = None


class OcrUnavailable(RuntimeError):
    pass


class OcrBusy(RuntimeError):
    pass


class InvalidLabelImage(ValueError):
    pass


def _credentials() -> tuple[str, str]:
    api_key = os.environ.get(BAIDU_API_KEY_VARIABLE, "").strip()
    secret_key = os.environ.get(BAIDU_SECRET_KEY_VARIABLE, "").strip()
    if (not api_key or not secret_key) and LOCAL_ENV_FILE.is_file():
        local = dotenv_values(LOCAL_ENV_FILE)
        if not api_key and isinstance(local.get(BAIDU_API_KEY_VARIABLE), str):
            api_key = local[BAIDU_API_KEY_VARIABLE].strip()
        if not secret_key and isinstance(local.get(BAIDU_SECRET_KEY_VARIABLE), str):
            secret_key = local[BAIDU_SECRET_KEY_VARIABLE].strip()
    if not api_key or not secret_key:
        raise OcrUnavailable("Label scanning is not configured. Add the Baidu OCR server credentials.")
    return api_key, secret_key


def _credential_fingerprint(api_key: str, secret_key: str) -> bytes:
    return hashlib.sha256(f"{api_key}\0{secret_key}".encode()).digest()


def _response_object(response: httpx.Response, failure_message: str) -> Mapping[str, Any]:
    if response.status_code < 200 or response.status_code >= 300:
        raise OcrUnavailable(failure_message)
    try:
        payload = response.json()
    except ValueError as exc:
        raise OcrUnavailable(failure_message) from exc
    if not isinstance(payload, Mapping):
        raise OcrUnavailable(failure_message)
    return payload


def _error_code(payload: Mapping[str, Any]) -> int | None:
    value = payload.get("error_code")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


async def _access_token(
    client: httpx.AsyncClient,
    api_key: str,
    secret_key: str,
    *,
    force_refresh: bool = False,
) -> str:
    global _token_cache
    fingerprint = _credential_fingerprint(api_key, secret_key)
    if not force_refresh and _token_cache is not None:
        token, expires_at, cached_fingerprint = _token_cache
        if cached_fingerprint == fingerprint and time.monotonic() < expires_at:
            return token

    try:
        response = await client.post(
            BAIDU_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": api_key,
                "client_secret": secret_key,
            },
            headers={"Accept": "application/json"},
        )
    except httpx.RequestError as exc:
        raise OcrUnavailable("The label scanning service could not be reached. Please try again shortly.") from exc
    payload = _response_object(response, "The Baidu OCR credentials could not be verified.")
    token = payload.get("access_token")
    if not isinstance(token, str) or not token:
        logger.warning("Baidu OCR token request failed with error code %s", _error_code(payload))
        raise OcrUnavailable("The Baidu OCR credentials could not be verified.")
    expires_in = payload.get("expires_in", 2_592_000)
    try:
        lifetime = max(60.0, float(expires_in))
    except (TypeError, ValueError):
        lifetime = 2_592_000.0
    refresh_after = time.monotonic() + max(30.0, lifetime - TOKEN_REFRESH_MARGIN_SECONDS)
    _token_cache = (token, refresh_after, fingerprint)
    return token


async def _recognition_payload(
    client: httpx.AsyncClient,
    token: str,
    encoded_image: str,
) -> Mapping[str, Any]:
    try:
        response = await client.post(
            BAIDU_OCR_URL,
            params={"access_token": token},
            data={
                "image": encoded_image,
                "language_type": "CHN_ENG",
                "detect_direction": "true",
                "probability": "true",
            },
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    except httpx.RequestError as exc:
        raise OcrUnavailable("The label scanning service could not be reached. Please try again shortly.") from exc
    return _response_object(response, "The label scanning service is temporarily unavailable.")


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _line_box(item: Mapping[str, Any], index: int) -> list[float]:
    location = item.get("location")
    if isinstance(location, Mapping):
        left = _number(location.get("left"))
        top = _number(location.get("top"))
        width = _number(location.get("width"))
        height = _number(location.get("height"))
        if None not in (left, top, width, height) and width >= 0 and height >= 0:
            return [left, top, left + width, top + height]
    # accurate_basic returns reading order but no coordinates. Preserve that order
    # in the existing four-number API contract without claiming pixel geometry.
    y = float(index)
    return [0.0, y, 1.0, y + 1.0]


def _lines_from_payload(payload: Mapping[str, Any]) -> tuple[list[OcrLine], bool]:
    raw_lines = payload.get("words_result")
    if not isinstance(raw_lines, list):
        raise OcrUnavailable("The label scanning service returned an invalid response.")
    lines: list[OcrLine] = []
    missing_confidence = False
    for index, item in enumerate(raw_lines):
        if not isinstance(item, Mapping):
            continue
        text = item.get("words")
        if not isinstance(text, str) or not text.strip():
            continue
        probability = item.get("probability")
        confidence = _number(probability.get("average")) if isinstance(probability, Mapping) else None
        if confidence is None:
            missing_confidence = True
            confidence = MIN_TEXT_SCORE
        lines.append(OcrLine(
            text=text.strip(),
            confidence=max(0.0, min(1.0, confidence)),
            box=_line_box(item, index),
        ))
    return lines, missing_confidence


def _raise_provider_error(code: int | None) -> None:
    if code in {17, 18, 19}:
        raise OcrBusy("The label scanning quota is temporarily unavailable. Please try again later.")
    if code is not None and 216200 <= code <= 216299:
        raise InvalidLabelImage("This photo could not be read. Try another JPEG, PNG or WebP image.")
    if code in {6, 100, 110, 111}:
        raise OcrUnavailable("The Baidu OCR service credentials are invalid or expired.")
    raise OcrUnavailable("The label scanning service is temporarily unavailable.")


_NUMBER = r"(\d{1,3}(?:[.,]\d{1,2})?)"
_ABV_PATTERNS = [
    re.compile(r"(?<![\d.,])" + _NUMBER + r"\s*%\s*(?:abv\b|alc(?:ohol)?\b)", re.I),
    re.compile(r"\b(?:abv|alc(?:ohol)?)\.?\s*(?:/\s*vol\.?\s*)?[: ]*" + _NUMBER + r"\s*%", re.I),
    re.compile(r"(?<![\d.,])" + _NUMBER + r"\s*%\s*vol\b", re.I),
]
_VOLUME = re.compile(r"(?<![\d.,])([0-9]+(?:[.,][0-9]+)?)\s*(ml|cl|l)\b", re.I)
_NOT_NAME = re.compile(
    r"\b(?:alc|alcohol|abv|vol|ml|cl|litres?|liters?|ingredients?|contains|"
    r"standard|drinks|servings?|nutrition|energy|sugar|protein|fat|sodium|"
    r"brewed|bottled|distributed|imported|warning|pregnan\w*|drink\s+responsibly|"
    r"recycl\w*|www|https?|best\s+before|sample|not\s+for\s+sale)\b|%", re.I,
)
_TYPE_WORDS = {
    "beer": r"\b(?:beer|lager|ale|ipa|stout|pilsner|porter)\b",
    "wine": r"\b(?:wine|shiraz|chardonnay|merlot|cabernet|pinot|riesling|prosecco|sauvignon)\b",
    "cider": r"\bcider\b",
    "spirits": r"\b(?:vodka|gin|whisk[ey]+|rum|tequila|brandy)\b",
    "rtd-premixed": r"\b(?:premix(?:ed)?|rtd|hard\s+seltzer)\b",
    "cocktail": r"\bcocktail\b",
    "liqueur": r"\bliqueur\b",
}


def extract_fields(lines: list[OcrLine]) -> DrinkLabelResult:
    """Rules do not infer unseen label values or use product databases."""
    usable = [line for line in lines if line.confidence >= MIN_TEXT_SCORE]
    abvs: set[float] = set()
    volumes: set[float] = set()
    for line in usable:
        for pattern in _ABV_PATTERNS:
            for match in pattern.finditer(line.text):
                value = float(match[1].replace(",", "."))
                if 0 <= value <= 100:
                    abvs.add(value)
        if re.search(r"\b(?:per|serving|nutrition|energy|recipe)\b", line.text, re.I):
            continue
        for match in _VOLUME.finditer(line.text):
            value = float(match[1].replace(",", ".")) * {"ml": 1, "cl": 10, "l": 1000}[match[2].lower()]
            if 0 < value <= 100000:
                volumes.add(round(value, 4))
    fields = DrinkLabelFields()
    notes: list[str] = []
    if len(abvs) == 1:
        fields.abvPercent = next(iter(abvs))
    elif len(abvs) > 1:
        notes.append("Several alcohol percentages were found. Enter ABV from the label.")
    if len(volumes) == 1:
        fields.containerVolumeMl = next(iter(volumes))
        notes.append("The scanned volume is the container size. Check your serving size separately.")
    elif len(volumes) > 1:
        notes.append("Several volumes were found. Choose the single-container volume yourself.")
    all_text = " ".join(line.text for line in usable)
    kinds = [kind for kind, pattern in _TYPE_WORDS.items() if re.search(pattern, all_text, re.I)]
    if len(kinds) == 1:
        fields.drinkType = kinds[0]
    name_lines = [line for line in usable if len(line.text) <= 100
                  and sum(char.isalpha() for char in line.text) >= 3
                  and not _NOT_NAME.search(line.text) and not _VOLUME.search(line.text)]
    if name_lines:
        height = max(line.box[3] - line.box[1] for line in name_lines)
        prominent = [line for line in name_lines if line.box[3] - line.box[1] >= height * 0.55]
        prominent = sorted(prominent, key=lambda line: (line.box[1], line.box[0]))[:3]
        fields.drinkName = " ".join(dict.fromkeys(line.text.strip() for line in prominent))[:200]
        notes.append("The drink name is a suggestion from prominent text. Check it against the label.")
    if not usable:
        notes.append("No clear text was found. Try a closer, well-lit photo or enter the details manually.")
    return DrinkLabelResult(fields=fields, lines=lines, warnings=notes)


async def recognize_label(content: bytes) -> DrinkLabelResult:
    """Send one in-memory image to Baidu and return the existing editable contract."""
    global _token_cache
    started = time.perf_counter()
    api_key, secret_key = _credentials()
    encoded_image = base64.b64encode(content).decode("ascii")
    timeout = httpx.Timeout(35.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        for attempt in range(2):
            token = await _access_token(client, api_key, secret_key, force_refresh=attempt > 0)
            payload = await _recognition_payload(client, token, encoded_image)
            code = _error_code(payload)
            if code in {110, 111} and attempt == 0:
                _token_cache = None
                continue
            if code is not None:
                logger.warning("Baidu OCR recognition failed with error code %s", code)
                _raise_provider_error(code)
            lines, missing_confidence = _lines_from_payload(payload)
            result = extract_fields(lines)
            if missing_confidence:
                result.warnings.append("Some recognized lines did not include a confidence score. Check them carefully.")
            result.elapsedMs = round((time.perf_counter() - started) * 1000)
            return result
    raise OcrUnavailable("The label scanning service is temporarily unavailable.")
