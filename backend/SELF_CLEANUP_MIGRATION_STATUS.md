# Self Cleanup Migration Status

## Overview

This document tracks the progress of migrating test files from traditional `beforeEach`/`afterEach` hooks to the self cleanup pattern using `createTestSelfCleanup`.

## Migration Progress

### ✅ Completed Migrations

The following test files have been successfully migrated to use self cleanup:

1. **frontend/src/utils/__tests__/csvExport.test.ts**
   - Migrated from global beforeEach/afterEach to per-test timer management
   - Each test now manages its own fake timers

2. **backend/src/utils/__tests__/RetryManager.test.ts**
   - Migrated from global timer setup to per-test timer management
   - Each test that needs timers sets them up and cleans them up individually

3. **backend/src/utils/__tests__/AlertManager.test.ts**
   - Migrated to use `createTestSelfCleanup` with `setupAlertManager()` helper
   - Each test manages its own AlertManager instance and timer cleanup

4. **backend/src/utils/__tests__/ReconciliationTestDataGenerator.test.ts**
   - Migrated to use `createTestSelfCleanup` with `createGenerator()` helper
   - Each test creates its own generator instance

5. **backend/src/utils/__tests__/ReconciliationReplayEngine.test.ts**
   - Migrated to use `createTestSelfCleanup` with `createReplayEngine()` helper
   - Complex test with multiple setup functions for different test scenarios

6. **backend/src/services/__tests__/CacheConfigService.test-isolation.property.test.ts**
   - Already using self cleanup (was previously migrated)

7. **backend/src/services/__tests__/CacheConfigService.property.test.ts**
   - Already using self cleanup (was previously migrated)

8. **backend/src/services/__tests__/ReconciliationStorageManager.test.ts**
   - Already using self cleanup (was previously migrated)

9. **backend/src/services/__tests__/ReconciliationPerformance.unit.test.ts** ✨ **NEW**
   - Migrated to use `createTestSelfCleanup` with helper functions
   - Each test manages its own ReconciliationCacheService and ReconciliationPerformanceMonitor instances
   - Replaced global beforeEach/afterEach with per-test setup and cleanup

10. **backend/src/services/__tests__/ReconciliationPerformance.test.ts** ✨ **NEW**
    - Migrated to use `createTestSelfCleanup` with `createUniqueTestDir` for storage paths
    - Each test manages its own ReconciliationStorageOptimizer, CacheService, BatchProcessor, and PerformanceMonitor instances
    - Replaced hardcoded test directories with unique test directories

11. **backend/src/services/__tests__/DistrictBackfillService.test.ts** ✨ **NEW**
    - Migrated to use `createTestSelfCleanup` with `createUniqueTestDir` for cache directories
    - Each test creates its own DistrictCacheManager and DistrictBackfillService instances
    - Replaced test-cache-helper with self-cleanup pattern

### 🔄 Remaining Migrations (38 files)

The following test files still need to be migrated:

#### High Priority (Core Services)
- `backend/src/__tests__/cache-configuration.e2e.test.ts`
- `backend/src/utils/__tests__/ReconciliationSimulator.integration.test.ts`

#### Medium Priority (Integration Tests)
- `backend/src/routes/__tests__/reconciliation.integration.test.ts`
- `backend/src/services/__tests__/ReconciliationWorkflow.integration.test.ts`
- `backend/src/services/__tests__/ReconciliationPerformance.integration.test.ts`

#### Lower Priority (Unit Tests)
- Various other service and utility test files

## Migration Patterns

### Pattern 1: Simple Timer Management
For tests that only need timer mocking:

```typescript
describe('MyService', () => {
  describe('method', () => {
    it('should do something', () => {
      vi.useFakeTimers()
      
      // Test logic here
      
      vi.useRealTimers()
    })
  })
})
```

### Pattern 2: Self Cleanup with Helper Functions
For tests that need resource management:

```typescript
import { createTestSelfCleanup } from '../test-self-cleanup.ts'

describe('MyService', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })

  // Each test cleans up after itself
  afterEach(performCleanup)

  function setupService() {
    const service = new MyService()
    
    // Register cleanup for the service
    cleanup(() => {
      service.shutdown()
    })
    
    return service
  }

  it('should work correctly', () => {
    const service = setupService()
    // Test logic here
  })
})
```

### Pattern 3: Complex Setup with Multiple Resources
For tests with complex setup requirements:

```typescript
import { createTestSelfCleanup } from '../test-self-cleanup.ts'

describe('ComplexService', () => {
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })
  afterEach(performCleanup)

  function setupComplexTest() {
    const mockDependency = createMockDependency()
    const service = new ComplexService(mockDependency)
    
    // Register cleanup for all resources
    cleanup(() => {
      service.shutdown()
      mockDependency.cleanup()
    })
    
    return { service, mockDependency }
  }

  it('should handle complex scenarios', () => {
    const { service, mockDependency } = setupComplexTest()
    // Test logic here
  })
})
```

## Migration Guidelines

### Step-by-Step Migration Process

1. **Import self cleanup utilities**:
   ```typescript
   import { createTestSelfCleanup } from '../test-self-cleanup.ts'
   ```

2. **Replace global beforeEach/afterEach**:
   - Remove `beforeEach` and `afterEach` from imports
   - Remove global `beforeEach`/`afterEach` blocks
   - Add self cleanup setup

3. **Create helper functions**:
   - Move setup logic from `beforeEach` to helper functions
   - Register cleanup actions using the `cleanup()` function

4. **Update individual tests**:
   - Call helper functions in each test that needs setup
   - For simple cases, handle setup/cleanup directly in the test

5. **Test the migration**:
   - Run the tests to ensure they still pass
   - Verify that resources are properly cleaned up

### Common Patterns to Replace

#### Before (Traditional Pattern):
```typescript
describe('MyService', () => {
  let service: MyService

  beforeEach(() => {
    service = new MyService()
  })

  afterEach(() => {
    service.shutdown()
  })

  it('should work', () => {
    // Test using service
  })
})
```

#### After (Self Cleanup Pattern):
```typescript
describe('MyService', () => {
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })
  afterEach(performCleanup)

  function createService() {
    const service = new MyService()
    cleanup(() => service.shutdown())
    return service
  }

  it('should work', () => {
    const service = createService()
    // Test using service
  })
})
```

## Benefits of Self Cleanup

1. **Test Isolation**: Each test manages its own resources
2. **Explicit Dependencies**: Clear what each test needs
3. **Reduced Side Effects**: No shared state between tests
4. **Better Debugging**: Easier to understand test failures
5. **Flexible Setup**: Different tests can have different setups

## Next Steps

1. **Prioritize Core Services**: Start with the high-priority files listed above
2. **Use Patterns**: Follow the established patterns for consistency
3. **Test Thoroughly**: Ensure each migration maintains test functionality
4. **Document Issues**: Note any challenges or special cases encountered

## Validation

After migration, verify:
- [ ] All tests still pass
- [ ] No resource leaks (check for hanging processes, open files, etc.)
- [ ] Test isolation is maintained
- [ ] Performance is not significantly impacted

## Resources

- **Self Cleanup Implementation**: `backend/src/utils/test-self-cleanup.ts`
- **Migration Guide**: `backend/SELF_CLEANUP_MIGRATION_GUIDE.md`
- **Example Test**: `backend/src/utils/__tests__/test-self-cleanup.example.test.ts`