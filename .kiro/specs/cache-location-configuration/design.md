# Design Document: Cache Location Configuration

## Overview

This design implements a unified cache configuration system that makes all on-disk caching locations configurable through a single `CACHE_DIR` environment variable. The solution replaces the current mixed approach where some services use hardcoded cache paths while others use different environment variables.

The design focuses on simplicity and consistency, providing a single configuration point for all cache operations while maintaining the existing cache functionality and data structures.

## Architecture

### Current State Analysis

**Existing Cache Services:**
- `CacheManager`: Manages historical district rankings and metadata (currently hardcoded to `./cache`)
- `DistrictCacheManager`: Manages district-specific performance data (accepts constructor parameter, defaults to `./cache`)
- `Assessment Module`: Uses `DISTRICT_CACHE_DIR` environment variable with complex fallback logic

**Current Issues:**
- Inconsistent configuration approaches across services
- Hardcoded cache paths in main application routes
- Complex fallback logic in assessment module
- No unified configuration strategy

### Target Architecture

**Unified Configuration Approach:**
- Single `CACHE_DIR` environment variable for all cache operations
- Consistent cache directory usage across all services
- Simplified configuration without complex hierarchies
- Centralized cache configuration management

## Components and Interfaces

### 1. Cache Configuration Service

A new service to centralize cache directory configuration:

```typescript
export class CacheConfigService {
  private static instance: CacheConfigService
  private readonly cacheDir: string

  private constructor() {
    this.cacheDir = this.resolveCacheDirectory()
  }

  static getInstance(): CacheConfigService {
    if (!CacheConfigService.instance) {
      CacheConfigService.instance = new CacheConfigService()
    }
    return CacheConfigService.instance
  }

  getCacheDirectory(): string {
    return this.cacheDir
  }

  private resolveCacheDirectory(): string {
    const envCacheDir = process.env.CACHE_DIR
    if (envCacheDir) {
      return path.resolve(envCacheDir)
    }
    return path.resolve('./cache')
  }

  validateCacheDirectory(): Promise<void> {
    // Validate path security and accessibility
  }
}
```

### 2. Updated Cache Manager Initialization

**Modified Route Initialization:**
```typescript
// Before (hardcoded)
const cacheManager = new CacheManager()
const districtCacheManager = new DistrictCacheManager()

// After (configurable)
const cacheConfig = CacheConfigService.getInstance()
const cacheDir = cacheConfig.getCacheDirectory()
const cacheManager = new CacheManager(cacheDir)
const districtCacheManager = new DistrictCacheManager(cacheDir)
```

### 3. Assessment Module Integration

**Simplified Cache Path Selection:**
```typescript
export class CacheIntegrationService {
  constructor(
    cacheManager?: DistrictCacheManager,
    cspExtractor?: CspExtractorService
  ) {
    if (cacheManager) {
      this.cacheManager = cacheManager
    } else {
      const cacheConfig = CacheConfigService.getInstance()
      const cachePath = cacheConfig.getCacheDirectory()
      this.cacheManager = new DistrictCacheManager(cachePath)
    }
    this.cspExtractor = cspExtractor ?? new CspExtractorService()
  }

  // Remove complex selectCachePath method
  // Replace with simple configuration service usage
}
```

### 4. Configuration Validation

**Security and Accessibility Validation:**
```typescript
interface CacheDirectoryValidation {
  isValid: boolean
  isAccessible: boolean
  isSecure: boolean
  errorMessage?: string
}

class CacheDirectoryValidator {
  static async validate(cacheDir: string): Promise<CacheDirectoryValidation> {
    // Validate path format
    // Check for path traversal attempts
    // Verify write permissions
    // Ensure directory can be created
  }
}
```

## Data Models

### Configuration Interface

```typescript
interface CacheConfiguration {
  baseDirectory: string
  isConfigured: boolean
  source: 'environment' | 'default'
  validationStatus: CacheDirectoryValidation
}
```

### Cache Directory Structure

The cache directory structure remains unchanged:
```
cache/
├── districts/
│   ├── {districtId}/
│   │   └── {YYYY-MM-DD}.json
├── districts_{YYYY-MM-DD}.json
├── metadata_{YYYY-MM-DD}.json
├── historical_index.json
└── reconciliation/
    └── {various reconciliation files}
```

## Implementation Strategy

### Phase 1: Create Configuration Service

1. **Create CacheConfigService**
   - Implement singleton pattern for consistent configuration
   - Add environment variable reading with validation
   - Provide default fallback behavior

2. **Add Configuration Validation**
   - Implement path security validation
   - Add write permission checks
   - Create error handling for invalid configurations

### Phase 2: Update Service Initialization

1. **Modify Main Routes**
   - Update `backend/src/routes/districts.ts` to use configuration service
   - Replace hardcoded cache manager initialization
   - Ensure all cache services use consistent configuration

2. **Update Other Route Files**
   - Apply same changes to any other routes that initialize cache services
   - Maintain consistent configuration usage across all endpoints

### Phase 3: Simplify Assessment Module

1. **Replace selectCachePath Method**
   - Remove complex fallback logic in `CacheIntegrationService`
   - Use `CacheConfigService` for cache directory resolution
   - Update tests to reflect simplified configuration

2. **Remove DISTRICT_CACHE_DIR Dependency**
   - Update assessment module to use unified `CACHE_DIR` configuration
   - Remove references to `DISTRICT_CACHE_DIR` environment variable
   - Update related tests and documentation

### Phase 4: Update Configuration and Documentation

1. **Environment Configuration**
   - Update `.env.example` files to include `CACHE_DIR`
   - Remove `DISTRICT_CACHE_DIR` references
   - Update Docker and deployment configurations

2. **Documentation Updates**
   - Update README with new configuration instructions
   - Create migration guide for existing deployments
   - Document configuration examples for different environments

## Error Handling

### Configuration Errors

1. **Invalid Cache Directory**
   - Log clear error messages for invalid paths
   - Fall back to default cache directory
   - Provide troubleshooting guidance

2. **Permission Issues**
   - Detect and report write permission problems
   - Suggest resolution steps
   - Fail gracefully with informative messages

3. **Path Security Violations**
   - Reject path traversal attempts
   - Log security violations
   - Use secure default fallback

### Runtime Error Handling

```typescript
class CacheConfigurationError extends Error {
  constructor(
    message: string,
    public readonly configuredPath?: string,
    public readonly fallbackPath?: string
  ) {
    super(message)
    this.name = 'CacheConfigurationError'
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Environment Variable Configuration
*For any* valid cache directory path set in `CACHE_DIR` environment variable, all cache services should use that directory as their base cache location
**Validates: Requirements 1.1, 1.2**

### Property 2: Default Fallback Behavior  
*For any* system initialization when `CACHE_DIR` is not set, the system should use `./cache` as the default cache directory
**Validates: Requirements 1.3**

### Property 3: Service Configuration Consistency
*For any* cache service initialization (CacheManager, DistrictCacheManager, Assessment services), all services should receive and use the same cache directory configuration
**Validates: Requirements 1.4, 2.1, 2.2, 2.4, 3.3, 6.4**

### Property 4: Security Validation
*For any* cache directory configuration input, the system should validate path format, prevent path traversal attempts, and reject malicious paths
**Validates: Requirements 1.5, 4.1, 4.2**

### Property 5: Unified Configuration Usage
*For any* cache operation across the system, only the `CACHE_DIR` environment variable should be used for cache directory configuration
**Validates: Requirements 3.1, 6.2, 6.3**

### Property 6: Permission Validation
*For any* configured cache directory, the system should verify write permissions during initialization and handle permission failures appropriately
**Validates: Requirements 4.3, 4.4**

### Property 7: Fallback on Validation Failure
*For any* invalid cache directory configuration, the system should fall back to the default cache location and log appropriate error messages
**Validates: Requirements 4.5, 4.4**

### Property 8: Backward Compatibility
*For any* existing cache functionality, the new configuration system should maintain the same behavior and preserve existing cache data
**Validates: Requirements 2.5, 6.5**

### Property 9: Test Environment Isolation
*For any* test execution with different cache directory configurations, the system should support isolated cache locations without conflicts
**Validates: Requirements 5.1, 5.4, 5.5**

### Property 10: Configuration Migration
*For any* system component that previously used hardcoded cache paths, the component should now use the configurable cache directory system
**Validates: Requirements 6.1**

## Testing Strategy

### Unit Testing Approach

### Unit Testing Approach

**Configuration Service Tests:**
- Test environment variable reading and path resolution
- Validate security checks and permission verification
- Test error handling and fallback behavior
- Verify singleton pattern implementation

**Service Integration Tests:**
- Test cache service initialization with different configurations
- Verify consistent cache directory usage across services
- Test migration from old to new configuration approach
- Validate error scenarios and recovery

### Property-Based Testing

Each correctness property will be implemented as a property-based test with minimum 100 iterations:

**Property Test Configuration:**
- **Feature: cache-location-configuration, Property 1**: Environment variable configuration consistency
- **Feature: cache-location-configuration, Property 2**: Default fallback behavior validation  
- **Feature: cache-location-configuration, Property 3**: Service configuration consistency across all cache services
- **Feature: cache-location-configuration, Property 4**: Security validation for all path inputs
- **Feature: cache-location-configuration, Property 5**: Unified configuration variable usage
- **Feature: cache-location-configuration, Property 6**: Permission validation and error handling
- **Feature: cache-location-configuration, Property 7**: Fallback behavior on validation failures
- **Feature: cache-location-configuration, Property 8**: Backward compatibility preservation
- **Feature: cache-location-configuration, Property 9**: Test environment isolation
- **Feature: cache-location-configuration, Property 10**: Configuration migration completeness

**Testing Framework:** Vitest with property-based testing library for comprehensive input coverage

### Dual Testing Approach

- **Unit tests**: Verify specific configuration scenarios, edge cases, and error conditions
- **Property tests**: Verify universal properties across all configuration inputs and system states
- Both approaches are complementary and necessary for comprehensive validation of the cache configuration system

## Performance Considerations

### Configuration Caching

- Use singleton pattern to avoid repeated environment variable reads
- Cache resolved paths to minimize file system operations
- Lazy initialization to avoid startup overhead

### Minimal Runtime Impact

- Configuration resolution happens once at startup
- No performance impact on cache operations
- Maintain existing cache performance characteristics

## Security Considerations

### Path Validation

1. **Path Traversal Prevention**
   - Validate all cache directory paths
   - Reject paths containing `..` or other traversal attempts
   - Use `path.resolve()` for safe path resolution

2. **Directory Permissions**
   - Verify write permissions before using cache directory
   - Create directories with appropriate permissions
   - Log permission issues for troubleshooting

### Configuration Security

- Validate environment variable values
- Sanitize cache directory paths
- Prevent injection attacks through configuration

## Migration Strategy

### Deployment Migration

1. **Existing Deployments**
   - No immediate action required (defaults maintain current behavior)
   - Optional: Set `CACHE_DIR` environment variable for explicit configuration
   - Remove `DISTRICT_CACHE_DIR` when convenient

2. **New Deployments**
   - Use `CACHE_DIR` for cache configuration
   - Follow updated documentation and examples
   - Benefit from simplified configuration approach

### Data Migration

- No cache data migration required
- Existing cache files remain in same locations with default configuration
- Cache directory structure unchanged

## Configuration Examples

### Development Environment
```bash
# Use local cache directory
CACHE_DIR=./cache
```

### Docker Deployment
```dockerfile
ENV CACHE_DIR=/app/cache
VOLUME ["/app/cache"]
```

### Kubernetes Deployment
```yaml
env:
  - name: CACHE_DIR
    value: "/var/cache/toastmasters"
volumeMounts:
  - name: cache-volume
    mountPath: /var/cache/toastmasters
```

### Testing Environment
```bash
# Use temporary directory for tests
CACHE_DIR=/tmp/test-cache-${TEST_ID}
```