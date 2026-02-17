# Platform Infrastructure Steering Document

**Status:** Authoritative  
**Applies to:** Backend deployment, containerization, and GCP infrastructure  
**Owner:** Development Team

---

## 1. Deployment Topology

The application deploys on Google Cloud Platform:

- **Frontend**: Firebase Hosting (CDN, SPA rewrites, static assets)
- **Backend**: Cloud Run (Node.js 22, Express, 512Mi / 1 vCPU, 0-10 instances)
- **Data**: Firestore (snapshots, config, rankings) + Cloud Storage (raw CSV cache)
- **API Gateway**: Google Cloud API Gateway (via `backend/openapi.yaml`)
- **CI/CD**: GitHub Actions → TypeCheck → Lint → Test → Build → Deploy

### Why Cloud Run (Not GKE)

Cloud Run is chosen for: zero cluster management, pay-per-request pricing with scale-to-zero, sub-second deployments, and automatic 0-10 autoscaling. Revisit if the app needs long-running background processes, stateful workloads, service mesh, or sustained high traffic.

---

## 2. Environment Configuration

| Config              | Development   | Staging                 | Production           |
| ------------------- | ------------- | ----------------------- | -------------------- |
| `STORAGE_PROVIDER`  | `local`       | `gcp`                   | `gcp`                |
| `NODE_ENV`          | `development` | `staging`               | `production`         |
| `LOG_LEVEL`         | `debug`       | `info`                  | `info`               |
| Cloud Run instances | N/A           | 0-2                     | 0-10                 |
| Memory limit        | N/A           | 512Mi                   | 512Mi                |
| Firestore project   | Emulator      | `toast-stats-staging`   | `toast-stats-prod`   |
| GCS bucket          | Local cache   | `toast-stats-staging-*` | `toast-stats-prod-*` |

### Promotion Flow

Development → Staging → Production. Each gate requires: tests pass, TypeScript compiles, ESLint clean, code review approved. Rollback MUST be achievable within 5 minutes.

---

## 3. Containerization

### Dockerfile Requirements

- MUST use `node:22-alpine` base image
- MUST use multi-stage build (build stage + production stage)
- MUST run as non-root user
- MUST use `npm ci` (not `npm install`)
- MUST clean npm cache after install
- Final image SHOULD be under 200MB

### Cloud Run Resource Defaults

| Resource        | Default | Range      |
| --------------- | ------- | ---------- |
| Memory          | 512Mi   | 256Mi–2Gi  |
| CPU             | 1 vCPU  | 0.5–2 vCPU |
| Concurrency     | 80      | 1–1000     |
| Max instances   | 10      | 1–100      |
| Request timeout | 300s    | 1s–3600s   |

**Memory rule**: `--max-old-space-size` ≈ 75% of container memory (384MB for 512Mi).

### Health Checks

| Endpoint        | Purpose         | Response Time |
| --------------- | --------------- | ------------- |
| `/health`       | Liveness probe  | < 100ms       |
| `/health/ready` | Readiness probe | < 500ms       |

---

## 4. IAM and Secrets

### Service Accounts

Each service MUST have a dedicated service account (`{service}@{project}.iam.gserviceaccount.com`). MUST NOT use the default Compute Engine SA.

Backend SA requires: `roles/datastore.user`, `roles/storage.objectAdmin`, `roles/secretmanager.secretAccessor`, `roles/logging.logWriter`.

### Secrets Management

- All secrets MUST be in Google Secret Manager, injected as env vars at runtime
- Secrets MUST NOT be in code, config files, or Dockerfiles
- API keys rotate every 90 days; service tokens every 30 days

---

## 5. Backend Standards (Summary)

### API Design

- RESTful conventions: plural nouns, kebab-case URLs, camelCase query params
- All request data validated with Zod schemas
- Structured JSON error responses with `{ error: { code, message, details? } }`

### Logging

- Structured JSON logging using `{ timestamp, level, message, environment, data? }`
- Levels: `error`, `warn`, `info` (all envs); `debug` (dev only)
- Sensitive data MUST NOT be logged

### Caching

- All in-memory caches MUST be bounded (LRU with TTL)
- Total cache SHOULD NOT exceed 25% of container memory
- Concurrent identical requests SHOULD be deduplicated

### Dependencies

- Production deps MUST use exact versions (no `^` or `~`)
- All envs MUST use same Node.js major version (22.x)
- Critical vulnerabilities addressed within 24 hours
