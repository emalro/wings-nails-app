"""Tests for the home-gallery backend capability (REQ-HMG-001..022).

Strict TDD — every test in this file was written BEFORE the implementation
it exercises. The 4 cases in TestGallerySchemas (W1.2) are pure Pydantic
schema validation. The endpoint tests come in W1.3, W1.4, W1.5, W1.6.

Env-var setup, schema creation, and the `client` / `session` fixtures live
at module level so this file is self-contained: `pytest tests/test_gallery.py`
works in isolation (without test_api.py's import-time setup having run).
The full suite still works because test_api.py's own env-var assignments
are setdefault-style idempotent.
"""

import os

# Env vars BEFORE any `app.*` import. Idempotent with test_api.py's setup.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-jwt-32-chars-long!")
os.environ.setdefault("LOGIN_RATE_LIMIT", "100/minute")

import pytest
from pydantic import ValidationError
from sqlmodel import Session, delete, select

from app.database import create_db_and_tables, engine
from app.models import GalleryItem

# Ensure schema exists. Idempotent. Mirrors test_api.py's import-time setup
# but is scoped to this file so we don't depend on test_api.py being loaded.
create_db_and_tables()


@pytest.fixture
def client():
    """A fresh TestClient bound to the FastAPI app, per test."""
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app, base_url="https://testserver")


@pytest.fixture
def session():
    """A fresh SQLModel Session bound to the shared test engine, per test."""
    s = Session(engine)
    try:
        yield s
    finally:
        s.close()


@pytest.fixture(autouse=True)
def _clear_gallery(session):
    """Wipe the GalleryItem table before each gallery test.

    Scoped to this file (autouse declared here, not in conftest.py) so the
    existing 182 tests are not affected. W1.6's seed_default_gallery tests
    are also safe under this fixture — the seed runs after the wipe.
    """
    session.exec(delete(GalleryItem))
    session.commit()
    yield


@pytest.fixture
def auth_headers(session):
    """Idempotent: creates the test admin user on first use, returns
    Authorization headers with a valid Bearer token. Works with the
    existing `client` fixture (no separate TestClient needed)."""
    from app.auth import create_access_token, get_password_hash
    from app.models import Usuario

    user = session.exec(
        select(Usuario).where(Usuario.email == "test-gallery-admin@test.com")
    ).first()
    if not user:
        user = Usuario(
            email="test-gallery-admin@test.com",
            hashed_password=get_password_hash("testpass123"),
            role="admin",
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


# ── W1.4: Admin POST /gallery (RED → GREEN) ─────────────────────────────────
# 4 cases per design §9 / REQ-HMG-020. 422 (invalid orden) is covered by W1.2.


class TestGalleryAdminCreate:
    """REQ-HMG-020: POST /gallery requires admin auth, validates input,
    rejects duplicate active orden with 409 (R13).
    """

    def test_create_returns_201_with_payload(self, client, session, auth_headers):
        """Valid body + auth -> 201 with the created item."""
        resp = client.post(
            "/gallery",
            json={
                "orden": 1,
                "image_url": "https://example.com/1.jpg",
                "alt_text": "Slot 1 alt",
                "activo": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert body["orden"] == 1
        assert body["image_url"] == "https://example.com/1.jpg"
        assert body["alt_text"] == "Slot 1 alt"
        assert body["activo"] is True
        assert body["id"] > 0

    def test_create_without_auth_returns_401(self, client, session):
        """No auth header -> 401 (before Pydantic runs)."""
        resp = client.post(
            "/gallery",
            json={
                "orden": 1,
                "image_url": "https://example.com/1.jpg",
                "alt_text": "Slot 1 alt",
            },
        )
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"

    def test_create_with_duplicate_active_orden_returns_409(
        self, client, session, auth_headers
    ):
        """R13: POST with the same orden as an existing ACTIVE row -> 409
        with detail starting with `orden_conflict`."""
        session.add(GalleryItem(
            orden=1, image_url="https://example.com/1.jpg", alt_text="First", activo=True,
        ))
        session.commit()
        resp = client.post(
            "/gallery",
            json={
                "orden": 1,
                "image_url": "https://example.com/other.jpg",
                "alt_text": "Second",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}: {resp.text}"
        assert "orden_conflict" in resp.json()["detail"]

    def test_create_with_inactive_duplicate_orden_succeeds(
        self, client, session, auth_headers
    ):
        """R13: two inactive rows with the same orden may coexist
        (uniqueness is active-only — see design §3.5)."""
        session.add(GalleryItem(
            orden=1, image_url="https://example.com/1.jpg", alt_text="Inactive", activo=False,
        ))
        session.commit()
        resp = client.post(
            "/gallery",
            json={
                "orden": 1,
                "image_url": "https://example.com/another.jpg",
                "alt_text": "Also inactive",
                "activo": False,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"


# ── W1.2: Schema validation (RED → GREEN) ───────────────────────────────────
#
# These tests exercise the Pydantic schemas ONLY — no DB, no HTTP. They run
# before any endpoint exists; the schemas live in backend/app/schemas.py.


class TestGallerySchemas:
    """REQ-HMG-002: GalleryItemCreate / Update / Read shape and validators."""

    def test_create_rejects_orden_out_of_range(self):
        """orden must be 1..6; 7 returns 422 with a clear error."""
        from app.schemas import GalleryItemCreate
        with pytest.raises(ValidationError) as exc_info:
            GalleryItemCreate(
                orden=7,
                image_url="https://example.com/x.jpg",
                alt_text="Test alt",
            )
        # The error must mention 'orden' and 'le' (Pydantic's `le=6` constraint).
        errors = exc_info.value.errors()
        assert any(
            e["loc"] == ("orden",) and "le" in e["type"]
            for e in errors
        ), f"Expected orden/le violation in errors, got {errors}"

    def test_create_rejects_invalid_url(self):
        """image_url must be a valid http/https URL; 'not-a-url' is rejected."""
        from app.schemas import GalleryItemCreate
        with pytest.raises(ValidationError) as exc_info:
            GalleryItemCreate(
                orden=1,
                image_url="not-a-url",
                alt_text="Test alt",
            )
        errors = exc_info.value.errors()
        assert any(
            e["loc"] == ("image_url",) and "url" in e["type"].lower()
            for e in errors
        ), f"Expected image_url/url violation, got {errors}"

    def test_create_rejects_empty_alt_text(self):
        """alt_text must be non-empty (min_length=1); empty string is rejected."""
        from app.schemas import GalleryItemCreate
        with pytest.raises(ValidationError) as exc_info:
            GalleryItemCreate(
                orden=1,
                image_url="https://example.com/x.jpg",
                alt_text="",
            )
        # Pydantic v2 surfaces the constraint via type='string_too_short' and
        # ctx={'min_length': 1}. The contract is "alt_text is rejected when
        # empty" — we don't pin the exact type string, just the (loc, min_length)
        # pair, so the test survives Pydantic minor-version drift.
        errors = exc_info.value.errors()
        assert any(
            e["loc"] == ("alt_text",) and e.get("ctx", {}).get("min_length") == 1
            for e in errors
        ), f"Expected alt_text min_length=1 violation, got {errors}"

    def test_update_excludes_orden_field(self):
        """GalleryItemUpdate has no `orden` field — orden is immutable post-create."""
        from app.schemas import GalleryItemUpdate
        # Confirming the field is NOT in the model fields.
        assert "orden" not in GalleryItemUpdate.model_fields, (
            "GalleryItemUpdate must not expose orden — orden is set on create "
            "and stays. If this fails, the partial-update contract is broken."
        )
        # And constructing without orden succeeds.
        upd = GalleryItemUpdate(alt_text="New alt text")
        assert upd.alt_text == "New alt text"
        assert upd.image_url is None
        assert upd.link_url is None
        assert upd.activo is None


# ── W1.3: Public GET /gallery (RED → GREEN) ─────────────────────────────────
#
# These tests exercise the GET endpoint through TestClient. They run BEFORE
# the endpoint is implemented — they fail with 404 on the first run, then
# pass after main.py grows the route.


class TestGalleryPublicGet:
    """REQ-HMG-010: GET /gallery is public, returns up to 6 items ordered by
    orden ASC. Inactive items are included (frontend filters).
    """

    def test_get_returns_six_items_ordered_by_orden(self, client, session):
        """With 6 manually-inserted items, GET /gallery returns them
        ordered by `orden` ASC (1, 2, 3, 4, 5, 6)."""
        for n in range(1, 7):
            session.add(GalleryItem(
                orden=n,
                image_url=f"https://example.com/{n}.jpg",
                alt_text=f"Slot {n}",
                activo=False,
            ))
        session.commit()

        r = client.get("/gallery")
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 6
        orden_values = [item["orden"] for item in items]
        assert orden_values == [1, 2, 3, 4, 5, 6], (
            f"Expected orden ASC, got {orden_values}"
        )

    def test_get_returns_empty_list_when_table_empty(self, client, session):
        """With no items in the gallery table, GET /gallery returns 200 with []."""
        # The _clear_gallery autouse fixture has already wiped the table.
        existing = session.exec(select(GalleryItem)).all()
        assert existing == [], (
            f"Test DB should start empty for this case, found {existing}"
        )

        r = client.get("/gallery")
        assert r.status_code == 200
        assert r.json() == []

    def test_get_does_not_require_auth(self, client, session):
        """GET /gallery is unauthenticated — no Authorization header, no cookie.
        Returns 200 even when no items exist (empty list is fine)."""
        r = client.get("/gallery")
        assert r.status_code == 200, (
            f"Expected 200 for unauthenticated GET, got {r.status_code}: {r.text}"
        )

    def test_get_includes_inactive_items(self, client, session):
        """Inactive items (activo=False) are returned. The public frontend
        decides what to render; the backend does not filter by activo."""
        for n in range(1, 7):
            session.add(GalleryItem(
                orden=n,
                image_url=f"https://example.com/{n}.jpg",
                alt_text=f"Slot {n}",
                activo=False,
            ))
        session.commit()

        r = client.get("/gallery")
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 6
        for item in items:
            assert item["activo"] is False, (
                f"Expected all items to be inactive, got {item}"
            )
