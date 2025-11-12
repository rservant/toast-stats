# Deployment Guide

This guide covers deploying the Toastmasters District Statistics Visualizer to production.

## Prerequisites

- Docker and Docker Compose installed
- Production environment variables configured
- SSL/TLS certificates (recommended for production)
- Domain name configured (for production)

## Quick Start with Docker Compose

1. **Copy and configure environment variables:**

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set:
- `JWT_SECRET` - Use a strong random string (minimum 32 characters)
- `CORS_ORIGIN` - Your frontend domain (e.g., https://yourdomain.com)
- `TOASTMASTERS_DASHBOARD_URL` - Usually https://dashboard.toastmasters.org

2. **Build and start services:**

```bash
docker-compose --env-file .env.production up -d
```

3. **Verify deployment:**

```bash
# Check backend health
curl http://localhost:5001/health

# Check frontend health
curl http://localhost:80/health

# View logs
docker-compose logs -f
```

## Individual Service Deployment

### Backend Deployment

#### Build Docker Image

```bash
cd backend
docker build -t toastmasters-backend:latest .
```

#### Run Container

```bash
docker run -d \
  --name toastmasters-backend \
  -p 5001:5001 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-secret-key \
  -e CORS_ORIGIN=https://yourdomain.com \
  -e TOASTMASTERS_DASHBOARD_URL=https://dashboard.toastmasters.org \
  --restart unless-stopped \
  toastmasters-backend:latest
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

### Frontend Deployment

#### Build Docker Image

```bash
cd frontend
docker build -t toastmasters-frontend:latest .
```

#### Run Container

```bash
docker run -d \
  --name toastmasters-frontend \
  -p 80:80 \
  -e BACKEND_URL=http://backend:5001 \
  --restart unless-stopped \
  toastmasters-frontend:latest
```

#### Health Check

```bash
curl http://localhost:80/health
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

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | development | Environment mode |
| `PORT` | No | 5001 | Server port |
| `JWT_SECRET` | Yes | - | Secret key for JWT tokens |
| `JWT_EXPIRES_IN` | No | 1h | JWT token expiration |
| `TOASTMASTERS_DASHBOARD_URL` | Yes | - | Toastmasters API URL |
| `CORS_ORIGIN` | Yes (prod) | * | Allowed CORS origins |
| `CACHE_TTL` | No | 900 | Cache TTL in seconds |
| `RATE_LIMIT_WINDOW_MS` | No | 900000 | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | No | 100 | Max requests per window |

### Frontend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | /api | Backend API URL |

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
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend
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

Run multiple backend instances behind a load balancer:

```bash
docker-compose up -d --scale backend=3
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

1. Check logs: `docker-compose logs backend`
2. Verify environment variables are set
3. Ensure port 5001 is not in use
4. Check JWT_SECRET is configured

### Frontend Can't Connect to Backend

1. Verify CORS_ORIGIN is configured correctly
2. Check backend is running: `curl http://localhost:5001/health`
3. Verify network connectivity between containers
4. Check nginx proxy configuration

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
- `docker-compose.yml`
- Any custom nginx configurations

## Updates and Maintenance

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose build

# Restart services
docker-compose --env-file .env.production up -d
```

### Zero-Downtime Updates

1. Build new images with version tags
2. Update docker-compose.yml with new tags
3. Use `docker-compose up -d` to rolling update

## Cloud Platform Deployment

### AWS Deployment

- **ECS/Fargate**: Use the Dockerfiles with ECS task definitions
- **Elastic Beanstalk**: Deploy using docker-compose.yml
- **EC2**: Install Docker and use docker-compose

### Google Cloud Platform

- **Cloud Run**: Deploy containers directly
- **GKE**: Use Kubernetes manifests (create from docker-compose)
- **Compute Engine**: Install Docker and use docker-compose

### Azure

- **Container Instances**: Deploy containers directly
- **App Service**: Deploy using Docker containers
- **AKS**: Use Kubernetes manifests

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
