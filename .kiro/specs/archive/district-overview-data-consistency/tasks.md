# Implementation Plan: District Overview Data Consistency

## Overview

This implementation fixes data inconsistencies in the District Overview dashboard by:
1. Adding `paidClubsCount` field to `PerformanceTargetsData`
2. Fixing `isClubDistinguished()` to use full DCP criteria
3. Updating the transformation layer to use actual values

## Tasks

- [x] 1. Update PerformanceTargetsData type
  - [x] 1.1 Add paidClubsCount field to PerformanceTargetsData interface
    - Add `paidClubsCount: number` field to the interface in `packages/analytics-core/src/types.ts`
    - Add JSDoc comment explaining the field
    - _Requirements: 1.1, 4.1_

- [x] 2. Fix isClubDistinguished method in AreaDivisionRecognitionModule
  - [x] 2.1 Add calculateNetGrowth helper method
    - Add private method to calculate net growth from club data
    - Handle missing membershipBase gracefully (default to 0)
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.2 Update isClubDistinguished to use full DCP criteria
    - Check Smedley: 10+ goals AND 25+ members
    - Check President's: 9+ goals AND 20+ members
    - Check Select: 7+ goals AND (20+ members OR 5+ net growth)
    - Check Distinguished: 5+ goals AND (20+ members OR 3+ net growth)
    - _Requirements: 2.1, 2.2_
  
  - [x] 2.3 Write property test for distinguished club criteria
    - **Property 3: Distinguished Club Criteria Validation**
    - Generate random clubs with various DCP goals, membership, and net growth
    - Verify isClubDistinguished returns correct result based on official criteria
    - **Validates: Requirements 2.1, 2.2**
  
  - [x] 2.4 Write unit tests for distinguished club boundary conditions
    - Test all threshold boundaries per design document table
    - Name each test after the rule being protected
    - _Requirements: 2.1, 2.2_

- [x] 3. Update computePerformanceTargets to include paidClubsCount
  - [x] 3.1 Add paidClubsCount to return object
    - Use existing `totalPaidClubs` calculation from area recognitions
    - Include in the return object
    - _Requirements: 1.2_
  
  - [x] 3.2 Write unit tests for paidClubsCount computation
    - Test snapshot with mixed statuses
    - Test all clubs Active
    - Test all clubs Suspended
    - Test empty snapshot
    - _Requirements: 1.2, 4.3_

- [x] 4. Update transformation layer
  - [x] 4.1 Update transformPerformanceTargets to use paidClubsCount
    - Change `current: 0` to `current: performanceTargets.paidClubsCount`
    - Remove the comment about hardcoded value
    - _Requirements: 1.3_
  
  - [x] 4.2 Write unit tests for transformation
    - Test pass-through of paidClubsCount value
    - Test zero value handling
    - _Requirements: 1.3_

- [x] 5. Add round-trip serialization property test
  - [x] 5.1 Write property test for PerformanceTargetsData serialization
    - **Property 4: Performance Targets Data Round-Trip Serialization**
    - Generate random valid PerformanceTargetsData objects
    - Serialize to JSON, deserialize, compare to original
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 6. Checkpoint - Verify all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run test` in analytics-core and backend packages
  - Verify TypeScript compilation succeeds with no errors

- [x] 7. Update existing tests
  - [x] 7.1 Update AnalyticsComputer.performanceTargets.test.ts
    - Add assertions for paidClubsCount in existing tests
    - Verify paidClubsCount is included in computation results
    - _Requirements: 1.2_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run full test suite across all packages
  - Verify no TypeScript errors

## Notes

- All tasks are required for comprehensive testing
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (distinguished criteria, serialization)
- Unit tests validate specific examples and boundary conditions
