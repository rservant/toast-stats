# Self Cleanup Migration Status

## Overview

This document tracks the progress of migrating test files from traditional `beforeEach`/`afterEach` hooks to the self cleanup pattern using `createTestSelfCleanup`.

## Migration Progress

### ✅ Completed Migrations

The following test files have been successfully migrated to use self cleanup:

1. **frontend/src/utils/**tests**/csvExport.test.ts**
   - Migrated from global beforeEach/afterEach to per-test timer management
   - Each test now manages its own fake timers

2. **backend/src/utils/**tests**/RetryManager.test.ts**
   - Migrated from global timer setup to per-test timer management
   - Each test that needs timers sets them up and cleans them up individually

3. **backend/src/utils/**tests**/AlertManager.test.ts**
   - Migrated to use `createTestSelfCleanup` with `setupAlertManager()` helper
   - Each test manages its own AlertManager instance and timer cleanup

4. **backend/src/utils/**tests**/ReconciliationTestDataGenerator.test.ts**
   - Migrated to use `createTestSelfCleanup` with `createGenerator()` helper
   - Each test creates its own generator instance

5. **backend/src/utils/**tests**/ReconciliationReplayEngine.test.ts**
   - Migrated to use `createTestSelfCleanup` with `createReplayEngine()` helper
   - Complex test with multiple setup functions for different test scenarios

6. **backend/src/services/**tests**/CacheConfigService.test-isolation.property.test.ts** ✅ **COMPLIANCE VERIFIED**
   - Already using self cleanup (was previously migrated)
   - **Zero lint errors, zero TypeScript errors, zero formatting errors**
   - Full compliance with organizational standards achieved

7. **backend/src/services/**tests**/CacheConfigService.property.test.ts** ✅ **COMPLIANCE VERIFIED**
   - Already using self cleanup (was previously migrated)
   - **Zero lint errors, zero TypeScript errors, zero formatting errors**
   - Full compliance with organizational standards achieved

8. **backend/src/services/**tests**/ReconciliationStorageManager.test.ts** ✅ **COMPLIANCE VERIFIED**
   - Already using self cleanup (was previously migrated)
   - **Zero lint errors, zero TypeScript errors, zero formatting errors**
   - Full compliance with organizational standards achieved

9. **backend/src/services/**tests**/ReconciliationPerformance.unit.test.ts** ✅ **COMPLIANCE VERIFIED**
   - Migrated to use `createTestSelfCleanup` with helper functions
   - Each test manages its own ReconciliationCacheService and ReconciliationPerformanceMonitor instances
   - Replaced global beforeEach/afterEach with per-test setup and cleanup
   - **Zero lint errors, zero TypeScript errors, zero formatting errors**
   - Full compliance with organizational standards achieved

10. **backend/src/services/**tests**/ReconciliationPerformance.test.ts** ✨ **NEW**
    - Migrated to use `createTestSelfCleanup` with `createUniqueTestDir` for storage paths
    - Each test manages its own ReconciliationStorageOptimizer, CacheService, BatchProcessor, and PerformanceMonitor instances
    - Replaced hardcoded test directories with unique test directories

11. **backend/src/services/**tests**/DistrictBackfillService.test.ts** ✨ **NEW**
    - Migrated to use `createTestSelfCleanup` with `createUniqueTestDir` for cache directories
    - Each test creates its own DistrictCacheManager and DistrictBackfillService instances
    - Replaced test-cache-helper with self-cleanup pattern

## Compliance Status ✅

### Organizational Standards Compliance

**COMPLETE COMPLIANCE ACHIEVED** for all migrated self-cleanup test files:

- **Zero lint errors** across all migrated test files
- **Zero TypeScript errors** across all migrated test files
- **Zero formatting errors** across all migrated test files
- **Full adherence** to TypeScript Policy steering document
- **Full adherence** to Lint Compliance steering document
- **Full adherence** to Software Testing steering document

### Recent Compliance Fixes (December 28, 2025)

Successfully resolved all remaining compliance issues in the core migrated test files:

1. **Type Safety Improvements**
   - Eliminated all explicit `any` types using safe type assertion patterns
   - Implemented proper mock interfaces for test utilities
   - Added comprehensive null safety checks in test assertions

2. **Lint Compliance Achievements**
   - Fixed all unused variable and import violations
   - Resolved React hooks dependency array issues
   - Eliminated console statement violations
   - Achieved zero lint warnings across all files

3. **Code Quality Enhancements**
   - Improved type definitions for test mock objects
   - Enhanced error handling in test scenarios
   - Standardized formatting across all test files

### CI/CD Pipeline Status

All migrated self-cleanup test files now pass:

- ✅ ESLint checks (zero errors)
- ✅ TypeScript compilation (zero errors)
- ✅ Prettier formatting (zero errors)
- ✅ Test execution (all tests passing)

This establishes a **gold standard** for future migrations and demonstrates that the self-cleanup pattern is fully compatible with organizational quality standards.

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

### Compliance-First Migration Patterns

All migration patterns now follow organizational compliance standards:

#### Pattern 1: Type-Safe Self Cleanup

```typescript
import { createTestSelfCleanup } from '../test-self-cleanup.ts'

describe('MyService', () => {
  // Self-cleanup setup with proper typing
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })
  afterEach(performCleanup)

  // Type-safe helper function
  function setupService(): MyService {
    const service = new MyService()
    cleanup(() => service.shutdown())
    return service
  }

  it('should work correctly', () => {
    const service = setupService()
    // Test logic with proper type safety
    expect(service).toBeDefined()
  })
})
```

#### Pattern 2: Mock Interface Pattern (Compliance-Approved)

For test mocks, use dedicated interfaces instead of `Partial<RealType>`:

```typescript
// GOOD: Dedicated mock interface
interface MockCacheService {
  get: Mock<[string], unknown>
  set: Mock<[string, unknown], void>
  clear: Mock<[], void>
}

function createMockCacheService(): MockCacheService {
  return {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  }
}

// Register cleanup for mocks
function setupTest() {
  const mockCache = createMockCacheService()
  cleanup(() => {
    vi.clearAllMocks()
  })
  return { mockCache }
}
```

#### Pattern 3: Safe Type Assertion Pattern

When eliminating `any` types, use the unknown-first pattern:

```typescript
// GOOD: Safe type assertion
function parseTestData(data: unknown): TestData {
  return data as unknown as TestData
}

// GOOD: Type guard pattern
function isTestData(data: unknown): data is TestData {
  return typeof data === 'object' && data !== null && 'id' in data
}
```

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
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

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
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })
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

### Compliance-First Migration Process

Every migration MUST achieve zero errors for all organizational standards:

#### Step 1: Pre-Migration Compliance Check

```bash
# Verify current state
npm run lint                    # Must pass
npx tsc --noEmit --skipLibCheck # Must pass
npm run format                  # Must pass
npm test                        # Must pass
```

#### Step 2: Import Self Cleanup Utilities

```typescript
import { createTestSelfCleanup } from '../test-self-cleanup.ts'
```

#### Step 3: Replace Global Hooks with Type-Safe Patterns

- Remove `beforeEach` and `afterEach` from imports
- Remove global `beforeEach`/`afterEach` blocks
- Add self cleanup setup with proper typing

#### Step 4: Create Compliance-Approved Helper Functions

- Move setup logic from `beforeEach` to typed helper functions
- Use proper interfaces for mock objects (no `Partial<RealType>`)
- Register cleanup actions using the `cleanup()` function
- Eliminate all `any` types using safe assertion patterns

#### Step 5: Update Tests with Type Safety

- Call helper functions in each test that needs setup
- Add proper null checks before assertions
- Use type-safe mock interfaces
- Ensure all variables are used (no unused imports/variables)

#### Step 6: Post-Migration Compliance Verification

```bash
# All must pass with zero errors
npm run lint                    # Zero lint errors
npx tsc --noEmit --skipLibCheck # Zero TypeScript errors
npm run format                  # Zero formatting errors
npm test                        # All tests passing
```

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

#### Before (Traditional Pattern)

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

#### After (Self Cleanup Pattern)

```typescript
describe('MyService', () => {
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })
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

After migration, verify both functionality and compliance:

### Functional Validation

- [ ] All tests still pass
- [ ] No resource leaks (check for hanging processes, open files, etc.)
- [ ] Test isolation is maintained
- [ ] Performance is not significantly impacted

### Compliance Validation (MANDATORY)

- [ ] **Zero lint errors**: `npm run lint` returns exit code 0
- [ ] **Zero TypeScript errors**: `npx tsc --noEmit --skipLibCheck` returns exit code 0
- [ ] **Zero formatting errors**: `npm run format` returns exit code 0
- [ ] **No explicit `any` types**: All types properly defined
- [ ] **No unused variables/imports**: Clean code with no dead code
- [ ] **Proper mock interfaces**: No `Partial<RealType>` patterns
- [ ] **Type-safe assertions**: Use `unknown as SpecificType` pattern
- [ ] **Complete null safety**: All assertions include proper null checks

### Compliance Verification Commands

```bash
# Run all compliance checks
npm run lint && npx tsc --noEmit --skipLibCheck && npm run format && npm test

# Should output: All checks passed with zero errors
```

### Quality Gates

Migration is considered complete ONLY when:

1. All functional tests pass
2. All compliance checks pass with zero errors
3. Code follows established self-cleanup patterns
4. Documentation is updated

## Resources

- **Self Cleanup Implementation**: `backend/src/utils/test-self-cleanup.ts`
- **Migration Guide**: `backend/SELF_CLEANUP_MIGRATION_GUIDE.md`
- **Example Test**: `backend/src/utils/__tests__/test-self-cleanup.example.test.ts`
