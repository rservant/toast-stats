# Spec Creation Prompt: Raw CSV Cache System

## Problem Statement

The current Toastmasters Statistics application downloads CSV files from the Toastmasters dashboard on every refresh operation, even when the same data may have been downloaded recently. This creates unnecessary load on the external service and increases refresh times. We need a raw CSV caching system that stores downloaded CSV files organized by date and district, with intelligent cache-first lookup before downloading.

**Current Inefficiency:**
- Every refresh operation downloads 4 CSV files per district from scratch
- No reuse of previously downloaded raw CSV data
- Increased external service load and refresh times
- No historical preservation of raw CSV data for debugging or analysis

**Desired State:**
- Raw CSV files cached in organized directory structure by date and district
- Cache-first lookup before attempting downloads
- Preserved raw CSV data for historical analysis and debugging
- Reduced external service load and faster refresh operations

## Specification Requirements

Create a comprehensive specification to implement a raw CSV cache system with the following requirements:

### 1. Cache Directory Structure

Design a clean, organized directory structure for raw CSV files:

```
backend/cache/raw-csv/
├── 2026-01-06/                           # Date-based organization
│   ├── all-districts.csv                 # System-wide All Districts CSV
│   ├── district-42/                      # District-specific folder
│   │   ├── district-performance.csv      # District Performance CSV
│   │   ├── division-performance.csv      # Division Performance CSV
│   │   └── club-performance.csv          # Club Performance CSV
│   ├── district-15/
│   │   ├── district-performance.csv
│   │   ├── division-performance.csv
│   │   └── club-performance.csv
│   └── metadata.json                     # Cache metadata for the date
└── 2026-01-05/
    ├── all-districts.csv
    ├── district-42/
    └── metadata.json
```

### 2. Cache-First Data Acquisition

Update the data acquisition workflow to check cache before downloading:

**Current Flow:**
```
RefreshService → ToastmastersScraper → Download CSV → Parse → Normalize
```

**New Flow:**
```
RefreshService → RawCSVCache.get() → [Cache Hit: Return CSV] OR [Cache Miss: Download + Cache + Return CSV] → Parse → Normalize
```

### 3. Raw CSV Cache Service

Implement a `RawCSVCacheService` with the following capabilities:

#### Core Methods:
- `getCachedCSV(date: string, type: CSVType, districtId?: string): Promise<string | null>`
- `setCachedCSV(date: string, type: CSVType, csvContent: string, districtId?: string): Promise<void>`
- `hasCachedCSV(date: string, type: CSVType, districtId?: string): Promise<boolean>`
- `getCacheMetadata(date: string): Promise<CacheMetadata | null>`
- `clearCacheForDate(date: string): Promise<void>`
- `getCachedDates(): Promise<string[]>`

#### CSV Types:
```typescript
enum CSVType {
  ALL_DISTRICTS = 'all-districts',
  DISTRICT_PERFORMANCE = 'district-performance', 
  DIVISION_PERFORMANCE = 'division-performance',
  CLUB_PERFORMANCE = 'club-performance'
}
```

### 4. Integration with ToastmastersScraper

Update `ToastmastersScraper` to use the cache:

#### Modified Methods:
- `getAllDistricts(dateString?: string): Promise<ScrapedRecord[]>`
- `getDistrictPerformance(districtId: string, dateString?: string): Promise<ScrapedRecord[]>`
- `getDivisionPerformance(districtId: string, dateString?: string): Promise<ScrapedRecord[]>`
- `getClubPerformance(districtId: string, dateString?: string): Promise<ScrapedRecord[]>`

#### Cache Integration Logic:
1. Check if raw CSV exists in cache for the requested date
2. If cache hit: Load and parse cached CSV
3. If cache miss: Download CSV, cache it, then parse
4. Return parsed `ScrapedRecord[]` as before (no API changes)

### 5. Cache Metadata and Management

#### Metadata Structure:
```typescript
interface RawCSVCacheMetadata {
  date: string                    // YYYY-MM-DD format
  timestamp: number              // When cache was created
  programYear: string            // e.g., "2024-2025"
  csvFiles: {                    // Track which CSV files are cached
    allDistricts: boolean
    districts: {
      [districtId: string]: {
        districtPerformance: boolean
        divisionPerformance: boolean
        clubPerformance: boolean
      }
    }
  }
  downloadStats: {
    totalDownloads: number
    cacheHits: number
    cacheMisses: number
  }
  source: 'scraper'
  cacheVersion: number
}
```

#### Management Features:
- Automatic cleanup of old cache entries (configurable retention period)
- Cache statistics and monitoring
- Integrity validation for cached CSV files
- Compression support for storage efficiency (optional)

### 6. Configuration and Settings

#### Cache Configuration:
```typescript
interface RawCSVCacheConfig {
  cacheDir: string              // Base directory for raw CSV cache
  maxAgeDays: number           // Maximum age of cached files (default: 30)
  enableCompression: boolean    // Enable gzip compression (default: false)
  retentionPolicy: {
    maxFiles: number           // Maximum number of date directories
    cleanupInterval: number    // Cleanup interval in hours
  }
}
```

### 7. Error Handling and Resilience

#### Robust Error Handling:
- Graceful fallback to download when cache is corrupted
- Partial cache support (some CSV files cached, others downloaded)
- Atomic cache operations to prevent corruption
- Detailed error logging with cache operation context

#### Cache Validation:
- Verify CSV file integrity before returning cached content
- Validate file size and basic CSV structure
- Handle corrupted cache files gracefully

### 8. Performance Optimizations

#### Efficiency Features:
- Lazy loading of cache metadata
- Efficient file existence checks
- Minimal memory footprint for large CSV files
- Concurrent cache operations where safe

#### Monitoring:
- Cache hit/miss ratios
- Storage usage statistics
- Performance metrics for cache operations
- Integration with existing performance monitoring

### 9. Testing Strategy

#### Test Coverage:
- Unit tests for `RawCSVCacheService` methods
- Integration tests for scraper cache integration
- Property-based tests for cache consistency
- Performance tests for large CSV files
- Error scenario tests (corrupted cache, disk full, etc.)

#### Test Isolation:
- Unique cache directories per test
- Proper cleanup of test cache files
- Mock CSV content for predictable testing
- Concurrent test safety

### 10. Migration and Compatibility

#### Backward Compatibility:
- No changes to existing API contracts
- Existing snapshots and data remain unchanged
- Gradual rollout with feature flag support
- Fallback to direct download if cache fails

#### Migration Strategy:
- Cache is populated on-demand (no bulk migration needed)
- Existing refresh operations automatically populate cache
- No disruption to current data flow

## Constraints and Considerations

### Steering Document Alignment

#### Production Maintenance Compliance:
- **Operational Simplicity**: File-based cache with minimal dependencies
- **Low Overhead**: Efficient storage and retrieval patterns
- **Single-User Deployment**: Optimized for current deployment model
- **Explicit Operations**: Cache operations are explicit and traceable

#### Testing Requirements:
- **Test Isolation**: Proper resource isolation with unique directories
- **Concurrent Safety**: Tests must run safely in parallel
- **Behavior Protection**: Cache behavior must be thoroughly tested
- **Future Protection**: Tests preserve understanding of cache semantics

### Technical Constraints

#### File System Requirements:
- Cross-platform compatibility (Windows, macOS, Linux)
- Atomic file operations for cache consistency
- Efficient directory scanning and file operations
- Proper file locking where necessary

#### Integration Constraints:
- **Zero API Changes**: Existing scraper methods maintain same signatures
- **No Breaking Changes**: Current refresh workflow continues unchanged
- **Performance**: Cache operations must not slow down refresh process
- **Memory Efficiency**: Handle large CSV files without excessive memory usage

### Security Considerations

#### Path Safety:
- Validate all date strings to prevent path traversal
- Sanitize district IDs used in file paths
- Ensure cache directory containment
- Proper file permission handling

#### Data Integrity:
- Validate CSV content before caching
- Detect and handle corrupted cache files
- Atomic write operations to prevent partial files
- Checksum validation for cached files (optional)

## Deliverables Expected

### 1. Requirements Document
- Detailed functional requirements for raw CSV caching
- Non-functional requirements (performance, security, reliability)
- Integration requirements with existing services
- Configuration and deployment requirements

### 2. Design Document
- Cache directory structure and organization
- Service architecture and class design
- Integration points with existing scraper
- Error handling and resilience patterns
- Performance optimization strategies

### 3. Implementation Plan
- Step-by-step implementation approach
- Service creation and integration strategy
- Testing and validation approach
- Rollout and migration plan
- Risk mitigation strategies

### 4. API Specification
- `RawCSVCacheService` interface definition
- Configuration interfaces and types
- Error types and handling patterns
- Integration patterns with dependency injection

### 5. Testing Strategy
- Unit test plan for cache service
- Integration test plan for scraper integration
- Performance test scenarios
- Error scenario test coverage
- Test isolation and cleanup strategies

## Success Criteria

### Functional Success:
- [ ] Raw CSV files cached in organized date/district structure
- [ ] Cache-first lookup implemented in scraper methods
- [ ] No changes to existing API contracts or data flow
- [ ] Proper cache metadata tracking and management
- [ ] Robust error handling and fallback mechanisms

### Performance Success:
- [ ] Reduced external service calls for repeated data requests
- [ ] Faster refresh operations when cache hits occur
- [ ] Minimal memory overhead for cache operations
- [ ] Efficient file system operations

### Quality Success:
- [ ] Comprehensive test coverage for all cache operations
- [ ] Proper test isolation and concurrent safety
- [ ] Clear error messages and logging
- [ ] Documentation and usage examples

### Operational Success:
- [ ] Simple configuration and deployment
- [ ] Automatic cache cleanup and maintenance
- [ ] Monitoring and observability features
- [ ] Zero-downtime rollout capability

## Context Files to Reference

### Architecture and Design:
- `docs/BACKEND_ARCHITECTURE.md` - Current system architecture
- `backend/src/services/ToastmastersScraper.ts` - Current scraper implementation
- `backend/src/services/CacheManager.ts` - Existing cache patterns
- `backend/src/services/RefreshService.ts` - Data acquisition workflow

### Configuration and Infrastructure:
- `backend/src/services/CacheConfigService.ts` - Cache configuration patterns
- `backend/src/services/ServiceContainer.ts` - Dependency injection patterns
- `backend/src/types/districts.ts` - Data type definitions

### Testing and Quality:
- `.kiro/steering/testing.md` - Testing requirements and standards
- `.kiro/steering/testing.eval.md` - Testing evaluation criteria
- `backend/vitest.config.ts` - Test configuration

### Operational Guidelines:
- `.kiro/steering/production-maintenance.md` - Operational constraints
- `.kiro/steering/toastmasters-brand-guidelines.md` - Brand compliance requirements

## Additional Instructions

### Specification Structure:
- Follow existing spec template patterns in the codebase
- Include mermaid diagrams for data flow and architecture
- Provide concrete TypeScript interface definitions
- Include detailed error scenarios and handling

### Implementation Guidance:
- Use dependency injection patterns consistent with existing services
- Follow existing file naming and organization conventions
- Implement proper logging with structured context
- Include performance monitoring and metrics

### Quality Assurance:
- Define clear acceptance criteria for each requirement
- Include property-based test scenarios where applicable
- Specify test isolation and cleanup requirements
- Address potential race conditions and concurrent access

### Documentation Requirements:
- Include usage examples and integration patterns
- Document configuration options and defaults
- Provide troubleshooting and debugging guidance
- Include migration and rollout instructions

This specification should result in a robust, efficient raw CSV caching system that reduces external service load while maintaining the reliability and simplicity required by the production maintenance guidelines.