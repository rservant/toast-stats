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

---

## 4. Test Strategy (Advisory Pyramid)

The system SHOULD broadly follow this distribution:

| Layer               | Purpose                     |
| ------------------- | --------------------------- |
| Unit Tests          | Core logic and rules        |
| Integration Tests   | Persistence and contracts   |
| End-to-End Tests    | Critical workflows only     |
| Exploratory Testing | Discovery and understanding |

This is guidance, not enforcement.  
Kiro SHOULD reason qualitatively, not mechanically.

---

## 5. Unit Testing Standards

Unit tests MUST:

- Be deterministic
- Avoid real network, filesystem, or clock dependencies
- Test one behaviour at a time
- Fail clearly and meaningfully

Critical or non-obvious logic SHOULD be covered by multiple tests.

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

---

## 7. End-to-End Testing

End-to-end tests are expensive.

They SHOULD exist only when:

- A workflow would be painful to validate manually
- A failure would be subtle or costly

Few trusted E2E tests are better than many brittle ones.

---

## 8. Rule-Driven and Derived Logic

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

## 9. Legacy and Refactoring Rule

Refactoring MUST NOT proceed without test protection.

Rule:

> No refactor without tests.  
> No tests without understanding.

---

## 10. Test Ownership

The author owns all tests.

Broken or unclear tests are a signal to clarify intent, not to delete blindly.

---

## 11. Final Rule

> **If it matters later, it must be tested now.**  
> **If a test isn’t trusted, fix the test before trusting the code.**  
> **If future-you would ask “why?”, the test should answer it.**

---

This document is paired with `testing.eval.md`.  
Kiro MUST use both when evaluating changes.
