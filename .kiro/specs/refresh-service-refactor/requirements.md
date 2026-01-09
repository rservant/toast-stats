# Requirements Document

## Introduction

This specification defines the refactoring of `RefreshService.ts` (2,117 lines, 34 methods) to extract specialized components for closing period detection and data normalization. The goal is to improve maintainability by separating complex domain logic into focused, testable modules.

## Glossary

- **Refresh_Service**: The main orchestrator service that coordinates scraping, normalization, validation, and snapshot creation
- **Closing_Period_Detector**: Module responsible for detecting and handling Toastmasters month-end closing periods
- **Data_Normalizer**: Module responsible for transforming raw scraped data into normalized snapshot format
- **Snapshot**: An immutable, time-specific representation of normalized application data
- **Closing_Period**: The period at month-end when Toastmasters dashboard data reflects the previous month

## Requirements

### Requirement 1: Closing Period Detector Extraction

**User Story:** As a maintainer, I want closing period detection logic separated, so that this complex domain logic is independently testable and documented.

#### Acceptance Criteria

1. THE Closing_Period_Detector SHALL detect when dashboard data represents a closing period
2. THE Closing_Period_Detector SHALL determine the logical date for closing period snapshots
3. THE Closing_Period_Detector SHALL calculate the data month from CSV metadata
4. THE Closing_Period_Detector SHALL provide clear documentation of closing period rules
5. WHEN the Refresh_Service detects closing periods, THE service SHALL delegate to the Closing_Period_Detector
6. THE Closing_Period_Detector file SHALL have no more than 300 lines

### Requirement 2: Data Normalizer Extraction

**User Story:** As a maintainer, I want data normalization logic separated, so that transformation rules are independently testable.

#### Acceptance Criteria

1. THE Data_Normalizer SHALL transform raw scraped data into NormalizedData format
2. THE Data_Normalizer SHALL normalize district-specific data (performance, divisions, clubs)
3. THE Data_Normalizer SHALL extract membership totals from club performance data
4. THE Data_Normalizer SHALL extract club membership details
5. THE Data_Normalizer SHALL count active and distinguished clubs
6. WHEN the Refresh_Service normalizes data, THE service SHALL delegate to the Data_Normalizer
7. THE Data_Normalizer file SHALL have no more than 400 lines

### Requirement 3: API Preservation

**User Story:** As a developer, I want the existing public API unchanged, so that consuming code requires no modification.

#### Acceptance Criteria

1. THE Refresh_Service SHALL expose all existing public methods with identical signatures
2. WHEN executeRefresh is called, THE Refresh_Service SHALL return RefreshResult with identical structure
3. WHEN validateConfiguration is called, THE Refresh_Service SHALL return validation results with identical structure
4. THE Refresh_Service SHALL maintain backward compatibility for all method parameters and return types

### Requirement 4: Dependency Injection

**User Story:** As a tester, I want extracted modules to accept dependencies via constructor injection, so that I can mock dependencies in tests.

#### Acceptance Criteria

1. WHEN a module is instantiated, THE module SHALL accept its dependencies via constructor parameters
2. THE Refresh_Service SHALL inject dependencies into extracted modules
3. THE extracted modules SHALL NOT create their own instances of shared dependencies
4. WHEN testing a module, THE tester SHALL be able to provide mock implementations of all dependencies

### Requirement 5: Test Coverage Preservation

**User Story:** As a maintainer, I want all existing tests to continue passing, so that I have confidence the refactoring preserves behavior.

#### Acceptance Criteria

1. WHEN the refactoring is complete, ALL existing RefreshService tests SHALL pass without modification
2. WHEN a module is extracted, THE module SHALL have dedicated unit tests
3. THE test coverage percentage SHALL NOT decrease after refactoring
4. THE Closing_Period_Detector SHALL have property-based tests for date boundary conditions
