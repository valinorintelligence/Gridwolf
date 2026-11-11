"""Test harness only: each test runs in its own event loop, so a PostgreSQL pool cannot outlive a test.
Active only when GW_TEST_DATABASE_URL is set; production code is unchanged."""
import os

if os.environ.get("GW_TEST_DATABASE_URL"):
    import sqlalchemy.ext.asyncio as _sa
    from sqlalchemy.pool import NullPool

    _orig = _sa.create_async_engine

    def _create(*a, **kw):
        kw.setdefault("poolclass", NullPool)
        return _orig(*a, **kw)

    _sa.create_async_engine = _create
