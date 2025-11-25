"""
Authentication and authorization module - Supabase JWT
"""

import os
import httpx
from typing import Optional
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..database import get_db, get_supabase, User
from .config import settings

# Security scheme
security = HTTPBearer(auto_error=False)

# Legacy API Key (optional - for backward compatibility during migration)
LEGACY_API_KEY = os.getenv("API_KEY", "")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Verify JWT token from Supabase and return current user.

    Raises:
        HTTPException: If token is invalid or user not found

    Returns:
        User: The authenticated user object
    """
    # If no credentials provided, check for legacy API key (dev mode)
    if not credentials:
        if LEGACY_API_KEY and not settings.SUPABASE_URL:
            # Dev mode: create a fake user
            return _get_dev_mode_user(db)
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Please provide a valid token."
        )

    token = credentials.credentials

    try:
        # Verify token with Supabase
        supabase = get_supabase()
        if not supabase:
            # If Supabase not configured, fall back to dev mode
            if not settings.SUPABASE_URL:
                return _get_dev_mode_user(db)
            raise HTTPException(
                status_code=503,
                detail="Supabase is not properly configured"
            )
        response = supabase.auth.get_user(token)

        if not response or not response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials"
            )

        user_id = response.user.id
        email = response.user.email

        # Get or create user in database
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            # Auto-create user if not exists (should be handled by trigger but fallback)
            user = User(
                id=user_id,
                email=email,
                google_id=response.user.app_metadata.get("provider_id")
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        return user

    except JWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Could not validate credentials: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}"
        )


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional authentication - returns User if authenticated, None otherwise.
    Useful for endpoints that work with or without auth (e.g., demo mode).

    Returns:
        Optional[User]: User object if authenticated, None otherwise
    """
    if not credentials:
        return None

    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def _get_dev_mode_user(db: Session) -> User:
    """
    Create a development mode user for local testing without Supabase.
    Only works when SUPABASE_URL is not configured.
    """
    dev_user_id = "00000000-0000-0000-0000-000000000000"
    user = db.query(User).filter(User.id == dev_user_id).first()

    if not user:
        user = User(
            id=dev_user_id,
            email="dev@localhost",
            google_id=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user


async def _validate_supabase_jwt(token: str) -> bool:
    """
    Validate Supabase JWT token by making a request to Supabase auth endpoint.
    Works even when Supabase client fails to initialize.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        print("JWT validation: Supabase not configured")
        return False
    
    try:
        # Try using Supabase client first (if it works)
        supabase = get_supabase()
        if supabase:
            try:
                response = supabase.auth.get_user(token)
                if response and response.user:
                    print(f"JWT validation: Valid token for user {response.user.email}")
                    return True
            except Exception as e:
                print(f"JWT validation: Supabase client failed: {e}")
                # Fall through to HTTP validation
        
        # Fallback: Validate via HTTP request to Supabase
        print(f"JWT validation: Trying HTTP validation with Supabase URL: {settings.SUPABASE_URL}")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.SUPABASE_ANON_KEY
                },
                timeout=5.0
            )
            print(f"JWT validation: HTTP response status: {response.status_code}")
            if response.status_code == 200:
                print("JWT validation: Token is valid")
                return True
            else:
                print(f"JWT validation: Token validation failed: {response.text[:200]}")
    except Exception as e:
        print(f"JWT validation error: {e}")
        import traceback
        traceback.print_exc()
    
    return False


async def get_user_id_from_token(token: str) -> Optional[str]:
    """
    Extract user_id from Supabase JWT token.
    Returns user_id if valid, None otherwise.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        return None
    
    try:
        # Try using Supabase client first
        supabase = get_supabase()
        if supabase:
            try:
                response = supabase.auth.get_user(token)
                if response and response.user:
                    return response.user.id
            except Exception:
                pass
        
        # Fallback: Get user_id via HTTP request
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.SUPABASE_ANON_KEY
                },
                timeout=5.0
            )
            if response.status_code == 200:
                user_data = response.json()
                return user_data.get("id")
    except Exception as e:
        print(f"Error extracting user_id from token: {e}")
    
    return None


# Legacy function for backward compatibility - now accepts both JWT and API key
async def verify_api_key(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> str:
    """
    Verify authentication - accepts both JWT tokens (Supabase) and legacy API keys.
    Returns "authenticated" if valid, raises HTTPException if not.
    """
    # If no credentials, check if we're in dev mode
    if not credentials:
        if LEGACY_API_KEY and not settings.SUPABASE_URL:
            # Dev mode without Supabase - allow
            return "dev-mode"
        raise HTTPException(
            status_code=403,
            detail="Missing authentication token"
        )

    token = credentials.credentials

    # First, try to validate as JWT token (Supabase)
    if settings.SUPABASE_URL:
        is_valid = await _validate_supabase_jwt(token)
        if is_valid:
            return "authenticated"

    # Fall back to legacy API key check
    if LEGACY_API_KEY and token == LEGACY_API_KEY:
        return "legacy-mode"

    # If Supabase is configured but token is invalid, be more specific
    if settings.SUPABASE_URL:
        raise HTTPException(
            status_code=403,
            detail="Invalid authentication token. Please sign in again."
        )

    raise HTTPException(
        status_code=403,
        detail="Invalid API key"
    )


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> Optional[str]:
    """
    Extract user_id from JWT token.
    Returns user_id if authenticated, None for dev/legacy mode.
    """
    if not credentials:
        print("[AUTH] get_current_user_id: No credentials provided")
        return None
    
    token = credentials.credentials
    
    # Try to get user_id from Supabase JWT
    if settings.SUPABASE_URL:
        user_id = await get_user_id_from_token(token)
        print(f"[AUTH] get_current_user_id: Extracted user_id: {user_id}")
        if user_id:
            return user_id
    
    # For legacy/dev mode, return None (papers won't be user-specific)
    print("[AUTH] get_current_user_id: Returning None (no Supabase or token invalid)")
    return None
