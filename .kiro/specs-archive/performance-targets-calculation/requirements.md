# Requirements Document

## Introduction

This document specifies the requirements for fixing two bugs in the District Overview page:

1. **"Targets: N/A" Bug**: All three metric cards (Paid Clubs, Membership Payments, Distinguished Clubs) display "Targets: N/A" instead of actual recognition level targets
2. **"+0 members" Bug**: The membership change badge shows "+0 members" when it should show actual membership change

The root cause is that the `PerformanceTargetsData` type in analytics-core computes rankings but does NOT compute base values, recognition level targets, or achieved recognition levels. The backend transformation sets these to `null` because the data is not available.

## Glossary

- **Analytics_Core**: The shared analytics computation package (`packages/analytics-core`) that pre-computes all analytics data
- **Performance_Targets_Data**: The data structure containing performance metrics, targets, and rankings for district overview cards
- **Recognition_Level**: Achievement tiers for district performance (Distinguished, Select, President's, Smedley)
- **Recognition_Targets**: Calculated threshold values for each recognition level
- **Club_Base**: The baseline club count from "Paid Club Base" CSV column, used for growth calculations
- **Payment_Base**: The baseline payment count from "Payment Base" CSV column, used for growth calculations
- **All_Districts_Rankings**: Pre-computed rankings data containing base values for all districts
- **Backend_Transformation**: The utility that transforms analytics-core data to frontend format
- **Membership_Change**: The net change in membership payments from program year start to current date

## Requirements

### Requirement 1: Extract Base Values from All-Districts Rankings

**User Story:** As a district leader, I want to see accurate base values for my district, so that I can understand the starting point for growth calculations.

#### Acceptance Criteria

1. WHEN computing performance targets, THE Analytics_Core SHALL extract `paidClubBase` from the All_Districts_Rankings data for the district
2. WHEN computing performance targets, THE Analytics_Core SHALL extract `paymentBase` from the All_Districts_Rankings data for the district
3. IF All_Districts_Rankings data is not available, THEN THE Analytics_Core SHALL set base values to null
4. THE Performance_Targets_Data type SHALL include `paidClubBase` and `paymentBase` fields

### Requirement 2: Calculate Paid Clubs Recognition Targets

**User Story:** As a district leader, I want to see the paid clubs targets for each recognition level, so that I can track progress toward district recognition.

#### Acceptance Criteria

1. WHEN Club_Base is available, THE Analytics_Core SHALL calculate Distinguished target as Club_Base + 1% of Club_Base, rounded up
2. WHEN Club_Base is available, THE Analytics_Core SHALL calculate Select target as Club_Base + 3% of Club_Base, rounded up
3. WHEN Club_Base is available, THE Analytics_Core SHALL calculate President's target as Club_Base + 5% of Club_Base, rounded up
4. WHEN Club_Base is available, THE Analytics_Core SHALL calculate Smedley target as Club_Base + 8% of Club_Base, rounded up
5. IF Club_Base is not available, THEN THE Analytics_Core SHALL set paid clubs targets to null
6. THE Analytics_Core SHALL always use ceiling function for rounding fractional results

### Requirement 3: Calculate Membership Payments Recognition Targets

**User Story:** As a district leader, I want to see the membership payments targets for each recognition level, so that I can track payment progress toward district recognition.

#### Acceptance Criteria

1. WHEN Payment_Base is available, THE Analytics_Core SHALL calculate Distinguished target as Payment_Base + 1% of Payment_Base, rounded up
2. WHEN Payment_Base is available, THE Analytics_Core SHALL calculate Select target as Payment_Base + 3% of Payment_Base, rounded up
3. WHEN Payment_Base is available, THE Analytics_Core SHALL calculate President's target as Payment_Base + 5% of Payment_Base, rounded up
4. WHEN Payment_Base is available, THE Analytics_Core SHALL calculate Smedley target as Payment_Base + 8% of Payment_Base, rounded up
5. IF Payment_Base is not available, THEN THE Analytics_Core SHALL set membership payments targets to null
6. THE Analytics_Core SHALL always use ceiling function for rounding fractional results

### Requirement 4: Calculate Distinguished Clubs Recognition Targets

**User Story:** As a district leader, I want to see the distinguished clubs targets for each recognition level, so that I can track club achievement progress toward district recognition.

#### Acceptance Criteria

1. WHEN Club_Base is available, THE Analytics_Core SHALL calculate Distinguished target as 45% of Club_Base, rounded up
2. WHEN Club_Base is available, THE Analytics_Core SHALL calculate Select target as 50% of Club_Base, rounded up
3. WHEN Club_Base is available, THE Analytics_Core SHALL calculate President's target as 55% of Club_Base, rounded up
4. WHEN Club_Base is available, THE Analytics_Core SHALL calculate Smedley target as 60% of Club_Base, rounded up
5. IF Club_Base is not available, THEN THE Analytics_Core SHALL set distinguished clubs targets to null
6. THE Analytics_Core SHALL always use ceiling function for rounding fractional results

### Requirement 5: Determine Achieved Recognition Level

**User Story:** As a district leader, I want to see which recognition level my district has achieved for each metric, so that I can celebrate progress and identify next goals.

#### Acceptance Criteria

1. WHEN current value meets or exceeds Smedley target, THE Analytics_Core SHALL set achievedLevel to "smedley"
2. WHEN current value meets or exceeds President's target but not Smedley, THE Analytics_Core SHALL set achievedLevel to "presidents"
3. WHEN current value meets or exceeds Select target but not President's, THE Analytics_Core SHALL set achievedLevel to "select"
4. WHEN current value meets or exceeds Distinguished target but not Select, THE Analytics_Core SHALL set achievedLevel to "distinguished"
5. WHEN current value is below Distinguished target, THE Analytics_Core SHALL set achievedLevel to null
6. IF targets are not available, THEN THE Analytics_Core SHALL set achievedLevel to null

### Requirement 6: Update Performance Targets Data Structure

**User Story:** As a developer, I want the PerformanceTargetsData type to include all necessary fields, so that the backend can transform and serve complete data to the frontend.

#### Acceptance Criteria

1. THE Performance_Targets_Data type SHALL include `paidClubBase` field of type number or null
2. THE Performance_Targets_Data type SHALL include `paymentBase` field of type number or null
3. THE Performance_Targets_Data type SHALL include `paidClubsTargets` field containing RecognitionTargets or null
4. THE Performance_Targets_Data type SHALL include `membershipPaymentsTargets` field containing RecognitionTargets or null
5. THE Performance_Targets_Data type SHALL include `distinguishedClubsTargets` field containing RecognitionTargets or null
6. THE Performance_Targets_Data type SHALL include `paidClubsAchievedLevel` field of type RecognitionLevel or null
7. THE Performance_Targets_Data type SHALL include `membershipPaymentsAchievedLevel` field of type RecognitionLevel or null
8. THE Performance_Targets_Data type SHALL include `distinguishedClubsAchievedLevel` field of type RecognitionLevel or null

### Requirement 7: Update Backend Transformation

**User Story:** As a developer, I want the backend transformation to correctly map the new fields, so that the frontend receives complete performance targets data.

#### Acceptance Criteria

1. THE Backend_Transformation SHALL map `paidClubBase` to `paidClubs.base`
2. THE Backend_Transformation SHALL map `paymentBase` to `membershipPayments.base`
3. THE Backend_Transformation SHALL map `paidClubBase` to `distinguishedClubs.base` (distinguished clubs use Club_Base)
4. THE Backend_Transformation SHALL map `paidClubsTargets` to `paidClubs.targets`
5. THE Backend_Transformation SHALL map `membershipPaymentsTargets` to `membershipPayments.targets`
6. THE Backend_Transformation SHALL map `distinguishedClubsTargets` to `distinguishedClubs.targets`
7. THE Backend_Transformation SHALL map `paidClubsAchievedLevel` to `paidClubs.achievedLevel`
8. THE Backend_Transformation SHALL map `membershipPaymentsAchievedLevel` to `membershipPayments.achievedLevel`
9. THE Backend_Transformation SHALL map `distinguishedClubsAchievedLevel` to `distinguishedClubs.achievedLevel`

### Requirement 8: Fix Membership Change Calculation

**User Story:** As a district leader, I want to see the actual membership change value, so that I can track membership growth or decline.

#### Acceptance Criteria

1. THE Analytics_Core SHALL calculate membershipChange as the difference between current total payments and Payment_Base
2. WHEN Payment_Base is available from All_Districts_Rankings, THE Analytics_Core SHALL use it for membershipChange calculation
3. IF Payment_Base is not available, THE Analytics_Core SHALL calculate membershipChange from snapshot history
4. THE membershipChange value SHALL be included in the district analytics response
