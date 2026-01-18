# Design Document: District Global Rankings Tab

## Overview

This design implements a new "Global Rankings" tab on the District Performance page that displays historical global ranking data across all available program years. The feature leverages the existing ranking infrastructure (Borda count algorithm, snapshot storage, and rank history API) while adding new UI components for end-of-year rankings display and multi-year comparison.

The solution follows the existing patterns in the codebase:

- Reuses the `HistoricalRankChart` component pattern for full-year progression charts
- Extends the existing tab navigation in `DistrictDetailPage.tsx`
- Leverages the `/api/districts/:districtId/rank-history` endpoint for ranking data
- Uses the existing `useRankHistory` hook with program year filtering
- Follows Toastmasters brand guidelines and WCAG AA accessibility requirements

## Architecture

### Component Hierarchy

```text
DistrictDetailPage
├── Tab Navigation (extended with "Global Rankings" tab)
└── Tab Content
    └── GlobalRankingsTab (NEW)
        ├── ProgramYearSelector (existing, reused)
        ├── EndOfYearRankingsPanel (NEW)
        │   ├── RankingCard (Overall)
        │   ├── RankingCard (Paid Clubs)
        │   ├── RankingCard (Membership Payments)
        │   └── RankingCard (Distinguished Clubs)
        ├── FullYearRankingChart (NEW, extends HistoricalRankChart pattern)
        │   └── MetricToggle (Overall/Clubs/Payments/Distinguished)
        └── MultiYearComparisonTable (NEW)
            └── YearRow (per program year)
```

### Data Flow

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Components                       │
├─────────────────────────────────────────────────────────────┤
│  GlobalRankingsTab                                          │
│    │                                                        │
│    ├── useGlobalRankings (NEW hook)                        │
│    │     │                                                  │
│    │     ├── useRankHistory (existing)                     │
│    │     │     └── GET /api/districts/:id/rank-history     │
│    │     │                                                  │
│    │     └── useAvailableProgramYears (NEW hook)           │
│    │           └── GET /api/districts/:id/available-years  │
│    │                                                        │
│    └── Renders: EndOfYearRankingsPanel                     │
│                 FullYearRankingChart                        │
│                 MultiYearComparisonTable                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                          │
├─────────────────────────────────────────────────────────────┤
│  DistrictRankHistoryService (existing)                      │
│    │                                                        │
│    ├── getDistrictRankHistory(districtId, startDate, end)  │
│    │                                                        │
│    └── SnapshotStore.readAllDistrictsRankings()            │
│          └── Per-snapshot ranking data                      │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### GlobalRankingsTab Component

The main container component for the Global Rankings tab content.

```typescript
interface GlobalRankingsTabProps {
  districtId: string
  districtName: string
}

interface GlobalRankingsState {
  selectedProgramYear: ProgramYear
  selectedMetric: RankMetric
  isLoading: boolean
  error: Error | null
}

type RankMetric = 'aggregate' | 'clubs' | 'payments' | 'distinguished'
```

### EndOfYearRankingsPanel Component

Displays the four ranking cards showing end-of-year positions.

```typescript
interface EndOfYearRankingsPanelProps {
  rankings: EndOfYearRankings | null
  isLoading: boolean
  programYear: ProgramYear
}

interface EndOfYearRankings {
  overall: RankPosition
  paidClubs: RankPosition
  membershipPayments: RankPosition
  distinguishedClubs: RankPosition
  asOfDate: string
  isPartialYear: boolean
}

interface RankPosition {
  rank: number
  totalDistricts: number
  percentile: number
}
```

### RankingCard Component

Individual card displaying a single ranking metric.

```typescript
interface RankingCardProps {
  title: string
  rank: number
  totalDistricts: number
  percentile: number
  icon: React.ReactNode
  colorScheme: 'blue' | 'green' | 'purple' | 'yellow'
  previousYearRank?: number // For showing year-over-year change
}
```

### FullYearRankingChart Component

Line chart showing ranking progression throughout the year.

```typescript
interface FullYearRankingChartProps {
  data: RankHistoryResponse | null
  selectedMetric: RankMetric
  onMetricChange: (metric: RankMetric) => void
  isLoading: boolean
  programYear: ProgramYear
}
```

### MultiYearComparisonTable Component

Table showing end-of-year rankings across all available program years.

```typescript
interface MultiYearComparisonTableProps {
  yearlyRankings: YearlyRankingSummary[]
  isLoading: boolean
}

interface YearlyRankingSummary {
  programYear: string // e.g., "2023-2024"
  overallRank: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  totalDistricts: number
  isPartialYear: boolean
  yearOverYearChange: {
    overall: number // positive = improved, negative = declined
    clubs: number
    payments: number
    distinguished: number
  } | null
}
```

### useGlobalRankings Hook

Custom hook that aggregates ranking data across program years.

```typescript
interface UseGlobalRankingsParams {
  districtId: string
  selectedProgramYear?: ProgramYear
}

interface UseGlobalRankingsResult {
  // Current year data
  currentYearHistory: RankHistoryResponse | null
  endOfYearRankings: EndOfYearRankings | null
  
  // Multi-year data
  availableProgramYears: ProgramYear[]
  yearlyRankings: YearlyRankingSummary[]
  
  // State
  isLoading: boolean
  isError: boolean
  error: Error | null
  
  // Actions
  refetch: () => void
}
```

## Data Models

### API Response Types

The feature uses existing API endpoints with the following response structures:

```typescript
// Existing: GET /api/districts/:districtId/rank-history
interface RankHistoryResponse {
  districtId: string
  districtName: string
  history: HistoricalRankPoint[]
  programYear: ProgramYearInfo
}

interface HistoricalRankPoint {
  date: string
  aggregateScore: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
}

interface ProgramYearInfo {
  startDate: string
  endDate: string
  year: string // e.g., "2023-2024"
}
```

### New API Endpoint: Available Program Years

A new endpoint to retrieve all program years with ranking data for a district.

```typescript
// NEW: GET /api/districts/:districtId/available-ranking-years
interface AvailableRankingYearsResponse {
  districtId: string
  programYears: ProgramYearWithData[]
}

interface ProgramYearWithData {
  year: string // e.g., "2023-2024"
  startDate: string
  endDate: string
  hasCompleteData: boolean
  snapshotCount: number
  latestSnapshotDate: string
}
```

### Derived Data Structures

```typescript
// End-of-year ranking extraction
interface EndOfYearRankings {
  overall: RankPosition
  paidClubs: RankPosition
  membershipPayments: RankPosition
  distinguishedClubs: RankPosition
  asOfDate: string
  isPartialYear: boolean
}

// Year-over-year comparison
interface YearOverYearChange {
  overall: number    // Rank change (negative = improved)
  clubs: number
  payments: number
  distinguished: number
}
```

### State Management

The component uses local React state with React Query for data fetching:

```typescript
// Query keys for caching
const globalRankingsQueryKeys = {
  rankHistory: (districtId: string, programYear: string) => 
    ['district', districtId, 'rank-history', programYear],
  availableYears: (districtId: string) => 
    ['district', districtId, 'available-ranking-years'],
  allYearsRankings: (districtId: string) => 
    ['district', districtId, 'all-years-rankings'],
}
```

## Correctness Properties

### Property-Based Testing Assessment

Following the project's property-testing guidance, this feature has been evaluated for PBT suitability:

**Decision: Unit tests with well-chosen examples are sufficient.**

**Rationale:**

1. This feature is primarily UI component work (display, interaction, styling)
2. The ranking calculation logic (Borda count algorithm) already has PBT coverage in the backend
3. Data transformation is straightforward mapping without complex invariants
4. 3-5 specific examples per behavior provide equivalent confidence to property tests
5. No mathematical invariants unique to this feature - it consumes pre-calculated rankings

### Testable Correctness Properties (Example-Based)

The following properties will be verified through unit tests with specific examples:

#### CP-1: Tab Navigation Correctness

- **Property**: Tab selection state correctly reflects user interaction
- **Validation**: Unit test with click events verifying active tab state
- **Validates**: Requirements 1.1, 1.2

#### CP-2: Program Year Selection Correctness

- **Property**: Selected program year filters displayed data correctly
- **Validation**: Unit test with mock data for multiple years, verify filtering
- **Validates**: Requirements 2.1, 2.2, 2.3

#### CP-3: End-of-Year Ranking Display Accuracy

- **Property**: Displayed rankings match source data without transformation errors
- **Validation**: Unit test comparing rendered values to mock API response
- **Validates**: Requirements 3.1-3.6

#### CP-4: Chart Data Mapping Correctness

- **Property**: Chart renders correct data points with inverted Y-axis
- **Validation**: Unit test verifying chart configuration and data binding
- **Validates**: Requirements 4.1-4.4

#### CP-5: Year-Over-Year Change Calculation

- **Property**: Change indicators correctly show improvement (negative change) or decline (positive change)
- **Validation**: Unit test with known rank transitions (e.g., rank 10→5 = -5 improvement)
- **Validates**: Requirement 5.2

#### CP-6: Chronological Ordering

- **Property**: Program years are displayed in descending order (most recent first)
- **Validation**: Unit test with shuffled input, verify output order
- **Validates**: Requirement 5.3

#### CP-7: Accessibility Compliance

- **Property**: All interactive elements meet WCAG AA requirements
- **Validation**: Integration test using axe-core accessibility testing
- **Validates**: Requirements 6.1-6.6

#### CP-8: Responsive Layout Adaptation

- **Property**: Layout adapts correctly at defined breakpoints
- **Validation**: Unit test with viewport mocking at 640px boundary
- **Validates**: Requirements 8.1-8.4

## Testing Strategy

### Unit Tests

Unit tests will cover component rendering and interaction logic:

```typescript
// GlobalRankingsTab.test.tsx
describe('GlobalRankingsTab', () => {
  it('renders loading skeleton while data is fetching', () => {
    // Mock loading state, verify skeleton presence
  })

  it('displays end-of-year rankings when data is available', () => {
    // Mock successful response, verify all four ranking cards render
  })

  it('shows error state with retry button on fetch failure', () => {
    // Mock error response, verify error message and retry button
  })

  it('updates displayed data when program year selection changes', () => {
    // Simulate year selection, verify data refresh
  })
})

// EndOfYearRankingsPanel.test.tsx
describe('EndOfYearRankingsPanel', () => {
  it('displays rank position with total districts', () => {
    // Verify "Rank 15 of 126" format
  })

  it('shows partial year indicator when data is incomplete', () => {
    // Mock isPartialYear: true, verify indicator presence
  })

  it('displays year-over-year change with correct direction', () => {
    // Test improvement (rank 10→5) shows positive indicator
    // Test decline (rank 5→10) shows negative indicator
  })
})

// FullYearRankingChart.test.tsx
describe('FullYearRankingChart', () => {
  it('renders line chart with inverted Y-axis', () => {
    // Verify chart configuration has reversed: true for Y-axis
  })

  it('toggles between ranking metrics', () => {
    // Simulate metric toggle, verify chart data updates
  })

  it('displays tooltip with rank and date on hover', () => {
    // Simulate hover event, verify tooltip content
  })
})
```

### Integration Tests

Integration tests will verify component composition and data flow:

```typescript
// GlobalRankingsTab.integration.test.tsx
describe('GlobalRankingsTab Integration', () => {
  it('fetches and displays ranking data for selected district', async () => {
    // Render with real hooks, mock API responses
    // Verify complete data flow from fetch to display
  })

  it('handles program year transitions correctly', async () => {
    // Select different years, verify data updates
  })
})
```

### Accessibility Tests

Accessibility compliance will be verified using axe-core:

```typescript
// GlobalRankingsTab.accessibility.test.tsx
describe('GlobalRankingsTab Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<GlobalRankingsTab {...props} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('supports keyboard navigation', () => {
    // Tab through interactive elements, verify focus management
  })

  it('provides screen reader descriptions for chart', () => {
    // Verify aria-label and accessible description presence
  })
})
```

### Visual Regression Tests (Optional)

If visual regression testing is set up, snapshots can verify brand compliance:

```typescript
describe('GlobalRankingsTab Visual', () => {
  it('matches brand guidelines snapshot', () => {
    // Render component, compare to baseline snapshot
  })
})
```

## Implementation Notes

### File Structure

```text
frontend/src/
├── components/
│   ├── GlobalRankingsTab.tsx
│   ├── EndOfYearRankingsPanel.tsx
│   ├── RankingCard.tsx
│   ├── FullYearRankingChart.tsx
│   ├── MultiYearComparisonTable.tsx
│   └── __tests__/
│       ├── GlobalRankingsTab.test.tsx
│       ├── EndOfYearRankingsPanel.test.tsx
│       ├── FullYearRankingChart.test.tsx
│       └── MultiYearComparisonTable.test.tsx
├── hooks/
│   ├── useGlobalRankings.ts
│   ├── useAvailableProgramYears.ts
│   └── __tests__/
│       └── useGlobalRankings.test.ts
└── pages/
    └── DistrictDetailPage.tsx (modified)
```

### Dependencies

- Existing: `recharts` for charting (already used by HistoricalRankChart)
- Existing: `@tanstack/react-query` for data fetching
- Existing: `axe-core` / `jest-axe` for accessibility testing

### Backend Changes

A new API endpoint is required:

```typescript
// GET /api/districts/:districtId/available-ranking-years
// Returns list of program years with ranking data for the district
```

This endpoint queries the SnapshotStore to determine which program years have ranking snapshots available.

### Performance Considerations

1. **Data Caching**: Use React Query's caching to avoid refetching ranking data on tab switches
2. **Lazy Loading**: Consider lazy loading the chart component to reduce initial bundle size
3. **Pagination**: If many program years exist, consider paginating the multi-year comparison table

### Brand Compliance

All components must follow Toastmasters brand guidelines:

- Use `--tm-loyal-blue` for primary chart elements
- Use `--tm-true-maroon` for emphasis/alerts
- Use Montserrat for headings, Source Sans 3 for body text
- Ensure 44px minimum touch targets for interactive elements
