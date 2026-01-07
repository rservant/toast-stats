# Implementation Plan: Closing Period Snapshot Integration

## Overview

This implementation integrates closing period handling into the snapshot creation flow. When the Toastmasters dashboard publishes data for a prior month (closing period), the snapshot is dated as the last day of that month. Raw CSV storage remains unchanged.

## Tasks

- [ ] 1. Add Closing Period Detection to RefreshService
  - Add `detectClosingPeriod(csvDate: string, dataMonth: string)` method
  - Compare data month to "As of" date month to identify closing periods
  - Calculate the last day of the data month for snapshot dating
  - Handle cross-year scenarios (December data collected in January)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.5_

- [ ] 1.1 Write property test for closing period detection
  - **Property 1: Closing Period Detection Accuracy**
  - Generate date pairs and verify detection when data month < As of month
  - **Validates: Requirements 1.1, 1.2**

- [ ] 2. Enhance Snapshot Metadata Types
  - Add `isClosingPeriodData?: boolean` to NormalizedDataMetadata
  - Add `collectionDate?: string` to track actual CSV date
  - Add `logicalDate?: string` to track the date the snapshot represents
  - Update `backend/src/types/snapshots.ts` with new fields
  - _Requirements: 2.6, 4.1, 4.2, 4.3_

- [ ] 3. Modify PerDistrictSnapshotStore for Override Date
  - Add `overrideSnapshotDate?: string` to WriteSnapshotOptions
  - Use override date for directory name when provided
  - Preserve actual collection date in metadata
  - _Requirements: 2.1, 2.5_

- [ ] 3.1 Write property test for snapshot dating
  - **Property 2: Snapshot Date Correctness**
  - Generate closing period data and verify snapshot directory uses last day of data month
  - **Validates: Requirements 2.1, 2.5**

- [ ] 4. Add Snapshot Comparison Logic
  - Add method to read existing snapshot's collection date from metadata
  - Implement comparison: only update if new collection date is strictly newer
  - Allow update if collection dates are equal (same-day refresh)
  - Skip update if existing snapshot has newer collection date
  - _Requirements: 2.2, 2.3, 2.4_

- [ ] 4.1 Write property test for newer-data-wins logic
  - **Property 3: Newer Data Wins**
  - Generate update scenarios and verify correct overwrite behavior
  - **Validates: Requirements 2.3, 2.4**

- [ ] 5. Integrate Closing Period Logic into RefreshService
  - Modify `normalizeData()` to call `detectClosingPeriod()`
  - Set closing period metadata fields in normalized data
  - Pass override date to `createSnapshot()` when closing period detected
  - Call comparison logic before writing closing period snapshots
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 3.1_

- [ ] 5.1 Write property test for no new-month snapshots
  - **Property 4: No Misleading New-Month Snapshots**
  - Generate closing period scenarios and verify no snapshot in new month
  - **Validates: Requirements 3.1**

- [ ] 6. Checkpoint - Ensure core snapshot logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Update API Response Metadata
  - Include `is_closing_period_data` in `_snapshot_metadata` when applicable
  - Include `collection_date` showing actual CSV date
  - Include `logical_date` showing the date the snapshot represents
  - Update district routes to populate new metadata fields
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7.1 Write property test for metadata completeness
  - **Property 5: Metadata Completeness**
  - Generate API responses and verify closing period fields are present
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 8. Add API Fallback for Missing Dates
  - When requested date has no snapshot, return nearest available
  - Include metadata indicating the actual snapshot date returned
  - Distinguish between "no data yet" and "closing period gap"
  - _Requirements: 3.2, 3.3, 4.4_

- [ ] 8.1 Write unit tests for API fallback behavior
  - Test API response when requested date has no snapshot
  - Verify nearest snapshot is returned with appropriate metadata
  - _Requirements: 3.2, 4.4_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Raw CSV storage is NOT affected - only snapshot directory naming changes
- The snapshot directory will be wiped, so no migration is needed
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
