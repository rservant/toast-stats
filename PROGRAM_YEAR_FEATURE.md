# Program Year Feature Implementation

## Overview
This feature adds program year boundaries and switching functionality to the Toastmasters District Rankings application. Users can now view and analyze data within specific Toastmasters program years (July 1 - June 30).

## What's New

### 1. Program Year Selector
- **Location**: Available on both Landing Page and District Detail Page
- **Functionality**: 
  - Dropdown to switch between available program years
  - Shows program year in format "2024-2025"
  - Displays date range (Jul 1, 2024 - Jun 30, 2025)
  - Shows progress bar for current program year
  - Automatically detects current program year

### 2. Date Filtering
- **Automatic Filtering**: All dates are now filtered to show only those within the selected program year
- **Smart Defaults**: Automatically selects the most recent date in the selected program year
- **Date Counter**: Shows how many dates are available in the selected program year

### 3. Global State Management
- **Context API**: Program year selection persists across page navigation
- **LocalStorage**: Selected program year is saved and restored on page reload
- **Synchronized**: Both Landing Page and District Detail Page use the same program year selection

## Technical Implementation

### New Files Created

#### 1. `frontend/src/utils/programYear.ts`
Utility functions for program year calculations:
- `getCurrentProgramYear()` - Gets the current program year
- `getProgramYear(year)` - Gets a specific program year
- `getAvailableProgramYears(dates)` - Extracts program years from date list
- `filterDatesByProgramYear(dates, programYear)` - Filters dates by program year
- `getMostRecentDateInProgramYear(dates, programYear)` - Gets latest date in program year
- `getProgramYearProgress(programYear)` - Calculates progress percentage

#### 2. `frontend/src/components/ProgramYearSelector.tsx`
Reusable component for program year selection:
- Dropdown selector with all available program years
- Optional progress bar showing year completion
- Date range display
- Responsive design

#### 3. `frontend/src/contexts/ProgramYearContext.tsx`
Global state management:
- Manages selected program year across the app
- Manages selected date within program year
- Persists selection to localStorage
- Provides `useProgramYear()` hook

### Modified Files

#### 1. `frontend/src/App.tsx`
- Added `ProgramYearProvider` wrapper around the app
- Ensures program year context is available everywhere

#### 2. `frontend/src/pages/LandingPage.tsx`
- Integrated `ProgramYearSelector` component
- Filters cached dates by selected program year
- Auto-selects most recent date when program year changes
- Updated date selector to show only dates in selected program year

#### 3. `frontend/src/pages/DistrictDetailPage.tsx`
- Integrated `ProgramYearSelector` component
- Filters cached dates by selected program year
- Auto-selects most recent date when program year changes
- Updated date selector to show only dates in selected program year
- All tabs now respect program year boundaries

## User Experience

### Landing Page
1. **Program Year Selector** (top right)
   - Select from available program years
   - See progress bar for current year
   - View date range

2. **Date Selector** (next to program year)
   - Shows only dates within selected program year
   - Displays count of available dates
   - Defaults to most recent date

3. **Rankings Table**
   - Shows data for selected date within program year
   - All metrics reflect the selected program year context

### District Detail Page
1. **Program Year Selector** (top right)
   - Same functionality as Landing Page
   - Selection synced across pages

2. **Date Selector** (next to program year)
   - Filtered to selected program year
   - Works across all tabs (Overview, Real-Time, Clubs, etc.)

3. **All Tabs**
   - Overview: Shows metrics for selected program year
   - Real-Time: Current data (always latest)
   - Clubs: Club list filtered by program year
   - Divisions & Areas: Performance within program year
   - Trends: Trends within program year boundaries
   - Analytics: Analytics calculated for program year

## Program Year Logic

### Definition
- **Start Date**: July 1
- **End Date**: June 30 (following year)
- **Label Format**: "YYYY-YYYY" (e.g., "2024-2025")

### Current Program Year Detection
- If current month is July-December: Program year started this year
- If current month is January-June: Program year started last year

### Example
- Date: November 15, 2024
- Current Program Year: 2024-2025 (Jul 1, 2024 - Jun 30, 2025)

## Benefits

1. **Focused Analysis**: View data within specific program year boundaries
2. **Historical Comparison**: Switch between program years to compare performance
3. **Accurate Metrics**: All calculations respect program year boundaries
4. **Better UX**: Clear indication of which program year data is being viewed
5. **Persistent Selection**: Program year selection saved across sessions

## Future Enhancements

Potential improvements for future versions:
1. **Year-over-Year Comparison**: Side-by-side comparison of multiple program years
2. **Program Year Summary**: Aggregate statistics for entire program year
3. **Goal Tracking**: Track progress toward program year goals
4. **Export by Program Year**: Export data filtered by program year
5. **Program Year Milestones**: Highlight key dates (renewals, deadlines, etc.)

## Testing

To test the feature:
1. Navigate to Landing Page
2. Select different program years from dropdown
3. Observe date selector updates to show only dates in selected year
4. Navigate to District Detail Page
5. Verify program year selection persists
6. Switch between tabs and verify all data respects program year
7. Reload page and verify selection is restored

## Notes

- Program year selection is stored in browser localStorage
- If no program year is selected, defaults to current program year
- If selected program year has no data, date selector will be empty
- Progress bar only shows for current program year
- All existing functionality remains intact - this is purely additive
