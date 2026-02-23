# Design Document: Club Status Value Mismatch Fix

## Overview

This design addresses the data contract mismatch for the `ClubHealthStatus` type between the backend/analytics-core (using `intervention_required` with underscore) and the frontend (expecting `intervention-required` with hyphen). The fix establishes a canonical type definition in `shared-contracts` and updates all consumers to use it consistently.

The solution follows the data-computation-separation steering document: the canonical type is defined in shared-contracts, analytics-core uses it during computation, and the backend serves the pre-computed data unchanged.

## Architecture

```mermaid
graph TB
    subgraph "shared-contracts"
        SC[ClubHealthStatus Type<br/>'thriving' | 'stable' | 'vulnerable' | 'intervention-required']
        ZS[ClubHealthStatusSchema<br/>Zod validation]
    end

    subgraph "analytics-core"
        AC[ClubHealthAnalyticsModule]
        AT[types.ts re-export]
    end

    subgraph "collector-cli"
        CLI[Computes analytics<br/>Writes pre-computed files]
    end

    subgraph "backend"
        BE[Serves pre-computed data]
        BT[types/analytics.ts]
    end

    subgraph "frontend"
        FE[useDistrictAnalytics]
        CT[ClubsTable]
    end

    SC --> AT
    SC --> BT
    SC --> FE
    ZS --> CLI
    AT --> AC
    AC --> CLI
    CLI --> BE
    BE --> FE
    FE --> CT
```

## Components and Interfaces

### 1. shared-contracts Package

**New File: `packages/shared-contracts/src/types/club-health-status.ts`**

```typescript
/**
 * Club health status classification.
 *
 * - 'thriving': Club meets all health requirements
 * - 'stable': Club is maintaining adequate performance
 * - 'vulnerable': Club has some but not all requirements met
 * - 'intervention-required': Club needs immediate attention (membership < 12 AND net growth < 3)
 */
export type ClubHealthStatus =
  | 'thriving'
  | 'stable'
  | 'vulnerable'
  | 'intervention-required'
```

**New File: `packages/shared-contracts/src/schemas/club-health-status.schema.ts`**

```typescript
import { z } from 'zod'

/**
 * Zod schema for ClubHealthStatus validation.
 */
export const ClubHealthStatusSchema = z.enum([
  'thriving',
  'stable',
  'vulnerable',
  'intervention-required',
])
```

**Updated: `packages/shared-contracts/src/index.ts`**

Add exports for the new type and schema.

### 2. analytics-core Package

**Updated: `packages/analytics-core/src/types.ts`**

```typescript
// Re-export ClubHealthStatus from shared-contracts
export type { ClubHealthStatus } from '@toastmasters/shared-contracts'
```

**Updated: `packages/analytics-core/src/analytics/ClubHealthAnalyticsModule.ts`**

Change all occurrences of `'intervention_required'` to `'intervention-required'`.

### 3. backend Package

**Updated: `backend/src/types/analytics.ts`**

```typescript
// Import from shared-contracts instead of defining locally
export type { ClubHealthStatus } from '@toastmasters/shared-contracts'
```

### 4. frontend Package

**Updated: `frontend/src/hooks/useDistrictAnalytics.ts`**

```typescript
// Import from shared-contracts instead of defining locally
import type { ClubHealthStatus } from '@toastmasters/shared-contracts'

export type { ClubHealthStatus }
```

**Updated: `frontend/src/hooks/useClubTrends.ts`**

```typescript
// Import from shared-contracts instead of defining locally
import type { ClubHealthStatus } from '@toastmasters/shared-contracts'

export type { ClubHealthStatus }
```

## Data Models

### ClubHealthStatus Type

| Value                     | Description                                | Criteria                                                                     |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `'thriving'`              | Club meets all health requirements         | Membership ≥ 20 (or net growth ≥ 3) AND DCP checkpoint met AND CSP submitted |
| `'stable'`                | Club is maintaining adequate performance   | Reserved for future use                                                      |
| `'vulnerable'`            | Club has some but not all requirements met | Some requirements not met, but not intervention-required                     |
| `'intervention-required'` | Club needs immediate attention             | Membership < 12 AND net growth < 3                                           |

### Impact on Existing Types

The `ClubTrend` interface in all packages uses `currentStatus: ClubHealthStatus`. This change ensures the value assigned to `currentStatus` uses the hyphenated format consistently.

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property Test Applicability Assessment

Per the testing steering document, property-based testing should only be used when:

1. Mathematical invariants exist
2. Complex input spaces with non-obvious edge cases
3. Business rules with universal properties
4. Existing bugs suggest missed edge cases

**Assessment for this feature:**

This fix addresses a simple string value mismatch ('intervention_required' vs 'intervention-required'). The requirements are:

- Type definition with 4 fixed values
- String literal assignment in one location
- UI display of known values

**Conclusion:** Property-based testing is **NOT warranted** for this feature because:

- The input space is trivial (4 fixed string values)
- 3-5 specific examples fully cover the behavior
- No mathematical invariants or complex transformations
- The fix is a simple string literal change

### Testable Examples (Unit Tests)

The following examples provide sufficient confidence:

**Example 1: Schema accepts valid values**

- Input: 'intervention-required'
- Expected: Schema validation passes
- **Validates: Requirements 1.2, 1.3**

**Example 2: Schema rejects underscore variant**

- Input: 'intervention_required'
- Expected: Schema validation fails
- **Validates: Requirements 1.3**

**Example 3: ClubHealthAnalyticsModule assigns hyphen format**

- Input: Club with membership=10, membershipBase=8 (net growth=2)
- Expected: currentStatus === 'intervention-required'
- **Validates: Requirements 2.2**

**Example 4: ClubsTable displays correct styling**

- Input: Club with currentStatus='intervention-required'
- Expected: Row has 'bg-red-50' class, badge has 'bg-red-100' class
- **Validates: Requirements 3.3, 5.1**

## Error Handling

### Invalid Status Values

If a status value is encountered that doesn't match the `ClubHealthStatusSchema`, the system should:

1. **At computation time (analytics-core)**: This should not occur as the module assigns values directly
2. **At validation time (shared-contracts)**: Zod schema will throw a validation error with details about the invalid value
3. **At display time (frontend)**: Unknown status values should fall through to a default styling (currently 'thriving' styling)

### Type Safety

TypeScript's type system will catch mismatches at compile time when:

- A component tries to use an invalid status value
- A function returns an incorrect status type

## Testing Strategy

### Approach

Per the testing steering document: "Prefer the simplest test that provides confidence" and "Property tests are for invariants, not for everything."

This feature uses **unit tests with well-chosen examples** rather than property-based tests because:

- The fix is a simple string literal change
- The input space is bounded (4 fixed values)
- Examples fully cover the behavior

### Unit Tests

Unit tests should cover:

1. **shared-contracts**:
   - Verify `ClubHealthStatusSchema` accepts all 4 valid values
   - Verify `ClubHealthStatusSchema` rejects 'intervention_required' (underscore)
   - Verify `ClubHealthStatusSchema` rejects arbitrary invalid strings

2. **analytics-core**:
   - Verify `ClubHealthAnalyticsModule.assessClubHealth()` assigns 'intervention-required' (hyphen) for clubs meeting intervention criteria
   - Verify the string literal is exactly 'intervention-required', not 'intervention_required'

3. **frontend**:
   - Verify `getStatusBadge('intervention-required')` returns correct CSS classes
   - Verify `getRowColor('intervention-required')` returns correct CSS classes
   - Verify `getStatusLabel('intervention-required')` returns 'Intervention Required'

### Integration Tests

Integration tests should verify:

1. End-to-end flow from analytics computation through to frontend display
2. The Clubs tab correctly displays intervention-required clubs with red styling
3. Status counts match between Overview and Clubs tabs
