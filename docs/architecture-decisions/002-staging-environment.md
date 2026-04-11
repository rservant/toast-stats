# ADR-002: Staging Environment and Deployment Flow

**Status**: Proposed
**Date**: 2026-04-10
**Context**: The site is in production, shared with all Toastmasters district directors worldwide. Every commit to main deploys directly to production via Firebase Hosting. Multiple incidents have reached users before detection: closing period data corruption (#309), Distinguished count discrepancy (#311), lighthouse CI failures, stale dates in dropdown. There is no staging environment to verify changes before they affect real users.

## Decision

Implement a two-environment deployment flow using Firebase Hosting's multi-site capability:

### Environments

| Environment    | URL                      | Deploys from                        | Purpose                     |
| -------------- | ------------------------ | ----------------------------------- | --------------------------- |
| **Production** | `ts.taverns.red`         | `main` (after staging verification) | End users                   |
| **Staging**    | `staging.ts.taverns.red` | `main` (automatic)                  | Pre-production verification |

### Architecture

```
commit → main → CI (lint, typecheck, test)
                  ↓
              Deploy to staging
                  ↓
              Smoke tests against staging
                  ↓ (all green)
              Auto-promote to production
                  ↓ (any red)
              Block — notify, do not promote
```

### Data Strategy

- **Staging reads the same GCS bucket** as production (read-only CDN data)
- No separate staging pipeline — the data is immutable per-date, same for both environments
- GA measurement ID differs: staging uses a separate GA4 stream (or no GA at all)

### Smoke Tests

Playwright-based smoke suite that runs against the deployed staging URL:

1. Landing page loads, rankings table renders
2. District detail page loads with data
3. Date selector has expected dates (no stray dates)
4. Club detail page loads
5. Dark mode toggle works
6. `v1/latest.json` returns valid date
7. No console errors

### Promotion Gate

- Automated: if smoke tests pass → promote to production
- Manual override: `workflow_dispatch` to promote or rollback
- Rollback: redeploy the previous successful build

### Implementation Steps

1. Add a second Firebase Hosting site (`staging-toast-stats`) in the existing Firebase project
2. Configure `firebase.json` with two targets: `production` and `staging`
3. Split the Deploy workflow: always deploy to staging, conditionally promote to production
4. Create Playwright smoke test suite (5-7 critical paths)
5. Add smoke test step after staging deploy
6. Configure auto-promotion on green
7. Add separate GA4 stream for staging (or disable GA)
8. DNS: add `staging.ts.taverns.red` CNAME

## Consequences

### Easier

- Verify changes before users see them
- Catch data-display bugs (like stray dates) before production
- Safe to deploy frequently — staging absorbs the risk
- Rollback is just "redeploy previous build to production"

### Harder

- Slightly longer deploy pipeline (staging → smoke → promote adds ~2-3 min)
- Two Firebase sites to manage (minimal overhead)
- Smoke tests need maintenance as UI changes

## Alternatives Considered

1. **Firebase preview channels** — ephemeral per-PR deployments. Good for visual review but don't persist and can't run scheduled smoke tests against them. Use in addition to staging, not instead of.

2. **Separate GCS bucket for staging** — adds pipeline complexity with no benefit since CDN data is immutable. The frontend reads the same data regardless of environment.

3. **Manual promotion gate** — safer but slower. Given the site's current stability and the smoke test coverage, automated promotion is acceptable. Can add manual gate later for major releases.

4. **No staging, just better CI** — CI already catches code-level bugs. The incidents that reached production were data-level (wrong dates, stale indexes) which require a deployed environment to detect.
