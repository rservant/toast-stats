# Club Health Classification System Deployment Guide

**Version:** 1.0.0  
**Last Updated:** January 2025  
**Audience:** DevOps Engineers, System Administrators, Technical Leads

## Overview

This guide provides comprehensive instructions for deploying the Club Health Classification System in production environments. The system supports multiple deployment methods including Docker Compose and Kubernetes.

## Architecture Overview

The Club Health Classification System consists of:

- **Frontend**: React-based web application served by Nginx
- **Backend**: Node.js API server with Express.js
- **Cache**: Redis for enhanced performance (optional)
- **Monitoring**: Prometheus and Grafana for observability (optional)

## Prerequisites

### System Requirements

#### Minimum Requirements

- **CPU**: 2 cores
- **Memory**: 4GB RAM
- **Storage**: 20GB available space
- **Network**: Stable internet connection

#### Recommended Requirements

- **CPU**: 4+ cores
- **Memory**: 8GB+ RAM
- **Storage**: 50GB+ available space (SSD preferred)
- **Network**: High-speed internet connection

### Software Dependencies

#### For Docker Compose Deployment

- **Docker**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later
- **Git**: For cloning the repository

#### For Kubernetes Deployment

- **Kubernetes**: Version 1.21 or later
- **kubectl**: Compatible with your cluster version
- **Docker**: For building images
- **Container Registry**: For storing images

#### Development Tools (Optional)

- **Node.js**: Version 18 or later (for local development)
- **npm**: Version 8 or later

## Pre-Deployment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/club-health-classification.git
cd club-health-classification
```

### 2. Environment Configuration

#### Backend Environment

Copy the production environment template:

```bash
cp backend/.env.production.example backend/.env.production
```

Edit `backend/.env.production` and update the following critical values:

```bash
# REQUIRED: Change these values
JWT_SECRET=your-production-jwt-secret-minimum-32-characters-long
SESSION_SECRET=your-session-secret-change-in-production
CORS_ORIGIN=https://yourdomain.com

# OPTIONAL: Customize as needed
PORT=5001
CACHE_TTL=1800
LOG_LEVEL=info
```

#### Frontend Environment

Copy the production environment template:

```bash
cp frontend/.env.production.example frontend/.env.production
```

Edit `frontend/.env.production` and update:

```bash
# REQUIRED: Update with your domain
VITE_API_BASE_URL=https://api.yourdomain.com/api

# OPTIONAL: Customize branding and features
VITE_APP_NAME=Club Health Dashboard
VITE_FEATURE_ADVANCED_ANALYTICS=true
```

### 3. Security Configuration

#### SSL/TLS Certificates

For production deployment, ensure you have:

- **Domain name**: Properly configured DNS
- **SSL certificate**: Valid certificate for your domain
- **Certificate management**: Automated renewal process

#### Secrets Management

Store sensitive information securely:

```bash
# Example using environment variables
export JWT_SECRET="your-secure-jwt-secret"
export SESSION_SECRET="your-secure-session-secret"
export DATABASE_PASSWORD="your-database-password"
```

## Deployment Methods

### Method 1: Docker Compose (Recommended for Single Server)

#### Quick Start

Use the automated deployment script:

```bash
./scripts/deploy.sh docker-compose production
```

#### Manual Deployment

1. **Build and start services**:

```bash
# Build images
docker-compose build --no-cache

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

2. **Verify deployment**:

```bash
# Check logs
docker-compose logs -f

# Test health endpoints
curl http://localhost/health
curl http://localhost/api/health
```

3. **Access the application**:

- **Frontend**: http://localhost
- **API**: http://localhost/api
- **Monitoring** (if enabled): http://localhost:3000 (Grafana)

#### Docker Compose Configuration

The `docker-compose.yml` includes:

- **Backend service**: API server with health checks
- **Frontend service**: Nginx web server
- **Redis service**: Caching layer
- **Monitoring services**: Prometheus and Grafana (optional)

#### Service Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart specific service
docker-compose restart backend

# View logs
docker-compose logs -f backend

# Scale services
docker-compose up -d --scale backend=3
```

### Method 2: Kubernetes (Recommended for Production)

#### Prerequisites

1. **Kubernetes cluster**: Running cluster with ingress controller
2. **Container registry**: For storing Docker images
3. **kubectl**: Configured to access your cluster

#### Deployment Steps

1. **Build and push images**:

```bash
# Build backend image
docker build -f Dockerfile.backend -t your-registry/club-health/backend:v1.0.0 .
docker push your-registry/club-health/backend:v1.0.0

# Build frontend image
docker build -f Dockerfile.frontend -t your-registry/club-health/frontend:v1.0.0 .
docker push your-registry/club-health/frontend:v1.0.0
```

2. **Update Kubernetes manifests**:

Edit `k8s/backend-deployment.yaml` and `k8s/frontend-deployment.yaml` to use your registry URLs.

3. **Deploy to Kubernetes**:

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy backend
kubectl apply -f k8s/backend-deployment.yaml

# Deploy frontend
kubectl apply -f k8s/frontend-deployment.yaml

# Check deployment status
kubectl get pods -n club-health
kubectl get services -n club-health
```

4. **Configure ingress**:

Update `k8s/frontend-deployment.yaml` ingress section with your domain:

```yaml
spec:
  tls:
    - hosts:
        - club-health.yourdomain.com
      secretName: club-health-tls
  rules:
    - host: club-health.yourdomain.com
```

#### Kubernetes Management

```bash
# Check pod status
kubectl get pods -n club-health

# View logs
kubectl logs -f deployment/club-health-backend -n club-health

# Scale deployment
kubectl scale deployment club-health-backend --replicas=3 -n club-health

# Update deployment
kubectl set image deployment/club-health-backend backend=your-registry/club-health/backend:v1.0.1 -n club-health

# Port forward for testing
kubectl port-forward service/club-health-frontend-service 8080:80 -n club-health
```

## Configuration Options

### Backend Configuration

#### Cache Settings

```bash
# Cache TTL settings (seconds)
CACHE_TTL=1800                          # General cache: 30 minutes
CLUB_HEALTH_CACHE_TTL=1800             # Club health data: 30 minutes
CLUB_HEALTH_HISTORY_CACHE_TTL=3600     # Historical data: 1 hour
DISTRICT_SUMMARY_CACHE_TTL=1200        # District summaries: 20 minutes
```

#### Rate Limiting

```bash
# Rate limiting configuration
RATE_LIMIT_WINDOW_MS=900000            # 15-minute window
RATE_LIMIT_MAX_REQUESTS=1000           # Max requests per window
RATE_LIMIT_CLUB_HEALTH_MAX=100         # Club health endpoint limit
RATE_LIMIT_BATCH_MAX=10                # Batch processing limit
```

#### Logging

```bash
# Logging configuration
LOG_LEVEL=info                         # debug, info, warn, error
LOG_FORMAT=json                        # json or text
LOG_FILE=/app/logs/application.log     # Log file path
LOG_MAX_SIZE=10m                       # Max log file size
LOG_MAX_FILES=5                        # Number of log files to keep
```

### Frontend Configuration

#### Feature Flags

```bash
# Feature toggles
VITE_FEATURE_REAL_TIME_UPDATES=false   # Real-time data updates
VITE_FEATURE_ADVANCED_ANALYTICS=true   # Advanced analytics dashboard
VITE_FEATURE_EXPORT_FUNCTIONALITY=true # Data export features
VITE_FEATURE_DEBUG_MODE=false          # Debug information display
```

#### Branding

```bash
# Branding customization
VITE_BRAND_PRIMARY_COLOR=#004165       # Toastmasters Loyal Blue
VITE_BRAND_SECONDARY_COLOR=#772432     # Toastmasters True Maroon
VITE_BRAND_ACCENT_COLOR=#F2DF74        # Toastmasters Happy Yellow
```

## Monitoring and Alerting

### Prometheus Configuration

The system includes Prometheus monitoring with the following metrics:

- **HTTP request metrics**: Response times, status codes, request counts
- **Application metrics**: Club health processing times, cache hit rates
- **System metrics**: CPU, memory, disk usage
- **Custom metrics**: Business-specific KPIs

### Grafana Dashboards

Pre-configured dashboards include:

1. **System Overview**: High-level system health and performance
2. **API Performance**: Request rates, response times, error rates
3. **Club Health Metrics**: Processing times, classification distribution
4. **Infrastructure**: Server resources, network, storage

### Alert Rules

Critical alerts are configured for:

- **Service availability**: Service down alerts
- **Performance**: High response times, error rates
- **Resources**: High CPU/memory usage
- **Business metrics**: Processing failures, cache issues

### Setting Up Monitoring

1. **Enable monitoring profile**:

```bash
docker-compose --profile monitoring up -d
```

2. **Access Grafana**:

- URL: http://localhost:3000
- Username: admin
- Password: admin (change on first login)

3. **Configure alerts**:

Edit `monitoring/alert_rules.yml` to customize alert thresholds.

## Security Considerations

### Network Security

1. **Firewall configuration**:

```bash
# Allow only necessary ports
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 22/tcp    # SSH (restrict to specific IPs)
```

2. **Reverse proxy**: Use Nginx or similar for SSL termination and security headers

3. **VPN access**: Consider VPN for administrative access

### Application Security

1. **Environment variables**: Never commit secrets to version control
2. **JWT secrets**: Use strong, randomly generated secrets
3. **CORS configuration**: Restrict to specific domains
4. **Rate limiting**: Implement appropriate rate limits
5. **Input validation**: All inputs are validated server-side

### Container Security

1. **Non-root users**: Containers run as non-root users
2. **Read-only filesystems**: Where possible
3. **Security scanning**: Regularly scan images for vulnerabilities
4. **Minimal base images**: Use Alpine Linux for smaller attack surface

## Performance Optimization

### Backend Optimization

1. **Caching strategy**:

```bash
# Optimize cache settings
CACHE_TTL=1800                    # Balance freshness vs performance
CACHE_MAX_SIZE=1000              # Prevent memory issues
```

2. **Database optimization** (if using database):

```bash
# Connection pooling
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

3. **Compression**:

```bash
# Enable compression
COMPRESSION_ENABLED=true
COMPRESSION_LEVEL=6
```

### Frontend Optimization

1. **Build optimization**: Production builds are automatically optimized
2. **CDN**: Consider using a CDN for static assets
3. **Caching headers**: Nginx configuration includes appropriate cache headers

### Infrastructure Optimization

1. **Resource allocation**:

```yaml
# Kubernetes resource limits
resources:
  requests:
    memory: '256Mi'
    cpu: '250m'
  limits:
    memory: '512Mi'
    cpu: '500m'
```

2. **Horizontal scaling**:

```bash
# Scale based on load
kubectl scale deployment club-health-backend --replicas=5 -n club-health
```

## Backup and Recovery

### Data Backup

1. **Application data**: Export club health data regularly
2. **Configuration**: Backup environment files and configurations
3. **Logs**: Archive important logs for compliance

### Backup Script Example

```bash
#!/bin/bash
# Backup script example

BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Export application data
curl -o "$BACKUP_DIR/club-health-data.json" "http://localhost/api/export/all"

# Backup configurations
cp -r /app/config "$BACKUP_DIR/"

# Backup logs
cp -r /app/logs "$BACKUP_DIR/"

# Compress backup
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"
```

### Recovery Procedures

1. **Service recovery**: Use health checks and auto-restart policies
2. **Data recovery**: Restore from backups with minimal downtime
3. **Disaster recovery**: Document complete system rebuild procedures

## Troubleshooting

### Common Issues

#### Service Won't Start

1. **Check logs**:

```bash
# Docker Compose
docker-compose logs backend

# Kubernetes
kubectl logs deployment/club-health-backend -n club-health
```

2. **Verify configuration**:

```bash
# Check environment variables
docker-compose exec backend env | grep -E "(JWT|PORT|NODE_ENV)"
```

3. **Check dependencies**:

```bash
# Verify Redis connection
docker-compose exec backend redis-cli ping
```

#### Performance Issues

1. **Monitor resources**:

```bash
# Docker stats
docker stats

# Kubernetes resources
kubectl top pods -n club-health
```

2. **Check cache hit rates**:

```bash
# Redis info
docker-compose exec redis redis-cli info stats
```

3. **Analyze slow queries**: Review application logs for slow operations

#### Network Issues

1. **Test connectivity**:

```bash
# Test internal communication
docker-compose exec frontend curl backend:5001/health
```

2. **Check DNS resolution**:

```bash
# Verify DNS
nslookup yourdomain.com
```

### Log Analysis

#### Important Log Patterns

```bash
# Error patterns to watch for
grep -E "(ERROR|FATAL|Exception)" /app/logs/application.log

# Performance issues
grep -E "(timeout|slow|performance)" /app/logs/application.log

# Security events
grep -E "(unauthorized|forbidden|attack)" /app/logs/application.log
```

## Maintenance

### Regular Maintenance Tasks

#### Daily

- Monitor system health and alerts
- Check application logs for errors
- Verify backup completion

#### Weekly

- Review performance metrics
- Update security patches
- Clean up old logs and temporary files

#### Monthly

- Update dependencies
- Review and rotate secrets
- Capacity planning review

### Update Procedures

#### Application Updates

1. **Backup current version**:

```bash
# Tag current version
docker tag club-health/backend:latest club-health/backend:backup-$(date +%Y%m%d)
```

2. **Deploy new version**:

```bash
# Build new version
docker-compose build --no-cache

# Rolling update
docker-compose up -d --no-deps backend
```

3. **Verify deployment**:

```bash
# Health check
curl http://localhost/api/health

# Monitor logs
docker-compose logs -f backend
```

#### Rollback Procedures

```bash
# Quick rollback with Docker Compose
docker-compose down
docker tag club-health/backend:backup-20250101 club-health/backend:latest
docker-compose up -d

# Kubernetes rollback
kubectl rollout undo deployment/club-health-backend -n club-health
```

## Scaling Considerations

### Horizontal Scaling

#### Load Balancing

```yaml
# Kubernetes horizontal pod autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: club-health-backend-hpa
  namespace: club-health
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: club-health-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

#### Session Management

- Use stateless design for easy scaling
- Store session data in Redis for shared access
- Implement proper load balancer session affinity if needed

### Vertical Scaling

#### Resource Monitoring

```bash
# Monitor resource usage
kubectl top pods -n club-health --containers

# Adjust resource limits
kubectl patch deployment club-health-backend -n club-health -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"1Gi","cpu":"1000m"}}}]}}}}'
```

## Compliance and Auditing

### Audit Logging

Enable comprehensive audit logging:

```bash
# Backend audit configuration
AUDIT_ENABLED=true
AUDIT_LOG_FILE=/app/logs/audit.log
AUDIT_LOG_LEVEL=info
```

### Compliance Requirements

1. **Data retention**: Configure appropriate data retention policies
2. **Access logging**: Log all administrative access
3. **Change tracking**: Track all configuration changes
4. **Security scanning**: Regular vulnerability assessments

### Reporting

Generate regular compliance reports:

```bash
# Example audit report
grep "$(date +%Y-%m-%d)" /app/logs/audit.log | \
  jq -r '.timestamp + " " + .user + " " + .action + " " + .resource'
```

## Support and Documentation

### Getting Help

1. **Documentation**: Refer to this guide and API documentation
2. **Logs**: Check application and system logs first
3. **Monitoring**: Use Grafana dashboards for insights
4. **Community**: Engage with the development team

### Additional Resources

- **API Documentation**: `/docs/api/club-health-api.md`
- **User Guide**: `/docs/ui/club-health-user-guide.md`
- **Troubleshooting**: `/docs/ui/troubleshooting-guide.md`
- **Architecture**: System design documentation

---

**Document Information**

- **Version**: 1.0.0
- **Last Updated**: January 2025
- **Next Review**: April 2025
- **Feedback**: Submit through development team or create GitHub issues
