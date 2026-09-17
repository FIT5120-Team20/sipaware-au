"""OCR suggestions are editable evidence, never catalog identities."""

from typing import Literal

from pydantic import BaseModel, Field


class OcrLine(BaseModel):
    text: str
    confidence: float = Field(ge=0, le=1)
    box: list[float] = Field(min_length=4, max_length=4)


class DrinkLabelFields(BaseModel):
    drinkName: str | None = None
    drinkType: Literal[
        "beer", "wine", "cider", "spirits", "rtd-premixed", "cocktail", "liqueur", "other"
    ] | None = None
    containerVolumeMl: float | None = None
    abvPercent: float | None = None


class DrinkLabelResult(BaseModel):
    fields: DrinkLabelFields
    lines: list[OcrLine]
    warnings: list[str]
    elapsedMs: int = 0
