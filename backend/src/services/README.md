# Backend Services Documentation

## Overview

The backend services implement a modular, dependency-injected architecture with clear separation of concerns. Recent refactoring has extracted specialized modules from large service files to improve maintainability.

## Service Architecture

### Core Services

#### RefreshService
**Purpose**: Orchestrates the complete data refresh workflow

**Extracted Modules**:
- `ClosingPeriodDetector` (234 lines): Month-end closing period detection
- `DataNormalizer` (364 lines): Raw data transformation to normalized format

**Responsibilities**:
- Coordinate scraping with circuit breaker protection
- Implement retry logic with exponential backoff
- Four-phase workflow: scraping → normalization → validation → snapshot creation

#### AnalyticsEngine
**Purpose**: Orchestrates analytics processing by delegating to specialized modules

**Extracted Modules** (in `analytics/` directory):
- `MembershipAnalyticsModule` (635 lines): Membership trends and year-over-year analysis
- `DistinguishedClubAnalyticsModule` (814 lines): Distinguished club tracking and projections
- `ClubHealthAnalyticsModule` (699 lines): At-risk club identification and health scoring
- `DivisionAreaAnalyticsModule` (448 lines): Division comparisons and area analysis
- `LeadershipAnalyticsModule` (665 lines): Leadership effectiveness analysis
- `AnalyticsUtils` (245 lines): Shared utility functions

#### RawCSVCacheService
**Purpose**: Caches raw CSV data from Toastmasters dashboard

**Extracted Modules**:
- `CacheSecurityManager` (281 lines): Path validation and security checks
- `CacheIntegrityValidator` (444 lines): Metadata validation and corruption detection

### Storage Services

- `FileSnapshotStore`: Legacy single-file snapshot storage
- `PerDistrictSnapshotStore`: Modern per-district directory-based storage
- `DistrictDataAggregator`: Efficient per-district data access with caching

### Infrastructure Services

- `ServiceContainer`: Dependency injection container
- `ProductionServiceFactory`: Production service instantiation
- `TestServiceFactory`: Test service instantiation with mock support

## Cache Service

The CacheService provides in-memory caching using `node-cache`:

### Features
- 15-minute default TTL
- Custom TTL per entry
- Cache bypass support
- Automatic cleanup
- Express middleware integration

### Usage

```typescript
import { cacheService } from '../services/CacheService.js'

// Set a value
cacheService.set('my-key', { data: 'value' })

// Get a value
const data = cacheService.get('my-key')

// Invalidate
cacheService.invalidate('my-key')
```

### Cache Middleware

```typescript
import { cacheMiddleware } from '../middleware/cache.js'

router.get('/data', cacheMiddleware({ ttl: 300 }), async (req, res) => {
  const data = await fetchData()
  res.json(data)
})
```

### Cache Bypass

```bash
# Query parameter
GET /api/districts?refresh=true

# Header
GET /api/districts
X-Bypass-Cache: true
```

## Testing

All services have comprehensive test coverage:
- Unit tests for core logic
- Integration tests for workflows
- Property-based tests for correctness properties

Run tests:
```bash
npm test
```

## Architecture Decisions

1. **Modular Extraction**: Large services (>1000 lines) are split into focused modules
2. **Dependency Injection**: Services use constructor injection for testability
3. **Interface-Based Design**: Services implement interfaces for mock support
4. **Property-Based Testing**: Universal correctness properties validated with fast-check
