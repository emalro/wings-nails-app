"""Tests for the home-gallery backend capability (REQ-HMG-001..022).

Strict TDD — every test in this file was written BEFORE the implementation
it exercises. The 4 cases in TestGallerySchemas (W1.2) are pure Pydantic
schema validation. The endpoint tests come in W1.3, W1.4, W1.5, W1.6.
"""

import pytest
from pydantic import ValidationError


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
