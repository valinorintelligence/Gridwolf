# Security Policy

Gridwolf is a security tool. We take vulnerabilities in our own code seriously
and welcome coordinated disclosure from the community.

---

## Supported Versions

We ship security fixes for the two most recent minor versions.

| Version  | Supported |
| -------- | --------- |
| 1.0.x    | ✅        |
| 0.9.x    | ✅        |
| < 0.9    | ❌        |

---

## Reporting a Vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Report privately via one of:

1. **GitHub Security Advisories** (preferred):
   <https://github.com/valinorintelligence/Gridwolf/security/advisories/new>

2. **Email:** `security@gridwolf.io`
   Encrypt with our PGP key (fingerprint published at
   <https://gridwolf.io/.well-known/security.txt>) if the report contains a
   working exploit or sensitive customer data.

Include, where possible:

- Affected version / commit SHA
- Component (backend, frontend, OVA, deployment template)
- Steps to reproduce
- Impact assessment
- Any suggested mitigation

---

## Response Targets

| Stage                          | Target           |
| ------------------------------ | ---------------- |
| Acknowledgement of report      | within 2 business days |
| Initial triage & severity      | within 5 business days |
| Fix released (High / Critical) | within 30 days   |
| Fix released (Medium / Low)    | next scheduled minor release |
| Public advisory published      | after fix is generally available |

We follow the CVSS v3.1 rubric and request CVE IDs via GitHub for
Medium+ issues.

---

## Scope

**In scope**

- The Gridwolf backend (`backend/`), frontend (`frontend/`), and CLI
- Official container images: `ghcr.io/valinorintelligence/gridwolf-backend`, `ghcr.io/valinorintelligence/gridwolf-frontend`
- Official OVA builds published to GitHub Releases
- Deployment templates under `deploy/aws/`, `deploy/azure/`, and the Helm chart
- First-boot setup scripts under `packer/`

**Out of scope**

- Findings that require physical access to a running appliance
- Denial of service against a single tenant's own instance
- Missing security headers on the marketing site (`landing/`)
- Self-XSS, clickjacking on pages with no sensitive actions
- Vulnerabilities in third-party dependencies already tracked upstream
- Social engineering of Gridwolf employees or customers

---

## Safe Harbour

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction,
  and service disruption
- Only interact with accounts they own or have explicit permission to access
- Give us reasonable time to remediate before public disclosure (typically
  90 days, or until a fix is released, whichever is earlier)
- Do not exploit the issue beyond what is necessary to confirm it

---

## Image Signature Verification

All `gridwolf-backend` and `gridwolf-frontend` images on GHCR tagged `v1.1.0`
or later are signed via [Sigstore cosign](https://docs.sigstore.dev/) using
keyless OIDC — no public key distribution required. Verify before pulling:

```bash
cosign verify ghcr.io/valinorintelligence/gridwolf-backend:1.1.0 \
  --certificate-identity-regexp='^https://github.com/valinorintelligence/Gridwolf' \
  --certificate-oidc-issuer='https://token.actions.githubusercontent.com'
```

Each image also ships SLSA provenance and a CycloneDX SBOM as attestations.

---

## Hardening Guidance for Operators

If you deploy Gridwolf, we recommend:

1. **Rotate `GRIDWOLF_SECRET_KEY`** on first login — this invalidates any
   tokens minted during setup.
2. **Change the auto-generated admin password** immediately after first login.
3. **Restrict `AllowedCidr`** in the AWS/Azure templates to trusted networks.
4. **Enable TLS** via the bundled Nginx config — Gridwolf does not speak
   plaintext HTTP to the internet by design.
5. **Run behind a reverse proxy / WAF** for internet-facing deployments.
6. **Keep images current** — subscribe to release notifications on GitHub.

---

## Credits

Security researchers who report valid issues are acknowledged in
release notes unless they request anonymity.
