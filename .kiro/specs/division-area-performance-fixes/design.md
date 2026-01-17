# Design Document: Division and Area Performance Fixes

## Overview

This design addresses five calculation bugs in the Division and Area Performance Cards feature. The bugs affect how club base values, distinguished club counts, and visit completion counts are calculated in the `extractDivisionPerformance.ts` module.

The fixes involve:

1. Reading Division Club Base from the CSV field instead of counting clubs
2. Reading Area Club Base from the CSV field instead of counting clubs
3. Using the analytics engine's distinguished level determination logic for consistency
4. Counting clubs with "1" in "Nov Visit award" for first round visits
5. Counting clubs with "1" in "May visit award" for second round visits

These changes ensure the performance cards display accurate data that matches the source CSV fields and maintains consistency with the analytics engine's calculations used elsewhere in the application.

## Architecture

### Affected Components

```
frontend/src/utils/
├── extractDivisionPerformance.ts  (PRIMARY - bug fixes here)
├── divisionStatus.ts              (UNCHANGED - calculation functions)
└── __tests__/
    ├── extractDivisionPerformance.test.ts         (UPDATE tests)
    └── extractDivisionPerformance.property.test.ts (UPDATE property tests)
```

### Data Flow Changes

**Current (Buggy) Flow:**

```
divisionPerformance CSV → Count clubs → clubBase
clubPerformance CSV → Lookup distinguished status → distinguishedClubs
Single club record → Read "Nov Visit award" value → firstRoundVisits
```

**Fixed Flow:**

```
divisionPerformance CSV → Read "Division Club Base" field → clubBase
divisionPerformance CSV → Read "Area Club Base" field → areaClubBase
divisionPerformance CSV → Apply distinguished level logic → distinguishedClubs
divisionPerformance CSV → Count clubs with "Nov Visit award" = "1" → firstRoundVisits
divisionPerformance CSV → Count clubs with "May visit award" = "1" → secondRoundVisits
```

### Integration Points

- **DistinguishedClubAnalyticsModule**: The backend module that calculates distinguished club status. The frontend extraction function will use the same logic for consistency.
- **divisionStatus.ts**: Existing calculation functions remain unchanged; only the data extraction logic is modified.

## Components and Interfaces

### Modified Function: extractDivisionPerformance

The main extraction function will be updated to:

1. Read club base values from CSV fields
2. Use consistent distinguished level determination
3. Count visit completions correctly

**Current Signature (unchanged):**

```typescript
export function extractDivisionPerformance(
  districtSnapshot: unknown
): DivisionPerformance[]
```

### Modified Function: extractAreasForDivision

The area extraction helper will be updated to:

1. Read area club base from CSV field
2. Count first/second round visits by iterating through clubs

### New Helper Function: determineDistinguishedLevel

A new helper function to determine distinguished level using the same logic as the analytics engine:

```typescript
/**
 * Determines the distinguished level for a club based on DCP criteria
 * Uses the same logic as DistinguishedClubAnalyticsModule for consistency
 *
 * @param club - Raw club data record from CSV
 * @returns Distinguished level or null if not distinguished
 */
function determineDistinguishedLevel(
  club: Record<string, unknown>
): 'Smedley' | 'Presidents' | 'Select' | 'Distinguished' | null
```

### New Helper Function: countVisitCompletions

A new helper function to count visit completions by iterating through clubs:

```typescript
/**
 * Counts the number of clubs with completed visits for a given visit field
 *
 * @param clubs - Array of club records
 * @param visitField - Field name ("Nov Visit award" or "May visit award")
 * @returns Number of clubs with "1" in the visit field
 */
function countVisitCompletions(clubs: unknown[], visitField: string): number
```

## Data Models

### CSV Field Mappings

The division-performance.csv contains the following relevant fields:

| Field Name                | Description                                     | Usage                                   |
| ------------------------- | ----------------------------------------------- | --------------------------------------- |
| Division Club Base        | Club base for the division                      | Read directly for division clubBase     |
| Area Club Base            | Club base for the area                          | Read directly for area clubBase         |
| Nov Visit award           | First round visit completion ("1" = completed)  | Count clubs with "1"                    |
| May visit award           | Second round visit completion ("1" = completed) | Count clubs with "1"                    |
| Club Distinguished Status | Distinguished level from CSV                    | Primary source for distinguished status |

### Distinguished Level Determination Logic

When "Club Distinguished Status" is empty or missing, calculate from DCP criteria:

```typescript
// Smedley Distinguished: 10 goals + 25 members
if (dcpGoals >= 10 && membership >= 25) return 'Smedley'

// President's Distinguished: 9 goals + 20 members
if (dcpGoals >= 9 && membership >= 20) return 'Presidents'

// Select Distinguished: 7 goals + (20 members OR net growth of 5)
if (dcpGoals >= 7 && (membership >= 20 || netGrowth >= 5)) return 'Select'

// Distinguished: 5 goals + (20 members OR net growth of 3)
if (dcpGoals >= 5 && (membership >= 20 || netGrowth >= 3))
  return 'Distinguished'

return null // Not distinguished
```

### Fallback Behavior

When CSV fields are missing:

- **Division Club Base missing**: Fall back to counting clubs in division
- **Area Club Base missing**: Fall back to counting clubs in area
- **Club Distinguished Status missing**: Calculate from DCP goals/membership
- **Visit award fields missing**: Treat as 0 completed visits

## Testing Approach

Per the property-testing-guidance steering document, this feature does not warrant property-based testing. The logic involves simple field reads, counting, and fallback behavior that is fully covered by well-chosen unit test examples.

**Rationale for unit tests over property tests:**

1. **Club base extraction**: Simple "read field or count clubs" logic - 3-4 examples suffice
2. **Visit counting**: Trivial counting of "1" values - examples are clearer than properties
3. **Distinguished calculation**: Already has PBT coverage in DistinguishedClubAnalyticsModule
4. **Error handling**: A few malformed input examples provide equivalent confidence

## Error Handling

### Missing CSV Fields

**Division Club Base Missing:**

- Log a debug message indicating fallback is being used
- Fall back to counting clubs in the division
- Continue processing without error

**Area Club Base Missing:**

- Log a debug message indicating fallback is being used
- Fall back to counting clubs in the area
- Continue processing without error

**Club Distinguished Status Missing:**

- Calculate distinguished level from DCP goals, membership, and net growth
- If DCP data is also missing, treat club as not distinguished
- Continue processing without error

**Visit Award Fields Missing:**

- Treat missing "Nov Visit award" as not completed (0)
- Treat missing "May visit award" as not completed (0)
- Continue processing without error

### Invalid Data Values

**Non-numeric Club Base:**

- Attempt to parse as integer
- If parsing fails, fall back to counting clubs
- Log warning with the invalid value

**Invalid Distinguished Status:**

- If status string doesn't match known values, treat as not distinguished
- Known values: "Distinguished", "Select Distinguished", "Presidents Distinguished", "Smedley Distinguished"

**Invalid Visit Award Values:**

- Only count "1" as completed
- Any other value (including "0", empty, invalid) is not counted

## Testing Strategy

### Unit Tests Only

All testing will use focused unit tests with well-chosen examples. No property-based tests are needed for this feature.

**Club Base Extraction Tests:**

- Valid "Division Club Base" field present → uses field value
- Valid "Area Club Base" field present → uses field value
- Missing club base fields → falls back to counting clubs
- Invalid/non-numeric club base values → falls back to counting clubs

**Distinguished Clubs Counting Tests:**

- "Club Distinguished Status" field present → uses status directly
- Missing status field with qualifying DCP data → calculates from criteria
- Each distinguished level boundary (5/7/9/10 goals, 20/25 members)
- CSP requirement for 2025-2026+ data

**Visit Counting Tests:**

- Area with all clubs having "1" → count equals club count
- Area with no clubs having "1" → count equals 0
- Area with mixed values ("1", "0", empty) → count equals "1" count only
- Missing visit fields → treated as 0

**Error Handling Tests:**

- Malformed district snapshot → returns empty array, no throw
- Missing required fields → uses sensible defaults
- Invalid data types → graceful fallback

### Test Organization

```text
frontend/src/utils/__tests__/
└── extractDivisionPerformance.test.ts  (UPDATE - add new test cases)
```
