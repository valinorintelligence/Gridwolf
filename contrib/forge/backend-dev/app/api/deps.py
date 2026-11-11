"""Dependencies that resolve the caller as a `User` row after an explicit permission check.

`Depends(current_user_for("<permission>"))` is the only way a route gets its user: it authenticates the
session cookie, checks the role holds the permission and returns the account. There is no dependency that
authenticates without naming a permission, so a new route cannot be protected by accident-by-omission.
"""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import Principal, require
from app.core.database import get_db
from app.models.user import User


def current_user_for(permission: str):
    requirement = require(permission)

    async def dependency(principal: Principal = Depends(requirement), db: AsyncSession = Depends(get_db)) -> User:
        return await db.get(User, principal.user_id)

    dependency.gw_permission = permission
    return dependency
