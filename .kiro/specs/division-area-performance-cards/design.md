# Design Document: Division and Area Performance Cards

## Overview

The Division and Area Performance Cards feature adds a new section to the District Detail Page that displays comprehensive performance metrics for all divisions and their constituent areas. Each division is represented by a card containing a summary section and a detailed area table, enabling district leaders to quickly assess progress toward Distinguished, Select Distinguished, and President's Distinguished status at both division and area levels.

The feature integrates with the existing district snapshot data structure and follows established patterns for data fetching, state management, and component composition. It adheres to Toastmasters brand guidelines and accessibility standards while providing a responsive, mobile-friendly interface.

## Architecture

### Component Hierarchy

```
DistrictDetailPage (existing)
└── DivisionPerformanceCards (new)
    └── DivisionPerformanceCard (new) [one per division]
        ├── DivisionSummary (new)
        └── AreaPerformanceTable (new)
            └── AreaPerformanceRow (new) [one per area]
```

### Data Flow

1. **District Detail Page** fetches district snapshot data (existing pattern)
2. **DivisionPerformanceCards** receives snapshot data as props
3. **Status calculation logic** processes raw snapshot data into structured performance metrics
4. **DivisionPerformanceCard** components receive calculated metrics and render UI
5. **User interactions** (if any) trigger state updates through React state management

### Integration Points

- **District Detail Page**: Existing page component that will host the new performance cards section
- **District Snapshot API**: Existing data source containing club, area, and division information
- **Brand Design System**: Existing CSS custom properties and component patterns for Toastmasters styling

## Components and Interfaces

### DivisionPerformanceCards Component

**Purpose**: Container component that orchestrates division performance card rendering

**Props**:

```typescript
interface DivisionPerformanceCardsProps {
  districtSnapshot: DistrictSnapshot
}
```

**Responsibilities**:

- Extract division and area data from district snapshot
- Calculate performance metrics for all divisions and areas
- Render DivisionPerformanceCard components in order
- Display snapshot timestamp

### DivisionPerformanceCard Component

**Purpose**: Displays performance summary and area details for a single division

**Props**:

```typescript
interface DivisionPerformanceCardProps {
  division: DivisionPerformance
}
```

**Responsibilities**:

- Render division summary section
- Render area performance table
- Apply card styling and layout

### DivisionSummary Component

**Purpose**: Displays high-level division performance metrics

**Props**:

```typescript
interface DivisionSummaryProps {
  divisionId: string
  status: DistinguishedStatus
  paidClubs: number
  clubBase: number
  netGrowth: number
  distinguishedClubs: number
  requiredDistinguishedClubs: number
}
```

**Responsibilities**:

- Display division identifier
- Display status badge with appropriate styling
- Display paid clubs progress with net growth indicator
- Display distinguished clubs progress
- Apply visual indicators for at-a-glance status assessment

### AreaPerformanceTable Component

**Purpose**: Displays tabular performance data for all areas in a division

**Props**:

```typescript
interface AreaPerformanceTableProps {
  areas: AreaPerformance[]
}
```

**Responsibilities**:

- Render table header with column labels
- Render AreaPerformanceRow for each area
- Apply responsive table styling
- Handle mobile layout adaptation

### AreaPerformanceRow Component

**Purpose**: Displays performance metrics for a single area

**Props**:

```typescript
interface AreaPerformanceRowProps {
  area: AreaPerformance
}
```

**Responsibilities**:

- Display area identifier
- Display paid clubs with net growth
- Display distinguished clubs progress
- Display first round visit status
- Display second round visit status
- Display area status with appropriate styling

## Data Models

### DistinguishedStatus Type

```typescript
type DistinguishedStatus =
  | 'not-distinguished'
  | 'distinguished'
  | 'select-distinguished'
  | 'presidents-distinguished'
  | 'not-qualified' // For areas only
```

### DivisionPerformance Interface

```typescript
interface DivisionPerformance {
  divisionId: string
  status: Exclude<DistinguishedStatus, 'not-qualified'>
  clubBase: number
  paidClubs: number
  netGrowth: number
  distinguishedClubs: number
  requiredDistinguishedClubs: number
  areas: AreaPerformance[]
}
```

### AreaPerformance Interface

```typescript
interface AreaPerformance {
  areaId: string
  status: DistinguishedStatus
  clubBase: number
  paidClubs: number
  netGrowth: number
  distinguishedClubs: number
  requiredDistinguishedClubs: number
  firstRoundVisits: VisitStatus
  secondRoundVisits: VisitStatus
  isQualified: boolean
}
```

### VisitStatus Interface

```typescript
interface VisitStatus {
  completed: number
  required: number // 75% of club base, rounded up
  percentage: number
  meetsThreshold: boolean // >= 75%
}
```

### Status Calculation Functions

```typescript
/**
 * Calculates the required number of distinguished clubs for a given club base
 * Formula: Math.ceil(clubBase * 0.5)
 */
function calculateRequiredDistinguishedClubs(clubBase: number): number

/**
 * Calculates division distinguished status based on metrics
 */
function calculateDivisionStatus(
  distinguishedClubs: number,
  requiredDistinguishedClubs: number,
  paidClubs: number,
  clubBase: number,
  netGrowth: number
): Exclude<DistinguishedStatus, 'not-qualified'>

/**
 * Calculates area distinguished status based on metrics and qualifying requirements
 */
function calculateAreaStatus(
  isQualified: boolean,
  distinguishedClubs: number,
  requiredDistinguishedClubs: number,
  paidClubs: number,
  clubBase: number,
  netGrowth: number
): DistinguishedStatus

/**
 * Determines if area meets qualifying requirements
 */
function checkAreaQualifying(
  netGrowth: number,
  firstRoundVisits: VisitStatus,
  secondRoundVisits: VisitStatus
): boolean

/**
 * Calculates visit status from snapshot data
 */
function calculateVisitStatus(
  completedVisits: number,
  clubBase: number
): VisitStatus
```

### Data Extraction Functions

```typescript
/**
 * Extracts division and area performance data from district snapshot
 */
function extractDivisionPerformance(
  districtSnapshot: DistrictSnapshot
): DivisionPerformance[]

/**
 * Extracts area visit data from snapshot JSON
 * First round: "Nov Visit award"
 * Second round: "May visit award"
 */
function extractVisitData(
  areaData: unknown,
  clubBase: number
): { firstRound: VisitStatus; secondRound: VisitStatus }
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Distinguished Club Threshold Calculation

_For any_ club base value greater than zero, the required distinguished clubs threshold should equal the ceiling of 50% of the club base.

**Validates: Requirements 2.1, 5.5**

### Property 2: Division Status Classification

_For any_ division with valid metrics (club base, paid clubs, distinguished clubs), the calculated status should match exactly one of the four status levels based on the following rules:

- President's Distinguished when: distinguished clubs ≥ (50% of base + 1) AND net growth ≥ 1
- Select Distinguished when: distinguished clubs ≥ (50% of base + 1) AND paid clubs ≥ base (but not President's)
- Distinguished when: distinguished clubs ≥ 50% of base AND paid clubs ≥ base (but not Select or President's)
- Not Distinguished otherwise

**Validates: Requirements 2.2, 2.3, 2.4, 2.5**

### Property 3: Area Qualifying Requirements

_For any_ area with valid metrics, the area should be marked as qualified if and only if ALL three conditions are met:

- No net club loss (paid clubs ≥ club base)
- First round visits ≥ 75% of club base
- Second round visits ≥ 75% of club base

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 4: Area Status Classification with Qualifying Gate

_For any_ area with valid metrics, if the area is not qualified, the status must be "not-qualified" regardless of other metrics. If the area is qualified, the status should follow the same classification rules as divisions (Distinguished, Select Distinguished, or President's Distinguished).

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 5: Net Growth Calculation

_For any_ valid paid clubs count and club base, net growth should equal (paid clubs - club base), which can be positive, negative, or zero.

**Validates: Requirements 2.6**

### Property 6: Visit Completion Percentage Calculation

_For any_ valid completed visits count and club base, the visit completion percentage should equal (completed visits / club base) × 100, and the threshold should be met when percentage ≥ 75.

**Validates: Requirements 7.3, 7.4**

### Property 7: Division Card Count and Ordering

_For any_ district snapshot containing N divisions, the rendered output should contain exactly N division cards, ordered by division identifier in ascending order.

**Validates: Requirements 1.1, 1.3**

### Property 8: Area Row Count and Ordering

_For any_ division containing N areas, the rendered area table should contain exactly N rows, ordered by area identifier in ascending order.

**Validates: Requirements 6.1, 6.8**

### Property 9: Division Summary Data Completeness

_For any_ division, the rendered summary section should contain all required data elements: division identifier, status level, paid clubs in "current/base" format, net growth indicator, and distinguished clubs in "current/required" format.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 10: Area Row Data Completeness

_For any_ area, the rendered row should contain all required data elements: area identifier, paid clubs with net growth, distinguished clubs progress, first round visit status, second round visit status, and current status level.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

### Property 11: Visit Data Extraction

_For any_ district snapshot containing area visit data, the extraction function should correctly retrieve first round visits from "Nov Visit award" field and second round visits from "May visit award" field.

**Validates: Requirements 7.1, 7.2**

### Property 12: Data Extraction Completeness

_For any_ valid district snapshot, the extraction function should produce division performance data that includes all divisions and all areas within each division present in the snapshot.

**Validates: Requirements 1.4**

### Property 13: Snapshot Update Reactivity

_For any_ two different district snapshots, providing the second snapshot should result in recalculated status classifications and updated metrics that reflect the new snapshot's data.

**Validates: Requirements 10.1, 10.2**

### Property 14: Snapshot Timestamp Display

_For any_ district snapshot with a timestamp, the rendered output should include that timestamp in a visible location.

**Validates: Requirements 10.3**

## Error Handling

### Invalid or Missing Data

**Division/Area Data Missing**:

- When division or area data is missing from snapshot, log warning and skip that entity
- Display message to user indicating incomplete data
- Continue rendering other valid divisions/areas

**Invalid Numeric Values**:

- When club counts are negative or non-numeric, treat as zero
- Log validation error with entity identifier
- Display error indicator in affected card/row

**Missing Visit Data**:

- When visit award data is missing, treat as zero completed visits
- Display "No data" indicator in visit status columns
- Do not prevent area from being rendered

### Calculation Edge Cases

**Zero Club Base**:

- When club base is zero, set required distinguished clubs to zero
- Status calculation should handle division by zero gracefully
- Display appropriate message indicating no clubs in division/area

**Threshold Rounding**:

- Always use Math.ceil() for threshold calculations to ensure proper rounding up
- Document that 50% threshold means "at least half, rounded up"

### Data Consistency

**Inconsistent Counts**:

- When distinguished clubs > paid clubs (data inconsistency), log warning
- Display data as-is but add visual indicator of potential data issue
- Do not block rendering or status calculation

## Testing Strategy

### Unit Tests

Unit tests will focus on core calculation logic and data transformation:

**Status Calculation Functions**:

- Test `calculateRequiredDistinguishedClubs` with various club base values including edge cases (0, 1, even, odd)
- Test `calculateDivisionStatus` with boundary conditions for each status level
- Test `calculateAreaStatus` with qualified and non-qualified scenarios
- Test `checkAreaQualifying` with all combinations of qualifying criteria
- Test `calculateVisitStatus` with various completion percentages around 75% threshold

**Data Extraction Functions**:

- Test `extractDivisionPerformance` with sample snapshot structures
- Test `extractVisitData` with present and missing visit award data
- Test handling of malformed or incomplete snapshot data

**Edge Cases**:

- Zero club base scenarios
- Missing visit data (example test)
- Negative net growth values
- Boundary values for status thresholds (exactly 50%, exactly 75%)

### Property-Based Tests

Property-based tests will verify universal correctness properties across randomized inputs:

**Configuration**: Each property test will run minimum 100 iterations with randomized inputs.

**Property Test Suite**:

1. **Distinguished Club Threshold Property** (Property 1)
   - Generate random club base values (1-100)
   - Verify threshold = Math.ceil(clubBase \* 0.5)
   - Tag: **Feature: division-area-performance-cards, Property 1: Distinguished club threshold calculation**

2. **Division Status Classification Property** (Property 2)
   - Generate random division metrics
   - Verify status matches exactly one classification rule
   - Verify status precedence (President's > Select > Distinguished > Not Distinguished)
   - Tag: **Feature: division-area-performance-cards, Property 2: Division status classification**

3. **Area Qualifying Requirements Property** (Property 3)
   - Generate random area metrics with various qualifying combinations
   - Verify qualifying determination matches ALL three criteria
   - Tag: **Feature: division-area-performance-cards, Property 3: Area qualifying requirements**

4. **Area Status with Qualifying Gate Property** (Property 4)
   - Generate random qualified and non-qualified areas
   - Verify non-qualified areas always get "not-qualified" status
   - Verify qualified areas follow classification rules
   - Tag: **Feature: division-area-performance-cards, Property 4: Area status classification with qualifying gate**

5. **Net Growth Calculation Property** (Property 5)
   - Generate random paid clubs and club base values
   - Verify net growth = paid clubs - club base
   - Tag: **Feature: division-area-performance-cards, Property 5: Net growth calculation**

6. **Visit Completion Percentage Property** (Property 6)
   - Generate random visit counts and club bases
   - Verify percentage calculation and threshold determination
   - Tag: **Feature: division-area-performance-cards, Property 6: Visit completion percentage calculation**

7. **Division Card Count and Ordering Property** (Property 7)
   - Generate random district snapshots with varying division counts
   - Verify card count matches division count
   - Verify cards are ordered by division identifier
   - Tag: **Feature: division-area-performance-cards, Property 7: Division card count and ordering**

8. **Area Row Count and Ordering Property** (Property 8)
   - Generate random divisions with varying area counts
   - Verify row count matches area count
   - Verify rows are ordered by area identifier
   - Tag: **Feature: division-area-performance-cards, Property 8: Area row count and ordering**

9. **Division Summary Data Completeness Property** (Property 9)
   - Generate random divisions
   - Verify all required data elements present in rendered output
   - Tag: **Feature: division-area-performance-cards, Property 9: Division summary data completeness**

10. **Area Row Data Completeness Property** (Property 10)
    - Generate random areas
    - Verify all required data elements present in rendered output
    - Tag: **Feature: division-area-performance-cards, Property 10: Area row data completeness**

11. **Visit Data Extraction Property** (Property 11)
    - Generate random snapshot structures with visit data
    - Verify correct field extraction for both visit rounds
    - Tag: **Feature: division-area-performance-cards, Property 11: Visit data extraction**

12. **Data Extraction Completeness Property** (Property 12)
    - Generate random district snapshots
    - Verify all divisions and areas are extracted
    - Tag: **Feature: division-area-performance-cards, Property 12: Data extraction completeness**

13. **Snapshot Update Reactivity Property** (Property 13)
    - Generate pairs of different snapshots
    - Verify output changes when snapshot changes
    - Tag: **Feature: division-area-performance-cards, Property 13: Snapshot update reactivity**

14. **Snapshot Timestamp Display Property** (Property 14)
    - Generate random snapshots with timestamps
    - Verify timestamp appears in rendered output
    - Tag: **Feature: division-area-performance-cards, Property 14: Snapshot timestamp display**

### Integration Tests

Integration tests will verify component interaction and data flow:

- Test DivisionPerformanceCards component with real snapshot data structure
- Test responsive behavior at different viewport sizes
- Test accessibility features (keyboard navigation, screen reader labels)
- Test loading states and error states

### Property-Based Testing Library

**Library**: fast-check (TypeScript property-based testing library)

**Rationale**:

- Native TypeScript support with excellent type inference
- Mature library with comprehensive arbitrary generators
- Good integration with Vitest (existing test framework)
- Supports custom generators for domain-specific types

**Custom Generators Needed**:

- Division performance data generator
- Area performance data generator
- District snapshot structure generator
- Visit status generator

### Test Organization

```
frontend/src/
├── components/
│   ├── __tests__/
│   │   ├── DivisionPerformanceCards.test.tsx (unit tests)
│   │   ├── DivisionPerformanceCards.property.test.tsx (property tests)
│   │   ├── DivisionPerformanceCard.test.tsx
│   │   ├── AreaPerformanceTable.test.tsx
│   │   └── AreaPerformanceRow.test.tsx
├── utils/
│   ├── __tests__/
│   │   ├── divisionStatus.test.ts (unit tests)
│   │   ├── divisionStatus.property.test.ts (property tests)
│   │   ├── areaStatus.test.ts
│   │   └── areaStatus.property.test.ts
└── test-utils/
    └── generators/
        ├── divisionPerformance.ts (fast-check generators)
        └── districtSnapshot.ts
```

### Accessibility Testing

- Verify WCAG AA compliance using axe-core
- Test keyboard navigation through cards and tables
- Verify screen reader announcements for status changes
- Test color contrast ratios for status indicators
- Verify touch target sizes on mobile viewports

### Visual Regression Testing

- Capture screenshots of division cards in various states
- Test responsive layouts at mobile, tablet, and desktop breakpoints
- Verify brand color usage and typography
- Test with different data scenarios (empty divisions, many areas, etc.)
