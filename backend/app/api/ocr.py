"""Local demo endpoint: bounded image bytes in, editable suggestions out."""

import logging

from fastapi import APIRouter, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool

from ..schemas.ocr import DrinkLabelResult
from ..services.ocr import (
    MAX_IMAGE_BYTES, InvalidLabelImage, OcrBusy, OcrUnavailable,
    recognize_label, require_enabled,
)

router = APIRouter(prefix="/api/ocr", tags=["label OCR"])
logger = logging.getLogger(__name__)


@router.post("/drink-label", response_model=DrinkLabelResult)
async def scan_drink_label(request: Request, response: Response) -> DrinkLabelResult:
    response.headers["Cache-Control"] = "no-store"
    try:
        require_enabled()
        if request.headers.get("content-type", "").split(";")[0].lower() not in {
            "image/jpeg", "image/png", "image/webp",
        }:
            raise HTTPException(415, "Choose a JPEG, PNG or WebP photo.")
        # A binary image body avoids multipart spooling and never writes images to disk.
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > MAX_IMAGE_BYTES:
                raise HTTPException(413, "Choose a photo smaller than 8 MB.")
            body.extend(chunk)
        if not body:
            raise HTTPException(400, "Choose a photo first.")
        return await run_in_threadpool(recognize_label, bytes(body))
    except InvalidLabelImage as exc:
        raise HTTPException(422, str(exc)) from exc
    except (OcrUnavailable, OcrBusy) as exc:
        raise HTTPException(503, str(exc), headers={"Cache-Control": "no-store"}) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Label OCR request failed")
        raise HTTPException(500, "Label scanning failed. Try another photo or enter the details manually.") from exc
