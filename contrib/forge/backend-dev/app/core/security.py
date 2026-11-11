from __future__ import annotations

import hashlib
import hmac
import secrets

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Stored for accounts that sign in only through authentik: it is not a bcrypt hash, so no password matches.
UNUSABLE_PASSWORD = "!"
_DUMMY_HASH = pwd_context.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str | None) -> bool:
    """Constant-effort check. An absent or unusable hash still costs one bcrypt verification."""
    if not hashed or not hashed.startswith("$2"):
        pwd_context.verify(plain, _DUMMY_HASH)
        return False
    try:
        return pwd_context.verify(plain, hashed)
    except ValueError:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def safe_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))
