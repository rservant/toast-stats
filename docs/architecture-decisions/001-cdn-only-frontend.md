# ADR-001: CDN-Only Frontend (No API Server)

**Status**: Accepted
**Date**: 2026-01-15

## Context

The Toast Stats frontend was originally backed by an Express API server that read pre-computed JSON from GCS and served it via REST endpoints. As the system matured, all data became pre-computed and static — the Express server did no on-the-fly computation, only file reads with optional enrichment.

Maintaining an Express backend added:

- Cloud Run costs (~$5/month for a single instance)
- Deployment complexity (Docker builds, Cloud Run config, health checks)
- Cold start latency (2-3 seconds on first request)
- A 75K-line codebase that was effectively a pass-through proxy

## Decision

Delete the Express backend entirely. Serve all pre-computed data directly from Cloud CDN (Google Cloud Storage with CDN-layer caching). The data pipeline writes JSON to GCS; the frontend fetches it directly.

## Consequences

### Easier

- Zero backend maintenance, zero server costs
- Immutable cache headers → instant loads for repeat visits
- Simpler deployment: push frontend to GitHub Pages, push data to GCS
- No cold starts — CDN is always warm

### Harder

- No server-side computation (all analytics must be pre-computed by pipeline)
- No server-side CSV generation (export is now client-side)
- Data freshness limited by pipeline frequency (daily)
- Cross-origin considerations for CDN-served JSON

## Alternatives Considered

1. **Keep Express as thin proxy**: Still had deployment/cost overhead for zero value
2. **Cloudflare Workers**: Added architectural complexity for marginal benefit
3. **API Gateway + Cloud Functions**: Over-engineered for static file serving
