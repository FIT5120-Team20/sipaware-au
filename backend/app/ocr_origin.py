"""Minimal, token-protected app exposed by the Mac presentation tunnel."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api.ocr import router as ocr_router
from .services.ocr import require_enabled
from .services.ocr_proxy import require_origin_configuration


@asynccontextmanager
async def lifespan(_app: FastAPI):
    require_enabled()
    require_origin_configuration()
    yield


app = FastAPI(
    title="SipAware OCR Origin",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(ocr_router)
