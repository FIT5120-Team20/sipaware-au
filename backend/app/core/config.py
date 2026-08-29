"""Provider-neutral configuration for database-backed reference features.

The API uses one ``DATABASE_URL`` in every environment. Production supplies it
through the process environment, while local development may fall back to the
gitignored ``backend/.env`` file. Personal SavedDrink and DrinkingRecord data is
not configured here because it remains exclusively in browser IndexedDB.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values


BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_ENV_FILE = BACKEND_DIRECTORY / ".env"
DATABASE_URL_VARIABLE = "DATABASE_URL"


class DatabaseConfigurationError(RuntimeError):
    """Report missing database configuration without exposing secret values."""


@dataclass(frozen=True, repr=False)
class DatabaseSettings:
    """Hold the private connection value with an intentionally redacted repr."""

    database_url: str = field(repr=False)

    def __repr__(self) -> str:
        """Prevent accidental credential disclosure in diagnostics and logs."""
        return "DatabaseSettings(database_url=<redacted>)"


def load_database_settings(
    environ: Mapping[str, str] | None = None,
    env_file: Path | None = DEFAULT_DATABASE_ENV_FILE,
) -> DatabaseSettings:
    """Resolve DATABASE_URL lazily when a database feature is invoked.

    Environment configuration wins so serverless deployments never depend on a
    local file. Deferring this function keeps application startup and the base
    health endpoint independent from database availability.
    """
    selected_environment = os.environ if environ is None else environ
    database_url = selected_environment.get(DATABASE_URL_VARIABLE, "").strip()

    if not database_url and env_file is not None and env_file.is_file():
        local_value = dotenv_values(env_file).get(DATABASE_URL_VARIABLE)
        if isinstance(local_value, str):
            database_url = local_value.strip()

    if not database_url:
        raise DatabaseConfigurationError(
            "DATABASE_URL is required for database-backed reference endpoints."
        )

    return DatabaseSettings(database_url=database_url)
