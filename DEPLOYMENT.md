# Deployment Guide

This guide covers deploying the Toastmasters District Statistics Visualizer to production.

## Architecture Overview

The recommended production deployment uses Firebase Hosting with GCP API Gateway:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Firebase Hosting                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Frontend (SPA)                        │    │
│  │                   frontend/dist/*                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                               │
                     /api/* requests
                               ▼
              ┌────────────────────────────────┐
              │      GCP API Gateway           │
              │   (backend/openapi.yaml)       │
              │                                │
              │  - Route definitions           │
              │  - Parameter validation        │
              │  - CORS configuration          │
              └────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │         Cloud Run              │
              │      toast-stats-api           │
              │                                │
              │  ┌──────────────────────────┐  │
              │  │   Express.js API Server  │  │
              │  └──────────────────────────┘  │
              │              │                 │
              └──────────────┼─────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌────────────┐   ┌────────────┐   ┌────────────┐
    │ Firestore  │   │   Cloud    │   │  Secret    │
    │ (Snapshots)│   │  Storage   │   │  Manager   │
    │            │   │ (CSV Cache)│   │            │
    └────────────┘   └────────────┘   └────────────┘
```

## Prerequisites

- Node.js 20+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Google Cloud SDK (`gcloud`) installed and configured
- GCP project with billing enabled
- Production environment variables configured
- Domain name configured (optional, Firebase provides default domain)

## Quick Start with Firebase

### Initial Setup

1. **Install Firebase CLI:**

```bash
npm install -g firebase-tools
firebase login
```

2. **Initialize Firebase project (if not already done):**

```bash
firebase use toast-stats-prod-6d64a
```

3. **Enable required GCP APIs:**

```bash
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### Deploy Backend to Cloud Run

4. **Set up secrets in Secret Manager:**

```bash
# Create JWT secret
echo -n "$(openssl rand -base64 32)" | gcloud secrets create jwt-secret --data-file=-
```

5. **Deploy backend to Cloud Run:**

```bash
PROJECT_ID="toast-stats-prod-6d64a"
REGION="us-east1"

gcloud run deploy toast-stats-api \
  --source=./backend \
  --region=${REGION} \
  --platform=managed \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="STORAGE_PROVIDER=gcp" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID}" \
  --set-env-vars="GCS_BUCKET_NAME=toast-stats-raw-csv-${PROJECT_ID}" \
  --set-secrets="JWT_SECRET=jwt-secret:latest" \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1
```

6. **Get the Cloud Run service URL:**

```bash
BACKEND_URL=$(gcloud run services describe toast-stats-api \
  --region=us-east1 \
  --format='value(status.url)')
echo "Backend URL: ${BACKEND_URL}"
```

### Configure Firebase Hosting with API Gateway

7. **Update firebase.json to route API requests to Cloud Run:**

```json
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "toast-stats-api",
          "region": "us-east1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Build and Deploy Frontend

8. **Build the frontend:**

```bash
cd frontend
npm ci
npm run build
cd ..
```

9. **Deploy to Firebase Hosting:**

```bash
firebase deploy --only hosting
```

### Verify Deployment

10. **Check deployment status:**

```bash
# Check backend health via Firebase Hosting
curl https://toast-stats-prod-6d64a.web.app/api/health

# Or check Cloud Run directly
curl ${BACKEND_URL}/health
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

## Alternative: Quick Start with PM2 (Local/VM Deployment)

For local development or VM-based deployment without Firebase:

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
- `CORS_ORIGIN` - Your frontend domain
- `TOASTMASTERS_DASHBOARD_URL` - Usually `https://dashboard.toastmasters.org`

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

### Firebase Hosting Deployment (Recommended)

Firebase Hosting serves as both the static file host for the frontend and an API gateway that routes `/api/*` requests to Cloud Run.

#### Firebase Configuration

The `firebase.json` configuration defines hosting behavior:

```json
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "toast-stats-api",
          "region": "us-east1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**Key Configuration Elements:**

| Element       | Purpose                                                    |
| ------------- | ---------------------------------------------------------- |
| `public`      | Directory containing built frontend assets                 |
| `rewrites[0]` | Routes `/api/**` requests to Cloud Run backend             |
| `rewrites[1]` | SPA fallback - serves `index.html` for client-side routing |

#### API Gateway Benefits

Using Firebase Hosting rewrites as an API gateway provides:

- **Single Domain**: Frontend and API share the same domain (no CORS issues)
- **Automatic SSL**: Firebase provides free SSL certificates
- **CDN Distribution**: Static assets served from global CDN
- **Zero Configuration**: No separate API gateway service to manage
- **Cost Effective**: Pay only for Cloud Run invocations

#### Deploy Frontend Only

```bash
# Build frontend
cd frontend && npm run build && cd ..

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

#### Deploy with Preview Channel

For testing before production:

```bash
# Create a preview channel
firebase hosting:channel:deploy preview-branch --expires 7d
```

#### Custom Domain Setup

1. **Add custom domain in Firebase Console:**
   - Go to Firebase Console → Hosting → Add custom domain
   - Follow DNS verification steps

2. **Update CORS configuration** (if using direct Cloud Run access):

```bash
gcloud run services update toast-stats-api \
  --set-env-vars="CORS_ORIGIN=https://your-custom-domain.com"
```

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

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| 0    | All districts scraped successfully      |
| 1    | Some districts failed (partial success) |
| 2    | All districts failed or fatal error     |

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

The frontend can be deployed to various static hosting services. Firebase Hosting is recommended for this project as it provides integrated API gateway functionality.

### Firebase Hosting (Recommended)

See the [Firebase Hosting Deployment](#firebase-hosting-deployment-recommended) section above.

### Alternative Static Hosts

For deployments where the backend is hosted separately:

#### Build for Production

```bash
cd frontend
npm install
npm run build
```

The `dist` directory contains the production build.

#### Frontend Environment Configuration

Create a `.env.production` file:

```env
VITE_API_URL=https://your-backend-domain.com/api
```

#### Deploy to Vercel

```bash
npm install -g vercel
cd frontend
vercel --prod
```

#### Deploy to Netlify

```bash
npm install -g netlify-cli
cd frontend
netlify deploy --prod --dir=dist
```

## Environment Variables

### Backend Environment Variables

| Variable                     | Required   | Default     | Description                                           |
| ---------------------------- | ---------- | ----------- | ----------------------------------------------------- |
| `NODE_ENV`                   | No         | development | Environment mode                                      |
| `PORT`                       | No         | 5001        | Server port                                           |
| `JWT_SECRET`                 | Yes        | -           | Secret key for JWT tokens                             |
| `JWT_EXPIRES_IN`             | No         | 1h          | JWT token expiration                                  |
| `TOASTMASTERS_DASHBOARD_URL` | Yes        | -           | Toastmasters API URL                                  |
| `CORS_ORIGIN`                | Yes (prod) | \*          | Allowed CORS origins                                  |
| `CACHE_TTL`                  | No         | 900         | Cache TTL in seconds                                  |
| `RATE_LIMIT_WINDOW_MS`       | No         | 900000      | Rate limit window                                     |
| `RATE_LIMIT_MAX_REQUESTS`    | No         | 100         | Max requests per window                               |
| `STORAGE_PROVIDER`           | No         | local       | Storage backend (`local` or `gcp`)                    |
| `GCP_PROJECT_ID`             | Yes (gcp)  | -           | GCP project ID (required when `STORAGE_PROVIDER=gcp`) |
| `GCS_BUCKET_NAME`            | Yes (gcp)  | -           | GCS bucket for raw CSV cache                          |

### Frontend Environment Variables

| Variable       | Required | Default | Description                                       |
| -------------- | -------- | ------- | ------------------------------------------------- |
| `VITE_API_URL` | No       | /api    | Backend API URL (use `/api` for Firebase Hosting) |

### Firebase Hosting Notes

When using Firebase Hosting with Cloud Run rewrites:

- Set `VITE_API_URL=/api` (or omit it to use the default)
- The Firebase Hosting rewrite handles routing to Cloud Run
- No CORS configuration needed since frontend and API share the same domain
- SSL is automatically provided by Firebase

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

### Firebase/Cloud Run Monitoring

#### View Cloud Run Logs

```bash
# Stream logs
gcloud run services logs read toast-stats-api --region=us-east1 --tail=50

# Or use Cloud Console
# https://console.cloud.google.com/run/detail/us-east/toast-stats-api/logs
```

#### Firebase Hosting Analytics

View hosting analytics in the Firebase Console:

- Request counts and bandwidth
- Cache hit rates
- Error rates

#### Cloud Run Metrics

Monitor in Google Cloud Console:

- Request latency
- Container instance count
- Memory and CPU utilization
- Error rates

### PM2 Monitoring (Local Deployment)

#### View Logs

```bash
# PM2 logs
pm2 logs toastmasters-backend

# Or view all PM2 processes
pm2 logs
```

### Health Monitoring

Set up monitoring for these endpoints:

- **Firebase Hosting**: `https://your-project.web.app/api/health`
- **Cloud Run Direct**: `https://toast-stats-api-xxxxx.run.app/health`
- **Local Backend**: `http://your-backend:5001/health`
- **Local Frontend**: `http://your-frontend:80/health`

Recommended monitoring tools:

- Google Cloud Monitoring (built-in for Cloud Run)
- Uptime Robot
- Pingdom
- DataDog
- New Relic

### Log Aggregation

For production, consider using:

- Cloud Logging (built-in for GCP/Firebase)
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- CloudWatch (AWS)
- Stackdriver (GCP)

## Scaling

### Cloud Run Auto-Scaling (Recommended)

Cloud Run automatically scales based on traffic:

```bash
# Configure scaling limits
gcloud run services update toast-stats-api \
  --region=us-east1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80
```

| Setting         | Recommended | Description                            |
| --------------- | ----------- | -------------------------------------- |
| `min-instances` | 0           | Scale to zero when idle (cost savings) |
| `max-instances` | 10          | Maximum concurrent instances           |
| `concurrency`   | 80          | Requests per instance before scaling   |

### PM2 Horizontal Scaling (Local Deployment)

Run multiple backend instances with PM2 cluster mode:

```bash
pm2 start dist/index.js --name toastmasters-backend -i max
```

### Load Balancer Configuration (Traditional Deployment)

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

### Firebase Hosting Issues

#### API Requests Return 404

1. Verify Cloud Run service is deployed and running:
   ```bash
   gcloud run services list --region=us-east1
   ```
2. Check `firebase.json` has correct rewrite configuration
3. Ensure the rewrite `serviceId` matches your Cloud Run service name
4. Verify the region in the rewrite matches your Cloud Run region

#### Firebase Deploy Fails

1. Check you're logged in: `firebase login`
2. Verify project: `firebase use`
3. Ensure frontend is built: `cd frontend && npm run build`
4. Check `firebase.json` syntax is valid

#### Cloud Run Service Not Accessible

1. Verify service allows unauthenticated access:
   ```bash
   gcloud run services describe toast-stats-api --region=us-east1
   ```
2. Check service account has required permissions
3. Review Cloud Run logs:
   ```bash
   gcloud run services logs read toast-stats-api --region=us-east1
   ```

### Backend Won't Start

1. Check logs: `pm2 logs toastmasters-backend` (PM2) or Cloud Run logs
2. Verify environment variables are set
3. Ensure port 5001 is not in use (local deployment)
4. Check JWT_SECRET is configured

### Frontend Can't Connect to Backend

1. For Firebase Hosting: Verify rewrite configuration in `firebase.json`
2. For separate hosting: Verify CORS_ORIGIN is configured correctly
3. Check backend is running: `curl http://localhost:5001/health`
4. Verify network connectivity
5. Check web server proxy configuration

### High Memory Usage

1. Adjust cache TTL to reduce memory usage
2. Implement Redis for distributed caching
3. Scale horizontally instead of vertically
4. For Cloud Run: Increase memory allocation or add more instances

## Backup and Recovery

### Data Backup

Currently, the application doesn't persist data. All data is fetched from the Toastmasters dashboard.

### Configuration Backup

Backup these files:

- `.env.production`
- PM2 ecosystem files
- Any custom nginx configurations

## Updates and Maintenance

### Updating the Application (Firebase Deployment)

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm ci

# Build and deploy backend to Cloud Run
gcloud run deploy toast-stats-api \
  --source=./backend \
  --region=us-east1

# Build and deploy frontend to Firebase Hosting
cd frontend && npm run build && cd ..
firebase deploy --only hosting
```

### Updating the API Gateway (GCP API Gateway with OpenAPI)

The API Gateway is configured through an OpenAPI specification in `backend/openapi.yaml`. This uses Google Cloud API Gateway to route requests to Cloud Run.

#### Architecture

```
Frontend (Firebase Hosting)
         │
         ▼
GCP API Gateway (openapi.yaml)
         │
         ▼
Cloud Run (toast-stats-api)
```

#### When Updates Are Needed

- Adding new API endpoints
- Changing endpoint parameters or validation
- Updating the Cloud Run backend URL
- Modifying CORS configuration

#### Modifying the API Gateway Configuration

1. **Edit `backend/openapi.yaml`** to add or modify endpoints:

```yaml
paths:
  /new-endpoint:
    get:
      summary: New endpoint description
      operationId: newEndpoint
      tags:
        - YourTag
      x-google-backend:
        address: https://toast-stats-api-736334703361.us-east1.run.app
        path_translation: APPEND_PATH_TO_ADDRESS
      produces:
        - application/json
      responses:
        '200':
          description: Success
```

2. **Deploy the updated API Gateway configuration:**

```bash
PROJECT_ID="toast-stats-prod-6d64a"
REGION="us-east1"
API_ID="toast-stats-api"
CONFIG_ID="toast-stats-config-$(date +%Y%m%d%H%M%S)"

# Create new API config from OpenAPI spec
gcloud api-gateway api-configs create ${CONFIG_ID} \
  --api=${API_ID} \
  --openapi-spec=backend/openapi.yaml \
  --project=${PROJECT_ID}

# Update the gateway to use the new config
gcloud api-gateway gateways update toast-stats-gateway \
  --api=${API_ID} \
  --api-config=${CONFIG_ID} \
  --location=${REGION} \
  --project=${PROJECT_ID}
```

#### Key OpenAPI Configuration Elements

| Element                             | Purpose                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `host`                              | API Gateway hostname                                                     |
| `basePath`                          | Base path for all endpoints (`/api`)                                     |
| `x-google-backend.address`          | Cloud Run service URL                                                    |
| `x-google-backend.path_translation` | How paths are forwarded (`APPEND_PATH_TO_ADDRESS` or `CONSTANT_ADDRESS`) |
| `x-google-endpoints`                | CORS and endpoint configuration                                          |

#### Adding New Endpoints

When adding a new endpoint to the backend:

1. Add the route in the Express backend (`backend/src/routes/`)
2. Add the corresponding path in `backend/openapi.yaml` with `x-google-backend`
3. Deploy the backend to Cloud Run
4. Deploy the updated API Gateway config

#### Updating the Backend URL

If the Cloud Run service URL changes:

```bash
# Find all occurrences and update
sed -i 's/old-url.run.app/new-url.run.app/g' backend/openapi.yaml

# Then redeploy the API Gateway config
```

#### Verifying API Gateway Changes

```bash
# Test through the API Gateway
curl https://toast-stats-18majkbqxtagv.apigateway.toast-stats-prod-6d64a.cloud.goog/api/health

# List API configs
gcloud api-gateway api-configs list --api=toast-stats-api --project=${PROJECT_ID}

# Describe current gateway
gcloud api-gateway gateways describe toast-stats-gateway \
  --location=${REGION} \
  --project=${PROJECT_ID}
```

#### Rollback API Gateway Changes

```bash
# List available configs
gcloud api-gateway api-configs list --api=toast-stats-api --project=${PROJECT_ID}

# Rollback to a previous config
gcloud api-gateway gateways update toast-stats-gateway \
  --api=toast-stats-api \
  --api-config=PREVIOUS_CONFIG_ID \
  --location=${REGION} \
  --project=${PROJECT_ID}
```

### Updating the Application (PM2 Deployment)

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

**Firebase/Cloud Run:**
Cloud Run automatically handles zero-downtime deployments with traffic migration.

**PM2:**
Use PM2 reload for zero-downtime restart: `pm2 reload toastmasters-backend`

## Cloud Platform Deployment

### Google Cloud Platform - Firebase + Cloud Run (Recommended)

This is the recommended production deployment using Firebase Hosting as the frontend host and API gateway, with Cloud Run for the backend.

#### Complete Deployment Checklist

- [ ] GCP project created with billing enabled
- [ ] Firebase project linked to GCP project
- [ ] Required APIs enabled (Cloud Run, Firestore, Storage, Secret Manager)
- [ ] Service account created with appropriate permissions
- [ ] Secrets stored in Secret Manager
- [ ] Cloud Storage bucket created for raw CSV cache
- [ ] Backend deployed to Cloud Run
- [ ] Firebase Hosting configured with Cloud Run rewrite
- [ ] Frontend built and deployed
- [ ] Health check verified
- [ ] Custom domain configured (optional)

#### Service Account Setup

Create a dedicated service account for the Cloud Run service:

```bash
PROJECT_ID="toast-stats-prod-6d64a"

# Create service account
gcloud iam service-accounts create toast-stats-api \
  --display-name="Toast Stats Backend Service"

SA_EMAIL="toast-stats-api@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant required permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
```

| Role                                 | Purpose                                   |
| ------------------------------------ | ----------------------------------------- |
| `roles/datastore.user`               | Read/write access to Firestore documents  |
| `roles/storage.objectAdmin`          | Full control of GCS objects in the bucket |
| `roles/secretmanager.secretAccessor` | Access to secrets                         |

#### Cloud Storage Bucket Configuration

```bash
PROJECT_ID="toast-stats-prod-6d64a"
BUCKET_NAME="toast-stats-raw-csv-${PROJECT_ID}"
REGION="us-east1"

# Create bucket
gcloud storage buckets create gs://${BUCKET_NAME} \
  --location=${REGION} \
  --uniform-bucket-level-access

# Optional: Set lifecycle policy to delete old cache files
cat > lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 90}
    }
  ]
}
EOF

gcloud storage buckets update gs://${BUCKET_NAME} --lifecycle-file=lifecycle.json
rm lifecycle.json
```

#### Full Backend Deployment Command

```bash
PROJECT_ID="toast-stats-prod-6d64a"
REGION="us-east1"
SERVICE_NAME="toast-stats-api"
BUCKET_NAME="toast-stats-raw-csv-${PROJECT_ID}"
SA_EMAIL="toast-stats-api@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud run deploy ${SERVICE_NAME} \
  --source=./backend \
  --region=${REGION} \
  --platform=managed \
  --service-account=${SA_EMAIL} \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="STORAGE_PROVIDER=gcp" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID}" \
  --set-env-vars="GCS_BUCKET_NAME=${BUCKET_NAME}" \
  --set-secrets="JWT_SECRET=jwt-secret:latest" \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10
```

**Note**: `--allow-unauthenticated` is required for Firebase Hosting rewrites to work. Authentication is handled at the application level.

#### Firebase Hosting Deployment

After deploying the backend:

```bash
# Build frontend
cd frontend && npm ci && npm run build && cd ..

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

#### Verify Full Stack Deployment

```bash
# Test via Firebase Hosting (recommended)
curl https://toast-stats-prod-6d64a.web.app/api/health

# Test Cloud Run directly (for debugging)
BACKEND_URL=$(gcloud run services describe toast-stats-api \
  --region=us-east1 --format='value(status.url)')
curl ${BACKEND_URL}/health
```

### Google Cloud Platform - Cloud Run with GCP Storage (Direct Access)

This section covers deploying the backend to Cloud Run with Cloud Firestore for snapshot storage and Cloud Storage (GCS) for raw CSV caching.

#### Prerequisites

- Google Cloud SDK (`gcloud`) installed and configured
- GCP project with billing enabled
- Cloud Run, Firestore, and Cloud Storage APIs enabled
- Service account with appropriate permissions

#### Enable Required APIs

```bash
# Enable required GCP APIs
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

#### Service Account Setup

Create a dedicated service account for the Cloud Run service:

```bash
# Create service account
gcloud iam service-accounts create toast-stats-api \
  --display-name="Toast Stats Backend Service"

# Get the service account email
SA_EMAIL="toast-stats-api@YOUR_PROJECT_ID.iam.gserviceaccount.com"
```

#### IAM Permissions Required

Grant the service account the following roles:

```bash
PROJECT_ID="your-gcp-project-id"
SA_EMAIL="toast-stats-api@${PROJECT_ID}.iam.gserviceaccount.com"

# Firestore access for snapshot storage
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user"

# Cloud Storage access for raw CSV cache
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"
```

| Role                        | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| `roles/datastore.user`      | Read/write access to Firestore documents  |
| `roles/storage.objectAdmin` | Full control of GCS objects in the bucket |

#### Cloud Firestore Setup

Create a Firestore database in Native mode:

```bash
# Create Firestore database (if not already created)
gcloud firestore databases create --location=us-east1
```

**Index Requirements**: No custom indexes are required. The application uses:

- Document ID queries (snapshot date as YYYY-MM-DD)
- Ordering by document ID descending for latest snapshot lookup

These operations are supported by default Firestore indexes.

#### Cloud Storage Bucket Configuration

Create and configure a GCS bucket for raw CSV storage:

```bash
PROJECT_ID="your-gcp-project-id"
BUCKET_NAME="toast-stats-raw-csv-${PROJECT_ID}"
REGION="us-east1"

# Create bucket
gcloud storage buckets create gs://${BUCKET_NAME} \
  --location=${REGION} \
  --uniform-bucket-level-access

# Set lifecycle policy to delete old cache files (optional)
cat > lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 90}
    }
  ]
}
EOF

gcloud storage buckets update gs://${BUCKET_NAME} --lifecycle-file=lifecycle.json
```

**Recommended Bucket Settings**:

| Setting                     | Value                    | Rationale                         |
| --------------------------- | ------------------------ | --------------------------------- |
| Location                    | Same region as Cloud Run | Minimize latency                  |
| Storage Class               | Standard                 | Frequent access pattern           |
| Public Access               | Prevented                | Security best practice            |
| Versioning                  | Disabled                 | Snapshots are immutable by design |
| Uniform Bucket-Level Access | Enabled                  | Simplified IAM management         |

#### Storage Provider Configuration

Set the following environment variables for GCP storage mode:

| Variable           | Required | Description                              |
| ------------------ | -------- | ---------------------------------------- |
| `STORAGE_PROVIDER` | Yes      | Set to `gcp` for Cloud Run deployment    |
| `GCP_PROJECT_ID`   | Yes      | Your GCP project ID                      |
| `GCS_BUCKET_NAME`  | Yes      | Name of the GCS bucket for raw CSV cache |

**Note**: When `STORAGE_PROVIDER=gcp`, the application will fail fast with a clear error if `GCP_PROJECT_ID` or `GCS_BUCKET_NAME` are not set.

#### Deploy to Cloud Run

Build and deploy the backend to Cloud Run:

```bash
PROJECT_ID="your-gcp-project-id"
REGION="us-east1"
SERVICE_NAME="toast-stats-api"
BUCKET_NAME="toast-stats-raw-csv-${PROJECT_ID}"
SA_EMAIL="toast-stats-api@${PROJECT_ID}.iam.gserviceaccount.com"

# Build and deploy
gcloud run deploy ${SERVICE_NAME} \
  --source=./backend \
  --region=${REGION} \
  --platform=managed \
  --service-account=${SA_EMAIL} \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="STORAGE_PROVIDER=gcp" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID}" \
  --set-env-vars="GCS_BUCKET_NAME=${BUCKET_NAME}" \
  --set-env-vars="CORS_ORIGIN=https://your-frontend-domain.com" \
  --set-secrets="JWT_SECRET=jwt-secret:latest" \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10
```

#### Using Secret Manager for Sensitive Values

Store sensitive configuration in Secret Manager:

```bash
# Create JWT secret
echo -n "your-secure-jwt-secret" | gcloud secrets create jwt-secret --data-file=-

# Grant service account access to the secret
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
```

#### Health Check Verification

After deployment, verify the service is healthy:

```bash
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region=${REGION} \
  --format='value(status.url)')

curl ${SERVICE_URL}/health
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

#### Storage Migration Notes

When migrating from local filesystem storage to GCP storage:

1. **No Data Migration Required**: Per the design, backward compatibility with existing local data is not required. The GCP storage starts fresh.

2. **Provider Selection**: The `STORAGE_PROVIDER` environment variable controls which storage backend is used:
   - `local` (default): Uses local filesystem (development)
   - `gcp`: Uses Cloud Firestore + Cloud Storage (production)

3. **Rollback**: To rollback to local storage, simply change `STORAGE_PROVIDER` back to `local`. Note that data stored in GCP will not be accessible in local mode.

4. **Testing GCP Storage Locally**: For local development with GCP emulators, see `backend/docs/gcp-emulator-setup.md`.

### Google Cloud Platform - Traditional Deployment

For deployments without Firebase Hosting:

- **Compute Engine**: Install Node.js and PM2, deploy directly
- **App Engine**: Deploy using Node.js runtime
- **Cloud Functions**: Use serverless deployment for individual endpoints

### AWS Deployment

- **EC2**: Install Node.js and PM2, deploy directly
- **Elastic Beanstalk**: Deploy using Node.js platform
- **Lambda + API Gateway**: Use serverless framework for API deployment
- **S3 + CloudFront**: Host frontend as static site

### Azure

- **Virtual Machines**: Install Node.js and PM2, deploy directly
- **App Service**: Deploy using Node.js runtime
- **Static Web Apps**: Host frontend with integrated API support

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
