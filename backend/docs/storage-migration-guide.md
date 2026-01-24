# Storage Migration Guide: Local to GCP

This guide documents the steps to migrate Toast-Stats from local filesystem storage to Google Cloud Platform (GCP) storage using Cloud Firestore and Cloud Storage.

## Overview

The Toast-Stats application supports two storage backends:

- **Local Storage** (default): Uses the local filesystem for development
- **GCP Storage**: Uses Cloud Firestore for snapshots and Cloud Storage for CSV files

Migration is a one-way process. **Backward compatibility with existing local data is not required** - the GCP storage starts fresh.

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
  name: toast-stats
spec:
  template:
    spec:
      containers:
        - image: gcr.io/YOUR_PROJECT/toast-stats:latest
          env:
            - name: STORAGE_PROVIDER
              value: 'gcp'
            - name: GCP_PROJECT_ID
              value: 'your-project-id'
            - name: GCS_BUCKET_NAME
              value: 'your-bucket-name'
```

Or using `gcloud`:

```bash
gcloud run deploy toast-stats \
  --image gcr.io/YOUR_PROJECT/toast-stats:latest \
  --set-env-vars "STORAGE_PROVIDER=gcp,GCP_PROJECT_ID=your-project-id,GCS_BUCKET_NAME=your-bucket-name"
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

# Or use the scraper CLI to populate cache first
npx scraper-cli scrape --date 2024-01-15
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
gcloud run services update toast-stats \
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
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=toast-stats" --limit=50

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
