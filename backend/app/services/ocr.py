"""Local CPU inference, with in-memory images and conservative field extraction."""

from __future__ import annotations

import io
import logging
import math
import os
import re
import threading
import time
import warnings
from pathlib import Path

from ..schemas.ocr import DrinkLabelFields, DrinkLabelResult, OcrLine

logger = logging.getLogger(__name__)
MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
MIN_TEXT_SCORE = 0.75
_lock = threading.Lock()
_pipeline = None


class OcrUnavailable(RuntimeError):
    pass


class OcrBusy(RuntimeError):
    pass


class InvalidLabelImage(ValueError):
    pass


def require_enabled() -> None:
    if os.environ.get("SIPAWARE_OCR_ENABLED") != "1":
        raise OcrUnavailable("Label scanning is disabled. Start the local OCR demo service.")


def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    root = Path(os.environ.get("SIPAWARE_OCR_MODEL_ROOT", "backend/models")).expanduser()
    directories = [root / f"PP-OCRv6_medium_{kind}_infer" for kind in ("det", "rec")]
    for directory in directories:
        if not all((directory / name).is_file() for name in (
            "inference.json", "inference.pdiparams", "inference.yml"
        )):
            raise OcrUnavailable("Local OCR models are missing. Check SIPAWARE_OCR_MODEL_ROOT.")
    # Set before importing PaddleX. All models are supplied locally; no hub lookup.
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    try:
        from paddleocr import PaddleOCR

        _pipeline = PaddleOCR(
            text_detection_model_name="PP-OCRv6_medium_det",
            text_detection_model_dir=str(directories[0]),
            text_recognition_model_name="PP-OCRv6_medium_rec",
            text_recognition_model_dir=str(directories[1]),
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device="cpu",
            enable_mkldnn=False,
            cpu_threads=4,
            text_det_limit_side_len=1280,
            text_det_limit_type="max",
            text_recognition_batch_size=4,
        )
    except Exception as exc:
        logger.exception("Local OCR initialization failed")
        raise OcrUnavailable("OCR could not start. Check the local model and CPU dependencies.") from exc
    return _pipeline


def _decode_image(content: bytes):
    try:
        import numpy as np
        from PIL import Image, ImageOps, UnidentifiedImageError
    except ImportError as exc:
        raise OcrUnavailable("Install backend/requirements-ocr.txt for local label scanning.") from exc
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise InvalidLabelImage("Choose a JPEG, PNG or WebP photo.")
                if source.width * source.height > MAX_IMAGE_PIXELS:
                    raise InvalidLabelImage("Use an image smaller than 20 megapixels.")
                rgb = ImageOps.exif_transpose(source).convert("RGB")
                rgb.thumbnail((1600, 1600))
                return np.asarray(rgb)[:, :, ::-1].copy()  # PaddleOCR expects BGR.
    except (UnidentifiedImageError, OSError, Image.DecompressionBombWarning,
            Image.DecompressionBombError) as exc:
        raise InvalidLabelImage("This photo could not be read. Try a JPEG or PNG image.") from exc


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


def recognize_label(content: bytes) -> DrinkLabelResult:
    require_enabled()
    if not _lock.acquire(blocking=False):
        raise OcrBusy("Another label is being scanned. Please try again shortly.")
    started = time.perf_counter()
    try:
        image = _decode_image(content)
        pipeline = _load_pipeline()
        lines = []
        for result in pipeline.predict(image):
            for text, score, box in zip(result["rec_texts"], result["rec_scores"], result["rec_boxes"]):
                confidence = float(score)
                if text.strip() and math.isfinite(confidence):
                    lines.append(OcrLine(text=text.strip(), confidence=max(0, min(1, confidence)),
                                         box=[float(coordinate) for coordinate in box]))
        response = extract_fields(lines)
        response.elapsedMs = round((time.perf_counter() - started) * 1000)
        return response
    finally:
        _lock.release()
