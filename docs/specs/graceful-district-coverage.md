# Graceful District Coverage Handling

## Problem

Only 6 of 128 districts have per-district snapshot data (109, 117, 20, 42, 61, 86). This is intentional — the collector pipeline targets specific districts. However, the site currently lets users navigate to any district detail page via the rankings table, where they see blank/zeroed data.

## Current Behavior

1. User clicks a district row in the rankings table
2. If the district has per-district data → full analytics load correctly
3. If the district **does not** have per-district data → the page shows "Unknown District" with all-zero metrics, empty tabs, and no explanation

## Expected Behavior

### Rankings Table (LandingPage)

- Add a visual indicator (e.g., a small icon or badge) next to district names that have detailed analytics available
- Tooltip on non-tracked districts: "Detailed analytics not available for this district"

### District Detail Page

- **Already implemented** (commit `d04d6df`): When a district is not in the tracked list, show "Detailed Analytics Not Available" with a "View Global Rankings" button
- The Global Rankings tab should still work for all districts since it uses the `rank-history-batch` endpoint which reads from `all-districts-rankings.json` (available for all districts)

### Future Enhancement

- Consider making the Global Rankings tab the default tab for untracked districts, allowing users to see their district's rank history even without per-district data
- Show a banner on the detail page: "This district has limited data. Global rankings are available."

## Acceptance Criteria

- [ ] Users never see "Unknown District" or zeroed data
- [ ] Clear messaging explains why detailed analytics are unavailable
- [ ] Global Rankings tab works for all districts
- [ ] Rankings table indicates which districts have detailed analytics
