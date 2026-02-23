# Implementation Plan: Shared Data Contracts

## Overview

This implementation creates a new `@toastmasters/shared-contracts` package that serves as the single source of truth for file format types between collector-cli and backend. The package provides TypeScript interfaces for compile-time verification and Zod schemas for runtime validation.

## Tasks

- [x] 1. Create shared-contracts package structure
  - [x] 1.1 Initialize package at `packages/shared-contracts/`
    - Create package.json with name `@toastmasters/shared-contracts`
    - Configure dual ESM/CJS builds matching analytics-core structure
    - Add Zod as the only runtime dependency
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 1.2 Set up TypeScript configuration
    - Create tsconfig.json, tsconfig.esm.json, tsconfig.cjs.json
    - Configure declaration file generation
    - _Requirements: 1.3_
  - [x] 1.3 Add package to workspace
    - Update root package.json workspaces array
    - Add build and test scripts to root package.json
    - _Requirements: 1.1_

- [x] 2. Implement file format types
  - [x] 2.1 Create DistrictStatisticsFile types
    - Create `src/types/district-statistics-file.ts`
    - Define ClubStatisticsFile, DivisionStatisticsFile, AreaStatisticsFile, DistrictTotalsFile
    - Define DistrictStatisticsFile matching analytics-core structure
    - _Requirements: 9.1, 9.2_
  - [x] 2.2 Create PerDistrictData type
    - Create `src/types/per-district-data.ts`
    - Define PerDistrictData interface with districtId, districtName, collectedAt, status, errorMessage, data
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.3 Create AllDistrictsRankingsData types
    - Create `src/types/all-districts-rankings.ts`
    - Define AllDistrictsRankingsMetadata with all required fields
    - Define DistrictRanking with all ranking fields
    - Define AllDistrictsRankingsData combining metadata and rankings
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 2.4 Create SnapshotMetadataFile type
    - Create `src/types/snapshot-metadata.ts`
    - Define SnapshotMetadataFile with required and optional closing period fields
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 2.5 Create SnapshotManifest types
    - Create `src/types/snapshot-manifest.ts`
    - Define DistrictManifestEntry interface
    - Define SnapshotManifest interface
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 3. Implement Zod validation schemas
  - [x] 3.1 Create DistrictStatisticsFile schemas
    - Create `src/schemas/district-statistics-file.schema.ts`
    - Define schemas for ClubStatisticsFile, DivisionStatisticsFile, AreaStatisticsFile, DistrictTotalsFile
    - Define DistrictStatisticsFileSchema
    - _Requirements: 6.1, 6.2_
  - [x] 3.2 Create PerDistrictData schema
    - Create `src/schemas/per-district-data.schema.ts`
    - Define PerDistrictDataSchema matching the TypeScript interface
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 3.3 Create AllDistrictsRankingsData schemas
    - Create `src/schemas/all-districts-rankings.schema.ts`
    - Define DistrictRankingSchema, AllDistrictsRankingsMetadataSchema
    - Define AllDistrictsRankingsDataSchema
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 3.4 Create SnapshotMetadataFile schema
    - Create `src/schemas/snapshot-metadata.schema.ts`
    - Define SnapshotMetadataFileSchema with optional fields
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 3.5 Create SnapshotManifest schemas
    - Create `src/schemas/snapshot-manifest.schema.ts`
    - Define DistrictManifestEntrySchema, SnapshotManifestSchema
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 4. Implement validation helpers and version constants
  - [x] 4.1 Create version constants
    - Create `src/version.ts`
    - Export SCHEMA_VERSION, CALCULATION_VERSION, RANKING_VERSION
    - Implement isSchemaCompatible function
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 4.2 Create validation helper functions
    - Create `src/validation/validators.ts`
    - Define ValidationResult interface
    - Implement validatePerDistrictData, validateAllDistrictsRankings, validateSnapshotMetadata, validateSnapshotManifest
    - _Requirements: 6.4, 6.5_
  - [x] 4.3 Create package entry point
    - Create `src/index.ts`
    - Export all types, schemas, validators, and version constants
    - _Requirements: 1.2_

- [x] 5. Checkpoint - Build and verify package
  - Build the package with `npm run build`
  - Verify ESM and CJS outputs are generated
  - Verify type declarations are generated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add unit tests
  - [x] 6.1 Write version compatibility tests
    - Create `src/__tests__/version.test.ts`
    - Test same major version returns compatible
    - Test different major version returns incompatible
    - Test edge cases (0.x.x, malformed strings)
    - _Requirements: 10.5_
  - [x] 6.2 Write error message quality tests
    - Create `src/__tests__/validators.test.ts`
    - Test missing required field produces descriptive error
    - Test wrong type produces descriptive error
    - Test nested validation error includes path
    - _Requirements: 6.5_
  - [x] 6.3 Write property test for schema-type consistency
    - Create `src/__tests__/schemas.property.test.ts`
    - Generate random valid objects using fast-check arbitraries
    - Verify schema accepts all valid objects
    - Verify schema rejects objects with missing/wrong fields
    - **Property 1: Schema-Type Consistency**
    - **Validates: Requirements 2.2, 2.3, 3.2, 3.3, 4.2, 4.3, 5.3, 6.3, 9.2**
  - [x] 6.4 Write property test for validation round-trip
    - Add round-trip tests to `src/__tests__/schemas.property.test.ts`
    - Generate random valid file format objects
    - Serialize to JSON, parse, validate
    - Verify structural equivalence
    - **Property 2: Validation Round-Trip**
    - **Validates: Requirements 6.3, 6.4**

- [x] 7. Checkpoint - Ensure all tests pass
  - Run `npm run test --workspace=@toastmasters/shared-contracts`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Migrate collector-cli to use shared contracts
  - [x] 8.1 Add shared-contracts dependency to collector-cli
    - Update `packages/collector-cli/package.json`
    - Add `@toastmasters/shared-contracts` as dependency
    - _Requirements: 7.1_
  - [x] 8.2 Update TransformService imports
    - Import PerDistrictData, SnapshotMetadataFile, SnapshotManifest, AllDistrictsRankingsData from shared-contracts
    - Remove local interface definitions that duplicate shared contracts
    - Update type annotations to use shared types
    - _Requirements: 7.2, 7.3_
  - [x] 8.3 Add validation before file writes
    - Import validation helpers from shared-contracts
    - Validate data before writing district files
    - Validate data before writing rankings file
    - Log validation errors and throw on failure
    - _Requirements: 7.4, 7.5_

- [x] 9. Migrate backend to use shared contracts
  - [x] 9.1 Add shared-contracts dependency to backend
    - Update `backend/package.json`
    - Add `@toastmasters/shared-contracts` as dependency
    - _Requirements: 8.1_
  - [x] 9.2 Update SnapshotStore imports
    - Import PerDistrictData, SnapshotManifest, AllDistrictsRankingsData from shared-contracts
    - Remove local interface definitions that duplicate shared contracts
    - Update type annotations to use shared types
    - _Requirements: 8.2, 8.3_
  - [x] 9.3 Create adapter for DistrictStatistics
    - Create `backend/src/adapters/district-statistics-adapter.ts`
    - Implement function to adapt DistrictStatisticsFile to backend's internal DistrictStatistics
    - Centralize all transformation logic in this adapter
    - _Requirements: 9.3, 9.4_
  - [x] 9.4 Add validation after file reads
    - Import validation helpers from shared-contracts
    - Validate data after reading district files
    - Validate data after reading rankings file
    - Log validation errors and return appropriate error responses
    - _Requirements: 8.4, 8.5_
  - [x] 9.5 Write unit tests for adapter function
    - Create `backend/src/adapters/__tests__/district-statistics-adapter.test.ts`
    - Test transformation from DistrictStatisticsFile to backend DistrictStatistics
    - Test edge cases and error conditions
    - _Requirements: 9.5_

- [x] 10. Final checkpoint - Integration verification
  - Build all packages: `npm run build:analytics-core && npm run build:shared-contracts && npm run build:collector-cli && npm run build:backend`
  - Run all tests: `npm run test`
  - Verify no TypeScript errors: `npm run typecheck`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- The shared-contracts package has zero runtime dependencies except Zod
- Version constants should match analytics-core's ANALYTICS_SCHEMA_VERSION for consistency
- The adapter function in backend handles the transformation from file format to API response format
- Property tests use fast-check with minimum 100 iterations per steering requirements
- This feature does not add any new API endpoints, so no OpenAPI updates are needed
