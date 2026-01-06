# TypeScript Steering Document

**Status:** Authoritative  
**Applies to:** All TypeScript code (backend, frontend, tooling, and tests)  
**Audience:** All developers and automation agents (including Kiro)  
**Owner:** Development Team

---

## 1. Purpose

This document defines **mandatory TypeScript standards and requirements** for this codebase.

Its goals are to:

- Enforce type safety throughout the application
- Prevent runtime errors through compile-time and runtime validation
- Maintain long-term code quality and maintainability
- Establish clear, enforceable TypeScript usage patterns

This document is **normative**.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be interpreted as described in RFC 2119.

Kiro MUST treat this document as the **primary source of truth** for all TypeScript-related decisions.

---

## 2. Authority Model

In the event of conflict, TypeScript rules MUST be applied according to the following precedence order (highest first):

1. **This Steering Document**
2. `tsconfig.json`
3. ESLint configuration
4. File-level overrides or comments

Lower-precedence sources MUST NOT weaken higher-precedence rules.

---

## 3. Scope

This document applies **equally and without exception** to:

- Production code
- Test code
- Build and tooling code
- Scripts and utilities

There are **no relaxed TypeScript rules** for test code.

---

## 4. Core Principles

All TypeScript code MUST adhere to the following principles:

1. **Zero tolerance for TypeScript errors**  
   No TypeScript compilation errors are permitted in code merged into `main` or deployed.

2. **Type safety over convenience**  
   Developer ergonomics must not compromise correctness.

3. **Clarity over cleverness**  
   Types should make intent obvious and code self-documenting.

4. **Validation at boundaries**  
   External and untrusted data MUST be validated at runtime.

---

## 5. Required Compiler Configuration

The following `tsconfig.json` options MUST be enabled:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "useUnknownInCatchVariables": true
}
```

Disabling or weakening any of these options requires an explicit exception under Section 12.

---

## 6. Prohibited Patterns

### 6.1 Explicit `any`

The `any` type is **STRICTLY FORBIDDEN**.

**Rule:** `@typescript-eslint/no-explicit-any` MUST be enabled and enforced.

```ts
// ❌ FORBIDDEN
function process(data: any): any {
  return data.value;
}

interface InvalidExample {
  payload: any;
}
```

---

## 7. Approved Type-Safe Patterns

### 7.1 `unknown` and Narrowing

```ts
function processUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  throw new Error('Expected string');
}
```

---

## 8. External Data Validation

All data originating from external or untrusted sources MUST be typed as `unknown`, validated at runtime, and narrowed before use.

---

## 9. Enforcement

TypeScript compilation errors are **always blocking**.

---

## 10. Legacy Code and Quota-Based Migration

Pull requests MUST NOT introduce a net increase in `any` usage.

---

## 11. Exceptions

Exceptions require documentation, justification, and a resolution plan.

---

## 12. Final Rules

> **TypeScript errors are blockers, not warnings.**  
> **The `any` type is forbidden.**  
> **All external data must be validated.**
