# Implementation Plan: Club Health Table Integration

## Overview

This implementation plan integrates Health Status and Trajectory columns into the existing ClubsTable component. The approach leverages existing infrastructure (React Query, column filters, TypeScript) while adding health classification data seamlessly. The implementation follows incremental development with comprehensive testing at each step.

## Tasks

- [x] 1. Set up enhanced data types and interfaces
  - Create EnhancedClubTrend interface extending ProcessedClubTrend with health data
  - Define HealthDataStatus interface for tracking data freshness and errors
  - Update column configuration types to include health status and trajectory fields
  - _Requirements: 1.1, 2.1, 5.1_

- [ ]\* 1.1 Write property test for enhanced data types
  - **Property 1: Health Status Display Consistency**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [x] 2. Implement HealthDataMerger service
  - [x] 2.1 Create HealthDataMerger class with club name normalization
    - Implement exact name matching (case-insensitive)
    - Add normalized name matching (remove special characters, spaces)
    - Include fuzzy matching for common club name variations
    - _Requirements: 5.2, 5.3_

  - [ ]\* 2.2 Write property test for data merging logic
    - **Property 7: Data Integration Consistency**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [x] 2.3 Add data age calculation and health status determination
    - Calculate data age in hours from timestamps
    - Determine health data status (fresh/stale/outdated)
    - Handle missing or invalid timestamp data
    - _Requirements: 5.4, 12.1, 12.2, 12.3_

- [x] 3. Create useClubHealthIntegration hook
  - [x] 3.1 Implement data fetching and integration logic
    - Fetch club performance data using useDistrictAnalytics
    - Fetch health classification data using useDistrictClubsHealth
    - Merge data using HealthDataMerger service
    - _Requirements: 5.1, 5.2_

  - [ ]\* 3.2 Write property test for hook integration
    - **Property 8: Performance Requirements**
    - **Validates: Requirements 5.6, 8.1, 8.2, 8.3, 8.4, 8.5**

  - [x] 3.3 Add error handling and refresh functionality
    - Handle API failures gracefully with fallback to "Unknown" status
    - Implement refresh functionality for stale data
    - Manage loading and error states
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 12.4_

- [x] 4. Checkpoint - Ensure data integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create health status and trajectory column components
  - [x] 5.1 Implement HealthStatusCell component
    - Create color-coded badges using Toastmasters brand colors
    - Add tooltip functionality showing classification reasoning
    - Include data freshness indicators
    - Implement ARIA labels for accessibility
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 6.1, 6.3, 10.1_

  - [ ]\* 5.2 Write property test for HealthStatusCell
    - **Property 1: Health Status Display Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

  - [x] 5.3 Implement TrajectoryCell component
    - Create directional arrow icons with color coding
    - Add tooltip functionality showing trajectory reasoning
    - Include data freshness indicators
    - Implement ARIA labels for accessibility
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 6.2, 6.4, 10.2_

  - [ ]\* 5.4 Write property test for TrajectoryCell
    - **Property 2: Trajectory Display Consistency**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 6. Extend column filtering system
  - [x] 6.1 Update column configuration with health fields
    - Add healthStatus and trajectory to COLUMN_CONFIGS
    - Define filter options for health status and trajectory
    - Add helpful tooltips explaining health classifications
    - _Requirements: 3.6, 4.6, 10.6_

  - [x] 6.2 Extend useColumnFilters hook for health data
    - Add health status and trajectory filter logic
    - Implement custom sort orders for health fields
    - Ensure integration with existing filter clearing functionality
    - _Requirements: 1.6, 2.6, 3.1, 3.2, 4.1, 4.2, 11.1, 11.2_

  - [ ]\* 6.3 Write property test for health filtering
    - **Property 5: Health Status Filtering Functionality**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [ ]\* 6.4 Write property test for trajectory filtering
    - **Property 6: Trajectory Filtering Functionality**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 7. Update ClubsTable component integration
  - [x] 7.1 Integrate useClubHealthIntegration hook
    - Replace useDistrictAnalytics with useClubHealthIntegration
    - Update component state management for enhanced club data
    - Add health data status display and refresh functionality
    - _Requirements: 5.1, 9.2, 12.4_

  - [x] 7.2 Add health status and trajectory columns to table
    - Insert HealthStatusCell and TrajectoryCell components
    - Update table headers with new column configurations
    - Ensure responsive design and mobile compatibility
    - _Requirements: 1.1, 2.1, 6.5, 11.5_

  - [ ]\* 7.3 Write property test for table integration
    - **Property 14: Integration with Existing Features**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6**

- [-] 8. Implement sorting functionality for health columns
  - [x] 8.1 Add custom sort logic for health status and trajectory
    - Implement health status sort order: Intervention Required, Vulnerable, Thriving
    - Implement trajectory sort order: Declining, Stable, Recovering
    - Handle "Unknown" values in sorting
    - _Requirements: 1.6, 2.6_

  - [ ]\* 8.2 Write property test for health sorting
    - **Property 3: Health Status Sorting Order**
    - **Validates: Requirements 1.6**

  - [ ]\* 8.3 Write property test for trajectory sorting
    - **Property 4: Trajectory Sorting Order**
    - **Validates: Requirements 2.6**

- [x] 9. Checkpoint - Ensure table functionality tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Update export functionality
  - [x] 10.1 Extend CSV export to include health data
    - Add health status and trajectory columns to export
    - Include health data timestamps for freshness tracking
    - Handle missing health data with "Unknown" labels
    - Ensure export respects health filters
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]\* 10.2 Write property test for export functionality
    - **Property 10: Export Data Integrity**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

- [x] 11. Implement error handling and data freshness features
  - [x] 11.1 Add error state displays and recovery options
    - Show informative error messages when health data fails to load
    - Provide retry buttons for failed health data requests
    - Display appropriate loading states during health data refresh
    - _Requirements: 9.2, 9.6, 12.6_

  - [x] 11.2 Implement data freshness indicators
    - Add visual indicators for data age (fresh/recent/stale/outdated)
    - Display warning messages for stale or outdated data
    - Provide refresh functionality for outdated health data
    - _Requirements: 9.4, 12.1, 12.2, 12.3, 12.5_

  - [ ]\* 11.3 Write property test for error handling
    - **Property 11: Error Handling Graceful Degradation**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5, 9.6**

  - [ ]\* 11.4 Write property test for data freshness
    - **Property 12: Data Freshness Indicators**
    - **Validates: Requirements 9.4, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

- [x] 12. Implement accessibility and visual enhancements
  - [x] 12.1 Add accessibility features
    - Implement proper ARIA labels for health status and trajectory
    - Ensure sufficient color contrast ratios (4.5:1 minimum)
    - Add keyboard navigation support for health filters
    - Verify touch target sizes on mobile devices (44px minimum)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]\* 12.2 Write property test for accessibility compliance
    - **Property 9: Accessibility Compliance**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [x] 12.3 Add visual consistency and branding
    - Ensure health columns match existing table styling
    - Apply Toastmasters brand colors consistently
    - Add visual grouping for clubs with same health status when sorted
    - _Requirements: 6.6, 10.5_

  - [ ]\* 12.4 Write property test for visual consistency
    - **Property 15: Visual Consistency and Branding**
    - **Validates: Requirements 6.6, 10.5**

- [x] 13. Add tooltip and user experience enhancements
  - [x] 13.1 Implement comprehensive tooltip system
    - Add tooltips showing health classification reasoning
    - Include trajectory determination factors in tooltips
    - Add educational tooltips on column headers
    - _Requirements: 10.1, 10.2, 10.6_

  - [ ]\* 13.2 Write property test for tooltip functionality
    - **Property 13: Tooltip Information Accuracy**
    - **Validates: Requirements 10.1, 10.2**

  - [x] 13.3 Add summary and highlighting features
    - Display count of clubs needing immediate attention
    - Implement visual grouping for health categories
    - Add fresh data indicators for recent health classifications
    - _Requirements: 10.3, 10.4, 10.5_

- [ ] 14. Performance optimization and caching
  - [ ] 14.1 Implement performance optimizations
    - Add efficient re-rendering to avoid unnecessary updates
    - Implement health data caching to reduce API calls
    - Optimize filtering performance for large datasets
    - _Requirements: 5.5, 8.6_

  - [ ]\* 14.2 Write performance tests
    - **Property 8: Performance Requirements**
    - **Validates: Requirements 5.6, 8.1, 8.2, 8.3, 8.4, 8.5**

- [ ] 15. Final integration and testing
  - [ ] 15.1 Complete end-to-end integration testing
    - Test complete user workflows from loading to export
    - Verify cross-browser compatibility
    - Test responsive behavior on different screen sizes
    - Validate all accessibility features work correctly
    - _Requirements: All requirements_

  - [ ] 15.2 Update documentation and examples
    - Update component documentation with health column examples
    - Add usage examples for health filtering and sorting
    - Document error handling and recovery procedures
    - _Requirements: Documentation and maintenance_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100+ iterations each
- Unit tests validate specific examples and edge cases
- The implementation leverages existing TypeScript/React infrastructure
- All health data integration maintains backward compatibility with existing table functionality
