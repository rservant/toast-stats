# Design Document

## Overview

This design addresses the bug in the `calculateDistinguishedClubs` method within the AnalyticsEngine service. The current implementation incorrectly classifies clubs as "Distinguished" or "Select Distinguished" because it only checks membership count and DCP goals, ignoring the net growth requirements for clubs with fewer than 20 members. The method has comments indicating it needs historical data for net growth, but the required data is already available in the "Mem. Base" field.

The fix will implement the correct Distinguished Club Program (DCP) logic:

- **Distinguished**: 5+ goals + (20+ members OR 3+ net growth)
- **Select Distinguished**: 7+ goals + (20+ members OR 5+ net growth)
- **President's Distinguished**: 9+ goals + 20+ members (no net growth requirement)
- **Smedley Award**: 10 goals + 25+ members (no net growth requirement)

## Architecture

### Current Architecture

The AnalyticsEngine service (`backend/src/services/AnalyticsEngine.ts`) contains the `calculateDistinguishedClubs()` method that:

1. Iterates through all clubs in a district cache entry
2. Checks each club's DCP goals and membership count
3. Classifies clubs into distinguished levels using simplified logic
4. Returns counts for each distinguished level

### Proposed Changes

The fix will be isolated to the `calculateDistinguishedClubs()` method with these changes:

1. **Add net growth calculation** - Calculate net growth as `Active Members - Mem. Base`
2. **Update Distinguished logic** - Check 20+ members OR 3+ net growth
3. **Update Select Distinguished logic** - Check 20+ members OR 5+ net growth
4. **Maintain existing logic** - President's Distinguished and Smedley Award remain unchanged
5. **Add error handling** - Handle missing or invalid "Mem. Base" values gracefully

## Components and Interfaces

### 1. Net Growth Calculation Helper

```typescript
/**
 * Calculate net growth for a club using available membership data
 */
private calculateNetGrowth(club: ScrapedRecord): number {
  const currentMembers = this.parseIntSafe(
    club['Active Members'] ||
    club['Active Membership'] ||
    club['Membership']
  )

  const membershipBase = this.parseIntSafe(club['Mem. Base'])

  return currentMembers - membershipBase
}
```

### 2. Updated calculateDistinguishedClubs Method

```typescript
private calculateDistinguishedClubs(entry: DistrictCacheEntry): {
  smedley: number
  presidents: number
  select: number
  distinguished: number
  total: number
} {
  let smedley = 0
  let presidents = 0
  let select = 0
  let distinguished = 0

  for (const club of entry.clubPerformance) {
    const dcpGoals = this.parseIntSafe(club['Goals Met'])
    const membership = this.parseIntSafe(
      club['Active Members'] ||
        club['Active Membership'] ||
        club['Membership']
    )
    const netGrowth = this.calculateNetGrowth(club)

    // Smedley Distinguished: 10 goals + 25 members (no net growth requirement)
    if (dcpGoals >= 10 && membership >= 25) {
      smedley++
    }
    // President's Distinguished: 9 goals + 20 members (no net growth requirement)
    else if (dcpGoals >= 9 && membership >= 20) {
      presidents++
    }
    // Select Distinguished: 7 goals + (20 members OR net growth of 5)
    else if (dcpGoals >= 7 && (membership >= 20 || netGrowth >= 5)) {
      select++
    }
    // Distinguished: 5 goals + (20 members OR net growth of 3)
    else if (dcpGoals >= 5 && (membership >= 20 || netGrowth >= 3)) {
      distinguished++
    }
  }

  return {
    smedley,
    presidents,
    select,
    distinguished,
    total: smedley + presidents + select + distinguished,
  }
}
```

## Data Models

No changes to existing data models are required. The fix operates on existing types:

- `DistrictCacheEntry` - Contains club performance data with "Mem. Base" field
- `ScrapedRecord` - Individual club record with membership fields
- Return type remains the same with counts for each distinguished level

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

Now I'll analyze the acceptance criteria to determine which ones can be tested as properties:

### Converting EARS to Properties

Based on the prework analysis, I'll create comprehensive properties that cover the core calculation logic:

**Property 1: Net Growth Calculation Consistency**
_For any_ club record with membership data, the net growth calculation should always equal the current membership count minus the membership base, with missing values treated as zero
**Validates: Requirements 1.1, 2.1**

**Property 2: Distinguished Level Classification**
_For any_ club with 5+ DCP goals, the club should be classified as "Distinguished" if and only if it has 20+ members OR 3+ net growth
**Validates: Requirements 1.2, 1.3, 1.4**

**Property 3: Select Distinguished Level Classification**
_For any_ club with 7+ DCP goals, the club should be classified as "Select Distinguished" if and only if it has 20+ members OR 5+ net growth
**Validates: Requirements 1.5, 1.6, 1.7**

**Property 4: President's Distinguished Level Classification**
_For any_ club with 9+ DCP goals and 20+ members, the club should be classified as "President's Distinguished" regardless of net growth
**Validates: Requirements 1.8**

**Property 5: Smedley Award Level Classification**
_For any_ club with 10 DCP goals and 25+ members, the club should be classified as "Smedley Award" regardless of net growth
**Validates: Requirements 1.9**

**Property 6: Membership Field Selection**
_For any_ club record, the system should use "Active Members" if available, otherwise "Active Membership", otherwise "Membership", with missing values treated as zero
**Validates: Requirements 2.2, 2.3**

**Property 7: Missing Data Handling**
_For any_ club record with missing or invalid "Mem. Base" field, the net growth should be calculated as zero and other validation criteria should still apply
**Validates: Requirements 1.10, 2.4, 2.5**

## Error Handling

### Missing Field Handling

- If "Mem. Base" field is missing, null, or invalid, treat as 0 for net growth calculation
- If membership fields are missing, use the fallback order: "Active Members" → "Active Membership" → "Membership" → 0
- If "Goals Met" field is missing, treat as 0 (club cannot be distinguished)

### Data Validation

- Use `parseIntSafe()` helper method for all numeric field parsing
- Handle `NaN` results by treating as 0
- No exceptions should be thrown - gracefully handle all data variations

### Logging

Add optional debug logging for troubleshooting:

```typescript
if (logger.isDebugEnabled()) {
  logger.debug('Distinguished status calculation', {
    clubId: club['Club Number'],
    clubName: club['Club Name'],
    dcpGoals,
    membership,
    membershipBase: this.parseIntSafe(club['Mem. Base']),
    netGrowth,
    distinguishedLevel: result,
  })
}
```

## Testing Strategy

### Unit Tests

Create comprehensive unit tests that verify the correctness properties:

#### Property-Based Tests

1. **Net Growth Calculation Property Test**
   - Generate random club data with various membership values
   - Verify net growth always equals current members minus base
   - Test with missing/invalid "Mem. Base" values
   - **Feature: distinguished-status-calculation-fix, Property 1: Net Growth Calculation Consistency**

2. **Distinguished Level Classification Property Test**
   - Generate random clubs with 5+ goals and various membership/net growth combinations
   - Verify classification follows "20+ members OR 3+ net growth" rule
   - **Feature: distinguished-status-calculation-fix, Property 2: Distinguished Level Classification**

3. **Select Distinguished Level Classification Property Test**
   - Generate random clubs with 7+ goals and various membership/net growth combinations
   - Verify classification follows "20+ members OR 5+ net growth" rule
   - **Feature: distinguished-status-calculation-fix, Property 3: Select Distinguished Level Classification**

4. **President's Distinguished Classification Property Test**
   - Generate random clubs with 9+ goals and 20+ members
   - Verify all are classified as President's Distinguished regardless of net growth
   - **Feature: distinguished-status-calculation-fix, Property 4: President's Distinguished Level Classification**

5. **Smedley Award Classification Property Test**
   - Generate random clubs with 10 goals and 25+ members
   - Verify all are classified as Smedley Award regardless of net growth
   - **Feature: distinguished-status-calculation-fix, Property 5: Smedley Award Level Classification**

6. **Membership Field Selection Property Test**
   - Generate random club data with different field name combinations
   - Verify correct field is selected according to priority order
   - **Feature: distinguished-status-calculation-fix, Property 6: Membership Field Selection**

7. **Missing Data Handling Property Test**
   - Generate random club data with missing/invalid fields
   - Verify graceful handling and zero defaults
   - **Feature: distinguished-status-calculation-fix, Property 7: Missing Data Handling**

#### Unit Tests (Specific Examples)

1. **Barrhaven Toastmasters Test Case**
   - Test the specific case: 11 members, 6 goals, negative net growth
   - Verify it's NOT classified as Distinguished
   - **Validates: Requirements 4.1**

2. **Edge Cases**
   - Test clubs with exactly 20 members and various net growth values
   - Test clubs with exactly 3 or 5 net growth and various membership counts
   - Test boundary conditions for each distinguished level

3. **Backward Compatibility**
   - Test with different membership field names
   - Test with missing "Mem. Base" field
   - Test with null/undefined values

### Integration Tests

1. **End-to-End Analytics Test**
   - Load real district data and verify distinguished counts are accurate
   - Compare results before and after the fix
   - Verify API responses contain correct distinguished club counts

2. **Performance Test**
   - Ensure the net growth calculation doesn't significantly impact performance
   - Test with large district datasets (100+ clubs)

## Implementation Notes

### Code Location

- File: `backend/src/services/AnalyticsEngine.ts`
- Method: `calculateDistinguishedClubs()` (lines ~1221-1260)
- New helper method: `calculateNetGrowth()` (add before `calculateDistinguishedClubs`)

### Backward Compatibility

- The fix maintains backward compatibility with all existing data formats
- Clubs without "Mem. Base" field will have net growth treated as 0
- No changes to API contracts or return types
- Existing distinguished clubs may be reclassified (this is the intended bug fix)

### Performance Considerations

- Net growth calculation adds minimal overhead (simple subtraction)
- No additional loops or data processing required
- Performance impact is negligible

### Migration Considerations

- No database changes required
- No data migration needed
- Results will change for some clubs (this is the intended fix)
- Frontend will automatically display corrected distinguished status

## Deployment Considerations

### Risk Assessment

- **Low Risk**: Changes are isolated to a single method
- **High Impact**: Fixes a visible bug affecting club recognition accuracy
- **Expected Changes**: Some clubs may lose distinguished status (correct behavior)

### Rollback Plan

- If issues arise, revert the single commit containing the fix
- No data cleanup required
- Distinguished status will revert to previous (buggy) behavior

### Monitoring

- Monitor API response times for analytics endpoints
- Check error logs for any field parsing issues
- Verify analytics pages load successfully after deployment
- Monitor for any user reports about distinguished status changes

### Communication

- Document that distinguished status calculations have been corrected
- Explain that some clubs may show different status (more accurate)
- Provide guidance on the correct DCP requirements for club leaders

## Future Enhancements

1. **Historical Trend Analysis**
   - Track distinguished status changes over time
   - Identify clubs that gained/lost status due to the fix

2. **Enhanced Validation**
   - Add validation warnings for clubs with unusual net growth patterns
   - Flag potential data quality issues

3. **Performance Optimization**
   - Cache net growth calculations if needed for large datasets
   - Consider pre-computing distinguished status during data ingestion
