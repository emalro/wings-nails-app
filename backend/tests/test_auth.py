import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

# Set test environment variables
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-jwt-32-chars-long!"
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$test_hash"  # Not used in unit tests

from app.auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    get_password_hash,
    verify_password,
)


class TestJWTUtils:
    """Tests for JWT creation and verification utilities."""

    def test_create_access_token_contains_user_id(self):
        """Access token should contain sub claim with user_id."""
        token = create_access_token(user_id=1)
        payload = verify_token(token, expected_type="access")
        assert payload["sub"] == "1"

    def test_create_access_token_has_access_type(self):
        """Access token should have type='access'."""
        token = create_access_token(user_id=1)
        payload = verify_token(token, expected_type="access")
        assert payload["type"] == "access"

    def test_create_access_token_expiry(self):
        """Access token should expire in ~30 minutes."""
        token = create_access_token(user_id=1)
        payload = verify_token(token, expected_type="access")
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = exp - now
        # Allow 29-31 minutes
        assert timedelta(minutes=29) <= delta <= timedelta(minutes=31)

    def test_create_refresh_token_contains_user_id(self):
        """Refresh token should contain sub claim with user_id."""
        token = create_refresh_token(user_id=42)
        payload = verify_token(token, expected_type="refresh")
        assert payload["sub"] == "42"

    def test_create_refresh_token_has_refresh_type(self):
        """Refresh token should have type='refresh'."""
        token = create_refresh_token(user_id=1)
        payload = verify_token(token, expected_type="refresh")
        assert payload["type"] == "refresh"

    def test_create_refresh_token_expiry(self):
        """Refresh token should expire in ~7 days."""
        token = create_refresh_token(user_id=1)
        payload = verify_token(token, expected_type="refresh")
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = exp - now
        # Allow 6-8 days
        assert timedelta(days=6) <= delta <= timedelta(days=8)

    def test_verify_token_valid(self):
        """verify_token should decode a valid token."""
        token = create_access_token(user_id=5)
        payload = verify_token(token, expected_type="access")
        assert payload["sub"] == "5"

    def test_verify_token_wrong_type_raises(self):
        """verify_token should raise when token type mismatches."""
        token = create_access_token(user_id=1)
        with pytest.raises(Exception):
            verify_token(token, expected_type="refresh")

    def test_verify_token_invalid_signature_raises(self):
        """verify_token should raise for tampered token."""
        token = create_access_token(user_id=1)
        # Tamper with token
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(Exception):
            verify_token(tampered, expected_type="access")

    def test_verify_token_expired_raises(self):
        """verify_token should raise for expired token."""
        # Create a token with very short expiry (can't mock datetime easily)
        # We'll test with an obviously expired token
        from jose import jwt, JWTError
        
        expired_payload = {
            "sub": 1,
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "type": "access",
        }
        expired_token = jwt.encode(expired_payload, os.environ["JWT_SECRET_KEY"], algorithm="HS256")
        with pytest.raises(JWTError):
            verify_token(expired_token, expected_type="access")


class TestPasswordUtils:
    """Tests for password hashing utilities."""

    def test_get_password_hash_returns_bcrypt(self):
        """Password hash should start with $2b$ (bcrypt prefix)."""
        hashed = get_password_hash("secret123")
        assert hashed.startswith("$2b$")

    def test_get_password_hash_different_each_time(self):
        """Same password should produce different hashes (salt)."""
        hash1 = get_password_hash("password")
        hash2 = get_password_hash("password")
        assert hash1 != hash2

    def test_verify_password_correct(self):
        """verify_password should return True for correct password."""
        password = "admin123"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """verify_password should return False for wrong password."""
        hashed = get_password_hash("correct")
        assert verify_password("wrong", hashed) is False

    def test_verify_password_empty_string(self):
        """verify_password should handle empty password."""
        hashed = get_password_hash("")
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False