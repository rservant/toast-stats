# Backend Test Utilities

This directory contains test utilities for the backend test suite. These utilities support test isolation, cleanup, data generation, and property-based testing.

## Overview

| Utility                         | Purpose                          | Usage         |
| ------------------------------- | -------------------------------- | ------------- |
| `test-self-cleanup.ts`          | Resource cleanup for tests       | 12 test files |
| `test-cache-helper.ts`          | Cache directory isolation        | 5 test files  |
| `TestIsolationManager.ts`       | Environment variable isolation   | 4 test files  |
| `PropertyTestInfrastructure.ts` | Property-based testing utilities | 6 test files  |
| `test-string-generators.ts`     | Safe string generation           | 8 test files  |
| `test-data-factories.ts`        | Test data generation             | 2 test files  |
| `test-types.ts`                 | Type definitions                 | Shared types  |

## Cleanup and Isolation

### test-self-cleanup.ts

Provides self-cleanup utilities for tests to manage their own temporary resources.

```typescript
import {
  createTestSelfCleanup,
  TestSelfCleanup,
} from '../utils/test-self-cleanup'

describe('MyTest', () => {
  const { cleanup, afterEach: cleanupAfterEach } = createTestSelfCleanup()

  afterEach(cleanupAfterEach)

  it('should create temp files', async () => {
    const tempDir = createUniqueTestDir(cleanup, 'my-test')
    cleanup.trackDirectory(tempDir)
    // ... test code
  })
})
```

Key exports:

- `TestSelfCleanup` - Class for tracking and cleaning up resources
- `createTestSelfCleanup()` - Factory function for creating cleanup instances
- `createUniqueTestDir()` - Create unique test directories
- `withSelfCleanup()` - Wrapper for automatic cleanup

### test-cache-helper.ts

Provides utilities for creating isolated cache directories in tests.

```typescript
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
} from '../utils/test-cache-helper'

describe('CacheTest', () => {
  let config: TestCacheConfig

  beforeEach(async () => {
    config = await createTestCacheConfig('my-test')
  })

  afterEach(async () => {
    await cleanupTestCacheConfig(config)
  })
})
```

Key exports:

- `createTestCacheConfig()` - Create isolated cache configuration
- `cleanupTestCacheConfig()` - Clean up cache configuration
- `initializeTestCache()` - Initialize cache with services
- `ensureDirectoryExists()` - Ensure directory exists

### TestIsolationManager.ts

Manages test environment isolation including environment variables.

```typescript
import { DefaultTestIsolationManager } from '../utils/TestIsolationManager'

const isolationManager = new DefaultTestIsolationManager()

beforeEach(async () => {
  await isolationManager.setupTestEnvironment()
})

afterEach(async () => {
  await isolationManager.cleanupTestEnvironment()
})
```

Key exports:

- `DefaultTestIsolationManager` - Class for environment isolation
- `getTestIsolationManager()` - Get global instance
- `resetTestIsolationManager()` - Reset global instance

## Data Generation

### test-string-generators.ts

Provides safe string generation for tests, ensuring filesystem-safe and deterministic strings.

```typescript
import {
  safeString,
  deterministicSafeString,
} from '../utils/test-string-generators'

// Random safe string
const randomStr = safeString(10)

// Deterministic safe string (same seed = same result)
const deterministicStr = deterministicSafeString(12345, 10)
```

Key exports:

- `safeString()` - Generate random filesystem-safe strings
- `deterministicSafeString()` - Generate deterministic safe strings
- `isFilesystemSafe()` - Check if string is filesystem-safe

### test-data-factories.ts

Provides factory functions for creating test data.

```typescript
import { createTestServiceConfiguration } from '../utils/test-data-factories'

const config = createTestServiceConfiguration({
  cacheDirectory: './test-cache',
})
```

Key exports:

- `createTestServiceConfiguration()` - Create service configurations
- `validateServiceConfiguration()` - Validate configurations
- `createDistrictCacheEntry()` - Create cache entries

## Property-Based Testing

### PropertyTestInfrastructure.ts

Provides utilities for property-based testing with fast-check.

```typescript
import {
  PropertyTestRunner,
  DeterministicGenerators,
} from '../utils/PropertyTestInfrastructure'

const runner = new PropertyTestRunner('test')

it('should satisfy property', async () => {
  const property = fc.asyncProperty(fc.string(), async input => {
    // ... property assertion
    return true
  })

  await runner.runProperty(property, { iterations: 100 })
})
```

Key exports:

- `PropertyTestRunner` - Enhanced property test runner
- `DeterministicGenerators` - Seeded random generators
- `PropertyTestUtils` - Configuration utilities
- `defaultPropertyTestRunner` - Global runner instance

## Best Practices

1. **Always clean up resources** - Use `afterEach` hooks with cleanup utilities
2. **Use unique directories** - Avoid conflicts in parallel test execution
3. **Prefer deterministic generation** - Use seeded generators for reproducibility
4. **Track all resources** - Register files and directories with cleanup managers
5. **Use dependency injection** - Avoid global state in tests

## Removed Utilities

The following utilities were removed as part of codebase cleanup (they were unused):

- `TestPerformanceMonitor.ts` - Performance monitoring (unused)
- `TestReliabilityMonitor.ts` - Reliability monitoring (unused)
- `IntegratedTestMonitor.ts` - Integrated monitoring (unused)
- `test-infrastructure.ts` - Backend test infrastructure (unused)
