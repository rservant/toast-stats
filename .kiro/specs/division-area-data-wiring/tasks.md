# Implementation Plan: Division and Area Data Wiring

## Overview

This implementation plan addresses the data format mismatch between the scraper-cli pipeline and the frontend's Divisions & Areas tab. The changes modify the `DataTransformer` to preserve raw CSV arrays alongside transformed data, following the data-computation-separation steering document.

## Tasks

- [x] 1. Add ScrapedRecord type to shared-contracts
  - [x] 1.1 Create ScrapedRecord type definition
    - Create `packages/shared-contracts/src/types/scraped-record.ts`
    - Define `ScrapedRecord` as `Record<string, string | number | null>`
    - Add JSDoc documentation
    - _Requirements: 2.4_
  
  - [x] 1.2 Export ScrapedRecord from shared-contracts index
    - Update `packages/shared-contracts/src/index.ts` to export ScrapedRecord type
    - _Requirements: 2.4_

- [x] 2. Update DistrictStatisticsFile type in shared-contracts
  - [x] 2.1 Add raw data fields to DistrictStatisticsFile interface
    - Update `packages/shared-contracts/src/types/district-statistics-file.ts`
    - Add required `divisionPerformance: ScrapedRecord[]` field
    - Add required `clubPerformance: ScrapedRecord[]` field
    - Add required `districtPerformance: ScrapedRecord[]` field
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.2 Update Zod schema for DistrictStatisticsFile
    - Update `packages/shared-contracts/src/schemas/district-statistics-file.schema.ts`
    - Add ScrapedRecordSchema for validating record values
    - Add validation for divisionPerformance, clubPerformance, districtPerformance arrays
    - _Requirements: 2.5, 5.1, 5.2, 5.3_
  
  - [x] 2.3 Write unit tests for Zod schema validation
    - Add tests to `packages/shared-contracts/src/__tests__/district-statistics-file.schema.test.ts`
    - Test valid ScrapedRecord with string, number, null values
    - Test invalid ScrapedRecord with object, array, boolean values
    - Test missing raw data fields fails validation
    - _Requirements: 2.5, 5.1, 5.2, 5.3_

- [x] 3. Update DistrictStatistics interface in analytics-core
  - [x] 3.1 Add raw data fields to DistrictStatistics interface
    - Update `packages/analytics-core/src/interfaces.ts`
    - Import ScrapedRecord from shared-contracts
    - Add required `divisionPerformance: ScrapedRecord[]` field
    - Add required `clubPerformance: ScrapedRecord[]` field
    - Add required `districtPerformance: ScrapedRecord[]` field
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Update DataTransformer to preserve raw CSV arrays
  - [x] 4.1 Modify transformRawCSV method to include raw arrays in output
    - Update `packages/analytics-core/src/transformation/DataTransformer.ts`
    - After parsing CSV rows to records, include them in the output DistrictStatistics
    - Ensure empty arrays are included when input is empty or missing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [x] 4.2 Write unit tests for DataTransformer raw data preservation
    - Add tests to `packages/analytics-core/src/__tests__/DataTransformer.test.ts`
    - Test CSV with Division Club Base, Area Club Base columns preserved
    - Test CSV with Nov Visit award, May visit award columns preserved
    - Test CSV with Club Status, Club Distinguished Status columns preserved
    - Test empty CSV arrays produce empty arrays in output
    - Test CSV with only header row produces empty arrays
    - Test numeric and string values preserved correctly
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 5. Checkpoint - Verify shared-contracts and analytics-core changes
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run build` in shared-contracts and analytics-core packages
  - Run `npm run test` in shared-contracts and analytics-core packages

- [x] 6. Update TransformService integration tests
  - [x] 6.1 Add integration tests for raw data in transformed output
    - Update `packages/scraper-cli/src/__tests__/TransformService.integration.test.ts`
    - Test that transformed district JSON includes raw arrays
    - Test that specific column values are preserved exactly
    - Test that Zod validation passes for generated files
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 4.1, 4.2_

- [x] 7. Final checkpoint - Verify complete pipeline
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run build` across all packages
  - Run `npm run test` across all packages

## Notes

- All tasks including tests are required for comprehensive implementation
- The backend already has optional raw data fields in its DistrictStatistics type - no backend changes needed
- After implementation, user should regenerate snapshots using scraper-cli to populate raw data fields
- Frontend's `extractDivisionPerformance` function will automatically work once snapshots contain raw data
