# Test Isolation and Concurrency Cleanup Spec Prompt

Use this prompt to create a comprehensive spec for fixing test isolation, concurrency, and race condition issues in the backend test suite.

---

## Prompt for Kiro

```
I need you to create a comprehensive spec to fix critical test isolation, concurrency, and race condition issues in our backend test suite.

## Context

Our analysis (see TEST_ISOLATION_ANALYSIS.md) identified that the current test suite has significant problems:

1. **Shared Cache Directory Race Conditions** - Tests use overlapping cache directories causing data corruption
2. **Global State Pollution** - Environment variables and singletons leak between tests
3. **Insufficient Test Isolation** - Tests interfere with each other when run in parallel
4. **Async Resource Cleanup Issues** - Resources leak between test runs
5. **Concurrency-Unsafe Patterns** - Tests fail unpredictably in parallel execution

## Requirements

The spec should address these areas:

### 1. Test Infrastructure Modernization
- Replace shared cache directories with unique, isolated directories per test
- Implement proper environment variable scoping
- Create standardized test isolation utilities
- Add resource leak detection and monitoring

### 2. Architecture Changes for Testability
- Convert singleton patterns to dependency injection
- Ensure all services accept dependencies as constructor parameters
- Implement proper resource management with cleanup/dispose methods
- Remove global state dependencies

### 3. Test Pattern Standardization
- Establish patterns for unique resource naming (directories, ports, etc.)
- Implement complete cleanup verification in afterEach hooks
- Create concurrency-safe resource management utilities
- Add test execution monitoring

### 4. Specific Test File Fixes
Focus on these problematic files:
- `backend/src/__tests__/districts.integration.test.ts`
- `backend/src/__tests__/unified-backfill-service.e2e.test.ts`
- `backend/src/services/__tests__/ReconciliationWorkflow.integration.test.ts`
- `backend/src/services/__tests__/ServiceFactory.integration.test.ts`
- `backend/src/services/__tests__/BackfillService.ranking-integration.test.ts`

### 5. Success Criteria
- All tests must pass when run with `vitest --run` (parallel mode)
- Zero resource leaks detected in CI runs
- Test flakiness rate < 1%
- No shared file system resources between tests
- Environment variables properly scoped per test

## Technical Constraints

- Single-user deployment context (see production-maintenance.md)
- Emphasis on correctness and maintainability over performance
- Must maintain existing test coverage and behavior validation
- Should leverage existing test utilities where possible (TestIsolationManager, test-self-cleanup)

## Deliverables Expected

1. **Test Infrastructure Utilities** - Enhanced isolation and cleanup utilities
2. **Service Architecture Changes** - Dependency injection patterns
3. **Test File Refactoring** - Fix all identified problematic test files
4. **Documentation** - Updated patterns and guidelines
5. **Verification Tools** - Resource leak detection and monitoring

## Implementation Approach

Please structure the spec with:
- Clear phases with dependencies and priorities
- Specific technical solutions for each identified issue
- Code examples showing before/after patterns
- Verification steps to ensure fixes work
- Rollback plans if issues arise

The spec should be implementable in phases while maintaining test functionality throughout the process.
```

---

## Usage Instructions

1. Copy the prompt above and paste it into a new conversation with Kiro
2. Kiro will create a comprehensive spec document with detailed implementation plans
3. The spec will include specific code changes, utilities, and verification steps
4. Implementation can proceed in phases while maintaining test functionality

## Expected Spec Structure

The resulting spec should include:

- **Executive Summary** with problem statement and solution approach
- **Technical Requirements** with specific acceptance criteria
- **Implementation Phases** with clear dependencies and timelines
- **Code Examples** showing before/after patterns for common issues
- **Verification Plan** to ensure fixes work and don't regress
- **Risk Assessment** and mitigation strategies
- **Documentation Updates** for new patterns and utilities

## Success Metrics

The spec should define clear success metrics:

- All tests pass in parallel execution (`vitest --run`)
- Zero resource leaks in CI environment
- Test execution time variance < 10% between serial and parallel
- Flaky test rate < 1%
- 100% cleanup verification success rate
