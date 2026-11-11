from __future__ import annotations
import logging
import secrets
import sys
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    APP_NAME: str = "Gridwolf"
    APP_VERSION: str = "1.2.0"
    DEBUG: bool = False
    DATABASE_URL: str = "sqlite+aiosqlite:///./gridwolf.db"
    DATABASE_URL_FILE: str = ""            # mounted secret: the URL carries the database password
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = ""
    SECRET_KEY_FILE: str = ""              # mounted secret; takes precedence over SECRET_KEY
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ]
    NVD_API_KEY: str = ""
    # --- Authentication (AUDIT-35) -------------------------------------------------------------
    # Human sign-in is authentik OIDC (authorization code + PKCE). Sessions are backend-managed: the
    # browser holds only an opaque, HttpOnly cookie; roles and sites come from authentik groups at
    # sign-in and are stored with the server-side session.
    OIDC_ENABLED: bool = False
    OIDC_ISSUER: str = ""                      # authentik issuer, e.g. https://<host>/application/o/<slug>/
    OIDC_CLIENT_ID: str = ""
    OIDC_CLIENT_SECRET: str = ""               # prefer OIDC_CLIENT_SECRET_FILE; blank = public client (PKCE only)
    OIDC_CLIENT_SECRET_FILE: str = ""
    OIDC_REDIRECT_URI: str = ""                # https://<gridwolf host>/api/v1/auth/oidc/callback
    OIDC_SCOPES: str = "openid profile email"
    OIDC_CA_FILE: str = ""                     # public CA bundle that signs the authentik certificate
    OIDC_GROUP_CLAIM: str = "groups"
    OIDC_REQUIRE_MFA: bool = False             # require an "otp"/"mfa" entry in the ID token amr claim
    OIDC_END_SESSION_ON_LOGOUT: bool = False   # also end the authentik session when signing out of Gridwolf
    OIDC_CLOCK_SKEW_SECONDS: int = 60
    OIDC_HTTP_TIMEOUT_SECONDS: float = 8.0
    # authentik entitlement groups. `FORGE-GW-PlatformAdmin` makes a Platform Administrator;
    # `FORGE-GW-<site>-<SiteAdmin|Analyst|OTEngineer|Viewer|ReportViewer|HealthViewer>` grants that role at that
    # registered, active site only. Team groups (`FORGE-Team-*`) grant nothing by themselves. A user whose
    # groups and bindings give no role anywhere is denied (no default role).
    GROUP_PREFIX: str = "FORGE-GW-"
    PLATFORM_GROUP: str = "FORGE-GW-PlatformAdmin"
    TEAM_GROUP_PREFIX: str = "FORGE-Team-"
    # Only accounts an administrator has registered may sign in; a valid authentik identity alone is never
    # enough, and there is no setting that creates accounts automatically.

    SESSION_COOKIE_NAME: str = "gw_session"
    COOKIE_SECURE: bool = True                 # set false only for http://127.0.0.1 development
    SESSION_IDLE_MINUTES: int = 30
    SESSION_ABSOLUTE_MINUTES: int = 480        # local sessions; also the cookie lifetime
    OIDC_CLAIMS_MAX_AGE_MINUTES: int = 15      # an SSO session's groups are re-read from authentik this often: the
                                               # session ends and the browser signs in again silently
    TRUSTED_ORIGINS: list[str] = []            # extra browser origins allowed to make state-changing requests

    # Local password sign-in (the pre-existing accounts) stays available until the operator approves the
    # OIDC migration; then set false. Recovery: see f4-retained/AUTH-RECOVERY.md.
    LOCAL_LOGIN_ENABLED: bool = True
    LOCAL_LOGIN_MAX_FAILURES: int = 5
    LOCAL_LOGIN_LOCKOUT_MINUTES: int = 15

    # Optional persistent cache for the advisory feed (advisories, dispositions, refresh status)
    FEED_CACHE_FILE: str = "./data/vuln-feed-cache.json"
    UPLOAD_DIR: str = "./uploads"
    REPORTS_DIR: str = "./reports"

    # First-run admin account (created automatically only if no users exist). The password is read from
    # ADMIN_PASSWORD_FILE (a mounted secret) or ADMIN_PASSWORD; if neither is set a random one is written to
    # BOOTSTRAP_PASSWORD_FILE (mode 0600). It is never printed or logged. After the first start the variable
    # is no longer needed and should be removed from the container environment.
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@gridwolf.local"
    ADMIN_PASSWORD: str = ""
    ADMIN_PASSWORD_FILE: str = ""
    BOOTSTRAP_PASSWORD_FILE: str = "./data/bootstrap-admin-password"

    def model_post_init(self, __context) -> None:
        # File-based secrets keep the values out of `docker inspect`, the compose file and the process
        # environment. A named file that cannot be read is fatal, never silently replaced by a default.
        for plain, filename in (("SECRET_KEY", self.SECRET_KEY_FILE), ("DATABASE_URL", self.DATABASE_URL_FILE)):
            if filename:
                value = self._read_secret_file(filename)
                if not value:
                    print("\n[GRIDWOLF] FATAL: GRIDWOLF_%s_FILE is set but unreadable or empty.\n" % plain,
                          file=sys.stderr)
                    sys.exit(1)
                setattr(self, plain, value)
        if not self.SECRET_KEY:
            if not self.DEBUG:
                # Production: refuse to start with an auto-generated key.
                # Sessions would be invalidated every restart and the key
                # provides no real security if never explicitly set.
                print(
                    "\n[GRIDWOLF] FATAL: GRIDWOLF_SECRET_KEY is not set.\n"
                    '  Generate one with:  python -c "import secrets; print(secrets.token_urlsafe(64))"\n'
                    "  Then set it in your .env file or environment before starting.\n",
                    file=sys.stderr,
                )
                sys.exit(1)
            # Development only: auto-generate and warn loudly.
            self.SECRET_KEY = secrets.token_urlsafe(64)
            logger.warning(
                "GRIDWOLF_SECRET_KEY not set — auto-generated for this process only. "
                "All sessions will be invalidated on restart. "
                "Set GRIDWOLF_SECRET_KEY explicitly for any persistent deployment."
            )

    model_config = {"env_prefix": "GRIDWOLF_", "env_file": ".env"}

    @staticmethod
    def _read_secret_file(path: str) -> str:
        try:
            with open(path, encoding="utf-8") as f:
                return f.read().strip()
        except OSError:
            logger.error("secret file %s could not be read", path)   # path only, never contents
            return ""

    def oidc_client_secret(self) -> str:
        return self._read_secret_file(self.OIDC_CLIENT_SECRET_FILE) if self.OIDC_CLIENT_SECRET_FILE \
            else self.OIDC_CLIENT_SECRET

    def admin_password(self) -> str:
        return self._read_secret_file(self.ADMIN_PASSWORD_FILE) if self.ADMIN_PASSWORD_FILE \
            else self.ADMIN_PASSWORD

    def allowed_origins(self) -> set[str]:
        from urllib.parse import urlsplit
        out = {o.rstrip("/") for o in list(self.TRUSTED_ORIGINS) + list(self.CORS_ORIGINS)}
        if self.OIDC_REDIRECT_URI:
            u = urlsplit(self.OIDC_REDIRECT_URI)
            if u.scheme and u.netloc:
                out.add("%s://%s" % (u.scheme, u.netloc))
        return out


settings = Settings()
