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
- [ ] Review `.gitignore` files

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

### Node.js Deployment

- [ ] Node.js 20+ installed on target server
- [ ] PM2 process manager installed: `npm install -g pm2`
- [ ] Build backend: `npm run build:backend`
- [ ] Build frontend: `npm run build:frontend`
- [ ] Start backend with PM2: `pm2 start backend/dist/index.js --name toastmasters-backend`
- [ ] Configure web server (nginx) to serve frontend static files
- [ ] Set up reverse proxy for backend API

### Kubernetes Deployment (if applicable)

- [ ] Create namespace: `kubectl create namespace toastmasters`
- [ ] Create secrets: `kubectl create secret generic toastmasters-secrets --from-literal=jwt-secret=YOUR_SECRET`
- [ ] Update ConfigMap with production values
- [ ] Create custom Kubernetes manifests (requires custom setup)
- [ ] Apply manifests: `kubectl apply -f custom-k8s/`
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

- [ ] **Clean test cache directories** (if deploying after testing):

  ```bash
  # Remove test cache directories
  find backend/cache -name "test-*" -type d -exec rm -rf {} +
  ```

- [ ] **Clear rankings cache** if rankings logic has changed:

  ```bash
  npm run clear-rankings-cache
  ```

- [ ] **Clean old historical data** (optional - keeps last 30 days):

  ```bash
  # Remove district data older than 30 days
  find backend/cache -name "districts_*.json" -mtime +30 -delete
  find backend/cache -name "metadata_*.json" -mtime +30 -delete
  ```

- [ ] **Verify cache directory structure**:

  ```bash
  ls -la backend/cache/
  # Should show: districts/, reconciliation/, and current data files
  # Should NOT show: thousands of test-* directories
  ```

- [ ] **Check cache size** and ensure it's reasonable:
  ```bash
  du -sh backend/cache/
  # Should be < 500MB for normal operation
  ```

### Verification

- [ ] Backend health check responds: `curl https://api.yourdomain.com/health`
- [ ] Frontend loads correctly: `curl https://yourdomain.com/health`
- [ ] Login functionality works
- [ ] District selection works
- [ ] Data visualizations load
- [ ] Export functionality works
- [ ] Mobile responsive design works
- [ ] All API endpoints respond correctly
- [ ] District rankings display correctly
- [ ] All data visualizations load properly

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

### Node.js/PM2 Deployment

```bash
# Stop current deployment
pm2 stop toastmasters-backend

# Revert to previous version
git checkout <previous-commit>

# Rebuild and restart
npm run build:backend
pm2 restart toastmasters-backend
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

**Deployment Date:** **\*\***\_\_\_**\*\***

**Deployed By:** **\*\***\_\_\_**\*\***

**Version/Commit:** **\*\***\_\_\_**\*\***

**Issues Encountered:** **\*\***\_\_\_**\*\***
