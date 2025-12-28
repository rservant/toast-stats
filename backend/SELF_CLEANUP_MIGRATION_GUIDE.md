# Self-Cleanup Migration Guide

## Overview

This guide helps you migrate from external cleanup scripts to the new **self-cleanup pattern** where each test manages its own temporary resources and cleans up after itself.

## Why Self-Cleanup?

### Problems with External Cleanup Scripts

- Tests depend on external processes to clean up
- Cleanup happens after all tests complete, not after each test
- Failed cleanup scripts can leave test artifacts behind
- Parallel test execution can interfere with cleanup timing
- Debugging is harder when cleanup is separated from test logic

### Benefits of Self-Cleanup

- ✅ Each test is responsible for its own cleanup
- ✅ Cleanup happens immediately after each test in `afterEach`
- ✅ Tests are isolated and don't depend on external scripts
- ✅ Parallel test execution is safer
- ✅ Easier debugging - cleanup logic is in the same file as the test
- ✅ Tests fail fast if cleanup fails (optional)

## Migration Steps

### 1. Import the Self-Cleanup Utilities

```typescript
import {
  createTestSelfCleanup,
  createUniqueTestDir,
  createUniqueTestFile,
} from '../utils/test-self-cleanup.ts'
```

### 2. Replace Manual Cleanup with Self-Cleanup

#### Before (Manual Cleanup)

```typescript
describe('MyService', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = './test-dir/my-service-test'
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should do something', async () => {
    // Test logic using testDir
  })
})
```

#### After (Self-Cleanup)

```typescript
describe('MyService', () => {
  // Self-cleanup setup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup()

  afterEach(performCleanup) // Automatic cleanup

  it('should do something', async () => {
    // Create unique test directory (automatically tracked)
    const testDir = createUniqueTestDir(cleanup, 'my-service-test')
    await fs.mkdir(testDir, { recursive: true })

    // Test logic using testDir
    // No manual cleanup needed!
  })
})
```

### 3. Handle Multiple Test Resources

#### Before

```typescript
describe('MyService', () => {
  let testDirs: string[] = []

  beforeEach(() => {
    testDirs = []
  })

  afterEach(async () => {
    for (const dir of testDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  it('should handle multiple directories', async () => {
    const dir1 = './test-dir/test-1'
    const dir2 = './test-dir/test-2'
    testDirs.push(dir1, dir2)

    await fs.mkdir(dir1, { recursive: true })
    await fs.mkdir(dir2, { recursive: true })

    // Test logic
  })
})
```

#### After

```typescript
describe('MyService', () => {
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup()
  afterEach(performCleanup)

  it('should handle multiple directories', async () => {
    // Create multiple unique directories (all automatically tracked)
    const dir1 = createUniqueTestDir(cleanup, 'test-1')
    const dir2 = createUniqueTestDir(cleanup, 'test-2')

    await fs.mkdir(dir1, { recursive: true })
    await fs.mkdir(dir2, { recursive: true })

    // Test logic - all directories cleaned up automatically
  })
})
```

### 4. Handle Custom Cleanup Logic

#### Before

```typescript
describe('MyService', () => {
  let service: MyService
  let testDir: string

  beforeEach(async () => {
    testDir = './test-dir/service-test'
    service = new MyService(testDir)
    await service.initialize()
  })

  afterEach(async () => {
    try {
      await service.shutdown()
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })
})
```

#### After

```typescript
describe('MyService', () => {
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup()
  afterEach(performCleanup)

  it('should initialize service', async () => {
    const testDir = createUniqueTestDir(cleanup, 'service-test')
    const service = new MyService(testDir)

    // Add custom cleanup for service shutdown
    cleanup.addCleanupFunction(async () => {
      await service.shutdown()
    })

    await service.initialize()

    // Test logic - service and directory cleaned up automatically
  })
})
```

### 5. Use Wrapper Pattern for Complex Tests

```typescript
describe('MyService', () => {
  it('should handle complex scenario', async () => {
    await withSelfCleanup(async cleanup => {
      const testDir = createUniqueTestDir(cleanup, 'complex-test')
      const configFile = createUniqueTestFile(cleanup, 'config', '.json')

      // Setup test resources
      await fs.mkdir(testDir, { recursive: true })
      await fs.writeFile(configFile, JSON.stringify({ test: true }))

      // Test logic

      // Automatic cleanup even if test throws an error
    })
  })
})
```

## Configuration Options

### Verbose Logging

```typescript
const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
  verbose: true, // Log cleanup operations
})
```

### Fail on Cleanup Errors

```typescript
const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
  failOnCleanupError: true, // Fail test if cleanup fails
})
```

### Cleanup Timeout

```typescript
const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
  timeoutMs: 10000, // 10 second cleanup timeout
})
```

## Common Patterns

### Property-Based Tests

```typescript
describe('Property Tests', () => {
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup()
  afterEach(performCleanup)

  it('should handle arbitrary inputs', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async input => {
        const testDir = createUniqueTestDir(
          cleanup,
          `prop-test-${input.slice(0, 10)}`
        )
        await fs.mkdir(testDir, { recursive: true })

        // Property test logic
      })
    )
  })
})
```

### Parallel Test Isolation

```typescript
describe('Parallel Tests', () => {
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup()
  afterEach(performCleanup)

  it('should isolate parallel executions', async () => {
    // Each test gets unique directories - no conflicts
    const testDir = createUniqueTestDir(cleanup, 'parallel-test')

    // Test logic - safe for parallel execution
  })
})
```

### Service Integration Tests

```typescript
describe('Service Integration', () => {
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup()
  afterEach(performCleanup)

  it('should integrate with external services', async () => {
    const cacheDir = createUniqueTestDir(cleanup, 'cache')
    const dataDir = createUniqueTestDir(cleanup, 'data')

    const service = new MyService({ cacheDir, dataDir })

    // Add service cleanup
    cleanup.addCleanupFunction(async () => {
      await service.stop()
    })

    await service.start()

    // Test service functionality
  })
})
```

## Debugging Cleanup Issues

### Verify Cleanup Completion

```typescript
import { verifyTestDirEmpty } from '../utils/test-self-cleanup.ts'

afterEach(async () => {
  await performCleanup()

  // Verify cleanup in development
  if (process.env.NODE_ENV === 'development') {
    const { isEmpty, remainingItems } = await verifyTestDirEmpty(
      './test-dir',
      true
    )
    if (!isEmpty) {
      console.warn('Test cleanup incomplete:', remainingItems)
    }
  }
})
```

### Enable Verbose Logging

```typescript
const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
  verbose: process.env.DEBUG_CLEANUP === 'true',
})
```

## Migration Checklist

- [ ] Replace manual `afterEach` cleanup with `createTestSelfCleanup()`
- [ ] Use `createUniqueTestDir()` instead of hardcoded test directories
- [ ] Use `createUniqueTestFile()` for temporary test files
- [ ] Add custom cleanup functions for services/resources that need shutdown
- [ ] Remove dependencies on external cleanup scripts
- [ ] Update test documentation to reflect self-cleanup pattern
- [ ] Test parallel execution to ensure no conflicts
- [ ] Verify cleanup completion in CI/CD pipeline

## Best Practices

1. **Always use unique names** - Use `createUniqueTestDir()` and `createUniqueTestFile()` to avoid conflicts
2. **Track all resources** - Register every temporary file and directory for cleanup
3. **Add custom cleanup** - Use `addCleanupFunction()` for services that need graceful shutdown
4. **Handle errors gracefully** - Set `failOnCleanupError: false` for non-critical cleanup failures
5. **Use wrapper pattern** - Use `withSelfCleanup()` for complex tests that might throw errors
6. **Verify in development** - Use `verifyTestDirEmpty()` to catch cleanup issues early
7. **Keep cleanup simple** - Avoid complex cleanup logic that might fail

## Examples

See `backend/src/utils/__tests__/test-self-cleanup.example.test.ts` for complete working examples of all patterns.

## Troubleshooting

### "Cannot track resources after cleanup has been performed"

- This happens when you try to track resources after `afterEach` has run
- Move resource tracking to the test body, not to `beforeEach`

### Cleanup timeouts

- Increase `timeoutMs` in configuration
- Simplify cleanup logic
- Check for hanging promises in custom cleanup functions

### Parallel test conflicts

- Ensure you're using `createUniqueTestDir()` and `createUniqueTestFile()`
- Don't use hardcoded directory names
- Each test should have completely isolated resources

### Cleanup failures in CI

- Set `failOnCleanupError: false` for non-critical cleanup
- Add retry logic for flaky filesystem operations
- Use `verifyTestDirEmpty()` to detect incomplete cleanup
