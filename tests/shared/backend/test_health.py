"""Tests for the database-independent process-health endpoint."""

import asyncio

import httpx
import pytest

from app.main import app


@pytest.mark.parametrize("prefix", ["", "/iteration2"])
def test_health_endpoint(prefix: str) -> None:
    async def request_health() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            return await client.get(prefix + "/api/health")

    response = asyncio.run(request_health())

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "sipaware-au-api",
    }


@pytest.mark.parametrize("prefix", ["/iteration1", "/iteration3", "/iteration20"])
def test_unknown_iterations_do_not_alias_the_active_api(prefix: str) -> None:
    """Future or retained iterations must never silently resolve to current handlers."""
    async def send() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            return await client.get(prefix + "/api/health")
    assert asyncio.run(send()).status_code == 404
