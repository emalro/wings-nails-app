from fastapi import Cookie, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlmodel import Session, select

from .auth import verify_token
from .database import get_session
from .models import Usuario

# Optional bearer token for Authorization header fallback
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    session: Session = Depends(get_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> Usuario:
    """
    Get the current authenticated user from JWT token.
    
    Token can be in:
    1. httpOnly cookie named 'access_token'
    2. Authorization header as Bearer token
    
    Raises:
        HTTPException 401: If token is missing, invalid, or user is inactive.
    """
    token = None
    
    # Try cookie first
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        token = cookie_token
    
    # Fallback to Authorization header
    if not token and credentials:
        token = credentials.credentials
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = verify_token(token, expected_type="access")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get user_id from payload (sub claim is string)
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = session.get(Usuario, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive user")
    
    return user