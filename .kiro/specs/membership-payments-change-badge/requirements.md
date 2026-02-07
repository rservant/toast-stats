# Requirements Document

## Introduction

The Membership Payments card on the District Overview page always displays "+0 members" regardless of district or date. The root cause is in `AnalyticsComputer.calculateMembershipChangeWithBase()`: when the rankings-based lookup fails (rankings not loaded, district not found, or districtId format mismatch), the fallback `MembershipAnalyticsModule.calculateMembershipChange()` returns 0 because only a single snapshot is passed by `AnalyticsComputeService`. Meanwhile, the Trends tab correctly computes net change from time-series data client-side.

A previous spec (`performance-targets-calculation`, Requirement 8) attempted to fix this but the bug persists because the rankings lookup silently fails and the single-snapshot fallback always yields 0.

## Glossary

- **Analytics_Computer**: The class in `packages/analytics-core` that orchestrates all district analytics computation (`AnalyticsComputer`)
- **Membership_Analytics_Module**: The module in `packages/analytics-core` that handles membership-specific calculations (`MembershipAnalyticsModule`)
- **Analytics_Compute_Service**: The scraper-cli service that invokes Analytics_Computer with snapshot data (`AnalyticsComputeService`)
- **All_Districts_Rankings**: Pre-computed rankings data containing `paymentBase` and `totalPayments` per district
- **Payment_Base**: The baseline payment count from the rankings data, representing program year start
- **Membership_Change**: The computed value `totalPayments - paymentBase` representing membership payment growth
- **District_Overview**: The frontend component displaying the membership payments card with the change badge

## Requirements

### Requirement 1: Diagnose Rankings Lookup Failure

**User Story:** As a developer, I want the analytics computation to log diagnostic information when the rankings-based membership change calculation fails, so that I can identify why the fallback path is triggered.

#### Acceptance Criteria

1. WHEN `calculateMembershipChangeWithBase` cannot find the district in All_Districts_Rankings, THE Analytics_Computer SHALL log a warning including the districtId sought and the list of available districtIds in the rankings
2. WHEN All_Districts_Rankings data is undefined, THE Analytics_Computer SHALL log a warning indicating that rankings data was not provided
3. WHEN `paymentBase` is null or undefined for a matched district, THE Analytics_Computer SHALL log a warning indicating that paymentBase is missing for that district

### Requirement 2: Robust Membership Change Calculation

**User Story:** As a district leader, I want the membership payments change badge to show the correct value, so that I can track membership payment growth on the District Overview page.

#### Acceptance Criteria

1. WHEN Payment_Base is available from All_Districts_Rankings and the district is found, THE Analytics_Computer SHALL calculate Membership_Change as `totalPayments - paymentBase`
2. WHEN the district is not found in All_Districts_Rankings by exact match, THE Analytics_Computer SHALL attempt a normalized lookup by stripping non-numeric characters from both the search districtId and the rankings districtIds
3. WHEN Payment_Base is not available after all lookup attempts, THE Analytics_Computer SHALL calculate Membership_Change from the single snapshot's `totalPayments` minus `membershipBase` sum (the per-club base values)
4. THE Analytics_Computer SHALL use `totalPayments` from the rankings data when the district is found, falling back to snapshot-derived `totalPayments` only when rankings are unavailable

### Requirement 3: Unit Test Coverage for Membership Change Paths

**User Story:** As a developer, I want comprehensive test coverage for all membership change calculation paths, so that regressions are caught immediately.

#### Acceptance Criteria

1. THE test suite SHALL verify that Membership_Change is correctly computed when All_Districts_Rankings contains the district with valid `paymentBase` and `totalPayments`
2. THE test suite SHALL verify that Membership_Change is correctly computed via normalized districtId lookup when exact match fails
3. THE test suite SHALL verify that Membership_Change falls back to snapshot-based calculation when rankings are unavailable
4. THE test suite SHALL verify that Membership_Change is 0 when both rankings and snapshot-based fallback yield no meaningful data
