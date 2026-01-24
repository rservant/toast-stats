# GCP Emulator Setup Guide

This guide documents how to set up and use GCP emulators for local development and testing of the Toast-Stats storage providers.

## Overview

The Toast-Stats application supports two storage backends:

- **Cloud Firestore** - For structured snapshot data
- **Cloud Storage (GCS)** - For raw CSV file caching

For local development and testing, we use emulators to avoid requiring real GCP credentials or network connectivity.

## Storage Provider Configuration

### Environment Variables

The storage provider is configured via environment variables. See `backend/.env.example` for a complete reference.

| Variable               | Description                        | Required   | Default        |
| ---------------------- | ---------------------------------- | ---------- | -------------- |
| `STORAGE_PROVIDER`     | Storage backend (`local` or `gcp`) | No         | `local`        |
| `GCP_PROJECT_ID`       | GCP project ID                     | When `gcp` | -              |
| `GCS_BUCKET_NAME`      | GCS bucket name                    | When `gcp` | -              |
| `FIRESTORE_COLLECTION` | Firestore collection name          | No         | `snapshots`    |
| `CACHE_DIR`            | Local cache directory              | No         | `./data/cache` |

### Provider Selection

```bash
# Use local filesystem storage (default, no GCP required)
STORAGE_PROVIDER=local

# Use GCP storage (requires GCP_PROJECT_ID and GCS_BUCKET_NAME)
STORAGE_PROVIDER=gcp
GCP_PROJECT_ID=my-project
GCS_BUCKET_NAME=my-bucket
```

### Fail-Fast Behavior

When `STORAGE_PROVIDER=gcp` is set but required configuration is missing, the application will fail immediately with a clear error message:

```
StorageConfigurationError: GCP storage provider selected but required configuration is missing: GCP_PROJECT_ID, GCS_BUCKET_NAME
```

This fail-fast behavior ensures configuration issues are caught at startup rather than at runtime.

## Prerequisites

### Required Tools

1. **Node.js** (v18 or later)
2. **Firebase CLI** (for Firestore emulator)
3. **fake-gcs-server** (for GCS emulator)
4. **Java Runtime** (required by Firebase emulator)

### Installing Firebase CLI

```bash
# Using npm (recommended)
npm install -g firebase-tools

# Verify installation
firebase --version
```

### Installing fake-gcs-server

```bash
# Using Go (if Go is installed)
go install github.com/fsouza/fake-gcs-server@latest

# Or using Docker (recommended for consistency)
docker pull fsouza/fake-gcs-server
```

### Installing Java Runtime

The Firebase emulator requires Java 11 or later:

```bash
# macOS (using Homebrew)
brew install openjdk@11

# Ubuntu/Debian
sudo apt-get install openjdk-11-jre

# Verify installation
java -version
```

## Firestore Emulator Setup

### Starting the Emulator

```bash
# Start Firestore emulator on default port (8080)
firebase emulators:start --only firestore

# Start on a custom port
firebase emulators:start --only firestore --project demo-project
```

### Environment Configuration

Set the following environment variable to connect to the emulator:

```bash
export FIRESTORE_EMULATOR_HOST=localhost:8080
```

Or add to your `.env` file:

```env
FIRESTORE_EMULATOR_HOST=localhost:8080
```

### Emulator UI

The Firebase emulator includes a web UI for inspecting data:

- Default URL: http://localhost:4000

### Using npm Scripts

```bash
# Start Firestore emulator
npm run emulator:firestore

# Start with UI
npm run emulator:firestore:ui
```

## GCS Emulator Setup

### Starting fake-gcs-server

#### Using Docker (Recommended)

```bash
# Start fake-gcs-server on port 4443
docker run -d --name fake-gcs-server \
  -p 4443:4443 \
  fsouza/fake-gcs-server \
  -scheme http \
  -port 4443

# With persistent storage
docker run -d --name fake-gcs-server \
  -p 4443:4443 \
  -v $(pwd)/gcs-data:/data \
  fsouza/fake-gcs-server \
  -scheme http \
  -port 4443 \
  -data /data
```

#### Using Go Binary

```bash
# Start fake-gcs-server
fake-gcs-server -scheme http -port 4443
```

### Environment Configuration

Set the following environment variables to connect to the emulator:

```bash
export GCS_EMULATOR_HOST=http://localhost:4443
export STORAGE_EMULATOR_HOST=http://localhost:4443
```

Or add to your `.env` file:

```env
GCS_EMULATOR_HOST=http://localhost:4443
STORAGE_EMULATOR_HOST=http://localhost:4443
```

### Creating Test Buckets

The fake-gcs-server automatically creates buckets on first write, but you can pre-create them:

```bash
# Using curl
curl -X POST "http://localhost:4443/storage/v1/b?project=test-project" \
  -H "Content-Type: application/json" \
  -d '{"name": "toast-stats-test-bucket"}'
```

### Using npm Scripts

```bash
# Start GCS emulator
npm run emulator:gcs

# Stop GCS emulator
npm run emulator:gcs:stop
```

## Running Both Emulators

### Using npm Scripts

```bash
# Start all emulators
npm run emulators:start

# Stop all emulators
npm run emulators:stop
```

### Manual Start

```bash
# Terminal 1: Start Firestore emulator
firebase emulators:start --only firestore

# Terminal 2: Start GCS emulator
docker run -d --name fake-gcs-server -p 4443:4443 fsouza/fake-gcs-server -scheme http -port 4443
```

## Test Configuration

### Environment Variables for Testing

Create a `.env.test` file or set these variables before running tests:

```env
# Storage provider configuration
STORAGE_PROVIDER=gcp

# GCP project (can be any value for emulators)
GCP_PROJECT_ID=demo-project

# GCS bucket name
GCS_BUCKET_NAME=toast-stats-test-bucket

# Emulator hosts
FIRESTORE_EMULATOR_HOST=localhost:8080
GCS_EMULATOR_HOST=http://localhost:4443
STORAGE_EMULATOR_HOST=http://localhost:4443
```

### Test Setup Code

The test setup automatically detects emulator configuration:

```typescript
// Example test setup
import { Firestore } from '@google-cloud/firestore'
import { Storage } from '@google-cloud/storage'

// Firestore automatically uses emulator when FIRESTORE_EMULATOR_HOST is set
const firestore = new Firestore({
  projectId: 'demo-project',
})

// GCS requires explicit endpoint configuration
const storage = new Storage({
  projectId: 'demo-project',
  apiEndpoint: process.env.GCS_EMULATOR_HOST || 'http://localhost:4443',
})
```

### Running Integration Tests

```bash
# Start emulators first
npm run emulators:start

# Run tests with emulators
npm run test:integration

# Or run all tests (unit + integration)
npm test
```

## Troubleshooting

### Firestore Emulator Issues

#### "Port 8080 already in use"

```bash
# Find and kill the process using port 8080
lsof -i :8080
kill -9 <PID>

# Or use a different port
firebase emulators:start --only firestore --port 8081
```

#### "Java not found"

Ensure Java 11+ is installed and in your PATH:

```bash
java -version
# Should show version 11 or later
```

### GCS Emulator Issues

#### "Connection refused on port 4443"

```bash
# Check if container is running
docker ps | grep fake-gcs-server

# Restart the container
docker restart fake-gcs-server

# Or start a new container
docker run -d --name fake-gcs-server -p 4443:4443 fsouza/fake-gcs-server -scheme http -port 4443
```

#### "Bucket not found"

The fake-gcs-server creates buckets automatically on first write. If you need to pre-create:

```bash
curl -X POST "http://localhost:4443/storage/v1/b?project=test-project" \
  -H "Content-Type: application/json" \
  -d '{"name": "your-bucket-name"}'
```

### General Issues

#### Tests fail with "ECONNREFUSED"

Ensure emulators are running before starting tests:

```bash
# Check Firestore emulator
curl http://localhost:8080

# Check GCS emulator
curl http://localhost:4443
```

#### Data persists between test runs

Clear emulator data:

```bash
# Firestore: Restart the emulator (data is in-memory by default)
# GCS: Remove the data directory or restart without volume mount
docker rm -f fake-gcs-server
docker run -d --name fake-gcs-server -p 4443:4443 fsouza/fake-gcs-server -scheme http -port 4443
```

## CI/CD Integration

### GitHub Actions Example

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      fake-gcs-server:
        image: fsouza/fake-gcs-server
        ports:
          - 4443:4443
        options: >-
          --health-cmd "curl -f http://localhost:4443 || exit 1"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci
        working-directory: backend

      - name: Setup Firebase Emulator
        run: |
          npm install -g firebase-tools
          firebase emulators:start --only firestore &
          sleep 10

      - name: Run tests
        run: npm test
        working-directory: backend
        env:
          FIRESTORE_EMULATOR_HOST: localhost:8080
          GCS_EMULATOR_HOST: http://localhost:4443
          STORAGE_EMULATOR_HOST: http://localhost:4443
          GCP_PROJECT_ID: demo-project
          GCS_BUCKET_NAME: test-bucket
```

### Skipping Emulator Tests in CI

If emulators are not available, tests can be conditionally skipped:

```typescript
const skipEmulatorTests = !process.env.FIRESTORE_EMULATOR_HOST

describe.skipIf(skipEmulatorTests)('Firestore Integration Tests', () => {
  // Tests that require emulator
})
```

## Quick Reference

### npm Scripts

| Script                       | Description                 |
| ---------------------------- | --------------------------- |
| `npm run emulator:firestore` | Start Firestore emulator    |
| `npm run emulator:gcs`       | Start GCS emulator (Docker) |
| `npm run emulators:start`    | Start all emulators         |
| `npm run emulators:stop`     | Stop all emulators          |
| `npm run test:integration`   | Run integration tests       |

### Environment Variables

| Variable                  | Description                        | Default |
| ------------------------- | ---------------------------------- | ------- |
| `STORAGE_PROVIDER`        | Storage backend (`local` or `gcp`) | `local` |
| `GCP_PROJECT_ID`          | GCP project ID                     | -       |
| `GCS_BUCKET_NAME`         | GCS bucket name                    | -       |
| `FIRESTORE_EMULATOR_HOST` | Firestore emulator host            | -       |
| `GCS_EMULATOR_HOST`       | GCS emulator host                  | -       |
| `STORAGE_EMULATOR_HOST`   | GCS emulator host (alternative)    | -       |

### Default Ports

| Service              | Port |
| -------------------- | ---- |
| Firestore Emulator   | 8080 |
| Firebase Emulator UI | 4000 |
| fake-gcs-server      | 4443 |

## Related Documentation

- [Firebase Emulator Suite Documentation](https://firebase.google.com/docs/emulator-suite)
- [fake-gcs-server GitHub](https://github.com/fsouza/fake-gcs-server)
- [Cloud Firestore Documentation](https://cloud.google.com/firestore/docs)
- [Cloud Storage Documentation](https://cloud.google.com/storage/docs)

## GCP Authentication (Production)

When using `STORAGE_PROVIDER=gcp` with real GCP services (not emulators), you need to configure authentication.

### Cloud Run (Recommended for Production)

In GCP Cloud Run, authentication is **automatic** via the service account attached to the Cloud Run service. No additional configuration is required.

**Required IAM Roles for the service account:**

- `roles/datastore.user` - For Firestore read/write access
- `roles/storage.objectAdmin` - For GCS read/write access

### Local Development with Real GCP Services

If you need to test against real GCP services locally (not recommended for regular development):

#### Option 1: Application Default Credentials (Recommended)

```bash
# Authenticate with your Google account
gcloud auth application-default login

# Set the project
gcloud config set project YOUR_PROJECT_ID
```

This creates credentials at `~/.config/gcloud/application_default_credentials.json` that the GCP client libraries automatically use.

#### Option 2: Service Account Key File

```bash
# Download a service account key from GCP Console
# Set the environment variable to point to the key file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

**Security Warning:** Service account key files are sensitive credentials. Never commit them to version control.

#### Option 3: Workload Identity (GKE)

For GKE deployments, configure Workload Identity to allow pods to authenticate as a service account without key files.

### Authentication Precedence

The GCP client libraries check for credentials in this order:

1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable
2. Application Default Credentials (`gcloud auth application-default login`)
3. GCE/GKE metadata server (automatic in GCP environments)

### Verifying Authentication

```bash
# Check current authentication
gcloud auth list

# Check application default credentials
gcloud auth application-default print-access-token

# Test Firestore access
gcloud firestore databases list --project=YOUR_PROJECT_ID

# Test GCS access
gsutil ls gs://YOUR_BUCKET_NAME
```

## Summary: Development vs Production

| Environment          | Storage Provider       | Authentication              |
| -------------------- | ---------------------- | --------------------------- |
| Local Development    | `local`                | None required               |
| Local with Emulators | `gcp` + emulator hosts | None required               |
| Local with Real GCP  | `gcp`                  | ADC or service account key  |
| Cloud Run            | `gcp`                  | Automatic (service account) |
| GKE                  | `gcp`                  | Workload Identity           |
