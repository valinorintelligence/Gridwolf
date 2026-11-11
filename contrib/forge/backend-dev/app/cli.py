"""Operator tool for account provisioning and recovery. Run inside the backend container:

    python -m app.cli list-users
    python -m app.cli register-user --username NAME --email ADDR --role administrator [--site SITE ...] \
                                    [--oidc-subject SUB] [--password-stdin]
    python -m app.cli set-password --username NAME            (reads the new password from stdin)
    python -m app.cli set-sites --username NAME --role ROLE --site SITE ...   (ROLE held at exactly these sites)
    python -m app.cli site-list
    python -m app.cli site-create --id SLUG --name NAME [--template lab|site] [--alias SOURCE_ID ...]
    python -m app.cli deactivate|activate --username NAME
    python -m app.cli revoke-sessions --username NAME
    python -m app.cli service-create --name NAME --site SITE ... [--permission view|export|ingest ...] [--days N]
    python -m app.cli service-list
    python -m app.cli service-revoke --name NAME

Passwords are only ever read from stdin or a prompt, never from arguments or the environment, and are
never printed. The CLI works with the database directly, so it is the recovery path when no administrator
can sign in (see AUTH-RECOVERY.md).
"""
from __future__ import annotations

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select


def _password(args) -> str | None:
    if getattr(args, "password_stdin", False):
        value = sys.stdin.readline().rstrip("\n")
    elif getattr(args, "prompt_password", False):
        value = getpass.getpass("New password: ")
    else:
        return None
    if len(value) < 12:
        sys.exit("password must be at least 12 characters")
    return value


async def run(args) -> int:
    from app.core.database import async_session_factory, init_db
    from app.core.security import hash_password
    from app.models.auth import IdentityLink
    from app.models.user import User
    from app.services.identity import register_user, set_user_sites
    from app.services.sessions import audit, revoke_user_sessions

    await init_db()
    async with async_session_factory() as db:
        async def find() -> User:
            u = (await db.execute(select(User).where(User.username == args.username))).scalar_one_or_none()
            if u is None:
                sys.exit("no such user")
            return u

        if args.cmd == "list-users":
            for u in (await db.execute(select(User).order_by(User.username))).scalars():
                linked = (await db.execute(select(IdentityLink).where(IdentityLink.user_id == u.id))).first()
                print("%-24s %-18s %-8s %s" % (u.username, u.role, "active" if u.is_active else "disabled",
                                               "oidc-linked" if linked else "not linked"))
        elif args.cmd == "register-user":
            u = await register_user(db, username=args.username, email=args.email, role=args.role,
                                    sites=args.site or [], oidc_subject=args.oidc_subject, password=_password(args))
            await audit(db, "user_registered", "ok", "cli", detail="registered %s role=%s" % (u.username, u.role))
            print("registered", u.username)
        elif args.cmd == "set-password":
            u = await find()
            u.hashed_password = hash_password(_password(args) or sys.exit("use --password-stdin or --prompt-password"))
            await db.commit()
            await revoke_user_sessions(db, u.id, "password reset by operator")
            await audit(db, "user_updated", "ok", "cli", u.id, "password reset for %s" % u.username)
            print("password updated for", u.username)
        elif args.cmd == "set-sites":
            u = await find()
            print("sites:", ", ".join(await set_user_sites(db, u.id, args.site or [], args.role, actor="cli")) or "(none)")
        elif args.cmd == "site-list":
            from app.services.sites import list_sites
            for x in await list_sites(db, include_all=True):
                print("%-20s %-10s %-24s aliases=%s" % (x["id"], x["status"], x["name"], ",".join(x["aliases"]) or "-"))
        elif args.cmd == "site-create":
            from app.services.sites import create_site
            site = await create_site(db, "cli", site_id=args.id, name=args.name, template=args.template,
                                     aliases=args.alias or [])
            print("registered site", site.id)
        elif args.cmd in ("deactivate", "activate"):
            u = await find()
            u.is_active = args.cmd == "activate"
            await db.commit()
            if not u.is_active:
                await revoke_user_sessions(db, u.id, "deactivated by operator")
            await audit(db, "user_updated", "ok", "cli", u.id, "%s %s" % (args.cmd, u.username))
            print(args.cmd + "d", u.username)
        elif args.cmd == "revoke-sessions":
            u = await find()
            print("revoked", await revoke_user_sessions(db, u.id, "revoked by operator"), "session(s)")
        elif args.cmd == "service-create":
            from app.services.credentials import CredentialError, create_credential
            try:
                token, cred = await create_credential(db, name=args.name, permissions=args.permission or ["view"],
                                                      sites=args.site or [], lifetime_days=args.days, created_by="cli")
            except CredentialError as exc:
                sys.exit(str(exc))
            print("created %s (expires %s); the token is shown once:" % (cred.name, cred.expires_at.date()), file=sys.stderr)
            print(token)
        elif args.cmd == "service-list":
            from app.models.auth import ServiceCredential
            from app.services.credentials import describe
            for c in (await db.execute(select(ServiceCredential).order_by(ServiceCredential.name))).scalars():
                d = describe(c)
                print("%-28s %-8s %-18s sites=%s expires=%s last_used=%s" % (
                    d["name"], d["state"], ",".join(d["permissions"]), ",".join(d["sites"]), d["expires_at"][:10],
                    (d["last_used_at"] or "never")[:19]))
        elif args.cmd == "service-revoke":
            from app.models.auth import ServiceCredential
            from app.services.credentials import revoke_credential
            row = (await db.execute(select(ServiceCredential).where(ServiceCredential.name == args.name))).scalar_one_or_none()
            if row is None:
                sys.exit("no such credential")
            await revoke_credential(db, row.id, "cli", "revoked by operator")
            print("revoked", row.name)
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list-users")
    r = sub.add_parser("register-user")
    r.add_argument("--username", required=True)
    r.add_argument("--email", required=True)
    r.add_argument("--role", required=True)
    r.add_argument("--site", action="append")
    r.add_argument("--oidc-subject")
    r.add_argument("--password-stdin", action="store_true")
    r.add_argument("--prompt-password", action="store_true")
    for name in ("set-password",):
        p = sub.add_parser(name)
        p.add_argument("--username", required=True)
        p.add_argument("--password-stdin", action="store_true")
        p.add_argument("--prompt-password", action="store_true")
    p = sub.add_parser("set-sites")
    p.add_argument("--username", required=True)
    p.add_argument("--role", required=True)
    p.add_argument("--site", action="append")
    sub.add_parser("site-list")
    p = sub.add_parser("site-create")
    p.add_argument("--id", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--template", default="site")
    p.add_argument("--alias", action="append")
    for name in ("deactivate", "activate", "revoke-sessions"):
        sub.add_parser(name).add_argument("--username", required=True)
    p = sub.add_parser("service-create")
    p.add_argument("--name", required=True)
    p.add_argument("--site", action="append")
    p.add_argument("--permission", action="append")
    p.add_argument("--days", type=int, default=30)
    sub.add_parser("service-list")
    sub.add_parser("service-revoke").add_argument("--name", required=True)
    return asyncio.run(run(ap.parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main())
