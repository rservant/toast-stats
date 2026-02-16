# Requirements Document

## Introduction

This spec addresses two distinct bugs on the Membership Payments card change badge in the District Overview page.

**Bug 1 (Resolved):** The badge always displayed "+0 members" regardless of district or date. The root cause was in `AnalyticsComputer.calculateMembershipChangeWithBase()`: when the rankings-based lookup failed (rankings not loaded, district not found, or districtId format mismatch), the fallback `MembershipAnalyticsModule.calculateMembershipChange()` returned 0 because only a single snapshot was passed by `AnalyticsComputeService`. This was fixed by Requirements 1–3 below.

**Bug 2 (Current):** The badge displays a payment-based change value (computed from `totalPayments - paymentBase`) but labels it as "members". In Toastmasters, payments and members are different metrics — a district can have 5,000 members but only 4,084 payments. The badge text says "+/- X members" but the number reflects payment change, not actual member count change. The badge should report the change in actual member count, not the change in payments.

## Glossary

- **Analytics_Computer**: The class in `packages/analytics-core` that orchestrates all district analytics computation (`AnalyticsComputer`)
- **Membership_Analytics_Module**: The module in `packages/analytics-core` that handles membership-specific calculations (`MembershipAnalyticsModule`)
- **Analytics_Compute_Service**: The scraper-cli service that invokes Analytics_Computer with snapshot data (`AnalyticsComputeService`)
- **All_Districts_Rankings**: Pre-computed rankings data containing `paymentBase` and `totalPayments` per district
- **Payment_Base**: The baseline payment count from the rankings data, representing program year start
- **Payment_Change**: The computed value `totalPayments - paymentBase` representing membership payment growth (previously named Membership_Change)
- **Member_Count_Change**: The change in actual member count (`totalMembership`) between the current snapshot and a baseline, representing real membership growth or decline
- **Total_Membership**: The sum of `membershipCount` across all clubs in a snapshot, representing the actual number of members in the district
- **District_Overview**: The frontend component displaying the membership payments card with the change badge
- **District_Analytics**: The data model produced by Analytics_Computer containing all computed analytics for a district
- **PreComputed_Analytics_Summary**: The backend type representing the pre-computed analytics summary served to the frontend

## Requirements

### Requirement 1: Diagnose Rankings Lookup Failure (Resolved)

**User Story:** As a developer, I want the analytics computation to log diagnostic information when the rankings-based membership change calculation fails, so that I can identify why the fallback path is triggered.

#### Acceptance Criteria

1. WHEN `calculateMembershipChangeWithBase` cannot find the district in All_Districts_Rankings, THE Analytics_Computer SHALL log a warning including the districtId sought and the list of available districtIds in the rankings
2. WHEN All_Districts_Rankings data is undefined, THE Analytics_Computer SHALL log a warning indicating that rankings data was not provided
3. WHEN `paymentBase` is null or undefined for a matched district, THE Analytics_Computer SHALL log a warning indicating that paymentBase is missing for that district

### Requirement 2: Robust Payment Change Calculation (Resolved)

**User Story:** As a district leader, I want the membership payments change badge to show the correct value, so that I can track membership payment growth on the District Overview page.

#### Acceptance Criteria

1. WHEN Payment_Base is available from All_Districts_Rankings and the district is found, THE Analytics_Computer SHALL calculate Payment_Change as `totalPayments - paymentBase`
2. WHEN the district is not found in All_Districts_Rankings by exact match, THE Analytics_Computer SHALL attempt a normalized lookup by stripping non-numeric characters from both the search districtId and the rankings districtIds
3. WHEN Payment_Base is not available after all lookup attempts, THE Analytics_Computer SHALL calculate Payment_Change from the single snapshot's `totalPayments` minus `membershipBase` sum (the per-club base values)
4. THE Analytics_Computer SHALL use `totalPayments` from the rankings data when the district is found, falling back to snapshot-derived `totalPayments` only when rankings are unavailable

### Requirement 3: Unit Test Coverage for Payment Change Paths (Resolved)

**User Story:** As a developer, I want comprehensive test coverage for all membership change calculation paths, so that regressions are caught immediately.

#### Acceptance Criteria

1. THE test suite SHALL verify that Payment_Change is correctly computed when All_Districts_Rankings contains the district with valid `paymentBase` and `totalPayments`
2. THE test suite SHALL verify that Payment_Change is correctly computed via normalized districtId lookup when exact match fails
3. THE test suite SHALL verify that Payment_Change falls back to snapshot-based calculation when rankings are unavailable
4. THE test suite SHALL verify that Payment_Change is 0 when both rankings and snapshot-based fallback yield no meaningful data

### Requirement 4: Badge Displays Actual Member Count Change

**User Story:** As a district leader, I want the Membership Payments card badge to show the change in actual member count, so that I can understand real membership growth or decline at a glance.

#### Acceptance Criteria

1. THE District_Analytics data model SHALL include a `memberCountChange` field representing the difference in Total_Membership between the current snapshot and the earliest available snapshot
2. WHEN multiple snapshots are available, THE Analytics_Computer SHALL calculate Member_Count_Change as the difference between Total_Membership of the last snapshot and Total_Membership of the first snapshot
3. WHEN only a single snapshot is available, THE Analytics_Computer SHALL set Member_Count_Change to 0
4. THE District_Overview badge SHALL display the Member_Count_Change value with the label "members"
5. THE `membershipChange` field in District_Analytics SHALL continue to hold the Payment_Change value for backward compatibility

### Requirement 5: Data Pipeline Propagation of Member Count Change

**User Story:** As a developer, I want the member count change to flow through the pre-computed analytics pipeline, so that the backend serves the correct value without on-demand computation.

#### Acceptance Criteria

1. THE PreComputed_Analytics_Summary interface SHALL include a `memberCountChange` field of type number
2. WHEN the scraper-cli pipeline computes analytics, THE Analytics_Compute_Service SHALL include `memberCountChange` in the pre-computed analytics output
3. WHEN the backend serves analytics data, THE backend SHALL include `memberCountChange` in the response without performing any computation
4. THE shared contracts SHALL define the `memberCountChange` field so that both scraper-cli and backend use the same type definition

### Requirement 6: Test Coverage for Member Count Change

**User Story:** As a developer, I want test coverage for the member count change calculation and display, so that regressions are caught immediately.

#### Acceptance Criteria

1. THE test suite SHALL verify that Member_Count_Change equals the difference in Total_Membership between the last and first snapshots when multiple snapshots are provided
2. THE test suite SHALL verify that Member_Count_Change is 0 when only a single snapshot is provided
3. THE test suite SHALL verify that the frontend badge displays the Member_Count_Change value with the "members" label
