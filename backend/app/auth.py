import os
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
# SECRET_KEY is read at module-import time. The lifespan check in
# app.main validates the env var (presence + 32-byte minimum) before
# any endpoint is reachable, so SECRET_KEY is guaranteed non-empty here
# at runtime. We deliberately do NOT default to "" because python-jose
# would happily sign tokens with an empty key — see B-5.
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

MIN_SECRET_KEY_BYTES = 32


def get_password_hash(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: int) -> str:
    """Create a short-lived access token (30 minutes)."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """Create a long-lived refresh token (7 days)."""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str, expected_type: str) -> dict[str, Any]:
    """
    Decode and verify a JWT token.
    
    Args:
        token: The JWT token string.
        expected_type: Expected token type ('access' or 'refresh').
    
    Returns:
        The decoded payload dict.
    
    Raises:
        JWTError: If token is invalid, expired, or type mismatches.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        raise e

    # Verify token type
    token_type = payload.get("type")
    if token_type != expected_type:
        raise JWTError(f"Invalid token type: expected {expected_type}, got {token_type}")
    
    return payload