"""Short-lived PostgreSQL connection lifecycle for serverless-safe requests.

Connections are opened only for public/reference-data operations and closed at
the request boundary. The module provides no mutation helper: personal data is
owned by browser IndexedDB, while this database connection reads project-managed
reference data only.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager, suppress
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.core.config import (
    DatabaseConfigurationError,
    DatabaseSettings,
    load_database_settings,
)


CONNECT_TIMEOUT_SECONDS = 5


class DatabaseUnavailableError(RuntimeError):
    """Represent a sanitized connection or query failure for API translation."""


DatabaseConnection = psycopg.Connection[dict[str, Any]]


@contextmanager
def open_database_connection(
    settings: DatabaseSettings | None = None,
) -> Iterator[DatabaseConnection]:
    """Yield one read-only connection and always close it after the operation.

    Psycopg's transaction characteristic is set before the first SQL statement.
    This is compatible with Neon's pooled endpoint, which rejects PostgreSQL
    startup ``options`` fields, and complements the database role's verified
    read-only grants.
    """
    connection: DatabaseConnection | None = None

    try:
        resolved_settings = settings or load_database_settings()
        connection = psycopg.connect(
            resolved_settings.database_url,
            row_factory=dict_row,
            connect_timeout=CONNECT_TIMEOUT_SECONDS,
            application_name="sipaware-reference-api",
        )
        connection.read_only = True
        yield connection
    except DatabaseConfigurationError:
        raise
    except psycopg.Error:
        # Driver errors may contain connection details, so discard their causal
        # chain and expose only a stable application-level failure.
        raise DatabaseUnavailableError(
            "The reference database is temporarily unavailable."
        ) from None
    finally:
        if connection is not None:
            with suppress(psycopg.Error):
                connection.close()
