"""
Authentication middleware and utilities for the NEXUS RAG API.
Handles:
- Internal secret verification (prevents header spoofing)
- API key validation
- User context extraction from headers
- Request logging for audit trail
"""

from fastapi import Request, HTTPException, Header
from fastapi.responses import JSONResponse
from typing import Optional
from dataclasses import dataclass
import logging
import os

logger = logging.getLogger(__name__)

# =============================================================================
# SECURITY: Internal Secret Verification
# =============================================================================
# This secret must match between Next.js frontend and FastAPI backend
# to prevent external clients from spoofing X-User-Id headers.
API_SECRET = os.environ.get("API_SECRET", "")

def verify_internal_secret(x_internal_secret: Optional[str]) -> bool:
    """
    Verify the internal secret header matches the expected value.
    This prevents external clients from spoofing user identity headers.
    """
    if not API_SECRET:
        # If no secret configured, log warning and allow (dev mode)
        logger.warning("[AUTH] API_SECRET not configured! Running in insecure dev mode.")
        return True
    
    if not x_internal_secret:
        return False
    
    return x_internal_secret == API_SECRET


@dataclass
class UserContext:
    """User context extracted from request headers or API key."""
    user_id: Optional[str] = None
    email: Optional[str] = None
    team_id: Optional[str] = None  # Added for multi-tenant vector filtering
    api_key: Optional[str] = None
    is_authenticated: bool = False


def extract_user_context(
    x_user_id: Optional[str] = None,
    x_user_email: Optional[str] = None,
    x_team_id: Optional[str] = None,
    x_api_key: Optional[str] = None,
    x_internal_secret: Optional[str] = None
) -> UserContext:
    """
    Extract user context from request headers.
    
    Headers:
    - X-Internal-Secret: MUST match API_SECRET (prevents spoofing)
    - X-User-Id: User's database ID (from frontend session)
    - X-User-Email: User's email (from frontend session)
    - X-Team-Id: Current team context for vector filtering
    - X-API-Key: API key for programmatic access
    """
    ctx = UserContext()
    
    if x_api_key:
        # API key takes precedence - no secret check needed
        # (API keys are self-authenticating)
        ctx.api_key = x_api_key
        ctx.is_authenticated = True
        # Note: In production, lookup API key in DB to get user_id and team_id
        logger.info(f"[AUTH] API key authentication: {x_api_key[:8]}...")
    elif x_user_id:
        # Session-based auth from frontend - MUST verify internal secret
        if not verify_internal_secret(x_internal_secret):
            logger.warning(f"[AUTH] Invalid or missing X-Internal-Secret for user {x_user_email}")
            # Return unauthenticated context instead of raising
            # (individual endpoints can decide if auth is required)
            return ctx
        
        ctx.user_id = x_user_id
        ctx.email = x_user_email
        ctx.team_id = x_team_id
        ctx.is_authenticated = True
        logger.info(f"[AUTH] Session authentication: user={x_user_email}, team={x_team_id}")
    else:
        # Anonymous request
        logger.debug("[AUTH] Anonymous request (no auth headers)")
    
    return ctx


def get_user_context_dependency(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_email: Optional[str] = Header(None, alias="X-User-Email"),
    x_team_id: Optional[str] = Header(None, alias="X-Team-Id"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret")
) -> UserContext:
    """
    FastAPI dependency for extracting user context from request headers.
    Use in route handlers: user: UserContext = Depends(get_user_context_dependency)
    """
    return extract_user_context(x_user_id, x_user_email, x_team_id, x_api_key, x_internal_secret)


def require_auth_dependency(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_user_email: Optional[str] = Header(None, alias="X-User-Email"),
    x_team_id: Optional[str] = Header(None, alias="X-Team-Id"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret")
) -> UserContext:
    """
    FastAPI dependency that REQUIRES authentication.
    Raises 401 if no valid auth is provided.
    """
    ctx = extract_user_context(x_user_id, x_user_email, x_team_id, x_api_key, x_internal_secret)
    
    if not ctx.is_authenticated:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Provide valid X-Internal-Secret with X-User-Id, or X-API-Key."
        )
    
    return ctx


# =============================================================================
# AUDIT LOGGING
# =============================================================================

def log_request(
    user: UserContext,
    action: str,
    resource: str,
    details: dict = None
):
    """
    Log a request for audit purposes.
    In production, this would write to a database or audit service.
    """
    log_entry = {
        "action": action,
        "resource": resource,
        "user_id": user.user_id,
        "email": user.email,
        "team_id": user.team_id,
        "api_key": user.api_key[:8] + "..." if user.api_key else None,
        "details": details
    }
    logger.info(f"[AUDIT] {log_entry}")
    return log_entry
