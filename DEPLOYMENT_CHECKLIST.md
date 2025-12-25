# Production Deployment Checklist

Use this checklist to ensure a secure and successful production deployment.

## Pre-Deployment

### Security Configuration

- [ ] Generate a strong JWT_SECRET (minimum 32 characters)
  ```bash
  openssl rand -base64 32
  ```
- [ ] Configure CORS_ORIGIN to your specific domain (not `*`)
- [ ] Review and update all environment variables in `.env.production`
- [ ] Ensure no sensitive data is committed to version control
- [ ] Review `.gitignore` and `.dockerignore` files

### Environment Setup

- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Update `TOASTMASTERS_DASHBOARD_URL` if needed
- [ ] Set `NODE_ENV=production`
- [ ] Configure cache TTL based on your needs
- [ ] Set appropriate rate limiting values

### Build Verification

- [ ] Backend builds successfully: `cd backend && npm run build`
- [ ] Frontend builds successfully: `cd frontend && npm run build`
- [ ] All tests pass: `npm run test:backend && npm run test:frontend`
- [ ] No TypeScript errors
- [ ] No linting errors

## Deployment

### Docker Deployment

- [ ] Docker and Docker Compose installed
- [ ] Build backend image: `docker build -t toastmasters-backend:latest ./backend`
- [ ] Build frontend image: `docker build -t toastmasters-frontend:latest ./frontend`
- [ ] Test images locally before deploying
- [ ] Push images to container registry (if using one)
- [ ] Deploy using docker-compose: `docker-compose --env-file .env.production up -d`

### Kubernetes Deployment (if applicable)

- [ ] Create namespace: `kubectl create namespace toastmasters`
- [ ] Create secrets: `kubectl create secret generic toastmasters-secrets --from-literal=jwt-secret=YOUR_SECRET`
- [ ] Update ConfigMap with production values
- [ ] Apply manifests: `kubectl apply -f k8s/`
- [ ] Verify pods are running: `kubectl get pods`
- [ ] Check service endpoints: `kubectl get services`

### Static Hosting (Frontend only)

- [ ] Build frontend with production environment variables
- [ ] Configure API URL in `.env.production`
- [ ] Deploy to hosting platform (Vercel/Netlify/S3)
- [ ] Configure custom domain
- [ ] Set up SSL/TLS certificate

## Post-Deployment

### Cache Management

**IMPORTANT: Clear cache after deploying ranking system changes**

The district rankings calculation has been updated to use a Borda count scoring system with percentage-based ranking. Existing cached rankings use the old scoring methodology (absolute counts instead of percentages) and must be cleared to ensure users see accurate rankings.

#### Automated Cache Clearing (Recommended)

- [ ] Use the automated cache clearing script:
  ```bash
  # If using Docker:
  docker exec -it <backend-container> npm run clear-rankings-cache
  
  # If running directly:
  cd backend && npm run clear-rankings-cache
  ```
- [ ] Verify script output shows successful cache clearing
- [ ] Check that cache version compatibility was verified

#### Manual Cache Clearing (Alternative)

- [ ] Clear all cached district rankings manually:
  ```bash
  # If using Docker:
  docker exec -it <backend-container> rm -rf /app/cache/districts_*.json
  docker exec -it <backend-container> rm -rf /app/cache/metadata_*.json
  docker exec -it <backend-container> rm -rf /app/cache/historical_index.json
  
  # If running directly:
  rm -rf backend/cache/districts_*.json
  rm -rf backend/cache/metadata_*.json
  rm -rf backend/cache/historical_index.json
  ```
- [ ] Verify cache was cleared (directory should be empty or only contain district-level data)

#### Post-Cache Clearing Verification

- [ ] Restart the application if it's currently running
- [ ] Trigger fresh data fetch by accessing the rankings page
- [ ] Verify new rankings display correctly with Borda scores (higher scores = better)
- [ ] Verify percentage values display alongside rank numbers
- [ ] Confirm rankings are based on growth percentages, not absolute counts

**Note:** District-level performance data (in `cache/districts/{districtId}/` subdirectories) does not need to be cleared as it is not affected by the ranking calculation changes.

**Cache Version:** The system now uses cache version 2 (Borda count system). Version 1 cache entries (simple rank-sum system) will be automatically detected and cleared.

### Verification

- [ ] Backend health check responds: `curl https://api.yourdomain.com/health`
- [ ] Frontend loads correctly: `curl https://yourdomain.com/health`
- [ ] Login functionality works
- [ ] District selection works
- [ ] Data visualizations load
- [ ] Export functionality works
- [ ] Mobile responsive design works
- [ ] All API endpoints respond correctly
- [ ] District rankings display with correct Borda scores (higher is better)
- [ ] Percentage values display alongside rank numbers

### Security Verification

- [ ] HTTPS is enforced (no HTTP access)
- [ ] CORS is properly configured (only allowed origins)
- [ ] Rate limiting is active
- [ ] Authentication is required for protected endpoints
- [ ] No sensitive data in error messages
- [ ] Security headers are present (check with securityheaders.com)

### Performance Verification

- [ ] Page load time is acceptable (< 3 seconds)
- [ ] API response times are reasonable (< 1 second)
- [ ] Caching is working (check response headers)
- [ ] Images and assets are optimized
- [ ] Gzip compression is enabled

### Monitoring Setup

- [ ] Set up uptime monitoring for health endpoints
- [ ] Configure log aggregation (if using)
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure alerts for downtime
- [ ] Set up performance monitoring
- [ ] Document monitoring dashboard URLs

### Documentation

- [ ] Update deployment documentation with actual URLs
- [ ] Document any custom configuration
- [ ] Create runbook for common issues
- [ ] Document backup procedures (if applicable)
- [ ] Share access credentials securely with team

## Ongoing Maintenance

### Regular Tasks

- [ ] Monitor application logs weekly
- [ ] Review error rates and fix issues
- [ ] Update dependencies monthly
- [ ] Review and rotate JWT secrets quarterly
- [ ] Test backup and recovery procedures
- [ ] Review and update rate limits as needed

### Security Updates

- [ ] Subscribe to security advisories for dependencies
- [ ] Apply security patches promptly
- [ ] Review access logs for suspicious activity
- [ ] Update SSL/TLS certificates before expiration
- [ ] Conduct security audits periodically

## Rollback Plan

In case of issues:

### Docker Compose

```bash
# Stop current deployment
docker-compose down

# Revert to previous version
git checkout <previous-commit>

# Rebuild and deploy
docker-compose --env-file .env.production up -d
```

### Kubernetes

```bash
# Rollback deployment
kubectl rollout undo deployment/toastmasters-backend
kubectl rollout undo deployment/toastmasters-frontend

# Verify rollback
kubectl rollout status deployment/toastmasters-backend
kubectl rollout status deployment/toastmasters-frontend
```

## Emergency Contacts

- [ ] Document on-call rotation
- [ ] List emergency contact information
- [ ] Document escalation procedures
- [ ] Share access to monitoring dashboards

## Notes

Add any deployment-specific notes here:

---

**Deployment Date:** _______________

**Deployed By:** _______________

**Version/Commit:** _______________

**Issues Encountered:** _______________
