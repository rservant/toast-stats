# Implementation Plan: Pre-Computed Analytics Alignment

## Overview

This implementation aligns the pre-computed analytics pipeline to produce the full `DistrictAnalytics` structure expected by the frontend. The work is organized into phases: type updates, module enhancements, data transformer updates, and deprecation/cleanup.

## Tasks

- [ ] 1. Update analytics-core types
  - [ ] 1.1 Extend ClubTrend type with frontend-required fields
    - Add divisionId, divisionName, areaId, areaName fields
    - Change riskFactors from ClubRiskFactors object to string[]
    - Add membershipTrend and dcpGoalsTrend arrays
    - Add distinguishedLevel field with DistinguishedLevel type
    - Add optional payment fields: octoberRenewals, aprilRenewals, newMembers
    - Add optional clubStatus field
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ] 1.2 Extend ClubStatistics interface with additional fields
    - Add divisionName and areaName fields
    - Add octoberRenewals, aprilRenewals, newMembers fields
    - Add membershipBase field for net growth calculation
    - Add optional clubStatus field
    - _Requirements: 2.4, 2.5, 9.1_

  - [ ] 1.3 Add DistinguishedLevel type if not already present
    - Define type: 'NotDistinguished' | 'Smedley' | 'President' | 'Select' | 'Distinguished'
    - _Requirements: 1.5_

- [ ] 2. Checkpoint - Types compile correctly
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run build` in analytics-core to verify type changes compile

- [ ] 3. Enhance ClubHealthAnalyticsModule
  - [ ] 3.1 Add division/area extraction to club trend generation
    - Extract divisionId, divisionName, areaId, areaName from ClubStatistics
    - Handle missing values with defaults ('Unknown Division', 'Unknown Area')
    - _Requirements: 2.1, 4.3_

  - [ ] 3.2 Implement membership trend array building
    - Build membershipTrend array from historical snapshots per club
    - Each entry: { date: string, count: number }
    - _Requirements: 2.2, 5.3_

  - [ ] 3.3 Implement DCP goals trend array building
    - Build dcpGoalsTrend array from historical snapshots per club
    - Each entry: { date: string, goalsAchieved: number }
    - _Requirements: 2.3, 5.4_

  - [ ] 3.4 Implement risk factors to string array conversion
    - Convert ClubRiskFactors object to string[] format
    - Map each true flag to descriptive string
    - _Requirements: 2.6_

  - [ ] 3.5 Implement distinguished level calculation
    - Calculate level based on DCP goals, membership, and net growth
    - Apply threshold rules: Smedley (10/25), President (9/20), Select (7/20 or 5 growth), Distinguished (5/20 or 3 growth)
    - _Requirements: 2.7_

  - [ ] 3.6 Add payment field extraction
    - Extract octoberRenewals, aprilRenewals, newMembers from ClubStatistics
    - Default to 0 if not present
    - _Requirements: 2.4_

  - [ ] 3.7 Add club status extraction
    - Extract clubStatus from ClubStatistics
    - Validate values: 'Active', 'Suspended', 'Low', 'Ineligible', or undefined
    - _Requirements: 2.5, 9.1, 9.2_

  - [ ] 3.8 Write unit tests for ClubHealthAnalyticsModule enhancements
    - Test division/area extraction with various inputs
    - Test trend array building with single and multiple snapshots
    - Test risk factors conversion
    - Test distinguished level calculation at boundary conditions
    - Test payment field extraction
    - Test club status extraction
    - _Requirements: 2.1-2.7, 9.1, 9.2_

  - [ ] 3.9 Write property test for risk factors round-trip
    - **Property 4: Risk factors conversion preserves information**
    - **Validates: Requirements 2.6**

  - [ ] 3.10 Write property test for club categorization partition
    - **Property 6: Club categorization partitions allClubs**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [ ] 4. Checkpoint - ClubHealthAnalyticsModule complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm test` in analytics-core to verify module changes

- [ ] 5. Update DataTransformer in scraper-cli
  - [ ] 5.1 Add division/area name extraction from CSV
    - Parse 'Division' field to extract divisionId and divisionName
    - Parse 'Area' field to extract areaId and areaName
    - _Requirements: 4.1, 4.2_

  - [ ] 5.2 Add payment field extraction from CSV
    - Extract 'Oct. Ren.' → octoberRenewals
    - Extract 'Apr. Ren.' → aprilRenewals
    - Extract 'New Members' → newMembers
    - _Requirements: 2.4_

  - [ ] 5.3 Add membership base extraction from CSV
    - Extract 'Mem. Base' → membershipBase
    - _Requirements: 2.7_

  - [ ] 5.4 Add club status extraction from CSV
    - Extract 'Club Status' or 'Status' field → clubStatus
    - _Requirements: 9.1_

  - [ ] 5.5 Write unit tests for DataTransformer enhancements
    - Test division/area parsing with various formats
    - Test payment field extraction
    - Test membership base extraction
    - Test club status extraction
    - _Requirements: 4.1, 4.2, 2.4, 9.1_

- [ ] 6. Checkpoint - DataTransformer complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm test` in scraper-cli to verify transformer changes

- [ ] 7. Verify DistrictAnalytics structure completeness
  - [ ] 7.1 Verify allClubs contains complete ClubTrend objects
    - Ensure all new fields are populated in output
    - _Requirements: 3.1_

  - [ ] 7.2 Verify categorized club arrays are complete
    - Ensure vulnerableClubs, thrivingClubs, interventionRequiredClubs have complete ClubTrend objects
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ] 7.3 Verify membershipTrend is array format
    - Ensure membershipTrend is array with entries per snapshot
    - _Requirements: 3.5, 5.1_

  - [ ] 7.4 Verify divisionRankings and topPerformingAreas are populated
    - Ensure arrays contain complete objects
    - _Requirements: 3.6, 3.7_

  - [ ] 7.5 Verify distinguishedClubsList and distinguishedProjection are populated
    - Ensure distinguishedClubsList has complete DistinguishedClubSummary objects
    - Ensure distinguishedProjection has all level counts
    - _Requirements: 3.8, 3.9, 6.1, 6.2, 6.3, 6.4_

  - [ ] 7.6 Write integration test for end-to-end analytics computation
    - Create test snapshot data
    - Run AnalyticsComputer
    - Verify output structure matches DistrictAnalytics type
    - _Requirements: 3.1-3.9_

- [ ] 8. Checkpoint - Analytics structure complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run full test suite to verify all changes work together

- [ ] 9. Deprecate PreComputedAnalyticsService
  - [ ] 9.1 Add deprecation notice to PreComputedAnalyticsService
    - Add @deprecated JSDoc tag with migration path explanation
    - Document that scraper-cli compute-analytics is the preferred approach
    - _Requirements: 8.1_

  - [ ] 9.2 Update backend to prefer full analytics files
    - Ensure PreComputedAnalyticsReader is used (already the case)
    - Document that analytics-summary.json is for backward compatibility only
    - _Requirements: 8.3, 8.4_

- [ ] 10. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm test` across all packages
  - Verify no TypeScript errors with `npm run build`

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (only 2 warranted per steering guidance)
- Unit tests validate specific examples and edge cases
