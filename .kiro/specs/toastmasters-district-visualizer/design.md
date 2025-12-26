# Design Document: Toastmasters District Statistics Visualizer

## Overview

The Toastmasters District Statistics Visualizer is a web-based application that provides an intuitive interface for viewing and analyzing district-level performance data from the Toastmasters International dashboard. The application will authenticate users, fetch data from dashboard.toastmasters.org, and present statistics through interactive visualizations including charts, graphs, and tables.

The system follows a modern web architecture with a React-based frontend for rich interactivity, a Node.js backend to handle API communication and authentication, and a caching layer to optimize performance.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Web Browser   │
│   (React SPA)   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Backend API    │
│   (Node.js)     │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Toastmasters   │
│    Dashboard    │
│  dashboard.tm.org│
└─────────────────┘
```

### Technology Stack

**Frontend:**

- React 18+ with TypeScript for type safety
- Recharts or Chart.js for data visualization
- TanStack Query (React Query) for data fetching and caching
- Tailwind CSS for responsive styling
- Vite for build tooling

**Backend:**

- Node.js with Express for API server
- Axios for HTTP requests to Toastmasters dashboard
- Node-cache for in-memory caching
- JWT for session management
- dotenv for configuration

**Development Tools:**

- TypeScript for both frontend and backend
- ESLint and Prettier for code quality
- Vitest for testing

## Components and Interfaces

### Frontend Components

#### 1. Authentication Module

**LoginForm Component**

- Handles user credential input
- Validates form data
- Communicates with backend authentication endpoint
- Stores JWT token in secure storage (httpOnly cookie or sessionStorage)

**AuthContext**

- Provides authentication state throughout the application
- Manages token refresh logic
- Handles logout functionality

#### 2. District Selection Module

**DistrictSelector Component**

- Dropdown or searchable list of districts
- Fetches available districts from backend
- Triggers data fetch when district changes
- Displays current selection prominently

#### 3. Dashboard Module

**DashboardLayout Component**

- Main container for all visualizations
- Responsive grid layout
- Loading states and error boundaries

**StatCard Component**

- Reusable component for displaying key metrics
- Shows metric name, value, and change percentage
- Color-coded indicators for positive/negative trends

#### 4. Visualization Components

**MembershipChart Component**

- Line chart showing membership trends over time
- Displays 12-month historical data
- Interactive tooltips with detailed information
- Responsive to container size

**ClubPerformanceTable Component**

- Sortable table of clubs with performance metrics
- Pagination for large datasets
- Filtering capabilities
- Export functionality

**EducationalAwardsChart Component**

- Bar or pie chart showing award distribution
- Breakdown by award type
- Time-series view option

**DailyReportCalendar Component**

- Calendar view of daily activities
- Color-coded days based on activity level
- Click to view detailed daily report
- Month navigation

**DailyReportDetail Component**

- Detailed view of selected day's activities
- Lists new members, renewals, club changes
- Day-over-day comparison metrics

#### 5. Export Module

**ExportButton Component**

- Triggers data export for current view
- Generates CSV files
- Handles file download

**HistoricalRankChart Component**

- Line chart showing district rank progression over program year
- Multi-district selection capability
- Interactive tooltips with detailed rank information
- Toggle between different ranking metrics
- Responsive to container size
- Color-coded lines for each district

**DateSelector Component**

- Month and day dropdown selectors
- Matches Toastmasters dashboard date format
- Triggers data fetch when date changes
- Shows available dates based on cached data

**BackfillButton Component**

- Initiates backfill of missing historical data
- Modal dialog with optional date range selection (defaults to program year)
- Real-time progress indicator showing:
  - Percentage complete
  - Dates processed / total dates
  - Breakdown: skipped (cached), unavailable (blackout), failed (errors)
  - Current date being processed
- Allows cancellation of in-progress backfills
- Polls backend every 2 seconds for status updates
- Automatically refreshes cached dates list when complete
- Handles error states with user-friendly messages
- Only fetches dates not already in cache

### Backend API Endpoints

#### Authentication Endpoints

```
POST /api/auth/login
Request: { username: string, password: string }
Response: { token: string, expiresIn: number }
```

```
POST /api/auth/refresh
Request: { token: string }
Response: { token: string, expiresIn: number }
```

```
POST /api/auth/logout
Request: { token: string }
Response: { success: boolean }
```

#### District Endpoints

```
GET /api/districts
Response: { districts: Array<{ id: string, name: string }> }
```

```
GET /api/districts/:districtId/statistics
Response: {
  membership: {
    total: number,
    change: number,
    changePercent: number,
    byClub: Array<{ clubId: string, clubName: string, count: number }>
  },
  clubs: {
    total: number,
    active: number,
    suspended: number,
    distinguished: number
  },
  education: {
    totalAwards: number,
    byType: Array<{ type: string, count: number }>,
    topClubs: Array<{ clubId: string, clubName: string, awards: number }>
  }
}
```

```
GET /api/districts/:districtId/membership-history
Query: { months: number }
Response: {
  data: Array<{ date: string, count: number }>
}
```

```
GET /api/districts/:districtId/clubs
Response: {
  clubs: Array<{
    id: string,
    name: string,
    status: string,
    memberCount: number,
    distinguished: boolean,
    awards: number
  }>
}
```

```
GET /api/districts/:districtId/rank-history
Query: { startDate?: string, endDate?: string }
Response: {
  districtId: string,
  districtName: string,
  history: Array<{
    date: string,
    aggregateScore: number,
    clubsRank: number,
    paymentsRank: number,
    distinguishedRank: number
  }>,
  programYear: {
    startDate: string,
    endDate: string,
    year: string
  }
}
```

```
GET /api/districts/available-dates
Response: {
  dates: Array<{
    date: string,
    month: number,
    day: number,
    monthName: string
  }>,
  programYear: {
    startDate: string,
    endDate: string,
    year: string
  }
}
```

```
POST /api/districts/backfill
Request: {
  startDate?: string,  // Defaults to program year start (July 1)
  endDate?: string     // Defaults to today
}
Response: {
  backfillId: string,
  status: 'processing' | 'complete' | 'error',
  progress: {
    total: number,      // Total missing dates to process
    completed: number,  // Dates processed so far
    skipped: number,    // Dates already cached
    unavailable: number, // Dates in blackout/reconciliation
    failed: number,     // Dates that errored
    current: string     // Current date being processed
  }
}
```

```
GET /api/districts/backfill/:backfillId
Response: {
  backfillId: string,
  status: 'processing' | 'complete' | 'error',
  progress: {
    total: number,
    completed: number,
    skipped: number,
    unavailable: number,
    failed: number,
    current: string
  },
  error?: string
}
```

```
DELETE /api/districts/backfill/:backfillId
Response: {
  success: boolean,
  message: string
}
```

#### Daily Report Endpoints

```
GET /api/districts/:districtId/daily-reports
Query: { startDate: string, endDate: string }
Response: {
  reports: Array<{
    date: string,
    newMembers: number,
    renewals: number,
    clubChanges: Array<{ clubId: string, change: string }>,
    awards: number
  }>
}
```

```
GET /api/districts/:districtId/daily-reports/:date
Response: {
  date: string,
  newMembers: Array<{ name: string, clubId: string }>,
  renewals: Array<{ name: string, clubId: string }>,
  clubChanges: Array<{ clubId: string, clubName: string, change: string }>,
  awards: Array<{ type: string, recipient: string, clubId: string }>,
  summary: {
    totalNewMembers: number,
    totalRenewals: number,
    totalAwards: number,
    dayOverDayChange: number
  }
}
```

### Backend Services

#### ToastmastersAPIService

Handles all communication with dashboard.toastmasters.org:

- Manages authentication with Toastmasters dashboard
- Implements retry logic for failed requests
- Handles rate limiting
- Transforms Toastmasters API responses to internal format

**Key Methods:**

- `authenticate(username, password)`: Obtains access token
- `getDistricts()`: Fetches list of districts
- `getDistrictStatistics(districtId)`: Fetches current statistics
- `getMembershipHistory(districtId, months)`: Fetches historical membership data
- `getClubs(districtId)`: Fetches club list with details
- `getDailyReports(districtId, startDate, endDate)`: Fetches daily reports
- `getDailyReportDetail(districtId, date)`: Fetches specific day's report

#### CacheManager

Manages file-based caching for historical district data:

- File-based cache storage (JSON files by date)
- Metadata tracking for each cached date
- Historical index for quick lookups
- Program year calculation and date range management

**Key Methods:**

- `getCache(date, type)`: Retrieves cached data for a specific date
- `setCache(date, data, type)`: Stores data with automatic metadata and index updates
- `getCachedDates(type)`: Returns list of all cached dates
- `getMetadata(date)`: Returns metadata for a cached date
- `getCacheStatistics()`: Returns comprehensive cache statistics
- `getDistrictRankHistory(districtId, startDate, endDate)`: Returns rank history for a district
- `clearCache()`: Removes all cached data

#### BackfillService

Manages background processing of historical data backfill requests:

- Generates date ranges (defaults to program year start to today)
- Identifies missing dates by comparing requested range with cached dates
- Fetches only missing dates from Dashboard API
- Distinguishes between unavailable dates (blackout periods) and actual errors
- Tracks detailed progress (total, completed, skipped, unavailable, failed)
- Supports cancellation of in-progress backfills
- Auto-cleanup of old jobs after 1 hour

**Key Methods:**

- `initiateBackfill(request)`: Starts a backfill job and returns job ID
- `getBackfillStatus(backfillId)`: Returns current status and progress
- `cancelBackfill(backfillId)`: Cancels an active backfill job
- `cleanupOldJobs()`: Removes completed jobs older than 1 hour

**Backfill Process:**

1. User initiates backfill with optional date range
2. System generates all dates in range
3. Filters out already-cached dates (marked as "skipped")
4. For each missing date:
   - Navigates to dashboard with date parameters
   - Verifies returned date matches requested date
   - If mismatch: marks as "unavailable" (blackout/reconciliation period)
   - If match: downloads CSV, processes data, caches result
   - If error: marks as "failed" (actual error)
5. Returns completion summary with counts for each category

#### ToastmastersScraper

Handles web scraping of Toastmasters dashboard using Playwright:

- Headless browser automation
- CSV export download and parsing
- Date verification to ensure correct data
- Handles dashboard's blackout and reconciliation periods

**Key Methods:**

- `getAllDistricts()`: Fetches all districts for current date
- `getAllDistrictsForDate(dateString)`: Fetches all districts for specific date (YYYY-MM-DD)
- `getDistrictPerformance(districtId)`: Fetches specific district data
- `getClubPerformance(districtId)`: Fetches club-level data

**Date Handling:**

- Uses URL parameters: `/Default.aspx?month=7&day=7/27/2025`
- Verifies date by finding dropdown with "As of" text
- Parses date from "As of dd-MMM-yyyy" format
- Throws error if requested date doesn't match returned date

#### AuthService

Manages user authentication and session:

- Validates credentials
- Generates and validates JWT tokens
- Handles token refresh
- Manages session expiration

**Key Methods:**

- `login(username, password)`: Authenticates user
- `validateToken(token)`: Verifies token validity
- `refreshToken(token)`: Issues new token
- `logout(token)`: Invalidates session

## Data Models

### User Session

```typescript
interface UserSession {
  userId: string
  username: string
  token: string
  expiresAt: Date
  districtAccess: string[]
}
```

### District

```typescript
interface District {
  id: string
  name: string
  region: string
}
```

### District Statistics

```typescript
interface DistrictStatistics {
  districtId: string
  asOfDate: Date
  membership: MembershipStats
  clubs: ClubStats
  education: EducationStats
}

interface MembershipStats {
  total: number
  change: number
  changePercent: number
  byClub: ClubMembership[]
  history: MembershipHistoryPoint[]
}

interface ClubMembership {
  clubId: string
  clubName: string
  memberCount: number
}

interface MembershipHistoryPoint {
  date: Date
  count: number
}

interface ClubStats {
  total: number
  active: number
  suspended: number
  distinguished: number
  clubs: Club[]
}

interface Club {
  id: string
  name: string
  status: 'active' | 'suspended' | 'ineligible'
  memberCount: number
  distinguished: boolean
  distinguishedLevel?: 'select' | 'distinguished' | 'president'
  awards: number
}

interface EducationStats {
  totalAwards: number
  byType: AwardTypeCount[]
  byMonth: MonthlyAwards[]
  topClubs: ClubAwards[]
}

interface AwardTypeCount {
  type: string
  count: number
}

interface MonthlyAwards {
  month: Date
  count: number
}

interface ClubAwards {
  clubId: string
  clubName: string
  awards: number
}
```

### Daily Report

```typescript
interface DailyReport {
  districtId: string
  date: Date
  newMembers: Member[]
  renewals: Member[]
  clubChanges: ClubChange[]
  awards: Award[]
  summary: DailyReportSummary
}

interface Member {
  name: string
  clubId: string
  clubName: string
}

interface ClubChange {
  clubId: string
  clubName: string
  changeType: 'chartered' | 'suspended' | 'reinstated' | 'closed'
  details?: string
}

interface Award {
  type: string
  level?: string
  recipient: string
  clubId: string
  clubName: string
}

interface DailyReportSummary {
  totalNewMembers: number
  totalRenewals: number
  totalAwards: number
  netMembershipChange: number
  dayOverDayChange: number
}
```

### Export Data

```typescript
interface ExportData {
  filename: string
  headers: string[]
  rows: string[][]
  metadata: {
    districtId: string
    districtName: string
    exportDate: Date
    dataType: string
  }
}
```

### Historical Rank Data

```typescript
interface HistoricalRankPoint {
  date: string // YYYY-MM-DD
  aggregateScore: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
}

interface DistrictRankHistory {
  districtId: string
  districtName: string
  history: HistoricalRankPoint[]
}

interface ProgramYearInfo {
  startDate: string // July 1
  endDate: string // June 30
  year: string // e.g., "2024-2025"
}

interface BulkDownloadRequest {
  startDate?: string
  endDate?: string
  includeMissing?: boolean // Fetch missing dates from API
}

interface BulkDownloadProgress {
  downloadId: string
  status: 'processing' | 'complete' | 'error'
  progress: {
    total: number
    completed: number
    current: string // Current date being processed
  }
  downloadUrl?: string
  error?: string
}
```

## Error Handling

### Frontend Error Handling

**Network Errors:**

- Display user-friendly error messages
- Provide retry mechanism
- Show offline indicator when network is unavailable

**Authentication Errors:**

- Redirect to login on 401 responses
- Clear invalid tokens
- Display specific error messages for credential issues

**Data Errors:**

- Show error boundaries for component crashes
- Display fallback UI when data is malformed
- Log errors for debugging

**Validation Errors:**

- Inline form validation
- Clear error messages
- Prevent invalid submissions

### Backend Error Handling

**API Errors:**

- Catch and log all errors
- Return consistent error response format
- Include error codes for client handling

**Toastmasters API Errors:**

- Implement exponential backoff for retries
- Handle rate limiting gracefully
- Provide meaningful error messages to frontend

**Authentication Errors:**

- Return appropriate HTTP status codes
- Clear error messages without exposing security details
- Log authentication attempts

**Error Response Format:**

```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
  }
}
```

## Testing Strategy

### Frontend Testing

**Unit Tests:**

- Test individual components in isolation
- Mock API calls and external dependencies
- Test utility functions and helpers
- Focus on business logic and data transformations

**Integration Tests:**

- Test component interactions
- Test data flow through React Query
- Test authentication flow
- Test routing and navigation

**Accessibility Tests:**

- Automated accessibility testing with axe-core
- Keyboard navigation testing
- Screen reader compatibility testing
- Color contrast validation

### Backend Testing

**Unit Tests:**

- Test service methods in isolation
- Mock external API calls
- Test data transformations
- Test cache logic

**Integration Tests:**

- Test API endpoints end-to-end
- Test authentication middleware
- Test error handling
- Test with mock Toastmasters API responses

**API Contract Tests:**

- Validate request/response formats
- Test error scenarios
- Verify authentication requirements

### End-to-End Testing

**Critical User Flows:**

- Login and authentication
- District selection and data loading
- Visualization interactions
- Data export
- Daily report viewing

## Performance Considerations

**Frontend Optimization:**

- Code splitting for faster initial load
- Lazy loading of visualization components
- Memoization of expensive calculations
- Virtual scrolling for large tables
- Debounced search and filter inputs

**Backend Optimization:**

- Caching with appropriate TTL
- Parallel API requests where possible
- Response compression
- Connection pooling for external APIs

**Data Transfer Optimization:**

- Pagination for large datasets
- Selective field loading
- Compressed responses (gzip)
- Efficient data formats (JSON)

## Security Considerations

**Authentication:**

- Secure credential transmission (HTTPS only)
- JWT tokens with appropriate expiration
- HttpOnly cookies for token storage (if using cookies)
- CSRF protection

**API Security:**

- Rate limiting on endpoints
- Input validation and sanitization
- SQL injection prevention (if database added)
- XSS prevention

**Data Privacy:**

- No storage of Toastmasters credentials
- Secure token management
- Clear data on logout
- Minimal data retention

## Deployment Considerations

**Frontend Deployment:**

- Static hosting (Vercel, Netlify, or similar)
- CDN for asset delivery
- Environment-specific configuration
- HTTPS enforcement

**Backend Deployment:**

- Container-based deployment (Docker)
- Environment variables for configuration
- Health check endpoints
- Logging and monitoring

**Configuration:**

- Separate development and production configs
- Secure storage of API credentials
- Configurable cache TTL
- Configurable rate limits
