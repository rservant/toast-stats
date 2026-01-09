# Requirements Document

## Introduction

This feature replaces the existing simple club health classification (Healthy/At-Risk/Critical) with a more sophisticated monthly DCP checkpoint-based system. The new classification evaluates clubs against monthly DCP thresholds, membership requirements, and CSP submission status to determine health status (Thriving/Vulnerable/Intervention Required).

This is a refactoring of existing functionality in the AnalyticsEngine, not a new feature. The goal is to provide more actionable health classifications that reflect where clubs should be in their Distinguished Club Program journey at any given point in the year.

## Glossary

- **AnalyticsEngine**: The existing backend service that processes district data and generates analytics including club health classification
- **Health_Status**: Classification with values Thriving, Vulnerable, or Intervention Required (replaces Healthy/At-Risk/Critical)
- **DCP_Goals**: Distinguished Club Program objectives tracked cumulatively year-to-date
- **CSP**: Club Success Plan submission requirement
- **Monthly_DCP_Checkpoint**: The minimum DCP goals a club should have achieved by a given month
- **Growth_Override**: Exception rule allowing clubs with 3+ net growth since July to meet membership requirement
- **Admin_Checkpoint**: Special July evaluation using officer list submission or training status

## Requirements

### Requirement 1: Health Status Classification

**User Story:** As a district leader, I want clubs classified by health status based on monthly DCP checkpoints, so that I can identify clubs falling behind their Distinguished Club Program journey.

#### Acceptance Criteria

1. WHEN club data is processed, THE AnalyticsEngine SHALL determine health status using membership, DCP checkpoint progress, and CSP submission
2. WHEN membership is below 12 AND net growth since July is less than 3, THE AnalyticsEngine SHALL assign "Intervention Required" status regardless of other criteria
3. WHEN membership is 20+ OR net growth since July is 3+, THE AnalyticsEngine SHALL consider the membership requirement met
4. WHEN all requirements are met (membership, DCP checkpoint, CSP), THE AnalyticsEngine SHALL assign "Thriving" status
5. WHEN some but not all requirements are met, THE AnalyticsEngine SHALL assign "Vulnerable" status
6. FOR ALL club evaluations, THE AnalyticsEngine SHALL provide a list of reasons explaining the assigned classification

### Requirement 2: Monthly DCP Checkpoint Thresholds

**User Story:** As a club performance analyst, I want DCP progress evaluated against monthly thresholds, so that clubs receive timely feedback on their Distinguished Club Program journey.

#### Acceptance Criteria

1. WHEN evaluating August or September, THE AnalyticsEngine SHALL require 1+ DCP goals achieved year-to-date
2. WHEN evaluating October or November, THE AnalyticsEngine SHALL require 2+ DCP goals achieved year-to-date
3. WHEN evaluating December or January, THE AnalyticsEngine SHALL require 3+ DCP goals achieved year-to-date
4. WHEN evaluating February or March, THE AnalyticsEngine SHALL require 4+ DCP goals achieved year-to-date
5. WHEN evaluating April, May, or June, THE AnalyticsEngine SHALL require 5+ DCP goals achieved year-to-date
6. WHEN evaluating July, THE AnalyticsEngine SHALL use administrative checkpoint (officer list submitted OR officers trained)

### Requirement 3: API and Type Updates

**User Story:** As a frontend developer, I want the API and types to use the new terminology, so that the codebase is consistent and clear.

#### Acceptance Criteria

1. WHEN returning club health data, THE AnalyticsEngine SHALL use new status values: "thriving", "vulnerable", "intervention-required"
2. WHEN generating district analytics, THE AnalyticsEngine SHALL provide thrivingClubs, vulnerableClubs, and interventionRequiredClubs arrays
3. THE ClubTrend type SHALL update currentStatus to use the new status values
4. WHEN calculating year-over-year metrics, THE AnalyticsEngine SHALL use the new classification logic consistently

### Requirement 6: Frontend Terminology Updates

**User Story:** As a district leader, I want the UI to display the new health terminology, so that I understand the classification system being used.

#### Acceptance Criteria

1. WHEN displaying club status, THE Frontend SHALL show "Thriving", "Vulnerable", or "Intervention Required" labels
2. THE AtRiskClubsPanel component SHALL be renamed to VulnerableClubsPanel with updated labels
3. THE CriticalClubsPanel component SHALL be renamed to InterventionRequiredClubsPanel with updated labels
4. THE ClubsTable component SHALL display new status labels and use appropriate styling
5. THE YearOverYearComparison component SHALL use "Thriving Clubs" instead of "Healthy Clubs"
6. THE DistrictDetailPage SHALL use the renamed panel components and updated terminology

### Requirement 4: Classification Reasoning

**User Story:** As a club mentor, I want to understand why a club received its classification, so that I can provide targeted guidance for improvement.

#### Acceptance Criteria

1. WHEN a club is classified, THE AnalyticsEngine SHALL populate the riskFactors array with specific reasons
2. WHEN membership requirement is not met, THE AnalyticsEngine SHALL include "Membership below threshold" in reasons
3. WHEN DCP checkpoint is not met, THE AnalyticsEngine SHALL include the specific checkpoint requirement in reasons
4. WHEN CSP is not submitted, THE AnalyticsEngine SHALL include "CSP not submitted" in reasons
5. WHEN a club is Thriving, THE AnalyticsEngine SHALL indicate all requirements are met

### Requirement 5: Data Requirements

**User Story:** As a system administrator, I want the classification to use available data fields, so that no new data collection is required.

#### Acceptance Criteria

1. WHEN evaluating membership, THE AnalyticsEngine SHALL use the existing "Active Members" or equivalent field
2. WHEN evaluating DCP goals, THE AnalyticsEngine SHALL use the existing "Goals Met" field
3. WHEN evaluating net growth, THE AnalyticsEngine SHALL calculate from "Active Members" minus "Mem. Base"
4. WHEN evaluating data from the 2025-2026 program year or later, THE AnalyticsEngine SHALL use the CSP field which is guaranteed to be present
5. WHEN evaluating data from prior program years (before 2025-2026), THE AnalyticsEngine SHALL treat CSP as submitted since the field did not exist
6. WHEN officer training data is unavailable for July checkpoint, THE AnalyticsEngine SHALL use DCP goals as fallback
