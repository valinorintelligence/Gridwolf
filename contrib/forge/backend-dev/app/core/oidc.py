"""authentik OpenID Connect client: authorization code flow with PKCE (S256), ID-token validation and the
mapping from authentik groups to a Gridwolf role and site grants.

Nothing here logs tokens, codes, secrets or provider response bodies. A failure is reported as a short
reason code (`OidcError.code`); the HTTP layer maps it to a fixed, non-revealing message.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import secrets
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import httpx
from jose import JWTError, jwt

from app.core.authz import ADMINISTRATOR, ROLES, valid_site
from app.core.config import settings

logger = logging.getLogger("gridwolf.oidc")

ALLOWED_ALGS = ["RS256", "RS384", "RS512", "ES256", "ES384", "PS256"]     # never HS* or none
MFA_AMR = {"mfa", "otp", "hwk", "swk", "webauthn", "totp"}
_DISCOVERY_TTL = 3600.0
_cache: dict = {"disc": None, "disc_at": 0.0, "jwks": None, "jwks_at": 0.0}


class OidcError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _client() -> httpx.AsyncClient:
    verify = settings.OIDC_CA_FILE or True
    return httpx.AsyncClient(timeout=settings.OIDC_HTTP_TIMEOUT_SECONDS, verify=verify, follow_redirects=False)


# Tests replace this to serve a fake issuer without a network.
client_factory = _client


def reset_cache() -> None:
    _cache.update(disc=None, disc_at=0.0, jwks=None, jwks_at=0.0)


def configured() -> bool:
    return bool(settings.OIDC_ENABLED and settings.OIDC_ISSUER and settings.OIDC_CLIENT_ID
                and settings.OIDC_REDIRECT_URI)


async def _get_json(url: str) -> dict:
    try:
        async with client_factory() as c:
            r = await c.get(url)
        if r.status_code != 200:
            raise OidcError("provider_error")
        return r.json()
    except OidcError:
        raise
    except Exception:
        raise OidcError("provider_error")


async def discovery() -> dict:
    now = time.monotonic()
    if _cache["disc"] and now - _cache["disc_at"] < _DISCOVERY_TTL:
        return _cache["disc"]
    issuer = settings.OIDC_ISSUER
    doc = await _get_json(issuer.rstrip("/") + "/.well-known/openid-configuration")
    if doc.get("issuer") != issuer:
        raise OidcError("provider_error")                      # issuer mix-up protection
    for key in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
        if not str(doc.get(key, "")).startswith(("https://", "http://127.0.0.1", "http://localhost")):
            raise OidcError("provider_error")
    _cache.update(disc=doc, disc_at=now)
    return doc


async def _jwks(force: bool = False) -> dict:
    now = time.monotonic()
    if not force and _cache["jwks"] and now - _cache["jwks_at"] < _DISCOVERY_TTL:
        return _cache["jwks"]
    keys = await _get_json((await discovery())["jwks_uri"])
    _cache.update(jwks=keys, jwks_at=now)
    return keys


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode()
    return verifier, challenge


async def authorization_url(state: str, nonce: str, challenge: str) -> str:
    disc = await discovery()
    query = urlencode({
        "response_type": "code", "client_id": settings.OIDC_CLIENT_ID, "redirect_uri": settings.OIDC_REDIRECT_URI,
        "scope": settings.OIDC_SCOPES, "state": state, "nonce": nonce,
        "code_challenge": challenge, "code_challenge_method": "S256"})
    return disc["authorization_endpoint"] + ("&" if "?" in disc["authorization_endpoint"] else "?") + query


async def exchange_code(code: str, verifier: str) -> dict:
    disc = await discovery()
    data = {"grant_type": "authorization_code", "code": code, "redirect_uri": settings.OIDC_REDIRECT_URI,
            "client_id": settings.OIDC_CLIENT_ID, "code_verifier": verifier}
    secret = settings.oidc_client_secret()
    if secret:
        data["client_secret"] = secret
    try:
        async with client_factory() as c:
            r = await c.post(disc["token_endpoint"], data=data)
        if r.status_code != 200:
            raise OidcError("exchange_failed")
        body = r.json()
    except OidcError:
        raise
    except Exception:
        raise OidcError("provider_error")
    if not isinstance(body, dict) or "id_token" not in body:
        raise OidcError("exchange_failed")
    return body


async def validate_id_token(id_token: str, nonce: str, access_token: Optional[str]) -> dict:
    try:
        header = jwt.get_unverified_header(id_token)
    except JWTError:
        raise OidcError("token_invalid")
    alg, kid = header.get("alg"), header.get("kid")
    if alg not in ALLOWED_ALGS:
        raise OidcError("token_invalid")
    keys = await _jwks()
    key = next((k for k in keys.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        key = next((k for k in (await _jwks(force=True)).get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        raise OidcError("token_invalid")
    try:
        # python-jose rejects an access_token when the ID token has no at_hash, so bind it only when asserted.
        bind = access_token if "at_hash" in jwt.get_unverified_claims(id_token) else None
        claims = jwt.decode(
            id_token, key, algorithms=ALLOWED_ALGS, audience=settings.OIDC_CLIENT_ID, issuer=settings.OIDC_ISSUER,
            access_token=bind,
            options={"leeway": settings.OIDC_CLOCK_SKEW_SECONDS, "require_exp": True, "require_iat": True,
                     "require_sub": True, "require_aud": True, "require_iss": True})
    except JWTError:
        raise OidcError("token_invalid")
    if not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
        raise OidcError("token_invalid")
    aud = claims.get("aud")
    if isinstance(aud, list) and len(aud) > 1 and claims.get("azp") != settings.OIDC_CLIENT_ID:
        raise OidcError("token_invalid")
    if not isinstance(claims.get("sub"), str) or not claims["sub"] or len(claims["sub"]) > 255:
        raise OidcError("token_invalid")
    return claims


@dataclass(frozen=True)
class Grants:
    groups: tuple
    mfa: bool


def groups_of(claims: dict) -> list[str]:
    value = claims.get(settings.OIDC_GROUP_CLAIM, [])
    if isinstance(value, str):
        value = [value]
    return [g for g in value if isinstance(g, str)] if isinstance(value, list) else []


def map_grants(claims: dict) -> Grants:
    """The directory groups and MFA assertion of a validated ID token. What the groups mean (platform, per-site
    role) is decided per request by `services.sites.resolve_access` from the registry, never here."""
    from app.services.sites import keep_groups
    amr = claims.get("amr", [])
    mfa = bool(MFA_AMR & set(amr)) if isinstance(amr, list) else False
    return Grants(groups=tuple(keep_groups(groups_of(claims))), mfa=mfa)
