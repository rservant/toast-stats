# Cache Migration Guide

## Overview

This guide documents the cache versioning system and provides instructions for managing cache migrations when the data format or calculation methodology changes.

## Cache Versioning System

The application uses a cache versioning system to track changes in cached data structure and calculations. The version is stored in the `CacheManager` class and included in cache metadata.

### Version History

| Version | Date | Changes | Migration Required |
|---------|------|---------|-------------------|
| v1 | Initial | Simple rank-sum scoring system | N/A |
| v2 | November 2025 | Borda count scoring system | Yes - Clear all rankings cache |

## Current Version: v2 (Borda Count Scoring)

### What Changed

The district rankings calculation methodology was updated from a simple rank-sum approach to a proper Borda count system:

**Old System (v1):**
- Districts ranked in each category (1 = best)
- Aggregate score = sum of ranks (lower is better)
- Example: Rank #5 + Rank #3 + Rank #8 = Score 16

**New System (v2):**
- Districts ranked in each category (1 = best)
- Borda points assigned: `bordaPoints = totalDistricts - rank + 1`
- Aggregate score = sum of Borda points (higher is better)
- Example: If 100 districts, rank #5 gets 96 points, rank #3 gets 98 points, rank #8 gets 93 points → Total: 287 points

### Why This Matters

Cached rankings from v1 use the old scoring methodology and will display incorrect aggregate scores. Users would see:
- Inverted rankings (lower scores appearing better)
- Incompatible score comparisons
- Confusing historical data

### Migration Required

**All district rankings cache must be cleared** when deploying v2 to ensure users see accurate rankings.

## Cache Structure

The application maintains two types of cache:

### 1. District Rankings Cache (Affected by v2 Migration)

**Location:** `backend/cache/`

**Files:**
- `districts_YYYY-MM-DD.json` - Daily district rankings snapshots
- `metadata_YYYY-MM-DD.json` - Metadata for each snapshot
- `historical_index.json` - Index of all cached dates

**Migration Action:** **MUST BE CLEARED**

These files contain aggregate scores calculated using the old methodology and must be regenerated with the new Borda count system.

### 2. District-Level Performance Cache (NOT Affected)

**Location:** `backend/cache/districts/{districtId}/`

**Files:**
- `{districtId}/YYYY-MM-DD.json` - District, division, and club performance data

**Migration Action:** **NO ACTION REQUIRED**

These files contain raw performance data (not rankings) and are not affected by the scoring methodology change.

## Migration Instructions

### Automatic Migration (Recommended)

The `CacheManager` includes automatic version checking and cleanup:

```typescript
import { CacheManager } from './services/CacheManager.js'

const cacheManager = new CacheManager()

// Check current version
const version = CacheManager.getCacheVersion()
console.log(`Current cache version: ${version}`)

// Automatically clear incompatible cache
const clearedCount = await cacheManager.clearIncompatibleCache()
console.log(`Cleared ${clearedCount} incompatible cache entries`)
```

This method:
- Checks each cached date's version
- Removes entries that don't match current version
- Clears the historical index if any entries were removed
- Logs all actions for audit trail

### Manual Migration (Production Deployment)

For production deployments, follow these steps:

#### Step 1: Backup Existing Cache (Optional)

```bash
# Create backup directory
mkdir -p cache_backup

# Backup rankings cache
cp backend/cache/districts_*.json cache_backup/
cp backend/cache/metadata_*.json cache_backup/
cp backend/cache/historical_index.json cache_backup/
```

#### Step 2: Clear Rankings Cache

```bash
# If using Docker:
docker exec -it <backend-container> rm -rf /app/cache/districts_*.json
docker exec -it <backend-container> rm -rf /app/cache/metadata_*.json
docker exec -it <backend-container> rm -rf /app/cache/historical_index.json

# If running directly:
rm -rf backend/cache/districts_*.json
rm -rf backend/cache/metadata_*.json
rm -rf backend/cache/historical_index.json
```

#### Step 3: Verify Cache Cleared

```bash
# Check that only district-level subdirectories remain
ls -la backend/cache/

# Should see:
# drwxr-xr-x  districts/
# (No districts_*.json files)
```

#### Step 4: Deploy New Version

Deploy the application with v2 code.

#### Step 5: Trigger Fresh Data Fetch

```bash
# Access the rankings endpoint to trigger fresh data fetch
curl https://api.yourdomain.com/api/districts/rankings

# Or access the frontend rankings page
# The first request will fetch and cache new data with v2 scoring
```

#### Step 6: Verify New Rankings

- Check that rankings display correctly
- Verify aggregate scores are higher numbers (Borda points)
- Confirm sorting is by highest score first
- Check that percentage values display alongside ranks

## Cache Version Checking

### Check if Cache is Compatible

```typescript
const isCompatible = await cacheManager.isCacheVersionCompatible('2025-11-22')
if (!isCompatible) {
  console.log('Cache needs to be regenerated')
}
```

### Get Metadata with Version

```typescript
const metadata = await cacheManager.getMetadata('2025-11-22')
console.log(`Cache version: ${metadata?.cacheVersion || 1}`)
```

## Future Migrations

When making breaking changes to cached data:

### 1. Increment Cache Version

```typescript
// In CacheManager.ts
private static readonly CACHE_VERSION = 3  // Increment from 2 to 3
```

### 2. Document the Change

Update the version history table in this document:

```markdown
| v3 | [Date] | [Description of changes] | [Yes/No] |
```

### 3. Update Deployment Checklist

Add specific migration instructions to `DEPLOYMENT_CHECKLIST.md`.

### 4. Test Migration

- Test automatic migration with `clearIncompatibleCache()`
- Test manual migration steps
- Verify data integrity after migration
- Test rollback procedures

### 5. Communicate to Team

- Document breaking changes in release notes
- Notify operations team of required migration
- Provide rollback plan if issues occur

## Rollback Procedures

If issues occur after migration:

### Option 1: Restore from Backup

```bash
# Restore backed up cache
cp cache_backup/*.json backend/cache/

# Restart application with previous version
git checkout <previous-commit>
docker-compose restart
```

### Option 2: Clear and Regenerate

```bash
# Clear all cache
rm -rf backend/cache/*.json

# Restart application
# Cache will regenerate on first request
```

## Monitoring

### Check Cache Version in Production

```bash
# Check a metadata file
cat backend/cache/metadata_2025-11-22.json | grep cacheVersion

# Should show: "cacheVersion": 2
```

### Verify No v1 Cache Remains

```bash
# Check all metadata files
for file in backend/cache/metadata_*.json; do
  version=$(cat "$file" | grep -o '"cacheVersion":[0-9]*' | cut -d: -f2)
  if [ -z "$version" ] || [ "$version" -lt 2 ]; then
    echo "Old cache found: $file"
  fi
done
```

## Best Practices

1. **Always backup before migration** - Even though cache can be regenerated, backups provide safety net
2. **Test in staging first** - Verify migration works before production deployment
3. **Monitor after deployment** - Check logs for cache regeneration activity
4. **Document all changes** - Keep this guide updated with each version change
5. **Communicate clearly** - Ensure team knows about required migrations
6. **Plan for downtime** - First requests after cache clear will be slower
7. **Version all cache data** - Always include version in new cache entries

## Troubleshooting

### Issue: Rankings show incorrect scores after deployment

**Cause:** Old cache not cleared properly

**Solution:**
```bash
# Clear all rankings cache
rm -rf backend/cache/districts_*.json
rm -rf backend/cache/metadata_*.json
rm -rf backend/cache/historical_index.json

# Restart application
docker-compose restart backend
```

### Issue: Some dates show old scores, others show new scores

**Cause:** Partial cache clear or mixed version cache

**Solution:**
```bash
# Use automatic cleanup
node -e "
  import('./backend/dist/services/CacheManager.js').then(m => {
    const cm = new m.CacheManager();
    cm.clearIncompatibleCache().then(count => {
      console.log(\`Cleared \${count} entries\`);
    });
  });
"
```

### Issue: Historical comparisons show inconsistent data

**Cause:** Comparing v1 and v2 scores

**Solution:**
- Clear all historical cache and regenerate
- Or add UI warning about methodology change
- Or maintain separate v1/v2 historical views

## Support

For questions or issues with cache migration:
1. Check application logs for cache-related errors
2. Review this guide for troubleshooting steps
3. Contact the development team
4. Reference the deployment checklist

## Related Documentation

- [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) - Production deployment steps
- [backend/src/services/README.md](src/services/README.md) - Cache service documentation
- [.kiro/specs/district-rankings-improvements/design.md](../.kiro/specs/district-rankings-improvements/design.md) - Borda count system design
