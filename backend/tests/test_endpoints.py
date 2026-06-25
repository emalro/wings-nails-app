import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

# Set test environment variables
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-jwt-32-chars-long!"
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$test_hash"  # placeholder
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["DATABASE_URL"] = "sqlite:///./test_endpoints.db"
os.environ["LOGIN_RATE_LIMIT"] = "100/minute"

from app.auth import get_password_hash
from app.database import create_db_and_tables, engine
from app.models import Usuario
from app.main import app

# Ensure DB tables exist for tests
create_db_and_tables()

# Create test client
client = TestClient(app, raise_server_exceptions=False)


def setup_test_user():
    """Create a test user with known password."""
    password = "secret123"
    hashed = get_password_hash(password)
    # Use the same engine the app uses
    from app.database import engine as app_engine
    with Session(app_engine) as session:
        # Delete existing test user
        existing = session.exec(
            select(Usuario).where(Usuario.email == "admin@test.com")
        ).first()
        if existing:
            session.delete(existing)
            session.commit()
        
        user = Usuario(
            email="admin@test.com",
            hashed_password=hashed,
            role="admin",
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id, password


class TestAuthEndpoints:
    """Tests for authentication endpoints."""

    @pytest.fixture(autouse=True)
    def setup_user(self):
        # Clear cookies from previous tests to avoid state leakage
        client.cookies.clear()
        self.user_id, self.password = setup_test_user()
        yield
        # Cleanup after each test
        with Session(engine) as session:
            user = session.get(Usuario, self.user_id)
            if user:
                session.delete(user)
                session.commit()
        client.cookies.clear()

    def test_login_success(self):
        """POST /auth/login with valid credentials returns 200 with tokens."""
        response = client.post(
            "/auth/login",
            json={"email": "admin@test.com", "password": self.password},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "admin@test.com"
        assert data["user"]["role"] == "admin"
        # Check cookies are set
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies

    def test_login_invalid_credentials(self):
        """POST /auth/login with wrong password returns 401."""
        response = client.post(
            "/auth/login",
            json={"email": "admin@test.com", "password": "wrongpassword"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials"

    def test_login_nonexistent_user(self):
        """POST /auth/login with unknown email returns 401."""
        response = client.post(
            "/auth/login",
            json={"email": "unknown@test.com", "password": "any"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials"

    def test_logout_success(self):
        """POST /auth/logout clears cookies and returns 200."""
        # First login to get cookies
        login_response = client.post(
            "/auth/login",
            json={"email": "admin@test.com", "password": self.password},
        )
        assert login_response.status_code == 200
        
        # Then logout
        logout_response = client.post("/auth/logout")
        assert logout_response.status_code == 200
        # Cookies should be cleared (max-age=0)
        # Note: TestClient doesn't easily expose cookie expiry, but we can check response
        assert logout_response.json()["message"] == "Logged out"

    def test_refresh_valid_token(self):
        """POST /auth/refresh with valid refresh token returns new access token."""
        # Login to get refresh token
        login_response = client.post(
            "/auth/login",
            json={"email": "admin@test.com", "password": self.password},
        )
        assert login_response.status_code == 200
        
        # Refresh using client cookie jar (cookies persist after login)
        refresh_response = client.post("/auth/refresh")
        assert refresh_response.status_code == 200
        data = refresh_response.json()
        assert "access_token" in data
        # New access token cookie should be set
        assert "access_token" in refresh_response.cookies

    def test_refresh_invalid_token(self):
        """POST /auth/refresh with invalid refresh token returns 401."""
        response = client.post(
            "/auth/refresh",
            cookies={"refresh_token": "invalid.token.here"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid refresh token"

    def test_refresh_missing_token(self):
        """POST /auth/refresh without refresh token returns 401."""
        response = client.post("/auth/refresh")
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid refresh token"

    def test_me_authenticated(self):
        """GET /auth/me with valid token returns user profile."""
        # Login to get access token
        login_response = client.post(
            "/auth/login",
            json={"email": "admin@test.com", "password": self.password},
        )
        access_token = login_response.cookies.get("access_token")
        assert access_token is not None
        
        # Get me
        me_response = client.get(
            "/auth/me",
            cookies={"access_token": access_token},
        )
        assert me_response.status_code == 200
        data = me_response.json()
        assert data["email"] == "admin@test.com"
        assert data["role"] == "admin"

    def test_me_unauthenticated(self):
        """GET /auth/me without token returns 401."""
        response = client.get("/auth/me")
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_me_invalid_token(self):
        """GET /auth/me with invalid token returns 401."""
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token"


class TestSeedAdmin:
    """Tests for seed_admin_user function."""

    def test_seed_admin_creates_user(self):
        """seed_admin_user should create user from env vars."""
        from app.main import seed_admin_user
        
        os.environ["ADMIN_EMAIL"] = "seed-test@example.com"
        os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$seedhash"
        
        with Session(engine) as session:
            # Ensure no existing user
            existing = session.exec(
                select(Usuario).where(Usuario.email == "seed-test@example.com")
            ).first()
            if existing:
                session.delete(existing)
                session.commit()
            
            seed_admin_user(session)
            
            user = session.exec(
                select(Usuario).where(Usuario.email == "seed-test@example.com")
            ).first()
            assert user is not None
            assert user.email == "seed-test@example.com"
            assert user.hashed_password == "$2b$12$seedhash"
            assert user.role == "admin"
            assert user.is_active is True
            
            # Cleanup
            session.delete(user)
            session.commit()

    def test_seed_admin_no_duplicate(self):
        """seed_admin_user should not create duplicate user."""
        from app.main import seed_admin_user
        
        os.environ["ADMIN_EMAIL"] = "seed-dup@example.com"
        os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$seedhash"
        
        with Session(engine) as session:
            # Ensure no existing user
            existing = session.exec(
                select(Usuario).where(Usuario.email == "seed-dup@example.com")
            ).first()
            if existing:
                session.delete(existing)
                session.commit()
            
            # First call creates user
            seed_admin_user(session)
            
            # Second call should not create duplicate
            seed_admin_user(session)
            
            # Count users with this email
            users = session.exec(
                select(Usuario).where(Usuario.email == "seed-dup@example.com")
            ).all()
            assert len(users) == 1
            
            # Cleanup
            for user in users:
                session.delete(user)
            session.commit()

    def test_seed_admin_missing_env_vars(self):
        """seed_admin_user should skip if env vars missing."""
        from app.main import seed_admin_user
        
        # Remove env vars
        saved_email = os.environ.pop("ADMIN_EMAIL", None)
        saved_hash = os.environ.pop("ADMIN_PASSWORD_HASH", None)
        
        try:
            with Session(engine) as session:
                # Should not raise, just skip
                seed_admin_user(session)
        finally:
            # Restore env vars
            if saved_email:
                os.environ["ADMIN_EMAIL"] = saved_email
            if saved_hash:
                os.environ["ADMIN_PASSWORD_HASH"] = saved_hash