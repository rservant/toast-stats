# Design Document

## Overview

This design addresses the bug in DCP goal counting logic within the AnalyticsEngine service. The core issue is that Goals 5 and 6 (and similarly Goals 3 and 8) are not being counted correctly because the code doesn't properly validate that prerequisite goals are achieved before counting "additional" goals. Additionally, the code must handle three different CSV column naming conventions used across different program years (2019 and earlier, 2020-2024, and 2025+).

## Architecture

### Current Architecture

The AnalyticsEngine service (`backend/src/services/AnalyticsEngine.ts`) contains a method `analyzeDCPGoals()` that:
1. Iterates through all clubs in a district cache entry
2. Checks each club's achievement of the 10 DCP goals
3. Counts how many clubs achieved each goal
4. Returns analysis with most/least commonly achieved goals

### Proposed Changes

The fix will be isolated to the `analyzeDCPGoals()` method with the following changes:

1. **Add helper method for field name resolution** - Create a method to get the correct field name based on the data structure
2. **Fix Goal 5 and 6 logic** - Properly check prerequisite goals before counting additional goals
3. **Fix Goal 3 and 8 logic** - Apply the same pattern to other "additional" goals
4. **Add comprehensive unit tests** - Ensure all 10 goals are tested with various scenarios

## Components and Interfaces

### 1. Field Name Resolution Helper

```typescript
/**
 * Get the appropriate field name for Level 4/Path Completion/DTM awards
 * based on the data structure (handles different program year formats)
 */
private getLevel4FieldName(club: any): {
  baseField: string;
  additionalField: string;
} {
  // Check for 2025+ format (Path Completions)
  if ('Level 4s, Path Completions, or DTM Awards' in club) {
    return {
      baseField: 'Level 4s, Path Completions, or DTM Awards',
      additionalField: 'Add. Level 4s, Path Completions, or DTM award'
    };
  }
  
  // Check for 2020-2024 format (Level 5s)
  if ('Level 4s, Level 5s, or DTM award' in club) {
    return {
      baseField: 'Level 4s, Level 5s, or DTM award',
      additionalField: 'Add. Level 4s, Level 5s, or DTM award'
    };
  }
  
  // Check for 2019 and earlier format (CL/AL/DTMs)
  if ('CL/AL/DTMs' in club) {
    return {
      baseField: 'CL/AL/DTMs',
      additionalField: 'Add. CL/AL/DTMs'
    };
  }
  
  // Fallback to 2025+ format if no match
  return {
    baseField: 'Level 4s, Path Completions, or DTM Awards',
    additionalField: 'Add. Level 4s, Path Completions, or DTM award'
  };
}
```

### 2. Updated analyzeDCPGoals Method

The method will be refactored to:

```typescript
private analyzeDCPGoals(entry: DistrictCacheEntry): {
  mostCommonlyAchieved: DCPGoalAnalysis[]
  leastCommonlyAchieved: DCPGoalAnalysis[]
} {
  const goalCounts = new Array(10).fill(0)
  const totalClubs = entry.clubPerformance.length

  for (const club of entry.clubPerformance) {
    // Goal 1: Level 1 awards (need 4)
    const level1s = parseInt(club['Level 1s'] || '0')
    if (level1s >= 4) goalCounts[0]++

    // Goal 2: Level 2 awards (need 2)
    const level2s = parseInt(club['Level 2s'] || '0')
    if (level2s >= 2) goalCounts[1]++

    // Goal 3: More Level 2 awards (need 2 base + 2 additional = 4 total)
    const addLevel2s = parseInt(club['Add. Level 2s'] || '0')
    if (level2s >= 2 && addLevel2s >= 2) goalCounts[2]++

    // Goal 4: Level 3 awards (need 2)
    const level3s = parseInt(club['Level 3s'] || '0')
    if (level3s >= 2) goalCounts[3]++

    // Goal 5 & 6: Level 4/Path Completion/DTM awards
    const { baseField, additionalField } = this.getLevel4FieldName(club)
    const level4s = parseInt(club[baseField] || '0')
    const addLevel4s = parseInt(club[additionalField] || '0')
    
    // Goal 5: Need 1 Level 4 award
    if (level4s >= 1) goalCounts[4]++
    
    // Goal 6: Need 1 base + 1 additional = 2 total
    if (level4s >= 1 && addLevel4s >= 1) goalCounts[5]++

    // Goal 7: New members (need 4)
    const newMembers = parseInt(club['New Members'] || '0')
    if (newMembers >= 4) goalCounts[6]++

    // Goal 8: More new members (need 4 base + 4 additional = 8 total)
    const addNewMembers = parseInt(club['Add. New Members'] || '0')
    if (newMembers >= 4 && addNewMembers >= 4) goalCounts[7]++

    // Goal 9: Club officer roles trained (need 4 in Round 1 and 4 in Round 2)
    const trainedRound1 = parseInt(club['Off. Trained Round 1'] || '0')
    const trainedRound2 = parseInt(club['Off. Trained Round 2'] || '0')
    if (trainedRound1 >= 4 && trainedRound2 >= 4) goalCounts[8]++

    // Goal 10: Membership-renewal dues on time & Club officer list on time
    const duesOct = parseInt(club['Mem. dues on time Oct'] || '0')
    const duesApr = parseInt(club['Mem. dues on time Apr'] || '0')
    const officerList = parseInt(club['Off. List On Time'] || '0')
    if (officerList >= 1 && (duesOct >= 1 || duesApr >= 1)) goalCounts[9]++
  }

  // Create analysis for each goal
  const goalAnalysis: DCPGoalAnalysis[] = goalCounts.map((count, index) => ({
    goalNumber: index + 1,
    achievementCount: count,
    achievementPercentage: totalClubs > 0
      ? Math.round((count / totalClubs) * 1000) / 10
      : 0,
  }))

  // Sort by achievement count
  const sortedByCount = [...goalAnalysis].sort(
    (a, b) => b.achievementCount - a.achievementCount
  )

  return {
    mostCommonlyAchieved: sortedByCount.slice(0, 5),
    leastCommonlyAchieved: sortedByCount.slice(-5).reverse(),
  }
}
```

## Data Models

No changes to existing data models are required. The fix operates on existing types:

- `DistrictCacheEntry` - Contains club performance data
- `DCPGoalAnalysis` - Contains goal achievement statistics
- `DistinguishedClubAnalytics` - Contains the DCP goal analysis results

## Error Handling

### Field Name Resolution
- If none of the expected field names are found, fall back to the most recent format (2025+)
- Log a warning if fallback is used to help identify data structure issues
- Use `|| '0'` pattern to handle missing or null field values

### Data Validation
- Use `parseInt()` with fallback to '0' for all numeric fields
- Handle `NaN` results from parseInt by treating as 0
- No exceptions should be thrown - gracefully handle all data variations

## Testing Strategy

### Unit Tests

Create comprehensive unit tests in `backend/src/services/__tests__/AnalyticsEngine.test.ts`:

#### Test Suite 1: Field Name Resolution
```typescript
describe('getLevel4FieldName', () => {
  it('should return 2025+ field names when Path Completions field exists', () => {
    const club = { 'Level 4s, Path Completions, or DTM Awards': '1' }
    const result = engine['getLevel4FieldName'](club)
    expect(result.baseField).toBe('Level 4s, Path Completions, or DTM Awards')
  })

  it('should return 2020-2024 field names when Level 5s field exists', () => {
    const club = { 'Level 4s, Level 5s, or DTM award': '1' }
    const result = engine['getLevel4FieldName'](club)
    expect(result.baseField).toBe('Level 4s, Level 5s, or DTM award')
  })

  it('should return 2019 field names when CL/AL/DTMs field exists', () => {
    const club = { 'CL/AL/DTMs': '1' }
    const result = engine['getLevel4FieldName'](club)
    expect(result.baseField).toBe('CL/AL/DTMs')
  })
})
```

#### Test Suite 2: Goal 5 Counting
```typescript
describe('analyzeDCPGoals - Goal 5', () => {
  it('should count Goal 5 when club has 1 Level 4 award (2025 format)', () => {
    const entry = createMockEntry([
      { 'Level 4s, Path Completions, or DTM Awards': '1' }
    ])
    const result = engine['analyzeDCPGoals'](entry)
    const goal5 = result.mostCommonlyAchieved.find(g => g.goalNumber === 5)
    expect(goal5?.achievementCount).toBe(1)
  })

  it('should count Goal 5 when club has 2+ Level 4 awards', () => {
    const entry = createMockEntry([
      { 'Level 4s, Path Completions, or DTM Awards': '3' }
    ])
    const result = engine['analyzeDCPGoals'](entry)
    const goal5 = result.mostCommonlyAchieved.find(g => g.goalNumber === 5)
    expect(goal5?.achievementCount).toBe(1)
  })

  it('should not count Goal 5 when club has 0 Level 4 awards', () => {
    const entry = createMockEntry([
      { 'Level 4s, Path Completions, or DTM Awards': '0' }
    ])
    const result = engine['analyzeDCPGoals'](entry)
    const goal5 = result.leastCommonlyAchieved.find(g => g.goalNumber === 5)
    expect(goal5?.achievementCount).toBe(0)
  })
})
```

#### Test Suite 3: Goal 6 Counting
```typescript
describe('analyzeDCPGoals - Goal 6', () => {
  it('should count Goal 6 when club has both base and additional Level 4 awards', () => {
    const entry = createMockEntry([
      {
        'Level 4s, Path Completions, or DTM Awards': '1',
        'Add. Level 4s, Path Completions, or DTM award': '1'
      }
    ])
    const result = engine['analyzeDCPGoals'](entry)
    const goal6 = result.mostCommonlyAchieved.find(g => g.goalNumber === 6)
    expect(goal6?.achievementCount).toBe(1)
  })

  it('should not count Goal 6 when club has base but no additional Level 4 awards', () => {
    const entry = createMockEntry([
      {
        'Level 4s, Path Completions, or DTM Awards': '1',
        'Add. Level 4s, Path Completions, or DTM award': '0'
      }
    ])
    const result = engine['analyzeDCPGoals'](entry)
    const goal6 = result.leastCommonlyAchieved.find(g => g.goalNumber === 6)
    expect(goal6?.achievementCount).toBe(0)
  })

  it('should not count Goal 6 when club has additional but no base Level 4 awards', () => {
    const entry = createMockEntry([
      {
        'Level 4s, Path Completions, or DTM Awards': '0',
        'Add. Level 4s, Path Completions, or DTM award': '1'
      }
    ])
    const result = engine['analyzeDCPGoals'](entry)
    const goal6 = result.leastCommonlyAchieved.find(g => g.goalNumber === 6)
    expect(goal6?.achievementCount).toBe(0)
  })
})
```

#### Test Suite 4: Goals 3 and 8 (Similar Pattern)
```typescript
describe('analyzeDCPGoals - Goals 3 and 8', () => {
  it('should count Goal 3 only when both base and additional Level 2s are met', () => {
    const entry = createMockEntry([
      { 'Level 2s': '2', 'Add. Level 2s': '2' }
    ])
    const result = engine['analyzeDCPGoals'](entry)
    const goal3 = result.mostCommonlyAchieved.find(g => g.goalNumber === 3)
    expect(goal3?.achievementCount).toBe(1)
  })

  it('should count Goal 8 only when both base and additional New Members are met', () => {
    const entry = createMockEntry([
      { 'New Members': '4', 'Add. New Members': '4' }
    ])
    const result = engine['analyzeDCPGoals'](entry)
    const goal8 = result.mostCommonlyAchieved.find(g => g.goalNumber === 8)
    expect(goal8?.achievementCount).toBe(1)
  })
})
```

#### Test Suite 5: Integration with Real Data
```typescript
describe('analyzeDCPGoals - Real Data Validation', () => {
  it('should return non-zero counts for Goals 5 and 6 with November 2024 data', async () => {
    const entry = await cacheManager.getDistrictData('61', '2024-11-22')
    const result = engine['analyzeDCPGoals'](entry!)
    
    const goal5 = result.mostCommonlyAchieved.find(g => g.goalNumber === 5)
    const goal6 = result.mostCommonlyAchieved.find(g => g.goalNumber === 6)
    
    expect(goal5?.achievementCount).toBeGreaterThan(0)
    expect(goal6?.achievementCount).toBeGreaterThan(0)
  })
})
```

### Manual Testing

1. **Test with current data (2025)**
   - Load district data from November 2025
   - Verify Goals 5 and 6 show non-zero counts
   - Compare counts to manual CSV inspection

2. **Test with 2020-2024 data**
   - Load district data from November 2023
   - Verify Goals 5 and 6 use "Level 5s" field names
   - Verify accurate counts

3. **Test with 2019 data**
   - Load district data from November 2019
   - Verify Goals 5 and 6 use "CL/AL/DTMs" field names
   - Verify accurate counts

4. **Test frontend display**
   - Navigate to analytics page
   - Select 2024-2025 program year
   - Verify DCP goal chart shows non-zero values for Goals 5 and 6

## Implementation Notes

### Code Location
- File: `backend/src/services/AnalyticsEngine.ts`
- Method: `analyzeDCPGoals()` (lines ~1640-1710)
- New helper method: `getLevel4FieldName()` (add before `analyzeDCPGoals`)

### Backward Compatibility
- The fix maintains backward compatibility with all historical data
- No changes to API contracts or data structures
- Existing tests should continue to pass (if any exist)

### Performance Considerations
- The field name resolution adds minimal overhead (simple object property checks)
- No additional loops or data processing required
- Performance impact is negligible

### Logging
Add debug logging to help troubleshoot field name resolution:

```typescript
logger.debug('Resolved Level 4 field names', {
  baseField: fieldNames.baseField,
  additionalField: fieldNames.additionalField,
  clubId: club['Club Number']
})
```

## Deployment Considerations

### Risk Assessment
- **Low Risk**: Changes are isolated to a single method
- **High Impact**: Fixes a visible bug affecting analytics accuracy
- **No Database Changes**: Only code logic changes

### Rollback Plan
- If issues arise, revert the single commit containing the fix
- No data migration or cleanup required

### Monitoring
- Monitor API response times for `/api/districts/:id/analytics` endpoint
- Check error logs for any field name resolution warnings
- Verify analytics page loads successfully after deployment

## Future Enhancements

1. **Centralized Field Name Mapping**
   - Create a configuration file mapping program years to field names
   - Makes it easier to handle future naming changes

2. **Data Structure Validation**
   - Add validation to detect and log unexpected data structures
   - Help identify when Toastmasters changes their export format

3. **Performance Optimization**
   - Cache field name resolution results per entry
   - Avoid repeated property checks for each club
