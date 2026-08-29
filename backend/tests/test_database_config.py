"""Tests for lazy, secret-safe database configuration and connections."""

from pathlib import Path
from typing import Any

import psycopg
import pytest

from app.core.config import (
    DatabaseConfigurationError,
    DatabaseSettings,
    load_database_settings,
)
from app.integrations import database
from app.integrations.database import DatabaseUnavailableError


SENSITIVE_SENTINEL = "opaque-sensitive-value"


def test_environment_database_url_takes_precedence(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("DATABASE_URL=local-file-value\n", encoding="utf-8")

    settings = load_database_settings(
        environ={"DATABASE_URL": "process-environment-value"},
        env_file=env_file,
    )

    assert settings.database_url == "process-environment-value"


def test_local_env_file_is_used_for_development(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("DATABASE_URL=local-file-value\n", encoding="utf-8")

    settings = load_database_settings(environ={}, env_file=env_file)

    assert settings.database_url == "local-file-value"


def test_missing_database_url_fails_only_when_loaded(tmp_path: Path) -> None:
    missing_env_file = tmp_path / "missing.env"

    with pytest.raises(DatabaseConfigurationError) as captured_error:
        load_database_settings(environ={}, env_file=missing_env_file)

    assert str(captured_error.value) == (
        "DATABASE_URL is required for database-backed reference endpoints."
    )


def test_database_settings_repr_redacts_connection_value() -> None:
    settings = DatabaseSettings(database_url=SENSITIVE_SENTINEL)

    assert repr(settings) == "DatabaseSettings(database_url=<redacted>)"
    assert SENSITIVE_SENTINEL not in repr(settings)
    assert SENSITIVE_SENTINEL not in str(settings)


def test_connection_is_short_lived_read_only_and_pooler_compatible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeConnection:
        def __init__(self) -> None:
            self.read_only = False
            self.closed = False

        def close(self) -> None:
            self.closed = True

    fake_connection = FakeConnection()
    connect_call: dict[str, Any] = {}

    def fake_connect(connection_value: str, **kwargs: Any) -> FakeConnection:
        connect_call["connection_value"] = connection_value
        connect_call["kwargs"] = kwargs
        return fake_connection

    monkeypatch.setattr(database.psycopg, "connect", fake_connect)

    settings = DatabaseSettings(database_url=SENSITIVE_SENTINEL)
    with database.open_database_connection(settings) as yielded_connection:
        assert yielded_connection is fake_connection
        assert fake_connection.read_only is True
        assert fake_connection.closed is False

    assert fake_connection.closed is True
    assert connect_call["connection_value"] == SENSITIVE_SENTINEL
    assert connect_call["kwargs"]["connect_timeout"] == 5
    assert "options" not in connect_call["kwargs"]


def test_driver_failure_discards_sensitive_exception_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_connect(*args: Any, **kwargs: Any) -> None:
        del args, kwargs
        raise psycopg.OperationalError(SENSITIVE_SENTINEL)

    monkeypatch.setattr(database.psycopg, "connect", fail_connect)

    with pytest.raises(DatabaseUnavailableError) as captured_error:
        with database.open_database_connection(
            DatabaseSettings(database_url=SENSITIVE_SENTINEL)
        ):
            pass

    assert SENSITIVE_SENTINEL not in str(captured_error.value)
    assert SENSITIVE_SENTINEL not in repr(captured_error.value)
    assert captured_error.value.__cause__ is None
