# Firestore Indexes Guide

## Overview

The Toastmasters District Visualizer uses Google Cloud Firestore for storing snapshot data and configuration history. Firestore requires **composite indexes** for queries that combine multiple fields or use ordering operations. Without these indexes, queries fail with `FAILED_PRECONDITION` errors.

This document lists all required indexes, explains their purpose, and provides deployment and troubleshooting guidance.

## Why Indexes Are Needed

Firestore automatically creates single-field indexes, but queries that:

- Order by document ID (`__name__`) in descending order
- Combine equality filters with ordering
- Order by fields in subcollections

...require **composite indexes** that must be explicitly defined and deployed.

## Required Indexes

All required indexes are defined in `firestore.indexes.json` at the project root.

### Index 1: Snapshots Collection - Document ID Ordering

```json
{
  "collectionGroup": "snapshots",
  "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "__name__", "order": "DESCENDING" }]
}
```

**Purpose:** Enables listing snapshots in reverse chronological order (newest first).

**Required By:**

- `FirestoreSnapshotStorage.getLatest()` - Retrieves the most recent snapshot regardless of status
- `FirestoreSnapshotStorage.listSnapshots()` - Lists all snapshots ordered by date
- `FirestoreSnapshotStorage.isIndexHealthy()` - Health check query

**Query Pattern:**

```typescript
snapshotsCollection.orderBy('__name__', 'desc').limit(1).get()
```

### Index 2: Snapshots Collection - Status Filter with Document ID Ordering

```json
{
  "collectionGroup": "snapshots",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "metadata.status", "order": "ASCENDING" },
    { "fieldPath": "__name__", "order": "DESCENDING" }
  ]
}
```

**Purpose:** Enables filtering snapshots by status (e.g., "success") while maintaining reverse chronological order.

**Required By:**

- `FirestoreSnapshotStorage.getLatestSuccessful()` - Retrieves the most recent successful snapshot
- `FirestoreSnapshotStorage.listSnapshots()` - When filtering by status

**Query Pattern:**

```typescript
snapshotsCollection
  .where('metadata.status', '==', 'success')
  .orderBy('__name__', 'desc')
  .limit(1)
  .get()
```

### Index 3: History Subcollection - Timestamp Ordering

```json
{
  "collectionGroup": "history",
  "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "timestamp", "order": "DESCENDING" }]
}
```

**Purpose:** Enables listing configuration change history in reverse chronological order.

**Required By:**

- `FirestoreDistrictConfigStorage.getChangeHistory()` - Retrieves configuration change history

**Query Pattern:**

```typescript
historyCollection.orderBy('timestamp', 'desc').limit(limit).get()
```

## Deployment Instructions

### Prerequisites

1. **Firebase CLI** installed: `npm install -g firebase-tools`
2. **Firebase project** configured in `firebase.json`
3. **Authentication** to Firebase: `firebase login`

### Deploy Indexes

Deploy indexes using the Firebase CLI:

```bash
# Deploy only Firestore indexes
firebase deploy --only firestore:indexes

# Or deploy all Firebase resources
firebase deploy
```

### Verify Deployment

After deployment, verify indexes in the Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes**
4. Confirm all three indexes show status **Enabled**

**Note:** Index creation can take several minutes. During this time, queries requiring the index will fail.

## Index Build Time

Index build time depends on:

- **Collection size**: Larger collections take longer
- **Number of documents**: More documents = longer build time
- **Field complexity**: Nested fields may take longer

Typical build times:

- Empty collection: < 1 minute
- Small collection (< 1,000 docs): 1-5 minutes
- Medium collection (1,000-100,000 docs): 5-30 minutes
- Large collection (> 100,000 docs): 30+ minutes

## Troubleshooting

### Error: FAILED_PRECONDITION

**Symptom:**

```text
Error: 9 FAILED_PRECONDITION: The query requires an index.
You can create it here: https://console.firebase.google.com/...
```

**Cause:** A required composite index does not exist or is still building.

**Solutions:**

1. **Deploy indexes:**

   ```bash
   firebase deploy --only firestore:indexes
   ```

2. **Create manually:** Click the URL in the error message to create the index in Firebase Console

3. **Wait for build:** If recently deployed, wait for index to finish building (check status in Firebase Console)

### Error: Index Still Building

**Symptom:** Queries fail even after deploying indexes.

**Cause:** Index is still being built by Firestore.

**Solution:**

1. Check index status in Firebase Console → Firestore → Indexes
2. Wait for status to change from **Building** to **Enabled**
3. For large collections, this may take 30+ minutes

### Application Returns Empty Data

**Symptom:** API endpoints return empty arrays or null values without errors.

**Cause:** The application implements graceful degradation - when index errors occur, it returns safe defaults instead of throwing errors.

**Diagnosis:**

1. Check application logs for warnings like:

   ```text
   Firestore query failed due to missing index
   ```

2. Look for `indexUrl` in the log entry - this provides the direct link to create the missing index

**Solution:** Deploy the missing indexes as described above.

### Health Check Fails

**Symptom:** `isReady()` returns `false` or health endpoints report unhealthy.

**Cause:** Index health check detected missing indexes.

**Diagnosis:**

```typescript
const health = await storage.isIndexHealthy()
console.log(health)
// { healthy: false, missingIndexes: [...], indexCreationUrls: [...] }
```

**Solution:** Deploy indexes using the URLs provided in `indexCreationUrls`.

## Creating Indexes Manually

If you cannot use the Firebase CLI, create indexes manually:

### Via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes**
4. Click **Create Index**
5. Configure each index:

**Index 1:**

- Collection ID: `snapshots`
- Fields: `__name__` (Descending)
- Query scope: Collection

**Index 2:**

- Collection ID: `snapshots`
- Fields: `metadata.status` (Ascending), `__name__` (Descending)
- Query scope: Collection

**Index 3:**

- Collection ID: `history`
- Fields: `timestamp` (Descending)
- Query scope: Collection

### Via Error Message Links

When a query fails due to a missing index, the error message includes a direct link to create that specific index:

```text
You can create it here: https://console.firebase.google.com/v1/r/project/...
```

Click this link to open the Firebase Console with the index configuration pre-filled.

## Configuration Files

### firestore.indexes.json

Located at the project root, this file defines all required indexes:

```json
{
  "indexes": [
    {
      "collectionGroup": "snapshots",
      "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "__name__", "order": "DESCENDING" }]
    },
    {
      "collectionGroup": "snapshots",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "metadata.status", "order": "ASCENDING" },
        { "fieldPath": "__name__", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "history",
      "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "timestamp", "order": "DESCENDING" }]
    }
  ],
  "fieldOverrides": []
}
```

### firebase.json

The Firebase configuration references the indexes file:

```json
{
  "firestore": {
    "indexes": "firestore.indexes.json"
  }
}
```

## Best Practices

### During Development

1. **Deploy indexes early:** Deploy indexes before writing queries that require them
2. **Test with emulator:** Use Firebase Emulator Suite for local development (note: emulator doesn't enforce index requirements)
3. **Monitor logs:** Watch for index-related warnings in application logs

### In Production

1. **Deploy indexes before code:** When adding new queries, deploy indexes before deploying code changes
2. **Monitor health checks:** Use `isIndexHealthy()` to proactively detect index issues
3. **Set up alerts:** Configure monitoring for `FAILED_PRECONDITION` errors

### Adding New Indexes

When adding queries that require new indexes:

1. Add the index definition to `firestore.indexes.json`
2. Deploy indexes: `firebase deploy --only firestore:indexes`
3. Wait for index to build (check Firebase Console)
4. Deploy application code with the new query
5. Update this documentation with the new index details

## Related Documentation

- [Firebase Firestore Indexes Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Backend Architecture](./BACKEND_ARCHITECTURE.md)
