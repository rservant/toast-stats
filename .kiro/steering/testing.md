# Testing Steering Document

**Status:** Authoritative  
**Applies to:** Toastmasters Statistics Application (single-user deployment)  
**Audience:** Primary developer (author), future self  
**Owner:** Author

---

## 1. Purpose

This document defines **how testing is thought about** in this system.

Its purpose is to:

- Protect future changes
- Preserve intent and reasoning
- Prevent silent regressions
- Support confident refactoring in a long-lived personal system

This document prioritizes **clarity, confidence, and recoverability** over process or ceremony.

Kiro MUST treat this document as the **source of intent** when reasoning about tests.

---

## 2. Scope Assumptions

This system operates under the following constraints:

- Single deployment
- Single operator
- Single primary user
- Manual intervention is possible
- Downtime is acceptable
- Long-term maintainability matters more than short-term speed

All testing guidance MUST be interpreted through this lens.

---

## 3. Core Principles

All testing decisions MUST follow these principles:

1. **Testing protects future-you**  
   Tests exist to preserve understanding over time.

2. **Behaviour matters more than structure**  
   Implementation may change; behaviour must not.

3. **Tests are production code**  
   Confusing or brittle tests are technical debt.

4. **Confidence beats coverage**  
   Coverage is a signal, not a goal.

5. **If it matters later, it must be tested now**

6. **Tests must be isolated and concurrent-safe**  
   Tests must not interfere with each other when run in parallel.

7. **Dependency injection over global state**  
   Use injected dependencies instead of singletons to enable proper test isolation.

8. **Prefer the simplest test that provides confidence**  
   Property tests are a tool, not a default. Unit tests with well-chosen examples are often sufficient and more maintainable.

---

## 4. Test Strategy (Advisory Pyramid)

The system SHOULD broadly follow this distribution:

| Layer               | Purpose                             |
| ------------------- | ----------------------------------- |
| Unit Tests          | Core logic and rules                |
| Integration Tests   | Persistence and contracts           |
| Property Tests      | Invariants and complex input spaces |
| End-to-End Tests    | Critical workflows only             |
| Exploratory Testing | Discovery and understanding         |

This is guidance, not enforcement.  
Kiro SHOULD reason qualitatively, not mechanically.

---

## 5. Unit Testing Standards

Unit tests MUST:

- Be deterministic
- Avoid real network, filesystem, or clock dependencies
- Test one behaviour at a time
- Fail clearly and meaningfully
- Use unique, isolated resources (directories, ports, etc.)
- Clean up all resources in afterEach hooks
- Not depend on execution order or other tests

Critical or non-obvious logic SHOULD be covered by multiple tests.

### Test Isolation Requirements

Unit tests MUST ensure:

- **Unique resource naming**: Use timestamps, random IDs, or process IDs to avoid conflicts
- **Complete cleanup**: All created files, directories, and resources must be removed
- **Environment isolation**: Environment variables must be scoped to individual tests
- **No shared state**: Tests must not rely on or modify global state

---

## 6. Integration Testing Standards

Integration tests validate **real behaviour across boundaries**.

They SHOULD be used when:

- Data persistence is involved
- External rules are encoded
- Multiple components interact

Mocks MAY be used only when:

- The real dependency is non-deterministic or unavailable
- Behaviour is already validated elsewhere

### Integration Test Isolation

Integration tests MUST:

- **Use dependency injection**: Create fresh service instances per test
- **Isolate data stores**: Use unique database/cache directories per test
- **Manage async resources**: Properly await all cleanup operations
- **Verify cleanup**: Ensure no resources leak between tests

### Concurrency Safety

Integration tests MUST be safe for parallel execution:

- **No shared resources**: Each test uses completely isolated resources
- **Atomic operations**: File and database operations must be atomic
- **Resource locking**: Use locks when shared resources are unavoidable

---

## 7. Property-Based Testing

Property-based testing (PBT) is a powerful technique, but it is **not the default**.

> **Property tests are a tool, not a default.**

Kiro MUST consult this section before proposing property-based tests.

### 7.1 When Property Tests ARE Warranted

Property-based testing SHOULD be used when:

1. **Mathematical invariants exist**
   - Sorting algorithms (output is sorted, same elements)
   - Calculations with known algebraic properties
   - Encoding/decoding roundtrips

2. **Complex input spaces with non-obvious edge cases**
   - Parsers and serializers
   - Data transformation pipelines
   - Input validation with many boundary conditions

3. **Business rules with universal properties**
   - "Rankings must be unique and contiguous"
   - "Totals must equal sum of parts"
   - "Status transitions must follow state machine"

4. **Existing bugs suggest missed edge cases**
   - When a bug reveals the input space wasn't adequately explored
   - When manual enumeration of cases is impractical

### 7.2 When Property Tests Are NOT Warranted

Property-based testing SHOULD NOT be used for:

1. **UI component fixes**
   - Display formatting
   - Layout adjustments
   - Styling changes

2. **Simple CRUD operations**
   - Basic create/read/update/delete
   - Straightforward data mapping

3. **Integration glue code**
   - Wiring between components
   - Configuration handling

4. **Cases where examples are clearer**
   - When 3-5 specific examples fully cover the behavior
   - When the "property" would just restate the implementation

5. **Low-risk, easily-observable changes**
   - Changes where failures would be immediately obvious
   - Changes with low blast radius

### 7.3 Decision Framework

Before proposing a property test, answer:

1. **What universal property would this test verify?**
   - If you can't articulate a clear property, use unit tests

2. **Would 5 well-chosen examples provide equivalent confidence?**
   - If yes, prefer the examples

3. **Is the input space genuinely complex?**
   - If inputs are simple or bounded, examples suffice

4. **Does this logic have mathematical or algebraic properties?**
   - If no, property tests likely add complexity without value

### 7.4 Existing PBT Coverage

This codebase retains ~32 property-based test files that test genuine properties:

- **Serialization round-trips**: snapshot, CSV, schema, and pointer round-trips
- **Ordering invariants**: snapshot ordering, change history, newer-data-wins
- **Math & classification**: Borda count ranking, metric rankings, risk factors, club categorization
- **Data normalization**: field mapping, division status, snapshot building
- **Storage contracts**: Firestore/local config storage, chunked write, behavioral equivalence
- **Date arithmetic**: closing period detection, refresh service date logic

New property tests SHOULD NOT duplicate coverage that already exists.
Property tests that only iterate fixed values via `constantFrom` SHOULD be converted to unit tests.

---

## 8. End-to-End Testing

End-to-end tests are expensive.

They SHOULD exist only when:

- A workflow would be painful to validate manually
- A failure would be subtle or costly

Few trusted E2E tests are better than many brittle ones.

### E2E Test Isolation

End-to-end tests MUST:

- **Use unique ports**: Each test instance uses a different port
- **Isolate application state**: Fresh application instance per test
- **Clean up servers**: Properly close all server instances
- **Manage external dependencies**: Mock or isolate external services

---

## 9. Rule-Driven and Derived Logic

Any logic that is:

- Threshold-based
- Time-dependent
- Derived from external rules (e.g., Toastmasters DCP/CSP)
- Produces classifications or trajectories

MUST be protected by tests that:

- Name the rule being protected
- Explain _why_ the rule exists
- Cover boundary conditions

---

## 10. Legacy and Refactoring Rule

Refactoring MUST NOT proceed without test protection.

Rule:

> No refactor without tests.  
> No tests without understanding.

---

## 11. Test Ownership

The author owns all tests.

Broken or unclear tests are a signal to clarify intent, not to delete blindly.

---

## 12. Architecture Requirements for Testability

Code MUST be designed to support reliable testing:

### Dependency Injection

- **Services MUST accept dependencies as constructor parameters**
- **Avoid singleton patterns that prevent test isolation**
- **Use factory patterns to create fresh instances for tests**

### Resource Management

- **All resources MUST be explicitly managed (files, connections, processes)**
- **Services MUST provide cleanup/dispose methods**
- **Resource creation MUST be deterministic and isolated**

### State Management

- **Avoid global state that persists between tests**
- **Use immutable data structures where possible**
- **Provide clear state reset mechanisms**

---

## 13. Test Infrastructure Requirements

The test infrastructure MUST provide:

### Isolation Utilities

- **Unique directory creation with automatic cleanup**
- **Environment variable scoping per test**
- **Service instance isolation helpers**
- **Resource leak detection and monitoring**

### Concurrency Support

- **Tests MUST pass when run with `--run` (parallel mode)**
- **Resource conflicts MUST be prevented through proper isolation**
- **Cleanup MUST be verified to prevent resource leaks**

### Monitoring and Verification

- **Test execution MUST be monitored for resource leaks**
- **Cleanup success MUST be verified**
- **Flaky test detection and reporting**

---

## 14. Final Rule

> **If it matters later, it must be tested now.**  
> **If a test isn't trusted, fix the test before trusting the code.**  
> **If future-you would ask "why?", the test should answer it.**  
> **If tests can't run in parallel, they're not properly isolated.**  
> **Prefer the simplest test that provides confidence.**  
> **Property tests are for invariants, not for everything.**  
> **When in doubt, write unit tests with good examples.**

---

This document is paired with `testing.eval.md`.  
Kiro MUST use both when evaluating changes.
