# Deployment Guide

This guide covers deploying the Toastmasters District Statistics Visualizer to production.

## Prerequisites

- Node.js 20+ installed
- Production environment variables configured
- SSL/TLS certificates (recommended for production)
- Domain name configured (for production)
- Process manager (PM2 recommended for production)

## Quick Start with PM2

1. **Install PM2 globally:**

```bash
npm install -g pm2
```

2. **Copy and configure environment variables:**

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set:

- `JWT_SECRET` - Use a strong random string (minimum 32 characters)
- `CORS_ORIGIN` - Your frontend domain (e.g., https://yourdomain.com)
- `TOASTMASTERS_DASHBOARD_URL` - Usually https://dashboard.toastmasters.org

3. **Build and start services:**

```bash
# Install dependencies
npm ci

# Build applications
npm run build:backend
npm run build:frontend
npm run build:scraper-cli

# Start backend with PM2
cd backend
pm2 start dist/index.js --name toastmasters-backend

# Serve frontend with a web server (nginx recommended)
```

4. **Verify deployment:**

```bash
# Check backend health
curl http://localhost:5001/health

# Check PM2 status
pm2 status
```

## Individual Service Deployment

### Scraper CLI Deployment

The scraper-cli is a standalone tool that collects data from Toastmasters dashboards and writes to the Raw CSV Cache. The backend reads from this cache to create snapshots.

#### Build and Install

```bash
# Build the scraper-cli
npm run build:scraper-cli

# The CLI is available at packages/scraper-cli/dist/
```

#### Running the Scraper

```bash
# Scrape all configured districts for today
npm run scraper-cli -- scrape

# Scrape for a specific date
npm run scraper-cli -- scrape --date 2025-01-10

# Scrape specific districts
npm run scraper-cli -- scrape --districts 57,58,59

# Force re-scrape even if cache exists
npm run scraper-cli -- scrape --force

# Check cache status
npm run scraper-cli -- status
```

#### Scheduled Scraping with Cron

Set up a cron job to run the scraper daily:

```bash
# Edit crontab
crontab -e

# Add daily scrape at 6 AM
0 6 * * * cd /path/to/toast-stats && npm run scraper-cli -- scrape >> /var/log/scraper.log 2>&1
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All districts scraped successfully |
| 1 | Some districts failed (partial success) |
| 2 | All districts failed or fatal error |

### Backend Deployment

#### Build and Run

```bash
# Install dependencies and build
npm ci
npm run build:backend

# Start with PM2
cd backend
pm2 start dist/index.js --name toastmasters-backend --env production
```

#### Environment Configuration

Create a `backend/.env` file or use environment variables:

```env
NODE_ENV=production
PORT=5001
JWT_SECRET=your-secret-key
CORS_ORIGIN=https://yourdomain.com
TOASTMASTERS_DASHBOARD_URL=https://dashboard.toastmasters.org
```

#### Health Check

```bash
curl http://localhost:5001/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "production"
}
```

## Static Hosting (Frontend Only)

The frontend can be deployed to static hosting services like Vercel, Netlify, or AWS S3.

### Build for Production

```bash
cd frontend
npm install
npm run build
```

The `dist` directory contains the production build.

### Environment Configuration

Create a `.env.production` file:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

### Deploy to Vercel

```bash
npm install -g vercel
cd frontend
vercel --prod
```

### Deploy to Netlify

```bash
npm install -g netlify-cli
cd frontend
netlify deploy --prod --dir=dist
```

## Environment Variables

### Backend Environment Variables

| Variable                     | Required   | Default     | Description               |
| ---------------------------- | ---------- | ----------- | ------------------------- |
| `NODE_ENV`                   | No         | development | Environment mode          |
| `PORT`                       | No         | 5001        | Server port               |
| `JWT_SECRET`                 | Yes        | -           | Secret key for JWT tokens |
| `JWT_EXPIRES_IN`             | No         | 1h          | JWT token expiration      |
| `TOASTMASTERS_DASHBOARD_URL` | Yes        | -           | Toastmasters API URL      |
| `CORS_ORIGIN`                | Yes (prod) | \*          | Allowed CORS origins      |
| `CACHE_TTL`                  | No         | 900         | Cache TTL in seconds      |
| `RATE_LIMIT_WINDOW_MS`       | No         | 900000      | Rate limit window         |
| `RATE_LIMIT_MAX_REQUESTS`    | No         | 100         | Max requests per window   |

### Frontend Environment Variables

| Variable       | Required | Default | Description     |
| -------------- | -------- | ------- | --------------- |
| `VITE_API_URL` | No       | /api    | Backend API URL |

## Security Considerations

### Production Checklist

- [ ] Generate a strong `JWT_SECRET` (minimum 32 characters)
- [ ] Configure `CORS_ORIGIN` to your specific domain
- [ ] Enable HTTPS/TLS for all traffic
- [ ] Set up rate limiting on the backend
- [ ] Configure firewall rules
- [ ] Enable security headers (already configured in nginx)
- [ ] Regular security updates for dependencies
- [ ] Monitor logs for suspicious activity

### Generating a Secure JWT Secret

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Monitoring and Logging

### View Logs

```bash
# PM2 logs
pm2 logs toastmasters-backend

# Or view all PM2 processes
pm2 logs
```

### Health Monitoring

Set up monitoring for these endpoints:

- Backend: `http://your-backend:5001/health`
- Frontend: `http://your-frontend:80/health`

Recommended monitoring tools:

- Uptime Robot
- Pingdom
- DataDog
- New Relic

### Log Aggregation

For production, consider using:

- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- CloudWatch (AWS)
- Stackdriver (GCP)

## Scaling

### Horizontal Scaling

Run multiple backend instances with PM2 cluster mode:

```bash
pm2 start dist/index.js --name toastmasters-backend -i max
```

### Load Balancer Configuration

Use nginx or a cloud load balancer to distribute traffic:

```nginx
upstream backend {
    server backend1:5001;
    server backend2:5001;
    server backend3:5001;
}

server {
    location /api {
        proxy_pass http://backend;
    }
}
```

## Troubleshooting

### Backend Won't Start

1. Check logs: `pm2 logs toastmasters-backend`
2. Verify environment variables are set
3. Ensure port 5001 is not in use
4. Check JWT_SECRET is configured

### Frontend Can't Connect to Backend

1. Verify CORS_ORIGIN is configured correctly
2. Check backend is running: `curl http://localhost:5001/health`
3. Verify network connectivity
4. Check web server proxy configuration

### High Memory Usage

1. Adjust cache TTL to reduce memory usage
2. Implement Redis for distributed caching
3. Scale horizontally instead of vertically

## Backup and Recovery

### Data Backup

Currently, the application doesn't persist data. All data is fetched from the Toastmasters dashboard.

### Configuration Backup

Backup these files:

- `.env.production`
- PM2 ecosystem files
- Any custom nginx configurations

## Updates and Maintenance

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Install dependencies and rebuild
npm ci
npm run build:backend
npm run build:frontend

# Restart backend service
pm2 restart toastmasters-backend
```

### Cache Management for Ranking Updates

**Important**: When deploying updates that change ranking calculations, cached data must be cleared to ensure accuracy.

The application uses a cache versioning system to track changes in ranking methodologies:

- **Version 1**: Simple rank-sum scoring (legacy)
- **Version 2**: Borda count scoring with percentage-based ranking (current)

#### Automated Cache Clearing

Use the provided script for safe cache clearing:

```bash
# Direct deployment
cd backend && npm run clear-rankings-cache
```

#### Manual Cache Clearing

If the automated script is unavailable:

```bash
# Remove only rankings cache (preserves district performance data)
rm -rf backend/cache/districts_*.json
rm -rf backend/cache/metadata_*.json
rm -rf backend/cache/historical_index.json
```

**Note**: See `backend/CACHE_MIGRATION_GUIDE.md` for detailed information about cache versioning and migration procedures.

### Zero-Downtime Updates

1. Build new version
2. Use PM2 reload for zero-downtime restart: `pm2 reload toastmasters-backend`

## Cloud Platform Deployment

### AWS Deployment

- **EC2**: Install Node.js and PM2, deploy directly
- **Elastic Beanstalk**: Deploy using Node.js platform
- **Lambda**: Use serverless framework for API deployment

### Google Cloud Platform

- **Compute Engine**: Install Node.js and PM2, deploy directly
- **App Engine**: Deploy using Node.js runtime
- **Cloud Functions**: Use serverless deployment

### Azure

- **Virtual Machines**: Install Node.js and PM2, deploy directly
- **App Service**: Deploy using Node.js runtime

## Performance Optimization

### Backend Optimization

- Enable response compression (gzip)
- Implement Redis for distributed caching
- Use connection pooling for external APIs
- Enable HTTP/2

### Frontend Optimization

- Already configured code splitting in vite.config.ts
- Enable CDN for static assets
- Implement service workers for offline support
- Use lazy loading for routes

## Support

For issues or questions:

1. Check logs first
2. Verify environment configuration
3. Review this deployment guide
4. Check application health endpoints
