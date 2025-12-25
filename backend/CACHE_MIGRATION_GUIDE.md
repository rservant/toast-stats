# Cache Migration Guide

This guide explains the cache versioning system and how to handle cache migrations when the ranking calculation methodology changes.

## Cache Versioning System

The application uses a cache versioning system to track changes in data format and calculation methodologies. This ensures that cached data remains compatible with the current application version.

### Version History

| Version | Date | Changes | Migration Required |
|---------|------|---------|-------------------|
| v1 | Initial | Simple rank-sum scoring system | N/A |
| v2 | Nov 2025 | Borda count scoring with percentage-based ranking | Yes - Clear all rankings cache |

### Current Version

The current cache version is **v2** (Borda count system).

## Cache Structure

### Rankings Cache Files

These files contain district rankings data and are affected by scoring methodology changes:

- `districts_YYYY-MM-DD.json` - District rankings for specific dates
- `metadata_YYYY-MM-DD.json` - Metadata about cached rankings
- `historical_index.json` - Index of all cached rankings dates

### District Performance Cache (Preserved)

These files contain individual district performance data and are NOT affected by ranking changes:

- `districts/{districtId}/performance_YYYY-MM-DD.json` - Individual district data
- `districts/{districtId}/metadata.json` - District-specific metadata

## Migration Process

### Automatic Migration

The system includes automatic cache version detection and migration:

1. **Version Detection**: When loading cached data, the system checks the `cacheVersion` field in metadata
2. **Compatibility Check**: If the cache version doesn't match the current version, the data is considered incompatible
3. **Automatic Cleanup**: The `clearIncompatibleCache()` method automatically removes outdated cache entries

### Manual Migration

For deployment scenarios, use the provided cache clearing script:

```bash
# Automated script (recommended)
npm run clear-rankings-cache

# Manual commands (alternative)
rm -rf cache/districts_*.json
rm -rf cache/metadata_*.json
rm -rf cache/historical_index.json
```

### Docker Deployment Migration

```bash
# Using the automated script
docker exec -it <backend-container> npm run clear-rankings-cache

# Manual approach
docker exec -it <backend-container> rm -rf /app/cache/districts_*.json
docker exec -it <backend-container> rm -rf /app/cache/metadata_*.json
docker exec -it <backend-container> rm -rf /app/cache/historical_index.json
```

## Cache Version Implementation

### CacheManager Configuration

The `CacheManager` class includes version tracking:

```typescript
// Current cache version
private static readonly CACHE_VERSION = 2

// Version compatibility check
async isCacheVersionCompatible(date: string): Promise<boolean> {
  const metadata = await this.getMetadata(date)
  const cacheVersion = metadata?.cacheVersion || 1 // Default to v1 for legacy
  return cacheVersion === CacheManager.CACHE_VERSION
}
```

### Metadata Structure

Each cached ranking includes version information:

```typescript
interface CacheMetadata {
  date: string
  timestamp: number
  dataCompleteness: 'complete' | 'partial' | 'empty'
  districtCount: number
  source: string
  programYear: string
  cacheVersion: number  // Version tracking field
}
```

## Deployment Checklist

When deploying changes that affect ranking calculations:

### Pre-Deployment

- [ ] Identify if changes affect ranking calculations
- [ ] Increment `CACHE_VERSION` in `CacheManager.ts` if needed
- [ ] Update this migration guide with new version information
- [ ] Test migration script in staging environment

### During Deployment

- [ ] Deploy application code
- [ ] Run cache clearing script: `npm run clear-rankings-cache`
- [ ] Verify cache was cleared successfully
- [ ] Restart application if needed

### Post-Deployment

- [ ] Access rankings page to trigger fresh data fetch
- [ ] Verify new rankings display correctly
- [ ] Monitor logs for any cache-related errors
- [ ] Confirm cache version is correct in new metadata

## Troubleshooting

### Cache Version Mismatch Errors

If you see warnings about cache version mismatches:

```
Cache version mismatch: date=2025-11-30, cacheVersion=1, currentVersion=2
```

**Solution**: Run the cache clearing script to remove incompatible cache entries.

### Incomplete Cache Clearing

If rankings still show old values after clearing:

1. Verify all cache files were removed:
   ```bash
   ls -la cache/
   # Should only show districts/ subdirectory
   ```

2. Check for cached data in memory:
   ```bash
   # Restart the application
   docker-compose restart backend
   ```

3. Force refresh by accessing the API directly:
   ```bash
   curl https://api.yourdomain.com/api/districts/rankings
   ```

### Performance Impact

Cache clearing will cause:

- **Temporary slowdown**: First request after clearing will be slower as data is re-fetched
- **Increased API calls**: Fresh data will be scraped from Toastmasters dashboard
- **Memory usage**: New cache entries will be created and stored

**Mitigation**: Clear cache during low-traffic periods and consider pre-warming cache by accessing key endpoints.

## Future Considerations

### Adding New Cache Versions

When making changes that require cache invalidation:

1. **Increment Version**: Update `CACHE_VERSION` in `CacheManager.ts`
2. **Document Changes**: Add entry to version history table above
3. **Update Migration**: Modify clearing script if needed
4. **Test Migration**: Verify migration works in staging environment

### Backward Compatibility

The system is designed to handle missing version information gracefully:

- **Legacy Cache**: Cache entries without version are treated as v1
- **Graceful Degradation**: Incompatible cache is automatically cleared
- **No Data Loss**: Individual district data is preserved during migrations

### Monitoring

Consider adding monitoring for:

- Cache hit/miss rates after migrations
- Cache version distribution in logs
- Migration script execution success/failure
- Performance impact of cache clearing

## API Endpoints

### Cache Management Endpoints

```bash
# Clear all rankings cache
DELETE /api/districts/cache

# Get cache statistics
GET /api/districts/cache/stats

# Check cache version compatibility
GET /api/districts/cache/version
```

### Manual Cache Operations

```bash
# Check current cache version
curl https://api.yourdomain.com/api/districts/cache/version

# Clear cache via API
curl -X DELETE https://api.yourdomain.com/api/districts/cache

# Get cache statistics
curl https://api.yourdomain.com/api/districts/cache/stats
```

## Support

For issues related to cache migrations:

1. **Check Logs**: Review application logs for cache-related errors
2. **Verify Version**: Confirm cache version matches application version
3. **Manual Clear**: Use cache clearing script as fallback
4. **Contact Support**: Provide cache statistics and error logs

---

**Last Updated**: November 2025  
**Current Cache Version**: v2 (Borda Count System)