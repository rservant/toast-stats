# Spec Updates: Removed Backward Compatibility

## Summary

Updated the All Districts Rankings Storage spec to remove backward compatibility requirements and simplify the ISO date directory naming approach. This aligns with the user's instruction that the application is in active development and doesn't need to support legacy timestamp-based snapshot directories.

## Changes Made

### requirements.md

**Requirement 3 (Extend PerDistrictSnapshotStore Structure)**

- ❌ Removed: "THE System SHALL maintain backward compatibility with existing snapshots that lack the rankings file"

**Requirement 4 (Update Rankings API Endpoint)**

- ❌ Removed: Fallback logic for legacy snapshots without rankings file
- ❌ Removed: Conditional serving based on file existence
- ✅ Simplified: API now always reads from all-districts-rankings.json file
- ✅ Simplified: Returns error if file doesn't exist

**Requirement 8 (Use ISO Date-Based Snapshot Directory Naming)**

- ✅ Added: "THE System SHALL NOT maintain backward compatibility with timestamp-based directory names"

**Requirement 9 (Support Testing and Validation)**

- ❌ Removed: "THE System SHALL include tests for backward compatibility with legacy snapshots"

### design.md

**Storage Structure**

- ❌ Removed: Example of legacy timestamp-based directory (1704672000000/)
- ✅ Simplified: Only shows ISO date-based directories (YYYY-MM-DD)

**PerDistrictSnapshotStore Interface**

- ❌ Removed: `isLegacyTimestampDirectory()` method
- ✅ Simplified: Only `generateSnapshotDirectoryName()` method remains

**Districts Route Handler**

- ❌ Removed: Fallback to aggregation logic for legacy snapshots
- ❌ Removed: Conditional logic checking if rankings file exists
- ✅ Simplified: Always reads from all-districts-rankings.json
- ✅ Simplified: Returns error if file doesn't exist

**Error Handling**

- ❌ Removed: "Scenario 4: Legacy Snapshot Without Rankings File"
- ✅ Updated: Scenario 2 & 3 now fail entire refresh operation instead of creating partial snapshots

**Correctness Properties**

- ❌ Removed: Property 4 (Backward Compatibility with missing rankings file)
- ❌ Removed: Property 9 (Backward Compatibility with Timestamp Directories)
- ✅ Renumbered: Properties 5-8 became Properties 4-7

**Testing Strategy**

- ❌ Removed: Integration test section "Backward Compatibility"
- ❌ Removed: Tests for legacy snapshots
- ❌ Removed: Tests for mixed environment with old and new snapshots

**Migration Path**

- ❌ Removed: "Old snapshots continue to work with fallback"
- ❌ Removed: "No manual intervention required"
- ✅ Added: "Delete existing timestamp-based snapshot directories"
- ✅ Added: "Run refresh operation to create new ISO date-based snapshot"

### tasks.md

**Task 3 (Extend PerDistrictSnapshotStore)**

- ❌ Removed: Task 3.2 - `isLegacyTimestampDirectory()` method
- ❌ Removed: Task 3.5 - Update snapshot reading methods for backward compatibility
- ✅ Simplified: Task 3.1 - No collision detection, just ISO date format
- ✅ Simplified: Task 3.3 - Overwrite existing directory if it exists for same date
- ✅ Updated: Task 3.5 (was 3.7) - `readAllDistrictsRankings()` returns null for missing file (not "legacy snapshots")

**Task 5 (Update PerDistrictSnapshotStore.writeSnapshot)**

- ✅ Updated: Fail entire operation if rankings write fails (not "handle gracefully")

**Task 6 (Update Rankings API Endpoint)**

- ❌ Removed: Task 6 entirely (was ProductionServiceFactory update for backward compat)
- ✅ Renumbered: Old Task 7 became Task 6
- ❌ Removed: Fallback logic for missing rankings file
- ✅ Simplified: Return error if file doesn't exist

**Task 7-10 (Renumbered from 8-11)**

- ✅ Renumbered: All subsequent tasks moved up by one
- ❌ Removed: Task 9.2 - Backward compatibility integration test
- ✅ Updated: Task 10.3 - Added migration step to delete old snapshots

**Notes Section**

- ❌ Removed: "Backward compatibility is maintained throughout - no migration required"
- ✅ Added: "No backward compatibility needed - this is a breaking change requiring migration"

## Impact

### Breaking Changes

- Existing timestamp-based snapshot directories will NOT be readable
- API will return errors if rankings file is missing
- Manual migration required: delete old snapshots and run refresh

### Simplified Implementation

- No need for `isLegacyTimestampDirectory()` method
- No need for fallback aggregation logic in API
- No need for collision detection in directory naming
- Cleaner error handling (fail fast instead of partial success)
- Fewer test cases needed

### Migration Required

1. Delete existing `snapshots/` directory contents
2. Run refresh operation to create new ISO date-based snapshot
3. Verify new snapshot structure is correct

## Validation

All three spec files have been updated consistently:

- ✅ requirements.md - Updated acceptance criteria
- ✅ design.md - Updated architecture and interfaces
- ✅ tasks.md - Updated implementation tasks

The spec is now ready for implementation with a clean, simplified approach that doesn't carry legacy compatibility burden.

## Additional Clarifications (2025-01-07)

### Data Fetching Strategy

**Clarified:** The system fetches TWO types of CSV data:

1. **All Districts CSV** - Summary data for all ~126 districts worldwide (used for comprehensive rankings)
2. **Configured Districts CSVs** - For each configured district, fetch 3 additional CSV files:
   - District performance CSV
   - Division performance CSV
   - Club performance CSV

This approach balances comprehensive rankings (all districts) with detailed analytics (configured districts only).

### Testing Requirements

**Added:** All automated tests MUST use mocked data and MUST NOT contact the Toastmasters website.

**Updated sections:**

- requirements.md: Added Requirement 9.5 - "THE Automated tests SHALL NOT contact the Toastmasters website"
- requirements.md: Updated Requirement 5.2 - Explicitly states system continues to fetch all 3 CSV files for configured districts
- design.md: Added testing note at top of Testing Strategy section
- design.md: Added "Uses: Mocked data" notes to all test descriptions
- design.md: Added Data Fetching Strategy section in Implementation Notes
- tasks.md: Added testing and data fetching notes to Notes section
- tasks.md: Updated test tasks to specify "Use mocked data, no network calls"
- tasks.md: Updated Task 4.1 to explicitly mention continuing to fetch 3 CSV files for configured districts
