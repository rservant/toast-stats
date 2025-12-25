# Implementation Plan

- [x] 1. Update backend ranking calculation to use Borda count system with percentage-based ranking
  - Modify `RealToastmastersAPIService.ts` to calculate Borda points instead of simple rank sums
  - Change paid clubs ranking: rank by `clubGrowthPercent` (highest positive % = rank 1) instead of absolute `paidClubs` count
  - Change total payments ranking: rank by `paymentGrowthPercent` (highest positive % = rank 1) instead of absolute `totalPayments` count
  - Change distinguished clubs ranking: rank by `distinguishedPercent` (highest positive % = rank 1) instead of absolute `distinguishedClubs` count
  - Replace aggregate score calculation: change from sum of ranks (lower is better) to sum of Borda points (higher is better)
  - Implement Borda point formula: `bordaPoints = totalDistricts - rank + 1`
  - Update sorting logic to sort by aggregate Borda score in descending order (highest points first)
  - Ensure tie handling works correctly with Borda points (tied districts get same points)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

- [x] 2. Update frontend to display percentage values alongside ranks
  - [x] 2.1 Create percentage formatting helper function
    - Write `formatPercentage` function that returns formatted text and color class
    - Handle positive percentages: add "+" prefix and return green color class
    - Handle negative percentages: keep "-" prefix and return red color class
    - Handle zero percentages: return "0.0%" with gray color class
    - Format to 1 decimal place precision
    - _Requirements: 1.3, 3.3, 3.4, 3.5, 3.6_

  - [x] 2.2 Update Paid Clubs column display
    - Modify table cell JSX to show metric value on first line
    - Add second line with rank number and percentage separated by bullet
    - Apply color coding to percentage value
    - Ensure proper text alignment (right-aligned)
    - _Requirements: 1.1, 3.1, 3.7_

  - [x] 2.3 Update Total Payments column display
    - Modify table cell JSX to show metric value on first line
    - Add second line with rank number and percentage separated by bullet
    - Apply color coding to percentage value
    - Ensure proper text alignment (right-aligned)
    - _Requirements: 1.2, 3.2, 3.7_

  - [x] 2.4 Update Distinguished Clubs column display
    - Modify table cell JSX to show metric value on first line
    - Add second line with rank number and percentage separated by bullet
    - Apply color coding to percentage value
    - Ensure proper text alignment (right-aligned)
    - _Requirements: 3.7_

  - [x] 2.5 Update scoring methodology legend
    - Replace current legend text with Borda count system explanation
    - Add description of point allocation formula
    - Include example calculation with actual numbers
    - Clarify that higher aggregate score is better
    - _Requirements: 2.2, 2.3, 2.5_

- [x] 3. Update MockToastmastersAPIService for consistency
  - Apply same Borda count calculation logic to mock service
  - Update ranking logic to use percentage-based ranking for clubs and payments
  - Ensure mock data includes percentage values for testing
  - Maintain consistency with real service implementation
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 4. Add backend tests for Borda count system with percentage-based ranking
  - [x] 4.1 Test percentage-based ranking for all categories
    - Test that clubs are ranked by clubGrowthPercent (not absolute paidClubs count)
    - Test that payments are ranked by paymentGrowthPercent (not absolute totalPayments count)
    - Test that distinguished clubs are ranked by distinguishedPercent (not absolute distinguishedClubs count)
    - Verify highest positive percentage gets rank 1 for all three categories
    - _Requirements: 2.6, 2.7, 2.8_

  - [x] 4.2 Test Borda point calculation accuracy
    - Test with 10 districts: verify rank 1 gets 10 points, rank 10 gets 1 point
    - Test with 100 districts: verify rank 1 gets 100 points, rank 100 gets 1 point
    - Test with various district counts to ensure formula correctness
    - _Requirements: 2.2, 2.3_

  - [x] 4.3 Test tie handling with Borda points
    - Create test scenario with 3 districts tied for rank 2 (same percentage)
    - Verify all tied districts receive same Borda points
    - Verify next rank after tie is calculated correctly (should be 5)
    - _Requirements: 2.1, 2.2_

  - [x] 4.4 Test aggregate score calculation
    - Verify aggregate score equals sum of Borda points from all three categories
    - Verify districts are sorted by aggregate score in descending order
    - Test that higher aggregate scores appear first in rankings
    - _Requirements: 2.4, 2.5_

  - [x] 4.5 Test edge cases
    - Test scenario where all districts have same percentage (all rank 1)
    - Test district with 0 or negative percentages
    - Test single district in system
    - Test handling of missing or null values
    - _Requirements: 2.11_

- [x] 5. Add frontend tests for percentage display
  - [x] 5.1 Test percentage formatting function
    - Test positive percentage returns "+" prefix and green color
    - Test negative percentage returns "-" prefix and red color
    - Test zero percentage returns "0.0%" with gray color
    - Test decimal precision (1 decimal place)
    - _Requirements: 1.3, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.2 Test table cell rendering
    - Test rank number displays correctly
    - Test percentage displays with correct color
    - Test bullet separator appears between rank and percentage
    - Test both values are visible and properly aligned
    - _Requirements: 3.1, 3.2, 3.7_

- [x] 6. Add integration tests
  - Test end-to-end ranking API call
  - Verify ranks are based on percentages for clubs and payments categories
  - Verify Borda scores calculated correctly in response
  - Verify percentage values included in API response
  - Verify sorting by aggregate Borda score (descending)
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 7. Clear existing cache to ensure fresh rankings
  - Document that existing cached rankings use old scoring system (absolute counts instead of percentages)
  - Add note in deployment checklist to clear cache after deployment
  - Consider adding cache version indicator for future migrations
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
