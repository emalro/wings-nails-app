import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlmodel import Session, select

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

# Set test environment variables
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-jwt-32-chars-long!"
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$test_hash"
os.environ["DATABASE_URL"] = "sqlite:///./test_deps.db"

from app.auth import create_access_token, create_refresh_token
from app.database import create_db_and_tables, engine
from app.models import Usuario
from app.deps import get_current_user

# Ensure DB tables exist for tests
create_db_and_tables()

# Create a test app with a protected route
test_app = FastAPI()


@test_app.get("/protected")
async def protected_route(user: Usuario = Depends(get_current_user)):
    return {"email": user.email, "role": user.role}


client = TestClient(test_app)


def setup_test_user():
    """Create a test user in the database."""
    with Session(engine) as session:
        # Delete existing test user
        existing = session.exec(
            select(Usuario).where(Usuario.email == "test@example.com")
        ).first()
        if existing:
            session.delete(existing)
            session.commit()
        
        user = Usuario(
            email="test@example.com",
            hashed_password="$2b$12$hashed",
            role="admin",
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id


class TestGetCurrentUser:
    """Tests for get_current_user dependency."""

    @pytest.fixture(autouse=True)
    def setup_user(self):
        self.user_id = setup_test_user()
        yield
        # Cleanup after each test
        with Session(engine) as session:
            user = session.get(Usuario, self.user_id)
            if user:
                session.delete(user)
                session.commit()

    def test_valid_token_in_cookie(self):
        """Should return user when valid access token is in cookie."""
        token = create_access_token(self.user_id)
        response = client.get("/protected", cookies={"access_token": token})
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["role"] == "admin"

    def test_valid_token_in_authorization_header(self):
        """Should return user when valid access token is in Authorization header."""
        token = create_access_token(self.user_id)
        response = client.get(
            "/protected",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["role"] == "admin"

    def test_missing_token(self):
        """Should return 401 when no token is provided."""
        response = client.get("/protected")
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_invalid_token(self):
        """Should return 401 when token is invalid."""
        response = client.get(
            "/protected",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token"

    def test_expired_token(self):
        """Should return 401 when token is expired."""
        from jose import jwt
        
        expired_payload = {
            "sub": str(self.user_id),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "type": "access",
        }
        expired_token = jwt.encode(
            expired_payload, os.environ["JWT_SECRET_KEY"], algorithm="HS256"
        )
        response = client.get(
            "/protected",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token"

    def test_wrong_token_type(self):
        """Should return 401 when using refresh token for access."""
        token = create_refresh_token(self.user_id)
        response = client.get(
            "/protected",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token"

    def test_inactive_user(self):
        """Should return 401 when user is inactive."""
        # Create inactive user
        with Session(engine) as session:
            user = Usuario(
                email="inactive@example.com",
                hashed_password="$2b$12$hashed",
                role="admin",
                is_active=False,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            inactive_id = user.id
        
        token = create_access_token(inactive_id)
        response = client.get(
            "/protected",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Inactive user"
        
        # Cleanup
        with Session(engine) as session:
            user = session.get(Usuario, inactive_id)
            if user:
                session.delete(user)
                session.commit()