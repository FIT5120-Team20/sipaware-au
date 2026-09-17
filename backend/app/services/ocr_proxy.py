"""HTTPS bridge between the public Vercel API and a protected OCR origin."""

from __future__ import annotations

import os
import secrets
from urllib.parse import urlsplit

import httpx
from pydantic import ValidationError

from ..schemas.ocr import DrinkLabelResult

TOKEN_HEADER = "X-Sipaware-Ocr-Token"


class OcrProxyError(RuntimeError):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


def upstream_base_url() -> str | None:
    value = os.environ.get("SIPAWARE_OCR_UPSTREAM_URL", "").strip().rstrip("/")
    return value or None


def _shared_secret() -> str:
    value = os.environ.get("SIPAWARE_OCR_SHARED_SECRET", "")
    if len(value) < 32:
        raise OcrProxyError("The online label scanner is not configured correctly.")
    return value


def require_origin_token(headers) -> None:
    """Protect a tunnel origin; normal local development does not enable this gate."""
    if os.environ.get("SIPAWARE_OCR_REQUIRE_TOKEN") != "1":
        return
    expected = _shared_secret()
    supplied = headers.get(TOKEN_HEADER, "")
    if not supplied or not secrets.compare_digest(supplied, expected):
        raise OcrProxyError("Unauthorized OCR request.", status_code=401)


def require_origin_configuration() -> None:
    if os.environ.get("SIPAWARE_OCR_REQUIRE_TOKEN") != "1":
        raise RuntimeError("The tunnel OCR origin must require an access token.")
    _shared_secret()


def _validated_upstream_url() -> str:
    base = upstream_base_url()
    if base is None:
        raise OcrProxyError("The online label scanner is not configured.")
    parsed = urlsplit(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password \
            or parsed.query or parsed.fragment:
        raise OcrProxyError("The online label scanner URL is invalid.")
    return f"{base}/api/ocr/drink-label"


async def proxy_label(content: bytes, content_type: str) -> DrinkLabelResult:
    """Forward a bounded image without exposing the origin secret to the browser."""
    url = _validated_upstream_url()
    headers = {
        "Content-Type": content_type,
        "Accept": "application/json",
        TOKEN_HEADER: _shared_secret(),
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(110.0), follow_redirects=False) as client:
            upstream = await client.post(url, content=content, headers=headers)
    except httpx.RequestError as exc:
        raise OcrProxyError(
            "The OCR computer is offline or still starting. Please try again shortly."
        ) from exc

    if upstream.status_code != 200:
        if upstream.status_code in {400, 413, 415, 422, 429}:
            try:
                detail = upstream.json().get("detail")
            except (ValueError, AttributeError):
                detail = None
            if isinstance(detail, str) and len(detail) <= 300:
                raise OcrProxyError(detail, status_code=upstream.status_code)
        if upstream.status_code in {401, 403}:
            raise OcrProxyError("The OCR computer rejected the service credentials.")
        raise OcrProxyError("The OCR computer is temporarily unavailable.")

    try:
        return DrinkLabelResult.model_validate(upstream.json())
    except (ValueError, ValidationError) as exc:
        raise OcrProxyError("The OCR computer returned an invalid response.") from exc
