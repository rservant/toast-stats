# Requirements Document

## Introduction

This document specifies the requirements for replacing the current `node-cache` implementation in `CacheService` with a bounded `lru-cache` implementation. The change is mandated by the Performance SLOs document (Section 7.3) which requires all in-memory caches to use the `lru-cache` library with proper configuration to prevent unbounded memory growth.

The current implementation uses `node-cache` without explicit maximum entry limits, which can lead to unbounded memory growth under high load. The new implementation will enforce memory bounds through maximum entry counts, maximum total size limits, and TTL-based expiration.

## Glossary

- **CacheService**: The in-memory caching service used by the backend to cache API responses and computed data
- **LRU_Cache**: Least Recently Used cache implementation from the `lru-cache` npm package
- **TTL**: Time To Live - the duration after which a cache entry expires
- **Size_Calculation**: A function that computes the memory size of a cached value for enforcing size limits
- **Entry_Limit**: The maximum number of entries allowed in the cache
- **Size_Limit**: The maximum total memory size allowed for all cached entries combined

## Requirements

### Requirement 1: Replace node-cache with lru-cache

**User Story:** As a system operator, I want the cache to use lru-cache instead of node-cache, so that memory usage is bounded and predictable.

#### Acceptance Criteria

1. THE CacheService SHALL use the `lru-cache` library instead of `node-cache`
2. WHEN the CacheService is instantiated, THE CacheService SHALL configure the LRU_Cache with a maximum entry count
3. WHEN the CacheService is instantiated, THE CacheService SHALL configure the LRU_Cache with a maximum total size in bytes
4. WHEN the CacheService is instantiated, THE CacheService SHALL configure the LRU_Cache with a Size_Calculation function

### Requirement 2: Maintain API Compatibility

**User Story:** As a developer, I want the CacheService API to remain unchanged, so that existing code continues to work without modification.

#### Acceptance Criteria

1. THE CacheService SHALL provide a `get<T>(key: string): T | undefined` method
2. THE CacheService SHALL provide a `set<T>(key: string, value: T, ttl?: number): boolean` method
3. THE CacheService SHALL provide an `invalidate(key: string): number` method
4. THE CacheService SHALL provide an `invalidateMultiple(keys: string[]): number` method
5. THE CacheService SHALL provide a `clear(): void` method
6. THE CacheService SHALL provide a `has(key: string): boolean` method
7. THE CacheService SHALL provide a `keys(): string[]` method
8. THE CacheService SHALL provide a `getStats()` method returning hits, misses, keys, and size

### Requirement 3: Configure Cache Bounds per SLO Requirements

**User Story:** As a system operator, I want the cache to enforce memory bounds, so that the application does not exhaust available memory.

#### Acceptance Criteria

1. THE CacheService SHALL enforce a default maximum of 1000 entries
2. THE CacheService SHALL enforce a default maximum size of 50MB total
3. THE CacheService SHALL calculate entry sizes using JSON serialization length
4. THE CacheService SHALL support configurable Entry_Limit via constructor options
5. THE CacheService SHALL support configurable Size_Limit via constructor options

### Requirement 4: TTL and Staleness Configuration

**User Story:** As a system operator, I want cache entries to expire and not serve stale data, so that users receive fresh data.

#### Acceptance Criteria

1. THE CacheService SHALL support TTL configuration in seconds (for API compatibility)
2. WHEN a TTL is specified, THE CacheService SHALL convert seconds to milliseconds for the LRU_Cache
3. THE CacheService SHALL configure `allowStale: false` to prevent serving expired data
4. THE CacheService SHALL configure `updateAgeOnGet: true` to refresh TTL on access

### Requirement 5: LRU Eviction Behavior

**User Story:** As a system operator, I want the cache to evict least recently used entries when limits are reached, so that frequently accessed data remains cached.

#### Acceptance Criteria

1. WHEN the Entry_Limit is reached, THE CacheService SHALL evict the least recently used entry before adding a new one
2. WHEN the Size_Limit is reached, THE CacheService SHALL evict least recently used entries until sufficient space is available
3. WHEN an entry is accessed via `get`, THE CacheService SHALL mark it as recently used

### Requirement 6: Statistics and Monitoring

**User Story:** As a system operator, I want to monitor cache performance, so that I can tune cache configuration.

#### Acceptance Criteria

1. THE CacheService SHALL track and report the current number of cached entries
2. THE CacheService SHALL track and report the current calculated size of all entries
3. THE CacheService SHALL report cache hit and miss counts
4. THE CacheService SHALL report the configured maximum entries and maximum size

### Requirement 7: Dependency Management

**User Story:** As a developer, I want the lru-cache dependency properly managed, so that the build succeeds.

#### Acceptance Criteria

1. THE backend package.json SHALL include `lru-cache` as a production dependency
2. THE backend package.json SHALL remove `node-cache` as a dependency after migration
