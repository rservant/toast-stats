# Design Document: Membership Payments Tracking Chart

## Overview

This design describes the implementation of a Membership Payments Tracking Chart component that displays YTD (Year-to-Date) membership payment data over time with multi-year comparison. The chart will be added to the Trends tab in the District Membership Trend card, positioned below the existing Total Membership graph.

The implementation follows the existing patterns established by `MembershipTrendChart` and `YearOverYearComparison` components, leveraging the same data fetching hooks, charting library (Recharts), and styling conventions.

## Architecture

The feature follows the existing frontend architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DistrictDetailPage                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     Trends Tab                             │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │           MembershipTrendChart (existing)           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │      MembershipPaymentsChart (new component)        │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │           Statistics Summary Panel            │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │         Multi-Year Line Chart                 │  │  │  │
│  │  │  │    (Current Year + Previous 2 Years)          │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │              Legend                           │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │        YearOverYearComparison (existing)            │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Backend API     │────▶│ useDistrictAnalytics│────▶│ MembershipPayments│
│  /analytics      │     │      Hook           │     │     Chart        │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
         │                                                    │
         │                                                    ▼
         │               ┌─────────────────────┐     ┌──────────────────┐
         └──────────────▶│ usePaymentsTrend    │────▶│  Multi-Year      │
                         │   (new hook)        │     │  Comparison      │
                         └─────────────────────┘     └──────────────────┘
```

## Components and Interfaces

### MembershipPaymentsChart Component

```typescript
interface PaymentTrendDataPoint {
  date: string // ISO date string (YYYY-MM-DD)
  payments: number // YTD payment count
  programYearDay: number // Days since July 1 (for alignment)
}

interface MultiYearPaymentData {
  currentYear: {
    label: string // e.g., "2024-2025"
    data: PaymentTrendDataPoint[]
  }
  previousYears: Array<{
    label: string // e.g., "2023-2024"
    data: PaymentTrendDataPoint[]
  }>
}

interface MembershipPaymentsChartProps {
  paymentsTrend: PaymentTrendDataPoint[]
  multiYearData?: MultiYearPaymentData
  currentPayments: number
  paymentBase?: number
  yearOverYearChange?: number
  isLoading?: boolean
}
```

### usePaymentsTrend Hook

A new hook to fetch and transform payment trend data with multi-year comparison:

```typescript
interface UsePaymentsTrendResult {
  data: {
    currentYearTrend: PaymentTrendDataPoint[]
    multiYearData: MultiYearPaymentData | null
    currentPayments: number
    paymentBase: number | null
    yearOverYearChange: number | null
  } | null
  isLoading: boolean
  error: Error | null
}

function usePaymentsTrend(
  districtId: string | null,
  programYearStartDate: string,
  endDate?: string
): UsePaymentsTrendResult
```

### Backend API Extension

The existing `/districts/:districtId/analytics` endpoint already returns `performanceTargets.membershipPayments` with current and base values. For multi-year comparison, we need to extend the analytics response or create a dedicated endpoint.

Option 1 (Recommended): Extend DistrictAnalytics to include payment trend data

```typescript
interface DistrictAnalytics {
  // ... existing fields ...
  paymentsTrend?: Array<{ date: string; payments: number }>
}
```

Option 2: Create a new endpoint for payment history

```typescript
GET /districts/:districtId/payments-history?years=3
```

For this design, we'll use Option 1 to minimize API changes and leverage existing data fetching patterns.

## Data Models

### Payment Trend Calculation

The payment trend is built from historical snapshots by extracting the `totalPayments` value from each snapshot's district ranking data:

```typescript
interface PaymentSnapshotData {
  snapshotId: string
  date: string
  totalPayments: number
  paymentBase: number
}

// Transform to trend data
function buildPaymentTrend(
  snapshots: PaymentSnapshotData[]
): PaymentTrendDataPoint[] {
  return snapshots
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(snapshot => ({
      date: snapshot.date,
      payments: snapshot.totalPayments,
      programYearDay: calculateProgramYearDay(snapshot.date),
    }))
}
```

### Program Year Day Calculation

To align multi-year data for comparison, we calculate the day number within the program year:

```typescript
function calculateProgramYearDay(dateStr: string): number {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = date.getMonth()

  // Program year starts July 1
  const programYearStart =
    month >= 6
      ? new Date(year, 6, 1) // July 1 of current year
      : new Date(year - 1, 6, 1) // July 1 of previous year

  const diffTime = date.getTime() - programYearStart.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}
```

### Multi-Year Data Structure

```typescript
interface YearData {
  programYear: string // e.g., "2024-2025"
  startYear: number // e.g., 2024
  trend: PaymentTrendDataPoint[]
}

function groupByProgramYear(
  allData: PaymentTrendDataPoint[]
): Map<string, YearData>
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Trend Line Rendering

_For any_ valid payment trend data array with at least one data point, the MembershipPaymentsChart SHALL render a line chart with the correct number of data points.

**Validates: Requirements 1.3**

### Property 2: Year Count Limiting

_For any_ multi-year payment data set, the chart SHALL display at most 3 program years, and SHALL display exactly the number of available years when fewer than 3 are present.

**Validates: Requirements 2.1, 2.4**

### Property 3: Program Year Day Alignment

_For any_ date within a program year, the calculateProgramYearDay function SHALL return a value between 0 and 365 (inclusive), and dates that are the same calendar day in different program years SHALL produce the same program year day value.

**Validates: Requirements 2.2**

### Property 4: Payment Data Extraction

_For any_ array of snapshot data containing district rankings, the buildPaymentTrend function SHALL produce a trend array where each element's payments value equals the corresponding snapshot's totalPayments field, and the array SHALL be sorted by date in ascending order.

**Validates: Requirements 3.1, 3.2**

### Property 5: Statistics Calculation

_For any_ payment trend with current and previous year data, the year-over-year change SHALL equal (currentPayments - previousPayments), and the trend direction SHALL be "up" when change > 0, "down" when change < 0, and "stable" when change = 0.

**Validates: Requirements 6.1, 6.2, 6.4**

## Error Handling

### Data Loading Errors

- If the analytics API fails, display an error message with retry option
- Use the existing `ErrorDisplay` component for consistency
- Log errors to console for debugging

### Missing Data Handling

- If `paymentsTrend` is empty or undefined, show `EmptyState` component
- If `paymentBase` is null/undefined, hide the payment base statistic
- If multi-year data is unavailable, show only current year data
- If a snapshot has no `totalPayments` value, exclude it from the trend

### Edge Cases

- Handle program year boundary dates correctly (June 30 vs July 1)
- Handle leap years in program year day calculation
- Handle districts with no historical data gracefully

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

1. **Component rendering tests**
   - Renders loading skeleton when `isLoading` is true
   - Renders empty state when no data is provided
   - Renders chart with correct structure when data is available
   - Renders statistics summary with correct values

2. **Date calculation tests**
   - July 1 returns day 0
   - June 30 returns day 364 (or 365 in leap year)
   - Same calendar date in different years returns same day number

3. **Data transformation tests**
   - Empty snapshot array returns empty trend
   - Snapshots are sorted by date
   - Missing totalPayments values are excluded

### Property-Based Tests

Property-based tests will use `fast-check` library with minimum 100 iterations per test.

1. **Trend rendering property test**
   - Generate random valid payment data arrays
   - Verify chart renders with correct data point count
   - Tag: **Feature: membership-payments-chart, Property 1: Trend Line Rendering**

2. **Year count property test**
   - Generate random multi-year data sets (1-5 years)
   - Verify displayed year count is min(available, 3)
   - Tag: **Feature: membership-payments-chart, Property 2: Year Count Limiting**

3. **Program year day alignment property test**
   - Generate random dates across multiple years
   - Verify same calendar day produces same program year day
   - Verify output is always in valid range [0, 365]
   - Tag: **Feature: membership-payments-chart, Property 3: Program Year Day Alignment**

4. **Data extraction property test**
   - Generate random snapshot arrays with totalPayments values
   - Verify extracted trend matches source data
   - Verify trend is sorted by date
   - Tag: **Feature: membership-payments-chart, Property 4: Payment Data Extraction**

5. **Statistics calculation property test**
   - Generate random current and previous payment values
   - Verify YoY change calculation is correct
   - Verify trend direction matches sign of change
   - Tag: **Feature: membership-payments-chart, Property 5: Statistics Calculation**

### Integration Tests

- Verify component integrates correctly with `useDistrictAnalytics` hook
- Verify component renders within `DistrictDetailPage` Trends tab
- Verify lazy loading works correctly with `LazyChart` wrapper

### Accessibility Tests

- Verify ARIA labels are present and descriptive
- Verify keyboard navigation works for interactive elements
- Verify color contrast meets WCAG AA standards

## Known Issues and Fixes

### Issue: Year-over-Year Data Not Displaying

**Problem:** The chart shows "N/A" for year-over-year comparison even when historical data exists in the system.

**Root Cause:** The `usePaymentsTrend` hook is being called with `selectedProgramYear.startDate` as the start date parameter in `DistrictDetailPage.tsx`. This limits the data fetch to only the current program year, preventing the hook from retrieving the historical data needed for multi-year comparison.

The hook's internal logic attempts to fetch 3 years of data by default:

```typescript
const startDate =
  programYearStartDate ?? getProgramYear(currentProgramYear.year - 2).startDate
```

However, since `programYearStartDate` is explicitly passed (not undefined), the fallback to 3-years-back never executes.

**Solution:** Remove the `programYearStartDate` parameter when calling `usePaymentsTrend` in `DistrictDetailPage.tsx`:

```typescript
// Before (incorrect):
const { data: paymentsTrendData, isLoading: isLoadingPaymentsTrend } =
  usePaymentsTrend(
    districtId || null,
    selectedProgramYear.startDate, // ❌ This limits data to current year only
    selectedDate || selectedProgramYear.endDate
  )

// After (correct):
const { data: paymentsTrendData, isLoading: isLoadingPaymentsTrend } =
  usePaymentsTrend(
    districtId || null,
    undefined, // ✅ Let hook fetch 3 years of data automatically
    selectedDate || selectedProgramYear.endDate
  )
```

**Impact:** This fix enables the multi-year comparison feature as designed, allowing district leaders to see payment trends across the current year and previous 2 years.

**Requirements Addressed:** 7.1, 7.2 (Historical Data Fetching)
