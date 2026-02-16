# Requirements Document

## Introduction

This feature makes the scraper-cli pipeline compliant with the month-end reconciliation documentation in `TOASTMASTERS_DASHBOARD_KNOWLEDGE.md`. During month-end closing periods, the Toastmasters dashboard publishes data for a prior month with an "As of" date in the current month. The TransformService must read cache metadata to detect these closing periods and write snapshots to the correct date directory (last day of the data month) rather than the requested date.

## Background

The scraper (`ToastmastersScraper.ts`) already:

- Detects closing periods by comparing the CSV's data month to the "As of" date
- Stores `isClosingPeriod` and `dataMonth` in cache metadata via `setCachedCSVWithMetadata()`
- Extracts closing period info from CSV footer lines

The TransformService currently:

- Reads raw CSV files from `CACHE_DIR/raw-csv/{date}/district-{id}/`
- Writes snapshots to `CACHE_DIR/snapshots/{date}/` using the input date directly
- Does NOT read the cache metadata
- Does NOT adjust snapshot dates for closing periods
- Does NOT include closing period fields in snapshot metadata

## Glossary

- **Closing_Period**: Time when the Toastmasters dashboard publishes prior-month data with an "As of" date in the current month
- **Data_Month**: The month the statistics in a CSV actually represent (YYYY-MM format)
- **As_Of_Date**: The date shown on the dashboard when the CSV was generated (YYYY-MM-DD format)
- **Collection_Date**: The actual date when data was collected (same as As_Of_Date)
- **Logical_Date**: The date the snapshot represents (last day of data month for closing periods)
- **TransformService**: The service that transforms raw CSV files into snapshot format
- **Cache_Metadata**: JSON file in raw-csv directory containing `isClosingPeriod` and `dataMonth` fields
- **Snapshot_Metadata**: The metadata.json file in each snapshot directory

## Requirements

### Requirement 1: Read Cache Metadata

**User Story:** As a system operator, I want the TransformService to read cache metadata, so that it can detect closing periods during transformation.

#### Acceptance Criteria

1. WHEN transforming raw CSVs THEN the TransformService SHALL read the cache metadata from `CACHE_DIR/raw-csv/{date}/metadata.json`
2. WHEN cache metadata exists THEN the TransformService SHALL extract `isClosingPeriod` and `dataMonth` fields
3. WHEN cache metadata does not exist THEN the TransformService SHALL treat the data as non-closing-period data
4. IF reading cache metadata fails THEN the TransformService SHALL log a warning and continue with non-closing-period behavior

### Requirement 2: Snapshot Date Adjustment for Closing Periods

**User Story:** As a system operator, I want closing period data to be stored under the last day of the data month, so that each month has accurate final data.

#### Acceptance Criteria

1. WHEN `isClosingPeriod` is true THEN the TransformService SHALL calculate the last day of the data month
2. WHEN `isClosingPeriod` is true THEN the TransformService SHALL write the snapshot to `CACHE_DIR/snapshots/{lastDayOfDataMonth}/` instead of `CACHE_DIR/snapshots/{requestedDate}/`
3. WHEN the data month is December and the collection date is in January THEN the snapshot SHALL be dated December 31 of the prior year
4. WHEN `isClosingPeriod` is false or undefined THEN the TransformService SHALL use the requested date as the snapshot date

### Requirement 3: Closing Period Metadata in Snapshots

**User Story:** As a system operator, I want snapshot metadata to indicate when data is from a closing period, so that downstream consumers understand the data's context.

#### Acceptance Criteria

1. WHEN creating a closing period snapshot THEN the metadata SHALL include `isClosingPeriodData: true`
2. WHEN creating a closing period snapshot THEN the metadata SHALL include `collectionDate` with the actual "As of" date
3. WHEN creating a closing period snapshot THEN the metadata SHALL include `logicalDate` with the last day of the data month
4. WHEN creating a non-closing-period snapshot THEN the metadata SHALL NOT include closing period fields (or set them to false/undefined)

### Requirement 4: Newer Data Wins for Closing Period Updates

**User Story:** As a system operator, I want newer closing period data to overwrite older data, so that the final snapshot reflects the most recent data.

#### Acceptance Criteria

1. WHEN a closing period snapshot already exists THEN the TransformService SHALL read the existing snapshot's collection date
2. WHEN the new data has a strictly newer collection date THEN the TransformService SHALL overwrite the existing snapshot
3. WHEN the new data has an equal or older collection date THEN the TransformService SHALL skip the update and log a message
4. WHEN the existing snapshot has no collection date metadata THEN the TransformService SHALL allow the update

### Requirement 5: Prevent Misleading New-Month Snapshots

**User Story:** As a district leader, I want to avoid seeing snapshots for dates that don't have real data, so that I'm not misled about data availability.

#### Acceptance Criteria

1. WHEN a closing period is detected THEN the TransformService SHALL NOT create a snapshot dated in the new month (the month of the collection date)
2. WHEN transforming closing period data THEN the TransformService SHALL only create a snapshot for the last day of the data month

---

## Compute-Analytics Closing Period Handling

The following requirements extend the month-end compliance feature to the `compute-analytics` command. The TransformService already handles closing periods by writing snapshots to the last day of the data month. The AnalyticsComputeService must also detect closing periods and look for snapshots at the adjusted date.

### Requirement 6: Read Cache Metadata for Analytics Computation

**User Story:** As a system operator, I want the compute-analytics command to read cache metadata, so that it can detect closing periods and find snapshots at the correct location.

#### Acceptance Criteria

1. WHEN computing analytics for a date THEN the AnalyticsComputeService SHALL read the cache metadata from `CACHE_DIR/raw-csv/{date}/metadata.json`
2. WHEN cache metadata exists with `isClosingPeriod: true` THEN the AnalyticsComputeService SHALL extract `isClosingPeriod` and `dataMonth` fields
3. WHEN cache metadata does not exist THEN the AnalyticsComputeService SHALL look for snapshots at the requested date
4. IF reading cache metadata fails THEN the AnalyticsComputeService SHALL log a warning and continue with non-closing-period behavior

### Requirement 7: Snapshot Date Adjustment for Analytics Computation

**User Story:** As a system operator, I want compute-analytics to find snapshots at the correct location during closing periods, so that analytics are computed for the data that was actually transformed.

#### Acceptance Criteria

1. WHEN `isClosingPeriod` is true THEN the AnalyticsComputeService SHALL calculate the last day of the data month using the existing ClosingPeriodDetector utility
2. WHEN `isClosingPeriod` is true THEN the AnalyticsComputeService SHALL look for snapshots at `CACHE_DIR/snapshots/{lastDayOfDataMonth}/` instead of `CACHE_DIR/snapshots/{requestedDate}/`
3. WHEN the data month is December and the collection date is in January THEN the AnalyticsComputeService SHALL look for snapshots dated December 31 of the prior year
4. WHEN `isClosingPeriod` is false or undefined THEN the AnalyticsComputeService SHALL look for snapshots at the requested date

### Requirement 8: Analytics Output Location for Closing Periods

**User Story:** As a system operator, I want analytics to be written alongside the snapshot they were computed from, so that the data pipeline remains consistent.

#### Acceptance Criteria

1. WHEN computing analytics for closing period data THEN the AnalyticsComputeService SHALL write analytics to `CACHE_DIR/snapshots/{lastDayOfDataMonth}/analytics/`
2. WHEN computing analytics for closing period data THEN the JSON output SHALL report the actual snapshot date used (not the requested date)
3. WHEN computing analytics for non-closing-period data THEN the AnalyticsComputeService SHALL write analytics to `CACHE_DIR/snapshots/{requestedDate}/analytics/`
