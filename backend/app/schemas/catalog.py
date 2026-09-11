"""Public product definitions describe one container, never a drinking event."""
from typing import Annotated, Literal
from pydantic import Field, HttpUrl, StringConstraints, model_validator
from app.schemas.reference import ReferenceModel

CatalogCategory = Literal["all", "beer", "wine", "spirits", "cider", "rtd", "other"]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class CatalogProduct(ReferenceModel):
    product_id: Text
    drink_name: Text
    drink_type: Literal["beer", "wine", "cider", "spirits", "rtd-premixed", "cocktail", "liqueur", "other"]
    volume_ml: float = Field(gt=0, le=100000, allow_inf_nan=False)
    abv_percent: float = Field(ge=0, le=100, allow_inf_nan=False)
    source_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    source_url: HttpUrl

    @model_validator(mode="after")
    def public_source(self) -> "CatalogProduct":
        if any((self.source_url.username, self.source_url.password)):
            raise ValueError("Source URL cannot contain credentials")
        return self


class CatalogPage(ReferenceModel):
    products: list[CatalogProduct]
    total: int = Field(ge=0)
    offset: int = Field(ge=0)
    limit: int = Field(ge=1, le=48)
