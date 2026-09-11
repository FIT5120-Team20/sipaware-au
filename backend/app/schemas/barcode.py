"""Public barcode DTOs, separate from sales packaging and personal records."""
from typing import Annotated, Literal

from pydantic import Field, HttpUrl, StringConstraints, model_validator

from app.schemas.reference import ReferenceModel

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class BarcodeProduct(ReferenceModel):
    """Volume is one container; pack metadata must never become consumption."""

    product_id: Text
    barcode: Annotated[str, StringConstraints(pattern=r"^[0-9]{1,200}$")]
    drink_name: Text
    drink_type: Literal["beer", "wine", "cider", "spirits", "rtd-premixed", "cocktail", "liqueur", "other"]
    volume_ml: float = Field(gt=0, le=100000, allow_inf_nan=False)
    abv_percent: float = Field(ge=0, le=100, allow_inf_nan=False)
    source_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    source_url: HttpUrl
    pack_quantity: int = Field(strict=True, gt=0, le=100000)
    total_package_volume_ml: float = Field(gt=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def consistent_package(self) -> "BarcodeProduct":
        # Fail closed on bad catalog data instead of suggesting the wrong amount.
        expected = self.volume_ml * self.pack_quantity
        if abs(self.total_package_volume_ml - expected) > max(0.000001, expected * 1e-9):
            raise ValueError("Inconsistent package volume")
        if any((self.source_url.username, self.source_url.password)):
            raise ValueError("Source URL cannot contain credentials")
        return self


class BarcodeMatch(ReferenceModel):
    kind: Literal["match"] = "match"
    product: BarcodeProduct


class BarcodeNotFound(ReferenceModel):
    kind: Literal["not-found"] = "not-found"
