# Requirements Document

## Introduction

This feature ensures that month-end closing period data is correctly handled during snapshot creation and that users understand when data represents the final version of a closing month. The Toastmasters dashboard continues publishing data for the prior month during closing periods, and this data should update the last day of that month rather than create misleading snapshots in the new month.

## Background

CSV files from the Toastmasters dashboard contain two key facts:

- **"As of" date**: When the page was generated
- **Data month**: Which month the statistics apply to

Most of the time these match. During month-end closing periods, however, the dashboard continues publishing data for the prior month even though the "As of" date has moved into the next month.

**Current behavior to implement:**

- Closing period data updates the snapshot for the last day of the month being closed
- No snapshots are created for dates in the new month until new-month data is available
- Each month ends with a single, accurate final snapshot

## Glossary

- **Closing_Period**: Time when dashboard publishes prior-month data with a future "As of" date
- **Data_Month**: The month the statistics in a CSV actually represent
- **As_Of_Date**: The date shown on the dashboard when the CSV was generated
- **Final_Snapshot**: The snapshot for the last day of a month, updated with closing period data
- **Snapshot_Store**: The PerDistrictFileSnapshotStore that manages snapshot storage

## Requirements

### Requirement 1: Closing Period Detection During Refresh

**User Story:** As a system operator, I want the refresh process to detect closing periods, so that data is stored under the correct month.

#### Acceptance Criteria

1. WHEN refreshing data THEN the RefreshService SHALL compare the CSV's data month to the "As of" date
2. WHEN the data month is earlier than the "As of" date's month THEN the RefreshService SHALL identify this as a closing period
3. WHEN a closing period is detected THEN the RefreshService SHALL log the detection with both dates for debugging
4. WHEN processing CSV data THEN the RefreshService SHALL extract the data month from the CSV content or metadata

### Requirement 2: Snapshot Dating During Closing Periods

**User Story:** As a system operator, I want closing period data to update the last day of the closing month, so that each month has accurate final data.

#### Acceptance Criteria

1. WHEN a closing period is detected THEN the snapshot SHALL be dated as the last day of the data month
2. WHEN creating a closing period snapshot AND no snapshot exists for that date THEN the system SHALL create the snapshot
3. WHEN creating a closing period snapshot AND a snapshot exists with an older or equal collection date THEN the system SHALL overwrite with the newer data
4. WHEN creating a closing period snapshot AND a snapshot exists with a newer collection date THEN the system SHALL NOT overwrite the existing snapshot
5. WHEN the data month is December and "As of" is January THEN the snapshot SHALL be dated December 31 of the prior year
6. WHEN storing closing period snapshots THEN the metadata SHALL indicate the actual collection date for transparency

### Requirement 3: Prevent Misleading New-Month Snapshots

**User Story:** As a district leader, I want to avoid seeing snapshots for dates that don't have real data, so that I'm not misled about data availability.

#### Acceptance Criteria

1. WHEN a closing period is detected THEN the system SHALL NOT create a snapshot dated in the new month
2. WHEN requesting data for early new-month dates during closing THEN the API SHALL return the most recent available snapshot
3. WHEN no new-month data exists THEN the system SHALL clearly indicate that data is from the prior month's final snapshot
4. WHEN the closing period ends THEN new snapshots SHALL resume with correct new-month dates

### Requirement 4: API Transparency for Closing Period Data

**User Story:** As a district leader, I want to know when displayed data is from a closing period, so that I understand the data's context.

#### Acceptance Criteria

1. WHEN serving data from a closing period snapshot THEN the API SHALL include metadata indicating the actual collection date
2. WHEN the snapshot date differs from the collection date THEN the API SHALL include `is_closing_period_data: true`
3. WHEN returning snapshot metadata THEN the API SHALL include both the logical date and actual collection date
4. WHEN a user requests a date with no snapshot THEN the API SHALL indicate the nearest available snapshot date
