# Storage Migration Guide: Local to GCP

This guide documents the steps to migrate Toast-Stats from local filesystem storage to Google Cloud Platform (GCP) storage using Cloud Firestore and Cloud Storage.

## Overview

The Toast-Stats application supports two storage backends:

- **Local Storage** (default): Uses the local filesystem for development
- **GCP Storage**: Uses Cloud Firestore for snapshots and Cloud Storage for CSV files

Migration is a one-way process. **Backward compatibility with existing local data is not required** - the GCP storage starts fresh.

## Route Handler Integration Status

> **✅ Migration Complete**: As of the storage provider integration fix, all route handlers now correctly respect the `STORAGE_PROVIDER` environment variable.

### What Was Fixed

The original GCP storage migration implemented the storage abstraction layer (`StorageProviderFactory`, `ISnapshotStorage` interface, etc.) but left an integration gap: the `shared.ts` module in `backend/src/routes/districts/` directly instantiated `FileSnapshotStore` instead of using the `StorageProviderFactory`. This caused route handlers to ignore the `STORAGE_PROVIDER` environment variable and always use local filesystem storage.

### Current Behavior

All district route handlers now:

1. **Respect `STORAGE_PROVIDER`**: Setting `STORAGE_PROVIDER=gcp` correctly routes all storage operations to Cloud Firestore
2. **Use consistent storage**: All services (`RefreshService`, `BackfillService`, `DistrictDataAggregator`) use the same storage provider instance
3. **Handle empty storage gracefully**: Return HTTP 503 with `NO_SNAPSHOT_AVAILABLE` instead of 500 errors when no data exists

### Verification

To verify the storage provider is correctly selected:

```bash
# Check application logs at startup for storage provider selection
# You should see: "Storage provider selected: gcp" or "Storage provider selected: local"

# Test with GCP storage
STORAGE_PROVIDER=gcp npm start

# Test with local storage (default)
STORAGE_PROVIDER=local npm start
# or simply
npm start
```

## Prerequisites

Before migrating, ensure you have:

1. **GCP Project**: An active GCP project with billing enabled
2. **GCP CLI**: `gcloud` CLI installed and authenticated
3. **Required APIs**: Enable the following APIs in your GCP project:
   - Cloud Firestore API
   - Cloud Storage API
4. **IAM Permissions**: Service account with required roles (see below)

### Required IAM Roles

The service account running Toast-Stats needs:

| Role                        | Purpose                         |
| --------------------------- | ------------------------------- |
| `roles/datastore.user`      | Firestore read/write access     |
| `roles/storage.objectAdmin` | Cloud Storage read/write access |

## Migration Steps

### Step 1: Create GCP Resources

#### Create Firestore Database

```bash
# Create Firestore database in Native mode
gcloud firestore databases create \
  --project=YOUR_PROJECT_ID \
  --location=YOUR_REGION \
  --type=firestore-native
```

Recommended regions:

- `us-central1` (Iowa)
- `us-east1` (South Carolina)
- `europe-west1` (Belgium)

#### Create Cloud Storage Bucket

```bash
# Create GCS bucket
gsutil mb -p YOUR_PROJECT_ID -l YOUR_REGION gs://YOUR_BUCKET_NAME

# Set lifecycle policy (optional - for cost management)
gsutil lifecycle set lifecycle.json gs://YOUR_BUCKET_NAME
```

Example `lifecycle.json` for archiving old data:

```json
{
  "rule": [
    {
      "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" },
      "condition": { "age": 90 }
    }
  ]
}
```

### Step 2: Configure Environment Variables

Update your deployment configuration with the following environment variables:

```bash
# Storage provider selection
STORAGE_PROVIDER=gcp

# GCP configuration
GCP_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name

# Optional: Custom Firestore collection name (default: 'snapshots')
FIRESTORE_COLLECTION=snapshots
```

#### Cloud Run Configuration

For Cloud Run deployments, set these in your service configuration:

```yaml
# cloud-run-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: toast-stats-api
spec:
  template:
    spec:
      containers:
        - image: gcr.io/toast-stats-prod-6d64a/toast-stats-api:latest
          env:
            - name: STORAGE_PROVIDER
              value: 'gcp'
            - name: GCP_PROJECT_ID
              value: 'toast-stats-prod-6d64a'
            - name: GCS_BUCKET_NAME
              value: 'toast-stats-raw-csv-toast-stats-prod-6d64a'
```

Or using `gcloud`:

```bash
gcloud run deploy toast-stats-api \
  --region us-east1 \
  --image gcr.io/toast-stats-prod-6d64a/toast-stats-api:latest \
  --set-env-vars "STORAGE_PROVIDER=gcp,GCP_PROJECT_ID=toast-stats-prod-6d64a,GCS_BUCKET_NAME=toast-stats-raw-csv-toast-stats-prod-6d64a"
```

### Step 3: Verify Configuration

Before deploying, verify your configuration:

```bash
# Test GCP authentication
gcloud auth application-default print-access-token

# Test Firestore access
gcloud firestore databases list --project=YOUR_PROJECT_ID

# Test GCS access
gsutil ls gs://YOUR_BUCKET_NAME
```

### Step 4: Deploy and Initialize

1. **Deploy the application** with the new environment variables
2. **Trigger a refresh** to populate the GCP storage with fresh data
3. **Verify data** by checking the dashboard displays correctly

```bash
# Trigger refresh via API
curl -X POST https://your-app-url/api/refresh

# Or use the collector CLI to populate cache first
npx collector-cli scrape --date 2024-01-15
```

### Step 5: Verify Migration

After deployment, verify the migration was successful:

1. **Check Firestore Console**: Navigate to Firestore in GCP Console and verify the `snapshots` collection exists
2. **Check GCS Console**: Navigate to Cloud Storage and verify the bucket contains `raw-csv/` prefixed objects
3. **Test API Endpoints**: Verify the application returns data correctly

```bash
# Test snapshot retrieval
curl https://your-app-url/api/snapshots/latest

# Test district data
curl https://your-app-url/api/districts/42
```

## Rollback Procedures

If you need to rollback to local storage:

### Quick Rollback

1. **Update environment variables**:

   ```bash
   STORAGE_PROVIDER=local
   ```

2. **Redeploy** the application

3. **Trigger refresh** to populate local storage

### Full Rollback with Data Preservation

If you need to preserve GCP data for later:

1. **Export Firestore data**:

   ```bash
   gcloud firestore export gs://YOUR_BUCKET_NAME/firestore-backup
   ```

2. **Keep GCS bucket** - data remains accessible3. **Switch to local storage** as described above

### Emergency Rollback

For immediate rollback without data preservation:

```bash
# Update Cloud Run service to use local storage
gcloud run services update toast-stats-api \
  --region us-east1 \
  --update-env-vars "STORAGE_PROVIDER=local"
```

## Data Structure Reference

### Firestore Document Structure

```text
snapshots/                          # Collection
  └── 2024-01-15/                   # Document (ISO date as ID)
        ├── metadata                # Snapshot metadata
        ├── manifest                # District manifest
        ├── rankings                # Optional rankings data
        └── districts/              # Subcollection
              ├── district_42       # District document
              └── district_43       # District document
```

### GCS Object Structure

```text
raw-csv/
  └── 2024-01-15/
        ├── all-districts.csv
        ├── metadata.json
        └── district-42/
              ├── club-performance.csv
              └── division-performance.csv
```

## Troubleshooting

### Empty Storage Scenarios

When the application starts with empty storage (no snapshots available), it returns HTTP 503 responses with the `NO_SNAPSHOT_AVAILABLE` error code. This is expected behavior and indicates that a refresh operation is needed.

#### HTTP 503 `NO_SNAPSHOT_AVAILABLE` Response

**Symptoms**:

- API endpoints return HTTP 503 status code
- Response body contains:

  ```json
  {
    "error": {
      "code": "NO_SNAPSHOT_AVAILABLE",
      "message": "No data snapshot available yet",
      "details": "Run a refresh operation to create the first snapshot"
    }
  }
  ```

- Frontend displays the onboarding dialog

**Cause**: No successful snapshot exists in storage. This is normal for:

- Fresh deployments
- After switching storage providers
- After clearing storage data

**Solution**:

1. **Trigger a refresh operation** to populate storage:

   ```bash
   # Via API
   curl -X POST https://your-app-url/api/refresh

   # Or use the collector CLI
   npx collector-cli scrape --date $(date +%Y-%m-%d)
   ```

2. **Verify the refresh completed successfully**:

   ```bash
   # Check for latest snapshot
   curl https://your-app-url/api/snapshots/latest
   ```

3. **Check logs for refresh errors** if the 503 persists after refresh:

   ```bash
   # Cloud Run logs
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=toast-stats-api" --limit=50
   ```

#### Empty Directory Handling (Local Storage)

When using local storage (`STORAGE_PROVIDER=local`), the application handles missing or empty snapshot directories gracefully:

- **Missing snapshots directory**: Returns `null` from `getLatestSuccessful()`, triggering 503 response
- **Empty snapshots directory**: Same behavior as missing directory
- **No successful snapshots**: Returns `null` even if failed snapshots exist

This ensures the application works correctly on fresh deployments without requiring manual directory creation.

### Common Issues

#### "StorageConfigurationError: GCP storage provider selected but required configuration is missing"

**Cause**: Missing `GCP_PROJECT_ID` or `GCS_BUCKET_NAME` environment variables.

**Solution**: Ensure both variables are set in your deployment configuration.

#### "Permission denied" errors

**Cause**: Service account lacks required IAM roles.

**Solution**: Grant `roles/datastore.user` and `roles/storage.objectAdmin` to the service account.

#### "Firestore database not found"

**Cause**: Firestore database not created or wrong project ID.

**Solution**: Create the Firestore database using `gcloud firestore databases create`.

#### Slow performance after migration

**Cause**: Network latency to GCP services.

**Solution**:

- Ensure Cloud Run and storage are in the same region
- Check circuit breaker isn't tripping due to transient errors
- Review Firestore indexes (none required for current queries)

### Debugging Commands

```bash
# Check current storage configuration
curl https://your-app-url/api/health

# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=toast-stats-api" --limit=50

# Check Firestore operations
gcloud logging read "resource.type=datastore_database" --limit=50
```

## Cost Considerations

### Firestore Costs

- **Document reads**: $0.06 per 100,000 reads
- **Document writes**: $0.18 per 100,000 writes
- **Storage**: $0.18 per GB/month

Estimated monthly cost for typical usage (daily refresh, moderate reads): **$1-5/month**

### Cloud Storage Costs

- **Storage**: $0.020 per GB/month (Standard)
- **Operations**: $0.005 per 10,000 operations

Estimated monthly cost for typical usage: **$0.50-2/month**

### Cost Optimization Tips

1. **Use lifecycle policies** to move old data to cheaper storage classes
2. **Limit snapshot retention** if historical data isn't needed
3. **Monitor usage** via GCP Cost Management

## Security Considerations

1. **Bucket Access**: Ensure GCS bucket has public access prevention enabled
2. **Firestore Rules**: Consider adding Firestore security rules for additional protection
3. **Service Account**: Use a dedicated service account with minimal permissions
4. **Audit Logging**: Enable Cloud Audit Logs for compliance

## Support

For issues with the migration:

1. Check the [GCP Emulator Setup Guide](./gcp-emulator-setup.md) for local testing
2. Review application logs for detailed error messages
3. Verify IAM permissions and API enablement in GCP Console
