# FORGE source checkpoint — November 11, 2026

This directory preserves source-only FORGE development work against the Gridwolf
fork. It is **not an integrated release, deployment bundle, production acceptance,
or replacement for the stock application at the repository root**. No release
version is assigned by this checkpoint. Existing upstream licensing is retained.

## Contents

| Path | Scope |
| --- | --- |
| backend-dev | Backend source: opaque cookie sessions, CSRF, OIDC/PKCE, scoped roles, site registry, service credentials, reporting/export and passive telemetry processing |
| tests | Synthetic engine, API, authorization, session and multi-site regression tests and their two local helpers |
| bridge/ui/frontend | Editable frontend extension modules and styles |
| bridge/ui/build_frontend.py | Transform against a pinned compiled upstream frontend tree |
| bridge/tests/compliance_mapping.test.mjs | Static compliance mapping checks |

The stock backend/frontend, Dockerfiles, root configuration and existing tests
remain unchanged. The stock frontend is **not compatible by assertion** with this
checkpoint's cookie/CSRF backend: end-to-end integration is still required.

The frontend transform relies on exact retained upstream chunk names and text.
It fails when expected patch targets differ. Those compiled inputs are deliberately
not included, and compatibility with this fork's current source build is not
verified. The editable extensions are not a full replacement TypeScript frontend.

## Publication boundary

Only explicitly selected application source, configuration schema, frontend
extension source and synthetic regression tests are included. Real deployment
configuration, identity-provider state, credentials, private keys/PKI, topology,
databases, captures, uploads, generated reports, container images, screenshots,
release evidence and operational logs are excluded.

Canonical site and legacy alias examples have been replaced consistently with
`example-lab` and `legacy-example-lab`. These are examples, not customer records.
Synthetic private-address fixtures and algorithmic private-network ranges remain
where necessary to test protocol parsing and detection. Test passwords and keys
are explicitly synthetic and must never be used in a deployment. Existing FORGE
API/schema and authorization-group identifiers are retained as software contracts.

The ignore rules are defense in depth, not a substitute for reviewing every staged
path and its contents. No original runtime collection or local repository history
is imported into this fork.

## Checks witnessed for this checkpoint

- 110 synthetic backend/API/authorization/multi-site tests passed using an existing
  Python 3.14.9 environment, in a disposable copy with no network, cleared
  environment and read-only host filesystem. No dependencies were installed.
- 2 frontend compliance mapping tests passed in network isolation.
- JavaScript syntax checks passed for all included JavaScript test/source files.
- Copied Python source parsed; site-identity sanitization was checked against
  normalized original syntax trees.

The initial read-only-source test run failed during collection because the PCAP
API creates a backend-relative uploads directory on import. The successful run
used a disposable copy rather than weakening host protections or changing that
behavior. Deprecation warnings remain for FastAPI query/response APIs and httpx
cookie handling. These checks do not certify every advertised Python version,
PostgreSQL operation, database migration, browser workflow, live OIDC provider,
native PDF generation or deployment readiness.

For isolated tests, set `GW_BACKEND_DIR` to the checkpoint's backend-dev directory
and run the four test modules under tests with pytest. Do not inherit deployment
environment variables; `GW_TEST_DATABASE_URL` can otherwise select an external
database. Tests create disposable synthetic captures and database records. The
frontend compliance test runs with Node's built-in test runner; it needs no npm
installation. Use a disposable working copy because imports can create directories.

## Known integration work and limits

- Provide a source-based frontend build compatible with the stock fork and retain
  the cookie/session/CSRF contract; do not restore browser-stored bearer tokens to
  make integration easier.
- Review migration behavior for existing databases. New SQLAlchemy definitions and
  bootstrap logic are not proof that existing installations migrate safely; no
  versioned migration revisions are included here.
- OIDC is optional and local login remains configurable in this source checkpoint.
  This does not authorize changing an existing authentik-only deployment policy.
- Multi-site authorization has synthetic regression coverage, not live tenant
  isolation certification. Single-site UI defaults do not replace backend scope
  enforcement.
- Reporting/export code is preserved; PDF dependencies are optional, and no native
  browser/PDF acceptance is claimed. Live capture is not accepted or deployed by
  this checkpoint.
- Passive observation boundaries remain: this checkpoint does not authorize
  scanning, injection, automatic blocking, quarantine or remediation.
