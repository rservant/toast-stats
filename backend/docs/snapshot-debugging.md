# Snapshot Store Debugging and Management

This document describes the debugging and management capabilities for the snapshot-based data architecture.

## Overview

The snapshot debugging system provides both HTTP API endpoints and CLI tools for:

- Listing snapshots with filtering and limiting
- Inspecting specific snapshots in detail
- Checking snapshot store health and integrity
- Monitoring performance metrics
- Debugging snapshot-related issues

## HTTP API Endpoints

All admin endpoints require authentication via the `ADMIN_TOKEN` environment variable.

### Authentication

Include the admin token in one of these ways:

- Header: `Authorization: Bearer <ADMIN_TOKEN>`
- Query parameter: `?token=<ADMIN_TOKEN>`

### Endpoints

#### `GET /api/admin/snapshots`

List snapshots with optional filtering and limiting.

**Query Parameters:**

- `limit` - Maximum number of snapshots to return (default: unlimited)
- `status` - Filter by status (`success`, `partial`, `failed`)
- `schema_version` - Filter by schema version
- `calculation_version` - Filter by calculation version
- `created_after` - Filter snapshots created after date (ISO string)
- `created_before` - Filter snapshots created before date (ISO string)
- `min_district_count` - Filter by minimum district count

**Example:**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5001/api/admin/snapshots?limit=10&status=success"
```

#### `GET /api/admin/snapshots/:snapshotId`

Inspect a specific snapshot in detail.

**Example:**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5001/api/admin/snapshots/1704067200000"
```

#### `GET /api/admin/snapshots/:snapshotId/payload`

Get the full payload data for a specific snapshot.

**Example:**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5001/api/admin/snapshots/1704067200000/payload"
```

#### `GET /api/admin/snapshot-store/health`

Check the health and status of the snapshot store.

**Example:**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5001/api/admin/snapshot-store/health"
```

#### `GET /api/admin/snapshot-store/integrity`

Validate the integrity of the snapshot store.

**Example:**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5001/api/admin/snapshot-store/integrity"
```

#### `GET /api/admin/snapshot-store/performance`

Get performance metrics for the snapshot store.

**Example:**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5001/api/admin/snapshot-store/performance"
```

#### `POST /api/admin/snapshot-store/performance/reset`

Reset performance metrics.

**Example:**

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5001/api/admin/snapshot-store/performance/reset"
```

## CLI Tool

The `snapshot-debug` CLI tool provides command-line access to debugging features.

### Usage

```bash
npm run snapshot-debug -- <command> [options]
```

### Commands

#### `list`

List snapshots with optional filtering.

**Options:**

- `-l, --limit <number>` - Maximum number of snapshots to return (default: 10)
- `-s, --status <status>` - Filter by status (success|partial|failed)
- `--schema-version <version>` - Filter by schema version
- `--calculation-version <version>` - Filter by calculation version
- `--created-after <date>` - Filter snapshots created after date (ISO string)
- `--created-before <date>` - Filter snapshots created before date (ISO string)
- `--min-districts <count>` - Filter by minimum district count
- `--json` - Output as JSON

**Examples:**

```bash
# List all snapshots
npm run snapshot-debug -- list

# List only successful snapshots
npm run snapshot-debug -- list --status success

# List recent snapshots in JSON format
npm run snapshot-debug -- list --limit 5 --json
```

#### `inspect <snapshotId>`

Inspect a specific snapshot in detail.

**Options:**

- `--json` - Output as JSON
- `--include-payload` - Include full payload data

**Examples:**

```bash
# Inspect a snapshot
npm run snapshot-debug -- inspect 1704067200000

# Get full snapshot data as JSON
npm run snapshot-debug -- inspect 1704067200000 --json --include-payload
```

#### `health`

Check snapshot store health and status.

**Options:**

- `--json` - Output as JSON

**Examples:**

```bash
# Check health
npm run snapshot-debug -- health

# Get health data as JSON
npm run snapshot-debug -- health --json
```

#### `performance`

View snapshot store performance metrics.

**Options:**

- `--json` - Output as JSON
- `--reset` - Reset performance metrics after displaying

**Examples:**

```bash
# View performance metrics
npm run snapshot-debug -- performance

# Reset metrics
npm run snapshot-debug -- performance --reset
```

#### `integrity`

Validate snapshot store integrity.

**Options:**

- `--json` - Output as JSON

**Examples:**

```bash
# Check integrity
npm run snapshot-debug -- integrity

# Get integrity data as JSON
npm run snapshot-debug -- integrity --json
```

## Common Debugging Scenarios

### 1. Check Overall System Health

```bash
npm run snapshot-debug -- health
```

### 2. Find Recent Failed Snapshots

```bash
npm run snapshot-debug -- list --status failed --limit 5
```

### 3. Inspect a Specific Snapshot

```bash
npm run snapshot-debug -- inspect <snapshot-id> --include-payload
```

### 4. Monitor Performance

```bash
npm run snapshot-debug -- performance
```

### 5. Validate Store Integrity

```bash
npm run snapshot-debug -- integrity
```

### 6. List Snapshots by Date Range

```bash
npm run snapshot-debug -- list --created-after "2024-01-01T00:00:00Z" --created-before "2024-01-02T00:00:00Z"
```

## Environment Configuration

Set the `ADMIN_TOKEN` environment variable to enable admin functionality:

```bash
export ADMIN_TOKEN="your-secure-admin-token-here"
```

For production environments, ensure the token is:

- Cryptographically secure (minimum 32 characters)
- Stored securely (not in source code)
- Rotated regularly

## Security Considerations

- Admin endpoints are protected by token authentication
- All admin operations are logged with IP addresses and timestamps
- Rate limiting should be applied to admin endpoints in production
- Admin tokens should be rotated regularly
- Access to admin functionality should be restricted to authorized personnel only

## Troubleshooting

### Common Issues

1. **"ADMIN_TOKEN_NOT_CONFIGURED" error**
   - Set the `ADMIN_TOKEN` environment variable
   - Restart the application after setting the token

2. **"UNAUTHORIZED" error**
   - Verify the admin token is correct
   - Check that the token is properly included in the request

3. **"No snapshots found"**
   - Check if any refresh operations have been run
   - Verify the cache directory is accessible
   - Run a manual refresh to create snapshots

4. **Performance metrics show 0 reads**
   - Performance metrics are reset on application restart
   - Metrics only track reads through the optimized methods
   - Make some API calls to generate metrics

### Getting Help

If you encounter issues:

1. Check the application logs for detailed error messages
2. Run the health check to identify system issues
3. Use the integrity check to validate store consistency
4. Review the snapshot listing to understand current state
