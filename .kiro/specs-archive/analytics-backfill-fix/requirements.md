# Requirements Document

## Introduction

This document specifies the requirements for fixing the analytics backfill functionality in the Unified Backfill Service. Currently, the `AnalyticsGenerator` class only generates time-series index data but does NOT generate the `analytics-summary.json` files that the frontend requires for pre-computed analytics. This causes the frontend to display fallback data warnings and results in missing pre-computed analytics for backfilled snapshots.

## Glossary

- **AnalyticsGenerator**: The component within the Unified Backfill Service responsible for processing existing snapshots to generate analytics data during backfill operations.
- **PreComputedAnalyticsService**: The service that computes and stores analytics summaries (`analytics-summary.json` files) within snapshot directories, enabling fast retrieval without on-demand computation.
- **TimeSeriesIndexStorage**: The storage interface for appending time-series data points used for trend analysis.
- **UnifiedBackfillService**: The orchestrator service that coordinates backfill operations including data collection and analytics generation.
- **analytics-summary.json**: A JSON file stored within each snapshot directory containing pre-computed analytics summaries for all districts in that snapshot.
- **Backfill_Job**: A background job that processes historical snapshots to generate analytics data.

## Requirements

### Requirement 1: Inject PreComputedAnalyticsService into AnalyticsGenerator

**User Story:** As a system operator, I want the AnalyticsGenerator to have access to the PreComputedAnalyticsService, so that it can generate pre-computed analytics files during backfill operations.

#### Acceptance Criteria

1. THE AnalyticsGenerator constructor SHALL accept a PreComputedAnalyticsService instance as a required dependency
2. THE AnalyticsGenerator SHALL store the PreComputedAnalyticsService reference for use during snapshot processing

### Requirement 2: Generate Pre-Computed Analytics During Snapshot Processing

**User Story:** As a system operator, I want the backfill job to generate analytics-summary.json files for each processed snapshot, so that the frontend can display pre-computed analytics without fallback warnings.

#### Acceptance Criteria

1. WHEN processing a snapshot, THE AnalyticsGenerator SHALL call PreComputedAnalyticsService.computeAndStore() to generate the analytics-summary.json file
2. WHEN PreComputedAnalyticsService.computeAndStore() fails, THE AnalyticsGenerator SHALL log the error and continue processing the snapshot for time-series data
3. THE AnalyticsGenerator SHALL generate pre-computed analytics AFTER successfully reading district data from the snapshot

### Requirement 3: Update UnifiedBackfillService to Provide PreComputedAnalyticsService

**User Story:** As a system operator, I want the UnifiedBackfillService to properly initialize the AnalyticsGenerator with all required dependencies, so that analytics backfill jobs generate complete analytics data.

#### Acceptance Criteria

1. THE UnifiedBackfillService SHALL create or receive a PreComputedAnalyticsService instance
2. THE UnifiedBackfillService SHALL pass the PreComputedAnalyticsService to the AnalyticsGenerator constructor
3. WHEN creating the PreComputedAnalyticsService, THE UnifiedBackfillService SHALL configure it with the correct snapshots directory path
