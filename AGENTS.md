# Project: Toast Stats

Engineering principles are defined globally in `~/.gemini/GEMINI.md`.
This file contains **project-specific** context only.

---

## Available Tools

### Always Available

| Tool                   | Use Case                                                                        | Notes                     |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------- |
| `gh`                   | PR management, CI/CD monitoring (`gh run list`, `gh run watch`), issue tracking | Permanently authenticated |
| `git`                  | Version control                                                                 |                           |
| `node` / `npm` / `npx` | Runtime, package management, script execution                                   | v25.x / 11.x              |
| `docker`               | Local backend container builds and testing (`npm run docker:build`)             | Rancher Desktop           |
| `curl`                 | API health checks, endpoint testing                                             |                           |
| `jq`                   | JSON processing, API response parsing                                           |                           |

### Require Authentication (Ask First)

| Tool     | Use Case                                    | Notes                               |
| -------- | ------------------------------------------- | ----------------------------------- |
| `gcloud` | Cloud Run management, deployment            | Ask user to authenticate before use |
| `gsutil` | GCS bucket access (data pipeline artifacts) | Ask user to authenticate before use |

---

## Monorepo Structure

| Workspace | Path         | Purpose            |
| --------- | ------------ | ------------------ |
| Frontend  | `frontend/`  | React SPA (Vite)   |
| Backend   | `backend/`   | Express API server |
| Packages  | `packages/*` | Shared libraries   |

## Tooling

| Tool          | Command                      | Notes                                                   |
| ------------- | ---------------------------- | ------------------------------------------------------- |
| Test runner   | `npm run test`               | Vitest — all workspaces                                 |
| Watch mode    | `npm run test:watch`         |                                                         |
| Coverage      | `npm run test -- --coverage` |                                                         |
| Formatting    | `npm run format`             | Prettier — no semicolons, single quotes, 2-space indent |
| Linting       | `npm run lint`               | ESLint + YAML lint                                      |
| Type checking | `npm run typecheck`          | TypeScript strict mode                                  |

## Coverage Policy

All workspaces enforce minimum coverage thresholds via Vitest:

| Metric   | Minimum |
| -------- | ------- |
| Lines    | 50%     |
| Branches | 40%     |

Coverage is checked on every `git push` and in CI. PRs that reduce coverage below the floor are rejected.

## Quality Gates

### Pre-commit (every commit)

- Prettier formatting (lint-staged)
- TypeScript type checking
- ESLint + YAML lint
- Full test suite

### Pre-push (every push)

- Full test suite **with coverage enforcement**

### CI/CD Pipeline

- Quality gates (TypeScript, lint, format)
- Full test suite with coverage thresholds
- Security scanning
- Build verification
