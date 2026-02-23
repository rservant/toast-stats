# Design Document: District Overview Data Consistency

## Overview

This design addresses data inconsistencies in the District Overview dashboard where:

1. **Paid Clubs shows 0**: The `transformPerformanceTargets()` function hardcodes `paidClubs.current: 0` because `PerformanceTargetsData` lacks a `paidClubsCount` field
2. **Distinguished Clubs mismatch (57 vs 30)**: The `isClubDistinguished()` method in `AreaDivisionRecognitionModule` only checks `dcpGoals >= 5` without validating membership/net growth requirements

The fix involves:

1. Adding `paidClubsCount` field to `PerformanceTargetsData` type
2. Computing `paidClubsCount` in `AnalyticsComputer.computePerformanceTargets()`
3. Fixing `isClubDistinguished()` to use the full DCP criteria
4. Updating the transformation layer to use actual values

## Architecture

### Current Data Flow

```
DistrictStatistics (snapshot)
    ↓
AnalyticsComputer.computePerformanceTargets()
    ↓
PerformanceTargetsData (pre-computed file)
    ↓
Backend reads file
    ↓
transformPerformanceTargets() → DistrictPerformanceTargets
    ↓
Frontend displays
```

### Components Affected

1. **packages/analytics-core/src/types.ts** - Add `paidClubsCount` to `PerformanceTargetsData`
2. **packages/analytics-core/src/analytics/AnalyticsComputer.ts** - Compute `paidClubsCount`
3. **packages/analytics-core/src/analytics/AreaDivisionRecognitionModule.ts** - Fix `isClubDistinguished()`
4. **backend/src/utils/performanceTargetsTransformation.ts** - Use actual `paidClubsCount`

## Components and Interfaces

### 1. Updated PerformanceTargetsData Type

```typescript
// packages/analytics-core/src/types.ts
export interface PerformanceTargetsData {
  districtId: string
  computedAt: string
  membershipTarget: number
  distinguishedTarget: number
  clubGrowthTarget: number
  /** Total count of paid clubs (clubs with "Active" status) */
  paidClubsCount: number // NEW FIELD
  currentProgress: {
    membership: number
    distinguished: number
    clubGrowth: number
  }
  projectedAchievement: {
    membership: boolean
    distinguished: boolean
    clubGrowth: boolean
  }
  paidClubsRankings: MetricRankings
  membershipPaymentsRankings: MetricRankings
  distinguishedClubsRankings: MetricRankings
}
```

### 2. Updated computePerformanceTargets Method

```typescript
// packages/analytics-core/src/analytics/AnalyticsComputer.ts
computePerformanceTargets(
  districtId: string,
  snapshots: DistrictStatistics[],
  allDistrictsRankings?: AllDistrictsRankingsData
): PerformanceTargetsData {
  // ... existing code ...

  // Calculate total paid clubs from area recognition
  const totalPaidClubs = areaRecognitions.reduce(
    (sum, area) => sum + area.paidClubs,
    0
  )

  // ... existing code ...

  return {
    districtId,
    computedAt: new Date().toISOString(),
    membershipTarget,
    distinguishedTarget,
    clubGrowthTarget,
    paidClubsCount: totalPaidClubs,  // NEW: Include paid clubs count
    currentProgress: {
      membership: currentMembership,
      distinguished: currentDistinguished,
      clubGrowth,
    },
    // ... rest of return object
  }
}
```

### 3. Fixed isClubDistinguished Method

The current implementation only checks DCP goals:

```typescript
// CURRENT (BUGGY)
private isClubDistinguished(club: ClubStatistics): boolean {
  return club.dcpGoals >= 5
}
```

The fix must validate the full DCP criteria:

```typescript
// FIXED
private isClubDistinguished(club: ClubStatistics): boolean {
  const dcpGoals = club.dcpGoals
  const membership = club.membershipCount
  const netGrowth = this.calculateNetGrowth(club)

  // Smedley: 10 goals + 25 members
  if (dcpGoals >= 10 && membership >= 25) return true

  // President's: 9 goals + 20 members
  if (dcpGoals >= 9 && membership >= 20) return true

  // Select: 7 goals + (20 members OR 5+ net growth)
  if (dcpGoals >= 7 && (membership >= 20 || netGrowth >= 5)) return true

  // Distinguished: 5 goals + (20 members OR 3+ net growth)
  if (dcpGoals >= 5 && (membership >= 20 || netGrowth >= 3)) return true

  return false
}

private calculateNetGrowth(club: ClubStatistics): number {
  const currentMembers = club.membershipCount
  const membershipBase = club.membershipBase ?? 0
  return currentMembers - membershipBase
}
```

### 4. Updated Transformation Layer

```typescript
// backend/src/utils/performanceTargetsTransformation.ts
export function transformPerformanceTargets(
  performanceTargets: PerformanceTargetsData
): DistrictPerformanceTargets {
  return {
    paidClubs: {
      current: performanceTargets.paidClubsCount, // Use actual value
      base: null,
      targets: null,
      achievedLevel: null,
      rankings: performanceTargets.paidClubsRankings ?? NULL_RANKINGS,
    },
    // ... rest unchanged
  }
}
```

## Data Models

### ClubStatistics Interface (existing)

```typescript
interface ClubStatistics {
  clubId: string
  clubName: string
  divisionId: string
  areaId: string
  membershipCount: number
  membershipBase?: number // Used for net growth calculation
  dcpGoals: number
  clubStatus?: string
  status?: string
  // ... other fields
}
```

### PerformanceTargetsData Changes

| Field          | Type   | Change | Description               |
| -------------- | ------ | ------ | ------------------------- |
| paidClubsCount | number | NEW    | Total count of paid clubs |

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Paid Clubs Count Computation

_For any_ district snapshot containing clubs with various statuses, the computed `paidClubsCount` SHALL equal the count of clubs with "Active" status, and the value SHALL always be non-negative (>= 0).

**Validates: Requirements 1.2, 4.3**

### Property 2: Transformation Preserves Paid Clubs Value

_For any_ valid `PerformanceTargetsData` object with a `paidClubsCount` value, the `transformPerformanceTargets()` function SHALL produce a `DistrictPerformanceTargets` object where `paidClubs.current` equals the input `paidClubsCount`.

**Validates: Requirements 1.3**

### Property 3: Distinguished Club Criteria Validation

_For any_ club with DCP goals and membership values, `isClubDistinguished()` SHALL return `true` if and only if the club meets one of the following criteria:

- Smedley: 10+ goals AND 25+ members
- President's: 9+ goals AND 20+ members
- Select: 7+ goals AND (20+ members OR 5+ net growth)
- Distinguished: 5+ goals AND (20+ members OR 3+ net growth)

**Validates: Requirements 2.1, 2.2**

### Property 4: Performance Targets Data Round-Trip Serialization

_For any_ valid `PerformanceTargetsData` object, serializing to JSON and then deserializing SHALL produce an object equivalent to the original, with all fields including `paidClubsCount` and `currentProgress.distinguished` preserved.

**Validates: Requirements 3.1, 3.2, 3.3**

## Error Handling

### Missing Data Handling

- **Missing membershipBase**: When `club.membershipBase` is undefined or null, treat net growth as 0
- **Missing clubStatus**: When `club.clubStatus` and `club.status` are both missing, treat club as "Active" (paid)
- **Empty snapshots**: Return `paidClubsCount: 0` and `currentProgress.distinguished: 0`

### Validation

- `paidClubsCount` must be a non-negative integer
- `currentProgress.distinguished` must be a non-negative integer
- Both values must be <= total club count in the snapshot

## Testing Strategy

### Testing Philosophy

Per the testing steering document, property tests are a tool, not a default. We apply the decision framework to each correctness property:

| Property                          | PBT Warranted? | Rationale                                                                    |
| --------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| 1. Paid Clubs Count               | No             | Simple counting logic; 3-5 examples provide equivalent confidence            |
| 2. Transformation Preserves Value | No             | Simple pass-through; examples are clearer                                    |
| 3. Distinguished Club Criteria    | **Yes**        | Threshold-based business rules with boundary conditions; complex input space |
| 4. Round-Trip Serialization       | **Yes**        | Encoding/decoding roundtrip - classic PBT use case                           |

### Property-Based Tests (2 tests)

Per Section 7.1 of testing.md, PBT is warranted for:

- **Business rules with universal properties** (Distinguished criteria)
- **Encoding/decoding roundtrips** (JSON serialization)

#### Property Test 1: Distinguished Club Criteria Validation

_For any_ club with DCP goals and membership values, `isClubDistinguished()` SHALL return `true` if and only if the club meets the official DCP criteria.

- **Library**: fast-check
- **Iterations**: 100 minimum
- **Tag**: `Feature: district-overview-data-consistency, Property 3: Distinguished Club Criteria Validation`
- **Validates: Requirements 2.1, 2.2**

#### Property Test 2: Performance Targets Data Round-Trip Serialization

_For any_ valid `PerformanceTargetsData` object, JSON round-trip SHALL preserve all fields.

- **Library**: fast-check
- **Iterations**: 100 minimum
- **Tag**: `Feature: district-overview-data-consistency, Property 4: Performance Targets Data Round-Trip Serialization`
- **Validates: Requirements 3.1, 3.2, 3.3**

### Unit Tests (Well-Chosen Examples)

Per Section 7.3 of testing.md: "Would 5 well-chosen examples provide equivalent confidence? If yes, prefer the examples."

#### Paid Clubs Count Tests

1. **Snapshot with mixed statuses**: 3 Active, 2 Suspended, 1 Low → `paidClubsCount: 3`
2. **All clubs Active**: 5 Active → `paidClubsCount: 5`
3. **All clubs Suspended**: 3 Suspended → `paidClubsCount: 0`
4. **Empty snapshot**: No clubs → `paidClubsCount: 0`

#### Transformation Tests

1. **Pass-through verification**: Input `paidClubsCount: 42` → Output `paidClubs.current: 42`
2. **Zero value**: Input `paidClubsCount: 0` → Output `paidClubs.current: 0`

#### Distinguished Club Criteria Boundary Tests

Per Section 9 of testing.md: "Threshold-based logic MUST be protected by tests that name the rule and cover boundary conditions."

| Test Case               | Goals | Members | Net Growth | Expected          | Rule Being Tested                 |
| ----------------------- | ----- | ------- | ---------- | ----------------- | --------------------------------- |
| Below threshold         | 4     | 25      | 5          | Not Distinguished | Minimum 5 goals required          |
| Distinguished (members) | 5     | 20      | 0          | Distinguished     | 5+ goals + 20+ members            |
| Distinguished (growth)  | 5     | 15      | 3          | Distinguished     | 5+ goals + 3+ net growth          |
| Not Distinguished       | 5     | 19      | 2          | Not Distinguished | Needs 20 members OR 3+ growth     |
| Select (members)        | 7     | 20      | 0          | Distinguished     | 7+ goals + 20+ members            |
| Select (growth)         | 7     | 15      | 5          | Distinguished     | 7+ goals + 5+ net growth          |
| President's             | 9     | 20      | 0          | Distinguished     | 9+ goals + 20+ members            |
| Smedley                 | 10    | 25      | 0          | Distinguished     | 10 goals + 25+ members            |
| Missing membershipBase  | 5     | 20      | undefined  | Distinguished     | Graceful handling of missing data |

## Implementation Notes

### File Changes Summary

| File                                                                     | Change Type | Description                                            |
| ------------------------------------------------------------------------ | ----------- | ------------------------------------------------------ |
| `packages/analytics-core/src/types.ts`                                   | Modify      | Add `paidClubsCount` field to `PerformanceTargetsData` |
| `packages/analytics-core/src/analytics/AnalyticsComputer.ts`             | Modify      | Include `paidClubsCount` in return object              |
| `packages/analytics-core/src/analytics/AreaDivisionRecognitionModule.ts` | Modify      | Fix `isClubDistinguished()` to use full DCP criteria   |
| `backend/src/utils/performanceTargetsTransformation.ts`                  | Modify      | Use `performanceTargets.paidClubsCount` instead of 0   |

### Regeneration Required

After implementing these changes, all pre-computed analytics files must be regenerated using the collector-cli to include the new `paidClubsCount` field and corrected `currentProgress.distinguished` values.
