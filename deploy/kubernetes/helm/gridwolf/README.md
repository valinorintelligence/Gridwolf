# Gridwolf Helm Chart

Deploy [Gridwolf](https://github.com/valinorintelligence/Gridwolf) — a
passive ICS/OT security platform — to Kubernetes.

## TL;DR

```bash
helm install gridwolf ./deploy/kubernetes/helm/gridwolf \
  --namespace gridwolf --create-namespace \
  --set ingress.hosts[0].host=gridwolf.example.com
```

## Prerequisites

- Kubernetes 1.25+
- Helm 3.10+
- A default `StorageClass` (or set `persistence.storageClass`)
- An Ingress controller (nginx-ingress, Traefik, etc.) if `ingress.enabled=true`

## Install

```bash
# Default (bundled Postgres + Redis, SPA exposed via Ingress on gridwolf.local)
helm install gridwolf ./deploy/kubernetes/helm/gridwolf \
  -n gridwolf --create-namespace

# Production-style (external Postgres, TLS, custom hostname)
helm install gridwolf ./deploy/kubernetes/helm/gridwolf \
  -n gridwolf --create-namespace \
  --set postgresql.host=pg.prod.internal \
  --set postgresql.username=gridwolf \
  --set ingress.hosts[0].host=gridwolf.acme.com \
  --set-string ingress.tls[0].secretName=gridwolf-tls \
  --set ingress.tls[0].hosts[0]=gridwolf.acme.com
```

## Retrieving the admin password

On first install Gridwolf creates an admin user and prints the password to
container stdout. Fetch it:

```bash
kubectl -n gridwolf logs deploy/gridwolf-backend | grep -A1 "Password"
```

Log in at the Ingress host, change the password, then rotate
`GRIDWOLF_SECRET_KEY` to invalidate the bootstrap token.

## Upgrading

```bash
helm upgrade gridwolf ./deploy/kubernetes/helm/gridwolf -n gridwolf
```

Rolling updates use `maxUnavailable: 0` so the API stays reachable during
upgrade.

## Uninstalling

```bash
helm uninstall gridwolf -n gridwolf
```

**Warning:** the PVCs backing Postgres and `/data` are **not** deleted
automatically. Remove them manually if you really want the data gone:

```bash
kubectl -n gridwolf delete pvc -l app.kubernetes.io/part-of=gridwolf
```

## Values reference

See [`values.yaml`](./values.yaml) — every option is documented inline.

Common overrides:

| Key                              | Default             | Description |
| -------------------------------- | ------------------- | ----------- |
| `image.tag`                      | `1.0.0`             | Image tag for both backend + frontend |
| `backend.replicaCount`           | `1`                 | Scale horizontally if you use external Postgres |
| `frontend.replicaCount`          | `2`                 | |
| `persistence.size`               | `20Gi`              | Backend `/data` (uploads + reports) |
| `postgresql.enabled`             | `true`              | Set false + supply `postgresql.host` for external DB |
| `secrets.createSecret`           | `true`              | Set false + supply `secrets.existingSecret` for ESO / Vault |
| `ingress.enabled`                | `true`              | |
| `ingress.hosts[0].host`          | `gridwolf.local`    | |

## Production recommendations

1. **Use a managed Postgres** (RDS, Azure DB for PostgreSQL, Cloud SQL).
2. **Use External Secrets Operator** or **Sealed Secrets** — do not let
   Helm generate your `GRIDWOLF_SECRET_KEY`.
3. **Enable TLS** on the Ingress with cert-manager.
4. **Set resource requests/limits** appropriate to your PCAP throughput.
5. **Enable NetworkPolicy** (`networkPolicy.enabled=true`) to lock down
   east-west traffic.
