# District-Level Data Feature Design

## Overview

This feature extends the existing Toastmasters District Visualizer to cache, backfill, and analyze district-level performance data. We'll leverage the existing collector methods (`getDistrictPerformance`, `getDivisionPerformance`, `getClubPerformance`) and build upon the proven backfill architecture to provide deep insights into club, area, and division performance over time.

## Architecture

### High-Level Flow

```
User Request → API Layer → Service Layer → Cache Layer → Collector
                    ↓
              Analytics Engine
                    ↓
            Frontend Visualization
```

### Key Components

1. **District Cache Manager** - Extends existing cache to handle district-level data
2. **District Backfill Service** - Orchestrates fetching historical district data
3. **Analytics Engine** - Processes cached data to generate insights
4. **District Detail Page** - Enhanced UI with charts and insights
5. **API Endpoints** - New routes for district data and analytics

## Components and Interfaces

### 1. District Cache Manager

Extends the existing `CacheManager` to handle three types of district data:

```typescript
interface DistrictCacheEntry {
  districtId: string
  date: string
  districtPerformance: any[] // From District.aspx
  divisionPerformance: any[] // From Division.aspx
  clubPerformance: any[] // From Club.aspx
  fetchedAt: string
}

class DistrictCacheManager {
  // Cache district data for a specific date
  async cacheDistrictData(
    districtId: string,
    date: string,
    data: DistrictCacheEntry
  ): Promise<void>

  // Get cached district data for a date
  async getDistrictData(
    districtId: string,
    date: string
  ): Promise<DistrictCacheEntry | null>

  // Get all cached dates for a district
  async getCachedDatesForDistrict(districtId: string): Promise<string[]>

  // Check if district data exists for a date
  async hasDistrictData(districtId: string, date: string): Promise<boolean>

  // Get date range of cached data
  async getDistrictDataRange(
    districtId: string
  ): Promise<{ startDate: string; endDate: string } | null>
}
```

**Storage Strategy:**

- Use file-based storage: `cache/districts/{districtId}/{YYYY-MM-DD}.json`
- Each file contains all three report types for that date
- Enables efficient date-based queries and cleanup

### 2. District Backfill Service

Orchestrates fetching historical data for a specific district:

```typescript
interface DistrictBackfillJob {
  jobId: string
  districtId: string
  startDate: string
  endDate: string
  status: 'processing' | 'complete' | 'error'
  progress: {
    total: number
    completed: number
    current: string
    skipped: number
    failed: number
    unavailable: number
  }
  error?: string
  startedAt: string
  completedAt?: string
}

class DistrictBackfillService {
  // Initiate backfill for a district
  async initiateDistrictBackfill(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ backfillId: string }>

  // Get backfill status
  async getBackfillStatus(backfillId: string): Promise<DistrictBackfillJob>

  // Cancel backfill
  async cancelBackfill(backfillId: string): Promise<void>

  // Process backfill (internal)
  private async processBackfill(job: DistrictBackfillJob): Promise<void>
}
```

**Backfill Process:**

1. Generate list of dates to fetch (skip already cached)
2. For each date:
   - Fetch district performance
   - Fetch division performance
   - Fetch club performance
   - Cache all three together
   - Update progress
3. Handle errors gracefully (log and continue)
4. Mark job complete

### 3. Analytics Engine

Processes cached data to generate insights:

```typescript
interface ClubTrend {
  clubId: string
  clubName: string
  membershipTrend: Array<{ date: string; count: number }>
  dcpGoalsTrend: Array<{ date: string; goalsAchieved: number }>
  currentStatus: 'healthy' | 'at-risk' | 'critical'
  riskFactors: string[]
  distinguishedLevel?: 'President' | 'Select' | 'Distinguished'
}

interface DivisionAnalytics {
  divisionId: string
  divisionName: string
  totalClubs: number
  totalDcpGoals: number
  averageClubHealth: number
  rank: number
  trend: 'improving' | 'stable' | 'declining'
}

interface DistrictAnalytics {
  districtId: string
  dateRange: { start: string; end: string }

  // Membership insights
  totalMembership: number
  membershipChange: number
  membershipTrend: Array<{ date: string; count: number }>
  topGrowthClubs: Array<{ clubId: string; clubName: string; growth: number }>

  // Club health
  atRiskClubs: ClubTrend[]
  healthyClubs: number
  criticalClubs: number

  // Distinguished status
  distinguishedClubs: {
    presidents: number
    select: number
    distinguished: number
    total: number
  }
  distinguishedProjection: number

  // Division/Area performance
  divisionRankings: DivisionAnalytics[]
  topPerformingAreas: Array<{ areaId: string; areaName: string; score: number }>

  // Year-over-year comparison (if data available)
  yearOverYear?: {
    membershipChange: number
    distinguishedChange: number
    clubHealthChange: number
  }
}

class AnalyticsEngine {
  // Generate comprehensive district analytics
  async generateDistrictAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistrictAnalytics>

  // Get club-specific trends
  async getClubTrends(districtId: string, clubId: string): Promise<ClubTrend>

  // Identify at-risk clubs
  async identifyAtRiskClubs(districtId: string): Promise<ClubTrend[]>

  // Compare divisions
  async compareDivisions(
    districtId: string,
    date: string
  ): Promise<DivisionAnalytics[]>

  // Calculate year-over-year metrics
  async calculateYearOverYear(
    districtId: string,
    currentDate: string
  ): Promise<any>
}
```

**Analytics Algorithms:**

1. **At-Risk Club Detection:**
   - Membership < 12: Critical
   - Membership declining 3+ months: At-risk
   - Zero DCP goals: At-risk
   - Combine factors for overall status

2. **Leadership Effectiveness Score:**
   - Average club health in division/area
   - Membership growth rate
   - DCP goal achievement rate
   - Weighted formula: `(0.4 * health) + (0.3 * growth) + (0.3 * dcp)`

3. **Trend Detection:**
   - Calculate 3-month moving average
   - Compare current to average: improving/declining
   - Use linear regression for projections

4. **Distinguished Projection:**
   - Calculate average goals per month
   - Project to end of program year
   - Estimate clubs reaching each level

### 4. API Endpoints

New routes for district-level data:

```typescript
// Get district data for a specific date
GET /api/districts/:districtId/data/:date
Response: DistrictCacheEntry

// Get cached dates for a district
GET /api/districts/:districtId/cached-dates
Response: { dates: string[] }

// Get district analytics
GET /api/districts/:districtId/analytics?startDate=&endDate=
Response: DistrictAnalytics

// Get club trends
GET /api/districts/:districtId/clubs/:clubId/trends
Response: ClubTrend

// Get at-risk clubs
GET /api/districts/:districtId/at-risk-clubs
Response: { clubs: ClubTrend[] }

// Initiate district backfill
POST /api/districts/:districtId/backfill
Body: { startDate?: string, endDate?: string }
Response: { backfillId: string }

// Get district backfill status
GET /api/districts/:districtId/backfill/:backfillId
Response: DistrictBackfillJob

// Cancel district backfill
DELETE /api/districts/:districtId/backfill/:backfillId
Response: { success: boolean }

// Export district data
GET /api/districts/:districtId/export?format=csv|pdf&startDate=&endDate=
Response: File download
```

### 5. Frontend Components

#### DistrictDetailPage (Enhanced)

```typescript
// Main district page with tabs
<DistrictDetailPage>
  <DistrictHeader districtId={id} />
  <DateSelector />
  <DistrictBackfillButton districtId={id} />

  <Tabs>
    <Tab label="Overview">
      <DistrictOverview analytics={analytics} />
      <AtRiskClubsPanel clubs={atRiskClubs} />
      <DistinguishedProgressChart data={analytics} />
    </Tab>

    <Tab label="Clubs">
      <ClubsTable clubs={clubs} />
      <ClubDetailModal club={selectedClub} />
    </Tab>

    <Tab label="Divisions & Areas">
      <DivisionRankings divisions={analytics.divisionRankings} />
      <AreaPerformanceChart areas={topAreas} />
    </Tab>

    <Tab label="Trends">
      <MembershipTrendChart data={analytics.membershipTrend} />
      <YearOverYearComparison data={analytics.yearOverYear} />
    </Tab>

    <Tab label="Analytics">
      <LeadershipInsights divisions={analytics.divisionRankings} />
      <SeasonalPatterns data={analytics.membershipTrend} />
    </Tab>
  </Tabs>
</DistrictDetailPage>
```

#### Key Visualizations

1. **Membership Trend Chart**
   - Line chart showing total district membership over time
   - Overlay with program year milestones
   - Highlight growth/decline periods

2. **Club Health Dashboard**
   - Grid of clubs with color-coded health status
   - Green: Healthy, Yellow: At-risk, Red: Critical
   - Click to see club details

3. **Distinguished Progress Gauge**
   - Circular gauge showing progress to district goals
   - Breakdown by distinguished level
   - Projection line to year-end

4. **Division Performance Heatmap**
   - Visual comparison of all divisions
   - Color intensity based on performance score
   - Hover for detailed metrics

5. **At-Risk Clubs Alert Panel**
   - Prominent display of clubs needing attention
   - Show specific risk factors
   - Quick actions (view details, export list)

6. **Club Detail Modal**
   - Membership trend line chart
   - DCP goals progress bar
   - Historical distinguished status
   - Risk factor indicators

## Data Models

### Club Performance Record

```typescript
interface ClubPerformanceRecord {
  clubId: string
  clubName: string
  divisionId: string
  divisionName: string
  areaId: string
  areaName: string

  // Membership
  activeMembership: number
  baseMembers: number

  // DCP Goals (0-10)
  goalsAchieved: number

  // Distinguished status
  distinguishedStatus?: 'President' | 'Select' | 'Distinguished'

  // Additional metrics from CSV
  [key: string]: any
}
```

### Division Performance Record

```typescript
interface DivisionPerformanceRecord {
  divisionId: string
  divisionName: string
  totalClubs: number
  totalMembers: number
  totalDcpGoals: number

  // Calculated metrics
  averageMembership: number
  averageDcpGoals: number

  // Additional metrics from CSV
  [key: string]: any
}
```

## Error Handling

### Backfill Errors

1. **Network Failures:**
   - Retry up to 3 times with exponential backoff
   - Log error and continue to next date
   - Mark date as failed in progress

2. **Date Unavailable:**
   - Mark as unavailable (blackout/reconciliation)
   - Don't retry
   - Continue to next date

3. **Parsing Errors:**
   - Log detailed error with CSV content sample
   - Mark date as failed
   - Continue to next date

4. **Cache Write Errors:**
   - Retry write operation
   - If fails, log error but don't fail entire job
   - Continue to next date

### API Errors

1. **Missing Data:**
   - Return 404 with helpful message
   - Suggest initiating backfill

2. **Invalid Date Range:**
   - Return 400 with validation error
   - Specify valid date format

3. **Analytics Calculation Errors:**
   - Return partial results if possible
   - Include error details in response
   - Log for investigation

## Testing Strategy

### Unit Tests

1. **DistrictCacheManager:**
   - Test caching all three report types
   - Test retrieval by district and date
   - Test date range queries
   - Test cache invalidation

2. **DistrictBackfillService:**
   - Test job creation and tracking
   - Test progress updates
   - Test error handling
   - Test cancellation

3. **AnalyticsEngine:**
   - Test at-risk club detection with various scenarios
   - Test trend calculations
   - Test year-over-year comparisons
   - Test projection algorithms

### Integration Tests

1. **End-to-End Backfill:**
   - Initiate backfill for test district
   - Verify all three report types cached
   - Verify progress tracking
   - Verify completion status

2. **Analytics Generation:**
   - Cache sample data for multiple dates
   - Generate analytics
   - Verify calculations
   - Verify all insights present

3. **API Endpoints:**
   - Test all new routes
   - Verify response formats
   - Test error scenarios
   - Test authentication/authorization

### Manual Testing

1. **UI Workflows:**
   - Navigate to district page
   - Initiate backfill
   - View progress
   - Explore analytics tabs
   - Export data

2. **Performance:**
   - Test with large districts (100+ clubs)
   - Verify chart rendering speed
   - Test backfill with 365 days
   - Monitor memory usage

## Performance Considerations

### Caching Strategy

- Cache all three reports together (atomic operation)
- Use file-based storage for easy date-based queries
- Implement LRU cache for frequently accessed districts
- Pre-calculate analytics for common date ranges

### Query Optimization

- Index cached files by district and date
- Use streaming for large data exports
- Implement pagination for club lists
- Lazy-load chart data

### Backfill Optimization

- Process dates in parallel (max 3 concurrent)
- Reuse browser instance across requests
- Batch cache writes
- Skip weekends/blackout periods upfront

## Security Considerations

1. **Access Control:**
   - Verify user has permission to view district data
   - Implement rate limiting on backfill requests
   - Validate district IDs to prevent injection

2. **Data Privacy:**
   - Don't expose personal member information
   - Aggregate data only
   - Sanitize club names in exports

3. **Resource Protection:**
   - Limit concurrent backfills per user
   - Implement backfill queue
   - Set maximum date range (e.g., 2 years)

## Migration Strategy

### Phase 1: Backend Infrastructure

- Implement DistrictCacheManager
- Implement DistrictBackfillService
- Add API endpoints
- Test with sample district

### Phase 2: Analytics Engine

- Implement basic analytics calculations
- Add at-risk club detection
- Add trend analysis
- Test with historical data

### Phase 3: Frontend Visualization

- Enhance DistrictDetailPage
- Add basic charts
- Add backfill UI
- Test user workflows

### Phase 4: Advanced Insights

- Add year-over-year comparisons
- Add leadership insights
- Add export functionality
- Polish UI/UX

### Phase 5: Optimization & Polish

- Performance tuning
- Add more visualizations
- Implement user feedback
- Documentation

## Future Enhancements

1. **Predictive Analytics:**
   - ML models to predict club charter risk
   - Forecast district performance
   - Recommend interventions

2. **Automated Alerts:**
   - Email notifications for at-risk clubs
   - Weekly district health reports
   - Achievement celebrations

3. **Comparative Analytics:**
   - Compare district to regional averages
   - Benchmark against similar districts
   - Best practice identification

4. **Mobile App:**
   - Native mobile experience
   - Push notifications
   - Offline access to cached data

5. **Integration with Toastmasters Systems:**
   - Direct API integration (if available)
   - Real-time data sync
   - Member-level insights (with permission)
