import os
import sys
from datetime import datetime, timezone

import pytest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

# Set test environment variables
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-jwt-32-chars-long!"
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$test_hash"

# Use separate test database for auth tests
os.environ["DATABASE_URL"] = "sqlite:///./test_auth.db"

from app.database import create_db_and_tables, engine
from app.models import Usuario
from sqlmodel import Session, select

# Ensure DB tables exist for tests
create_db_and_tables()


class TestUsuarioModel:
    """Tests for Usuario model creation and constraints."""

    def test_create_usuario(self):
        """Usuario should be created with all fields."""
        with Session(engine) as session:
            user = Usuario(
                email="test@example.com",
                hashed_password="$2b$12$hashed",
                role="admin",
                is_active=True,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            
            assert user.id is not None
            assert user.email == "test@example.com"
            assert user.hashed_password == "$2b$12$hashed"
            assert user.role == "admin"
            assert user.is_active is True
            assert user.created_at is not None
            # Cleanup
            session.delete(user)
            session.commit()

    def test_usuario_email_unique(self):
        """Duplicate email should raise IntegrityError."""
        from sqlalchemy.exc import IntegrityError
        
        with Session(engine) as session:
            user1 = Usuario(
                email="unique@example.com",
                hashed_password="$2b$12$hashed1",
                role="admin",
                is_active=True,
            )
            session.add(user1)
            session.commit()
            
            # Try to create second user with same email
            user2 = Usuario(
                email="unique@example.com",
                hashed_password="$2b$12$hashed2",
                role="admin",
                is_active=True,
            )
            session.add(user2)
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
            
            # Cleanup
            session.delete(user1)
            session.commit()

    def test_usuario_default_role(self):
        """Usuario should have default role 'admin'."""
        with Session(engine) as session:
            user = Usuario(
                email="default-role@example.com",
                hashed_password="$2b$12$hashed",
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            
            assert user.role == "admin"
            # Cleanup
            session.delete(user)
            session.commit()

    def test_usuario_default_is_active(self):
        """Usuario should default is_active=True."""
        with Session(engine) as session:
            user = Usuario(
                email="default-active@example.com",
                hashed_password="$2b$12$hashed",
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            
            assert user.is_active is True
            # Cleanup
            session.delete(user)
            session.commit()

    def test_usuario_created_at_auto(self):
        """Usuario created_at should be set automatically."""
        with Session(engine) as session:
            # Clean up any leftover user from previous failed test
            existing = session.exec(select(Usuario).where(Usuario.email == "timestamp@example.com")).first()
            if existing:
                session.delete(existing)
                session.commit()
            
            before = datetime.now(timezone.utc)
            user = Usuario(
                email="timestamp@example.com",
                hashed_password="$2b$12$hashed",
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            after = datetime.now(timezone.utc)
            
            assert user.created_at is not None
            # SQLite stores naive datetimes; compare as naive UTC
            before_naive = before.replace(tzinfo=None)
            after_naive = after.replace(tzinfo=None)
            assert before_naive <= user.created_at <= after_naive
            # Cleanup
            session.delete(user)
            session.commit()