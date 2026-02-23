# Design Document

## Overview

This design addresses two key improvements to the District Rankings system:

1. **Borda Count Scoring System**: Replace the current simple rank-sum approach with a proper Borda count system that assigns points based on rank position
2. **Enhanced Display**: Add percentage values alongside rank numbers for paid clubs and total payments metrics

The changes will affect both the backend ranking calculation logic and the frontend display components.

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           LandingPage.tsx (Rankings Table)             │ │
│  │  - Display rank numbers                                │ │
│  │  - Display percentage values with color coding         │ │
│  │  - Format: "Rank #X" + "+Y.Z%" or "-Y.Z%"            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP GET /api/districts/rankings
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express/Node)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         RealToastmastersAPIService.ts                  │ │
│  │  - Fetch district data from collector                    │ │
│  │  - Calculate Borda points for each category           │ │
│  │  - Calculate aggregate Borda score                     │ │
│  │  - Return rankings with all metrics                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Changes

#### 1. RealToastmastersAPIService.ts

**Current Behavior:**

- Ranks districts in each category (1 = best)
- Calculates aggregate score as sum of ranks (lower is better)
- Example: Rank #5 + Rank #3 + Rank #8 = Score 16

**New Behavior (Borda Count):**

- Ranks districts in each category (1 = best) based on:
  - **Paid Clubs**: Club growth percentage (highest positive % = rank 1)
  - **Total Payments**: Payment growth percentage (highest positive % = rank 1)
  - **Distinguished Clubs**: Distinguished clubs percentage (highest positive % = rank 1)
- Assigns Borda points: If N districts exist, rank 1 gets N points, rank 2 gets N-1 points, etc.
- Calculates aggregate score as sum of Borda points (higher is better)
- Example: If 100 districts, rank #5 gets 96 points, rank #3 gets 98 points, rank #8 gets 93 points → Total: 287 points

**Borda Point Formula:**

```
bordaPoints = totalDistricts - rank + 1
```

For ties, all tied districts receive the same Borda points based on their shared rank.

#### 2. Data Structure

The existing `DistrictRanking` interface already includes the necessary fields:

```typescript
interface DistrictRanking {
  districtId: string
  districtName: string
  region: string
  paidClubs: number
  paidClubBase: number
  clubGrowthPercent: number // Already available!
  totalPayments: number
  paymentBase: number
  paymentGrowthPercent: number // Already available!
  activeClubs: number
  distinguishedClubs: number
  selectDistinguished: number
  presidentsDistinguished: number
  distinguishedPercent: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  aggregateScore: number // Will now be sum of Borda points
}
```

No interface changes needed - the percentage values are already being scraped and passed through!

### Frontend Changes

#### 1. LandingPage.tsx - Rankings Table

**Current Display:**

```
Paid Clubs Column:
  123
  Rank #5
```

**New Display:**

```
Paid Clubs Column:
  123
  Rank #5 • +12.5%
```

**Implementation Approach:**

1. Add a helper function to format percentage display:

```typescript
const formatPercentage = (percent: number): { text: string; color: string } => {
  const sign = percent > 0 ? '+' : percent < 0 ? '' : ''
  const color =
    percent > 0
      ? 'text-green-600'
      : percent < 0
        ? 'text-red-600'
        : 'text-gray-600'
  return {
    text: `${sign}${percent.toFixed(1)}%`,
    color,
  }
}
```

2. Update table cells to display both rank and percentage:

```tsx
<td className="px-6 py-4 whitespace-nowrap text-right">
  <div className="text-sm font-medium text-gray-900">
    {formatNumber(district.paidClubs)}
  </div>
  <div className="text-xs flex items-center justify-end gap-1">
    <span className="text-blue-600">Rank #{district.clubsRank}</span>
    <span className="text-gray-400">•</span>
    <span className={formatPercentage(district.clubGrowthPercent).color}>
      {formatPercentage(district.clubGrowthPercent).text}
    </span>
  </div>
</td>
```

3. Apply same pattern to Total Payments column using `paymentGrowthPercent`

4. Update Distinguished Clubs column to show percentage:

```tsx
<td className="px-6 py-4 whitespace-nowrap text-right">
  <div className="text-sm font-medium text-gray-900">
    {formatNumber(district.distinguishedClubs)}
  </div>
  <div className="text-xs flex items-center justify-end gap-1">
    <span className="text-blue-600">Rank #{district.distinguishedRank}</span>
    <span className="text-gray-400">•</span>
    <span className={formatPercentage(district.distinguishedPercent).color}>
      {formatPercentage(district.distinguishedPercent).text}
    </span>
  </div>
</td>
```

#### 2. Scoring Methodology Legend

Update the legend section to explain the new Borda count system:

```tsx
<div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm">
  <p className="font-medium text-blue-900 mb-2">
    Ranking Formula (Borda Count System):
  </p>
  <p className="text-blue-800">
    Each district is ranked in three categories: Paid Clubs, Total Payments, and
    Distinguished Clubs. Points are awarded based on rank position (higher rank
    = more points).
  </p>
  <p className="text-blue-700 mt-2">
    <strong>Point Allocation:</strong> If there are N districts, rank #1
    receives N points, rank #2 receives N-1 points, and so on. The{' '}
    <strong>Overall Score</strong> is the sum of points from all three
    categories (higher is better).
  </p>
  <p className="text-blue-700 mt-2 text-xs">
    Example: With 100 districts, if a district ranks #5 in Paid Clubs (96 pts),
    #3 in Payments (98 pts), and #8 in Distinguished Clubs (93 pts), their
    Overall Score = 96 + 98 + 93 = 287 points
  </p>
</div>
```

## Data Models

No new data models required. The existing `DistrictRanking` interface contains all necessary fields.

## Error Handling

### Backend

1. **Missing or Invalid Data:**
   - If a district has missing values for metrics, treat as 0
   - Assign lowest possible Borda points (1 point) to districts with 0 values
   - Log warning for data quality issues

2. **Tie Handling:**
   - When multiple districts have the same value, assign same rank
   - All tied districts receive the same Borda points
   - Next rank skips appropriately (e.g., if three districts tie for rank 2, next rank is 5)

### Frontend

1. **Missing Percentage Data:**
   - If `clubGrowthPercent` or `paymentGrowthPercent` is null/undefined, display "N/A"
   - Use gray color for N/A values

2. **Display Overflow:**
   - Ensure percentage text doesn't cause column width issues
   - Use `whitespace-nowrap` and appropriate padding

## Testing Strategy

### Backend Tests

**File:** `backend/src/services/__tests__/RealToastmastersAPIService.test.ts`

1. **Test Borda Point Calculation:**
   - Verify correct point assignment for various district counts
   - Test: 10 districts → rank 1 gets 10 points, rank 10 gets 1 point
   - Test: 100 districts → rank 1 gets 100 points, rank 100 gets 1 point

2. **Test Tie Handling:**
   - Create scenario with 3 districts tied for rank 2
   - Verify all three receive same Borda points
   - Verify next rank is 5

3. **Test Aggregate Score:**
   - Verify aggregate score is sum of Borda points from all categories
   - Verify sorting by aggregate score (descending order)

4. **Test Edge Cases:**
   - All districts have same value (all rank 1)
   - District with 0 values in all categories
   - Single district in system

### Frontend Tests

**File:** `frontend/src/pages/__tests__/LandingPage.test.tsx`

1. **Test Percentage Display:**
   - Positive percentage shows with "+" and green color
   - Negative percentage shows with "-" and red color
   - Zero percentage shows "0.0%" with gray color

2. **Test Rank Display:**
   - Rank number displays correctly
   - Rank and percentage separated by bullet point
   - Both values visible in table cell

3. **Test Formatting:**
   - Percentage formatted to 1 decimal place
   - Numbers formatted with locale-specific separators

### Integration Tests

**File:** `backend/src/__tests__/districts.integration.test.ts`

1. **Test End-to-End Ranking:**
   - Fetch rankings from API
   - Verify Borda scores calculated correctly
   - Verify percentage values included in response
   - Verify sorting by aggregate score

## Implementation Notes

### Borda Count Algorithm

```typescript
// Pseudocode for Borda point calculation
const totalDistricts = districtData.length

// For Paid Clubs - rank by growth percentage
const sortedByClubGrowth = [...districtData].sort(
  (a, b) => b.clubGrowthPercent - a.clubGrowthPercent
)

// For Total Payments - rank by growth percentage
const sortedByPaymentGrowth = [...districtData].sort(
  (a, b) => b.paymentGrowthPercent - a.paymentGrowthPercent
)

// For Distinguished Clubs - rank by percentage
const sortedByDistinguished = [...districtData].sort(
  (a, b) => b.distinguishedPercent - a.distinguishedPercent
)

// Calculate ranks and Borda points for each category
const calculateRanksAndPoints = (sortedData, metricKey) => {
  const ranks = new Map<string, number>()
  const bordaPoints = new Map<string, number>()
  let currentRank = 1
  let previousValue = sortedData[0]?.[metricKey]

  sortedData.forEach((district, index) => {
    // Update rank if value changed
    if (index > 0 && district[metricKey] < previousValue) {
      currentRank = index + 1
    }

    ranks.set(district.districtId, currentRank)

    // Calculate Borda points: totalDistricts - rank + 1
    const points = totalDistricts - currentRank + 1
    bordaPoints.set(district.districtId, points)

    previousValue = district[metricKey]
  })

  return { ranks, bordaPoints }
}
```

### Migration Considerations

1. **Backward Compatibility:**
   - The API response structure remains unchanged
   - Only the `aggregateScore` calculation method changes
   - Frontend can immediately consume new scores

2. **Cache Invalidation:**
   - Existing cached rankings use old scoring system
   - Consider clearing cache or adding version indicator
   - Document that historical comparisons may show different scores

3. **User Communication:**
   - Update legend to explain new scoring system
   - Consider adding a "What's New" notice on first load
   - Document change in user guide

## Visual Design

### Table Cell Layout

```
┌─────────────────────────┐
│        123              │  ← Metric value (large, bold)
│  Rank #5 • +12.5%       │  ← Rank (blue) • Percentage (green/red)
└─────────────────────────┘
```

### Color Scheme

- **Rank Number:** Blue (#2563eb) - existing color
- **Positive Percentage:** Green (#16a34a) - success color
- **Negative Percentage:** Red (#dc2626) - error color
- **Zero/N/A Percentage:** Gray (#6b7280) - neutral color
- **Bullet Separator:** Light Gray (#9ca3af)

### Typography

- **Metric Value:** text-sm font-medium (14px, medium weight)
- **Rank & Percentage:** text-xs (12px)
- **Spacing:** gap-1 between rank and percentage (4px)

## Performance Considerations

1. **Backend:**
   - Borda calculation adds minimal overhead (O(n log n) for sorting, same as before)
   - No additional database queries needed
   - Caching strategy remains unchanged

2. **Frontend:**
   - Percentage formatting is lightweight
   - No additional API calls required
   - Rendering performance unchanged (same number of DOM elements)

## Accessibility

1. **Color Independence:**
   - Don't rely solely on color to convey positive/negative
   - Include "+" and "-" signs for screen readers
   - Maintain sufficient contrast ratios

2. **Screen Reader Support:**
   - Ensure rank and percentage are announced together
   - Use semantic HTML structure
   - Add aria-labels if needed for clarity

## Future Enhancements

1. **Weighted Borda System:**
   - Allow different weights for different categories
   - Example: Distinguished clubs worth 2x other categories

2. **Historical Borda Tracking:**
   - Track Borda score changes over time
   - Show trend arrows for score movement

3. **Percentile Display:**
   - Show percentile rank in addition to absolute rank
   - Example: "Top 10%" alongside "Rank #8"
