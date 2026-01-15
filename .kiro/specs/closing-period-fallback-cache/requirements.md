# Requirements Document

## Introduction

This feature optimizes the scraper's handling of closing period data by caching the fallback knowledge after the first successful fallback. Currently, when scraping data for a date that requires month-end reconciliation (closing period), each CSV download independently:
1. Tries the requested month parameter
2. Detects a date mismatch from the dashboard
3. Falls back to the previous month parameter
4. Succeeds

This pattern repeats for every CSV file (all-districts, club-performance, division-performance, district-performance per district), resulting in unnecessary failed requests. After the first successful fallback, the scraper should remember that this date requires the fallback approach and skip the initial failed attempt for subsequent files.

## Glossary

- **Scraper**: The ToastmastersScraper class that downloads CSV data from the Toastmasters dashboard
- **Orchestrator**: The ScraperOrchestrator class that coordinates scraping across multiple districts
- **Closing_Period**: A time window (typically early in a month) when the dashboard returns previous month's final data instead of current month data
- **Fallback**: The strategy of using the previous month parameter when the requested month returns a date mismatch
- **Date_Mismatch**: When the dashboard's "As of" date differs from the requested date
- **Fallback_Cache**: An in-memory cache that stores knowledge about which dates require fallback navigation
- **Navigation_Strategy**: The approach used to navigate to a specific date (direct or fallback)

## Requirements

### Requirement 1: Fallback Knowledge Caching

**User Story:** As a system operator, I want the scraper to remember when a date requires fallback navigation, so that subsequent CSV downloads for the same date skip the initial failed attempt.

#### Acceptance Criteria

1. WHEN the Scraper successfully uses fallback navigation for a date, THE Fallback_Cache SHALL store that the date requires fallback
2. WHEN the Scraper attempts to navigate to a date that is in the Fallback_Cache, THE Scraper SHALL use fallback navigation directly without first trying the standard approach
3. THE Fallback_Cache SHALL be scoped to a single scrape session (not persisted across process restarts)
4. WHEN a new scrape session starts, THE Fallback_Cache SHALL be empty

### Requirement 2: Fallback Cache Data Structure

**User Story:** As a developer, I want the fallback cache to store sufficient information to reconstruct the fallback navigation, so that subsequent requests can use the correct parameters.

#### Acceptance Criteria

1. THE Fallback_Cache SHALL store the requested date as the cache key
2. THE Fallback_Cache SHALL store the fallback month parameter that succeeded
3. THE Fallback_Cache SHALL store whether a program year boundary crossing was required
4. THE Fallback_Cache SHALL store the actual date string returned by the dashboard

### Requirement 3: Cache Lookup Integration

**User Story:** As a system operator, I want the scraper to check the fallback cache before attempting navigation, so that known fallback dates are handled efficiently.

#### Acceptance Criteria

1. WHEN navigating to a date, THE Scraper SHALL first check the Fallback_Cache for that date
2. IF the date is found in the Fallback_Cache, THEN THE Scraper SHALL construct the fallback URL directly using cached parameters
3. IF the date is not found in the Fallback_Cache, THEN THE Scraper SHALL use the standard navigation approach with fallback retry
4. THE cache lookup SHALL have O(1) time complexity

### Requirement 4: Cache Population

**User Story:** As a developer, I want the fallback cache to be populated automatically when fallback succeeds, so that no manual intervention is required.

#### Acceptance Criteria

1. WHEN fallback navigation succeeds, THE Scraper SHALL automatically populate the Fallback_Cache with the successful parameters
2. WHEN standard navigation succeeds without fallback, THE Scraper SHALL NOT add an entry to the Fallback_Cache
3. THE cache population SHALL occur before returning from the navigation method

### Requirement 5: Logging and Observability

**User Story:** As a system operator, I want to see when the scraper uses cached fallback knowledge, so that I can verify the optimization is working.

#### Acceptance Criteria

1. WHEN the Scraper uses cached fallback knowledge, THE Scraper SHALL log an info message indicating cache hit
2. WHEN the Scraper populates the Fallback_Cache, THE Scraper SHALL log a debug message with the cached parameters
3. THE log messages SHALL include the date, fallback month, and whether program year boundary was crossed

### Requirement 6: Session Scope Management

**User Story:** As a developer, I want the fallback cache to be properly scoped to the scraper instance, so that concurrent scrape operations don't interfere with each other.

#### Acceptance Criteria

1. THE Fallback_Cache SHALL be an instance property of the ToastmastersScraper class
2. WHEN a new ToastmastersScraper instance is created, THE Fallback_Cache SHALL be initialized as empty
3. THE Fallback_Cache SHALL NOT be shared between ToastmastersScraper instances
4. WHEN the browser is closed, THE Fallback_Cache MAY be cleared (but is not required to be)

### Requirement 7: Efficiency Metrics

**User Story:** As a system operator, I want to understand the efficiency gains from fallback caching, so that I can verify the optimization value.

#### Acceptance Criteria

1. THE Scraper SHALL track the number of cache hits (fallback knowledge reused)
2. THE Scraper SHALL track the number of cache misses (fallback discovered fresh)
3. WHEN the scrape session completes, THE Orchestrator SHALL log a summary including cache hit/miss statistics
