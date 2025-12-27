# Test Cache Configuration Guide

This guide explains how to use configurable cache directories in tests to support test isolation and parallel execution.

## Overview

The test cache configuration system provides:

- **Isolated cache directories** for each test
- **Parallel test execution** support without conflicts
- **Automatic cleanup** of test cache directories
- **Consistent configuration** across all cache services

## Basic Usage

### Single Test Configuration

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CacheManager } from '../CacheManager.js'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
  initializeTestCache,
  getTestCacheDirectory,
} from '../../__tests__/test-cache-helper.js'
import type { TestCacheConfig } from '../../__tests__/test-cache-helper.js'

describe('My Cache Test', () => {
  let cacheManager: CacheManager
  let testCacheConfig: TestCacheConfig

  beforeEach(async () => {
    // Create isolated test cache configuration
    testCacheConfig = await createTestCacheConfig('my-test')
    await initializeTestCache(testCacheConfig)

    // Use configured cache directory
    const testCacheDir = getTestCacheDirectory()
    cacheManager = new CacheManager(testCacheDir)
    await cacheManager.init()
  })

  afterEach(async () => {
    // Clean up test cache configuration
    await cleanupTestCacheConfig(testCacheConfig)
  })

  it('should work with isolated cache', async () => {
    // Your test code here
    // Cache operations will use the isolated directory
  })
})
```

### Parallel Test Configuration

For tests that need multiple isolated cache configurations:

```typescript
import {
  createParallelTestCacheConfigs,
  cleanupParallelTestCacheConfigs,
  verifyTestCacheIsolation,
} from '../../__tests__/test-cache-helper.js'

describe('Parallel Cache Tests', () => {
  let testConfigs: TestCacheConfig[]

  beforeEach(async () => {
    // Create multiple isolated configurations
    testConfigs = await createParallelTestCacheConfigs('parallel-test', 3)

    // Verify isolation
    await verifyTestCacheIsolation(testConfigs)
  })

  afterEach(async () => {
    // Clean up all configurations
    await cleanupParallelTestCacheConfigs(testConfigs)
  })

  it('should support parallel cache operations', async () => {
    // Use different cache configurations in parallel
    const operations = testConfigs.map(async (config, index) => {
      await initializeTestCache(config)
      const cacheDir = getTestCacheDirectory()
      const cacheManager = new CacheManager(cacheDir)

      // Perform cache operations
      await cacheManager.init()
      // ... test operations
    })

    await Promise.all(operations)
  })
})
```

## API Reference

### `createTestCacheConfig(testName: string): Promise<TestCacheConfig>`

Creates an isolated cache directory configuration for a test.

- **testName**: Unique identifier for the test
- **Returns**: Configuration object with cache directory and cleanup info

### `cleanupTestCacheConfig(config: TestCacheConfig): Promise<void>`

Cleans up a test cache configuration, removing the cache directory and restoring environment variables.

### `initializeTestCache(config: TestCacheConfig): Promise<void>`

Initializes the cache configuration service with the test cache directory.

### `getTestCacheDirectory(): string`

Gets the currently configured cache directory for the test environment.

### `createParallelTestCacheConfigs(testName: string, count: number): Promise<TestCacheConfig[]>`

Creates multiple isolated cache configurations for parallel testing.

### `cleanupParallelTestCacheConfigs(configs: TestCacheConfig[]): Promise<void>`

Cleans up multiple test cache configurations.

### `verifyTestCacheIsolation(configs: TestCacheConfig[]): Promise<void>`

Verifies that test cache directories are properly isolated and accessible.

## Migration Guide

### From Hardcoded Cache Directories

**Before:**

```typescript
describe('My Test', () => {
  const testCacheDir = './test-cache'
  let cacheManager: CacheManager

  beforeEach(async () => {
    cacheManager = new CacheManager(testCacheDir)
    await cacheManager.init()
  })

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })
})
```

**After:**

```typescript
describe('My Test', () => {
  let cacheManager: CacheManager
  let testCacheConfig: TestCacheConfig

  beforeEach(async () => {
    testCacheConfig = await createTestCacheConfig('my-test')
    await initializeTestCache(testCacheConfig)

    const testCacheDir = getTestCacheDirectory()
    cacheManager = new CacheManager(testCacheDir)
    await cacheManager.init()
  })

  afterEach(async () => {
    await cleanupTestCacheConfig(testCacheConfig)
  })
})
```

## Benefits

1. **Test Isolation**: Each test gets its own cache directory
2. **Parallel Execution**: Tests can run in parallel without conflicts
3. **Automatic Cleanup**: Cache directories are automatically cleaned up
4. **Consistent Configuration**: All cache services use the same configuration
5. **Environment Variable Support**: Respects `CACHE_DIR` environment variable
6. **Easy Migration**: Simple pattern to update existing tests

## Environment Variables

- **`CACHE_DIR`**: Base cache directory (defaults to `./test-cache-default` in tests)
- **`NODE_ENV`**: Should be set to `test` for test environment

## Best Practices

1. **Always use test cache helpers** instead of hardcoded cache directories
2. **Create unique test names** to avoid conflicts
3. **Clean up in afterEach** to ensure proper test isolation
4. **Use parallel configurations** for tests that need multiple cache instances
5. **Verify isolation** when using parallel configurations
6. **Handle cleanup errors gracefully** (helpers do this automatically)

## Troubleshooting

### Cache Directory Conflicts

If you see cache directory conflicts, ensure:

- Test names are unique
- Cleanup is properly called in `afterEach`
- Tests are not sharing cache configurations

### Permission Issues

If you encounter permission issues:

- Ensure the test cache directory is writable
- Check that cleanup is removing directories properly
- Verify environment variables are set correctly

### Parallel Test Issues

For parallel test problems:

- Use `createParallelTestCacheConfigs` for multiple configurations
- Verify isolation with `verifyTestCacheIsolation`
- Ensure each test uses a different configuration
