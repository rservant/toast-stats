# Design Document: Raw CSV Cache Service Refactor

## Overview

This design describes the extraction of cross-cutting concerns from `RawCSVCacheService.ts` (2,422 lines, 56 methods) into three focused modules:

1. **CacheIntegrityValidator** - Metadata validation, corruption detection, and recovery
2. **CacheSecurityManager** - Path safety, permissions, and content security
3. **CircuitBreakerManager** - Reusable circuit breaker pattern (leveraging existing `CircuitBreaker.ts`)

The refactoring preserves the existing `IRawCSVCacheService` interface and all public method signatures, ensuring zero breaking changes for consuming code.

## Architecture

### Current State

```
┌─────────────────────────────────────────────────────────────────┐
│                    RawCSVCacheService                           │
│                    (2,422 lines, 56 methods)                    │
├─────────────────────────────────────────────────────────────────┤
│  Core Cache Operations                                          │
│  ├── getCachedCSV, setCachedCSV, hasCachedCSV                  │
│  ├── getCacheMetadata, updateCacheMetadata                      │
│  └── clearCacheForDate, getCachedDates                         │
├─────────────────────────────────────────────────────────────────┤
│  Integrity Logic (to extract)                                   │
│  ├── validateMetadataIntegrity                                  │
│  ├── repairMetadataIntegrity                                    │
│  ├── detectCorruption                                           │
│  ├── attemptCorruptionRecovery                                  │
│  └── recalculateIntegrityTotals                                │
├─────────────────────────────────────────────────────────────────┤
│  Security Logic (to extract)                                    │
│  ├── validatePathSafety                                         │
│  ├── validateCacheDirectoryBounds                               │
│  ├── setSecureFilePermissions                                   │
│  ├── setSecureDirectoryPermissions                              │
│  ├── validateCSVContentSecurity                                 │
│  └── sanitizeDistrictId                                         │
├─────────────────────────────────────────────────────────────────┤
│  Circuit Breaker Logic (to extract)                             │
│  ├── isCircuitBreakerOpen                                       │
│  ├── recordCircuitBreakerFailure                                │
│  ├── resetCircuitBreaker                                        │
│  └── getCircuitBreakerState                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────────────┐
│                    RawCSVCacheService                           │
│                    (~800 lines, core operations)                │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies (injected)                                        │
│  ├── ICacheIntegrityValidator                                   │
│  ├── ICacheSecurityManager                                      │
│  └── ICircuitBreaker (from existing CircuitBreaker.ts)         │
├─────────────────────────────────────────────────────────────────┤
│  Core Cache Operations (retained)                               │
│  ├── getCachedCSV, setCachedCSV, hasCachedCSV                  │
│  ├── getCacheMetadata, updateCacheMetadata                      │
│  └── clearCacheForDate, getCachedDates                         │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ CacheIntegrity  │  │ CacheSecurity   │  │ CircuitBreaker  │
│ Validator       │  │ Manager         │  │ (existing)      │
│ (~400 lines)    │  │ (~300 lines)    │  │                 │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ validateMeta    │  │ validatePath    │  │ execute()       │
│ detectCorrupt   │  │ validateBounds  │  │ getStats()      │
│ attemptRecovery │  │ setPermissions  │  │ reset()         │
│ recalcTotals    │  │ validateContent │  │                 │
│ repairIntegrity │  │ sanitizeId      │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Components and Interfaces

### ICacheIntegrityValidator Interface

```typescript
/**
 * Cache Integrity Validator Interface
 *
 * Handles metadata validation, corruption detection, and recovery operations
 * for the raw CSV cache system.
 */
export interface ICacheIntegrityValidator {
  /**
   * Validate metadata integrity against actual files on disk
   * @param cacheDir - Base cache directory path
   * @param date - Date string (YYYY-MM-DD format)
   * @param metadata - Current metadata to validate
   * @returns Validation result with issues and statistics
   */
  validateMetadataIntegrity(
    cacheDir: string,
    date: string,
    metadata: RawCSVCacheMetadata | null
  ): Promise<{
    isValid: boolean
    issues: string[]
    actualStats: { fileCount: number; totalSize: number }
    metadataStats: { fileCount: number; totalSize: number }
  }>

  /**
   * Detect corruption in cached CSV content
   * @param content - CSV content to validate
   * @param metadata - Associated metadata for checksum verification
   * @param filename - Filename for checksum lookup
   * @returns Corruption detection result
   */
  detectCorruption(
    content: string,
    metadata: RawCSVCacheMetadata | null,
    filename: string
  ): Promise<{ isValid: boolean; issues: string[] }>

  /**
   * Attempt to recover from file corruption
   * @param cacheDir - Base cache directory path
   * @param date - Date string (YYYY-MM-DD format)
   * @param type - CSV type
   * @param districtId - Optional district ID
   * @returns Recovery result with actions taken
   */
  attemptCorruptionRecovery(
    cacheDir: string,
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<{ success: boolean; actions: string[]; errors: string[] }>

  /**
   * Recalculate integrity totals from actual files
   * @param cacheDir - Base cache directory path
   * @param date - Date string (YYYY-MM-DD format)
   * @param metadata - Metadata to update
   * @returns Updated metadata with recalculated totals
   */
  recalculateIntegrityTotals(
    cacheDir: string,
    date: string,
    metadata: RawCSVCacheMetadata
  ): Promise<RawCSVCacheMetadata>

  /**
   * Repair metadata integrity by recalculating from actual files
   * @param cacheDir - Base cache directory path
   * @param date - Date string (YYYY-MM-DD format)
   * @param existingMetadata - Existing metadata or null
   * @returns Repair result
   */
  repairMetadataIntegrity(
    cacheDir: string,
    date: string,
    existingMetadata: RawCSVCacheMetadata | null
  ): Promise<{ success: boolean; repairedFields: string[]; errors: string[] }>
}
```

### ICacheSecurityManager Interface

```typescript
/**
 * Cache Security Manager Interface
 *
 * Handles path safety validation, directory bounds checking, file permissions,
 * and content security validation for the raw CSV cache system.
 */
export interface ICacheSecurityManager {
  /**
   * Validate path safety to prevent path traversal attacks
   * @param input - Input string to validate
   * @param inputType - Description of input type for error messages
   * @throws Error if path contains dangerous patterns
   */
  validatePathSafety(input: string, inputType: string): void

  /**
   * Validate that a file path is within cache directory bounds
   * @param filePath - File path to validate
   * @param cacheDir - Base cache directory
   * @throws Error if path is outside bounds
   */
  validateCacheDirectoryBounds(filePath: string, cacheDir: string): void

  /**
   * Set secure file permissions (owner read/write only)
   * @param filePath - Path to file
   */
  setSecureFilePermissions(filePath: string): Promise<void>

  /**
   * Set secure directory permissions (owner access only)
   * @param dirPath - Path to directory
   */
  setSecureDirectoryPermissions(dirPath: string): Promise<void>

  /**
   * Validate CSV content for security issues
   * @param csvContent - CSV content to validate
   * @throws Error if content contains malicious patterns
   */
  validateCSVContentSecurity(csvContent: string): void

  /**
   * Sanitize district ID by removing dangerous characters
   * @param districtId - District ID to sanitize
   * @returns Sanitized district ID
   */
  sanitizeDistrictId(districtId: string): string

  /**
   * Validate district ID format and security
   * @param districtId - District ID to validate
   * @throws Error if district ID is invalid
   */
  validateDistrictId(districtId: string): void

  /**
   * Validate date string format
   * @param date - Date string to validate
   * @throws Error if date format is invalid
   */
  validateDateString(date: string): void

  /**
   * Validate CSV content (non-empty, size limits, structure)
   * @param csvContent - CSV content to validate
   * @param maxSizeMB - Maximum allowed size in MB
   * @throws Error if content is invalid
   */
  validateCSVContent(csvContent: string, maxSizeMB: number): void
}
```

### Circuit Breaker Integration

The existing `CircuitBreaker` class in `backend/src/utils/CircuitBreaker.ts` already provides a reusable implementation with:

- `execute<T>(operation, context)` - Execute operation through circuit breaker
- `getStats()` - Get current statistics
- `reset()` - Reset to closed state
- Factory methods: `createCacheCircuitBreaker(name)`

The `RawCSVCacheService` will use this existing implementation via dependency injection rather than maintaining its own circuit breaker state.

```typescript
// Usage in RawCSVCacheService
constructor(
  cacheConfigService: ICacheConfigService,
  logger: ILogger,
  config?: Partial<RawCSVCacheConfig>,
  // New optional dependencies for extracted modules
  integrityValidator?: ICacheIntegrityValidator,
  securityManager?: ICacheSecurityManager,
  circuitBreaker?: CircuitBreaker
) {
  // Create defaults if not provided (backward compatibility)
  this.integrityValidator = integrityValidator ?? new CacheIntegrityValidator(logger)
  this.securityManager = securityManager ?? new CacheSecurityManager(config?.security)
  this.circuitBreaker = circuitBreaker ?? CircuitBreaker.createCacheCircuitBreaker('raw-csv-cache')
}
```

## Data Models

### Existing Types (Preserved)

The following types from `backend/src/types/rawCSVCache.ts` remain unchanged:

- `CSVType` - Enum for CSV file types
- `RawCSVCacheMetadata` - Cache metadata structure
- `RawCSVCacheStatistics` - Cache statistics
- `CacheHealthStatus` - Health status information
- `RawCSVCacheConfig` - Configuration options

### New Internal Types

```typescript
/**
 * Corruption detection result
 */
export interface CorruptionDetectionResult {
  isValid: boolean
  issues: string[]
}

/**
 * Recovery operation result
 */
export interface RecoveryResult {
  success: boolean
  actions: string[]
  errors: string[]
}

/**
 * Integrity validation result
 */
export interface IntegrityValidationResult {
  isValid: boolean
  issues: string[]
  actualStats: { fileCount: number; totalSize: number }
  metadataStats: { fileCount: number; totalSize: number }
}

/**
 * Security configuration subset for CacheSecurityManager
 */
export interface SecurityConfig {
  validatePaths: boolean
  sanitizeInputs: boolean
  enforcePermissions: boolean
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Integrity Validation Correctness

_For any_ cache directory state with files and metadata, the `CacheIntegrityValidator.validateMetadataIntegrity()` method SHALL correctly identify:

- File count mismatches between metadata and actual files
- Total size mismatches between metadata and actual files
- Checksum mismatches for individual files
- Missing files referenced in metadata

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: Corruption Detection and Recovery

_For any_ CSV content (valid or corrupted), the `CacheIntegrityValidator.detectCorruption()` method SHALL:

- Return `isValid: true` for valid CSV content with matching checksums
- Return `isValid: false` with appropriate issues for:
  - Empty content
  - Binary/control characters
  - Checksum mismatches
  - Truncated content
  - Excessively long lines

_For any_ corrupted file, `attemptCorruptionRecovery()` SHALL remove the corrupted file and update metadata accordingly.

**Validates: Requirements 1.2, 1.3**

### Property 3: Security Validation Correctness

_For any_ input string, the `CacheSecurityManager` SHALL:

- Reject path traversal patterns (`..`, `/`, `\`, etc.) in `validatePathSafety()`
- Reject paths outside cache directory bounds in `validateCacheDirectoryBounds()`
- Reject malicious CSV patterns (formula injection, script tags, etc.) in `validateCSVContentSecurity()`
- Produce safe output from `sanitizeDistrictId()` containing only alphanumeric, hyphen, and underscore characters

**Validates: Requirements 2.1, 2.2, 2.4, 2.5**

### Property 4: Circuit Breaker State Machine Correctness

_For any_ sequence of success/failure operations, the `CircuitBreaker` SHALL:

- Transition from CLOSED to OPEN after `failureThreshold` consecutive failures
- Transition from OPEN to HALF_OPEN after `recoveryTimeout` milliseconds
- Transition from HALF_OPEN to CLOSED after a successful operation
- Transition from HALF_OPEN to OPEN after any failure
- Reset failure count after successful operations in CLOSED state

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Behavioral Equivalence (API Preservation)

_For any_ valid input to any public method of `IRawCSVCacheService`, the refactored `RawCSVCacheService` SHALL produce output identical to the pre-refactor implementation, including:

- Return values
- Side effects (file system changes)
- Error conditions and messages
- Metadata updates

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

## Error Handling

### CacheIntegrityValidator Error Handling

| Error Condition                | Handling Strategy                                     |
| ------------------------------ | ----------------------------------------------------- |
| File system read errors        | Log warning, return partial results with issues noted |
| Checksum calculation failure   | Log error, mark file as potentially corrupted         |
| Recovery file deletion failure | Log error, include in recovery errors array           |
| Metadata parse failure         | Return validation failure with parse error in issues  |

### CacheSecurityManager Error Handling

| Error Condition            | Handling Strategy                    |
| -------------------------- | ------------------------------------ |
| Path traversal detected    | Throw Error with descriptive message |
| Invalid district ID        | Throw Error with format requirements |
| Malicious CSV content      | Throw Error identifying the pattern  |
| Permission setting failure | Log warning, continue (non-critical) |

### Circuit Breaker Error Handling

The existing `CircuitBreaker` class handles:

- Throwing `CircuitBreakerError` when circuit is OPEN
- Logging state transitions
- Tracking failure/success counts

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all valid inputs

### Property-Based Testing Configuration

- **Library**: fast-check (already used in the codebase)
- **Minimum iterations**: 100 per property test
- **Tag format**: `Feature: raw-csv-cache-refactor, Property N: {property_text}`

### Test Organization

```
backend/src/services/__tests__/
├── CacheIntegrityValidator.test.ts          # Unit tests
├── CacheIntegrityValidator.property.test.ts # Property tests
├── CacheSecurityManager.test.ts             # Unit tests
├── CacheSecurityManager.property.test.ts    # Property tests
├── RawCSVCacheService.test.ts               # Existing tests (must pass unchanged)
└── RawCSVCacheService.refactor.test.ts      # New integration tests
```

### Test Isolation Requirements

Per the testing steering document:

- Each test uses unique, isolated resources (directories, ports)
- Complete cleanup in afterEach hooks
- No shared state between tests
- Tests must pass when run in parallel (`--run` mode)

### Coverage Requirements

- Existing test coverage percentage must not decrease
- Each extracted module must have dedicated unit tests
- All existing `RawCSVCacheService` tests must pass without modification

## Implementation Notes

### Backward Compatibility Strategy

1. **Constructor signature preservation**: New dependencies are optional with defaults
2. **Method signature preservation**: All public methods retain identical signatures
3. **Behavior preservation**: Delegation to extracted modules produces identical results
4. **Error message preservation**: Error messages remain unchanged for consuming code

### File Size Constraints

- `CacheIntegrityValidator.ts`: Maximum 400 lines (Requirement 1.6)
- `CacheSecurityManager.ts`: Maximum 300 lines (Requirement 2.7)

### Dependency Injection Pattern

```typescript
// Production usage (defaults created internally)
const service = new RawCSVCacheService(cacheConfig, logger)

// Test usage (mocks injected)
const service = new RawCSVCacheService(
  mockCacheConfig,
  mockLogger,
  undefined,
  mockIntegrityValidator,
  mockSecurityManager,
  mockCircuitBreaker
)
```

### Migration Path

1. Extract `CacheSecurityManager` (no dependencies on other extracted modules)
2. Extract `CacheIntegrityValidator` (depends on security manager for path validation)
3. Integrate existing `CircuitBreaker` class
4. Update `RawCSVCacheService` to use extracted modules
5. Verify all existing tests pass
6. Add new module-specific tests
