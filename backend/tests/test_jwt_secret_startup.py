"""Tests for the JWT_SECRET_KEY startup validation (B-5).

These tests drive the production lifespan through a fresh FastAPI app to
assert that startup hard-fails when JWT_SECRET_KEY is missing or shorter
than MIN_SECRET_KEY_BYTES. They do NOT replace the global `client` fixture
in test_api.py.
"""
import asyncio
import os
import sys
import pytest
from fastapi import FastAPI

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

# These tests deliberately mutate JWT_SECRET_KEY in the environment, so we
# snapshot/restore around each test to avoid leaking state into other tests.
from app import main as app_main  # noqa: E402  (path inserted above)


@pytest.fixture
def isolated_secret(monkeypatch):
    """Strip JWT_SECRET_KEY from the environment, regardless of what other
    test modules already set. The fixture yields the monkeypatch; tests
    should set their own value (or leave it unset)."""
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    yield monkeypatch
    # monkeypatch restores automatically


def _build_app():
    """Build a minimal FastAPI app with the same lifespan as the real one."""
    return FastAPI(lifespan=app_main.lifespan)


async def _drive_lifespan(test_app):
    """Enter the lifespan async context manager and return the exception
    raised on startup (or None if startup completed cleanly)."""
    try:
        async with app_main.lifespan(test_app):
            return None
    except Exception as e:  # noqa: BLE001 — we want to assert on whatever raises
        return e


def test_lifespan_raises_when_jwt_secret_key_missing(isolated_secret):
    """B-5: missing JWT_SECRET_KEY must fail at startup, not silently sign with ''."""
    test_app = _build_app()
    err = asyncio.run(_drive_lifespan(test_app))
    assert err is not None, "Expected lifespan to raise when JWT_SECRET_KEY is unset"
    assert isinstance(err, RuntimeError)
    assert "JWT_SECRET_KEY is not set" in str(err)


def test_lifespan_raises_when_jwt_secret_key_too_short(isolated_secret):
    """B-5: short JWT_SECRET_KEY (< 32 bytes) must fail at startup."""
    isolated_secret.setenv("JWT_SECRET_KEY", "short")
    test_app = _build_app()
    err = asyncio.run(_drive_lifespan(test_app))
    assert err is not None, "Expected lifespan to raise when JWT_SECRET_KEY is too short"
    assert isinstance(err, RuntimeError)
    assert "too short" in str(err)
    assert "32 bytes" in str(err)


def test_lifespan_passes_when_jwt_secret_key_is_long_enough(isolated_secret, tmp_path, monkeypatch):
    """B-5: a 32+ byte JWT_SECRET_KEY must pass the startup check.

    The lifespan also runs DB migrations; point the test at a tmp SQLite
    file so we don't disturb the shared test.db.
    """
    db_path = tmp_path / "lifespan_ok.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    isolated_secret.setenv("JWT_SECRET_KEY", "x" * 32)
    test_app = _build_app()
    err = asyncio.run(_drive_lifespan(test_app))
    assert err is None, f"Expected startup to pass, got: {err!r}"
