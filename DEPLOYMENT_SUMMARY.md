# Deployment Summary: District Rankings Improvements

## Overview

This deployment introduces significant improvements to the district rankings system, including a new Borda count scoring methodology and enhanced display features.

## Key Changes

### 1. Borda Count Scoring System
- **Old System**: Simple rank-sum scoring (lower total = better)
- **New System**: Borda count scoring (higher total = better)
- **Impact**: More accurate and fair ranking calculations

### 2. Percentage-Based Ranking
- **Old Method**: Rankings based on absolute counts
- **New Method**: Rankings based on growth percentages
- **Categories Affected**: Paid Clubs, Total Payments, Distinguished Clubs

### 3. Enhanced Display
- **Addition**: Percentage values shown alongside rank numbers
- **Color Coding**: Green for positive growth, red for negative growth
- **Format**: "Rank #5 • +12.5%" or "Rank #3 • -2.1%"

## Critical Deployment Step: Cache Clearing

### ⚠️ IMPORTANT: Cache Must Be Cleared

**Why**: Existing cached rankings use the old scoring methodology and will display incorrect values if not cleared.

**What to Clear**: District rankings cache files (preserves individual district performance data)

**When**: Immediately after deploying the application code

### Automated Cache Clearing (Recommended)

```bash
# Docker deployment
docker exec -it <backend-container> npm run clear-rankings-cache

# Direct deployment  
cd backend && npm run clear-rankings-cache
```

### Manual Cache Clearing (Fallback)

```bash
# Docker deployment
docker exec -it <backend-container> rm -rf /app/cache/districts_*.json
docker exec -it <backend-container> rm -rf /app/cache/metadata_*.json
docker exec -it <backend-container> rm -rf /app/cache/historical_index.json

# Direct deployment
rm -rf backend/cache/districts_*.json
rm -rf backend/cache/metadata_*.json
rm -rf backend/cache/historical_index.json
```

## Verification Steps

After deployment and cache clearing:

1. **Restart Application**: Ensure clean state
   ```bash
   docker-compose restart backend
   ```

2. **Access Rankings Page**: Trigger fresh data fetch
   ```bash
   curl https://api.yourdomain.com/api/districts/rankings
   ```

3. **Verify Display**: Check that rankings show:
   - Higher aggregate scores for better-performing districts
   - Percentage values alongside rank numbers
   - Color-coded percentages (green/red)

4. **Check Cache Version**: Confirm using new system
   ```bash
   curl https://api.yourdomain.com/api/districts/cache/version
   ```

## Expected Results

### Before (Old System)
```json
{
  "districtId": "42",
  "aggregateScore": 15,  // Lower = better (rank sum)
  "clubsRank": 5,
  "paymentsRank": 3,
  "distinguishedRank": 7
}
```

### After (New System)
```json
{
  "districtId": "42", 
  "aggregateScore": 285, // Higher = better (Borda points)
  "clubsRank": 5,        // Based on growth %
  "paymentsRank": 3,     // Based on growth %
  "distinguishedRank": 7, // Based on % of clubs
  "clubGrowthPercent": 12.5,
  "paymentGrowthPercent": 8.3,
  "distinguishedPercent": 45.2
}
```

### Frontend Display
```
Paid Clubs: 123
Rank #5 • +12.5%

Total Payments: $45,678
Rank #3 • +8.3%

Distinguished: 45
Rank #7 • 45.2%
```

## Rollback Plan

If issues occur after deployment:

1. **Revert Code**: Deploy previous version
2. **Clear Cache**: Remove new cache entries
3. **Restart**: Ensure clean state
4. **Verify**: Confirm old system is working

## Monitoring

Monitor these metrics post-deployment:

- **Cache Hit Rate**: Should drop initially, then recover
- **API Response Times**: May be slower initially as cache rebuilds
- **Error Rates**: Watch for cache-related errors
- **User Feedback**: Verify rankings appear correct to users

## Support Information

### Cache Version System
- **Current Version**: v2 (Borda Count System)
- **Previous Version**: v1 (Simple Rank Sum)
- **Compatibility**: Automatic detection and migration

### Useful Commands
```bash
# Check cache version
curl https://api.yourdomain.com/api/districts/cache/version

# Get cache statistics  
curl https://api.yourdomain.com/api/districts/cache/stats

# Clear cache via API
curl -X DELETE https://api.yourdomain.com/api/districts/cache
```

### Documentation
- **Detailed Guide**: `backend/CACHE_MIGRATION_GUIDE.md`
- **Deployment Checklist**: `DEPLOYMENT_CHECKLIST.md`
- **Full Deployment Guide**: `DEPLOYMENT.md`

## Timeline

1. **Deploy Code** (5 minutes)
2. **Clear Cache** (1 minute) 
3. **Restart Services** (2 minutes)
4. **Verification** (5 minutes)
5. **Monitor** (30 minutes)

**Total Estimated Downtime**: 2-3 minutes (during restart)

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Cache Cleared**: ☐ Yes ☐ No  
**Verification Complete**: ☐ Yes ☐ No