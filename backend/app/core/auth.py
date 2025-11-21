"""
Authentication and authorization module
"""
import os
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader
from typing import Optional

# API Key from environment variable
API_KEY = os.getenv("API_KEY", "")

# Header-based API key authentication
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> str:
    """
    Verify API key from request header.

    Raises:
        HTTPException: If API key is missing or invalid

    Returns:
        str: The validated API key
    """
    # If no API_KEY is set in environment, skip validation (development mode)
    if not API_KEY:
        return "dev-mode"

    if not api_key:
        raise HTTPException(
            status_code=403,
            detail="Missing API key. Please provide X-API-Key header."
        )

    if api_key != API_KEY:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )

    return api_key


def get_api_key_optional(api_key: Optional[str] = Security(api_key_header)) -> Optional[str]:
    """
    Optional API key validation for endpoints that work with or without auth.

    Returns:
        Optional[str]: The API key if valid, None otherwise
    """
    if not API_KEY:
        return None

    if api_key == API_KEY:
        return api_key

    return None
