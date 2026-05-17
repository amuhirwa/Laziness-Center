"""
Inline service-token verification for the manhwa module.

The Center mints RS256 JWTs (iss=lc-center, aud=manhwa). We fetch the Center's
public key once at startup and verify incoming tokens locally. No LC SDK needed
for Phase 4 — this is ~30 lines of pyjwt + cryptography.
"""
import os
import httpx
import jwt
from jwt.algorithms import RSAAlgorithm

MODULE_ID = "manhwa"
CENTER_INTERNAL_URL = os.environ.get("CENTER_INTERNAL_URL", "http://center:3000")

_public_key = None  # cached CryptoKey after first fetch


async def _fetch_public_key():
    global _public_key
    if _public_key is not None:
        return _public_key
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{CENTER_INTERNAL_URL}/internal/jwks", timeout=5)
        r.raise_for_status()
    _public_key = RSAAlgorithm.from_jwk(r.json())
    return _public_key


async def verify_service_token(authorization: str | None) -> dict | None:
    """
    Returns the decoded JWT payload if valid, None otherwise.
    Validates: RS256 signature, iss == "lc-center", aud == "manhwa", exp not past.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    try:
        public_key = await _fetch_public_key()
        return jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=MODULE_ID,
            issuer="lc-center",
        )
    except (jwt.PyJWTError, Exception):
        return None
