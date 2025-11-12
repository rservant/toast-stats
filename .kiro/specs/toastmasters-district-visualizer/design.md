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

#### CacheService

Manages data caching to reduce API calls:
- In-memory cache with TTL (15 minutes default)
- Cache key generation based on endpoint and parameters
- Cache invalidation on user logout
- Manual refresh bypass

**Key Methods:**
- `get(key)`: Retrieves cached data
- `set(key, value, ttl)`: Stores data with expiration
- `invalidate(key)`: Removes specific cache entry
- `clear()`: Clears all cache

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
  userId: string;
  username: string;
  token: string;
  expiresAt: Date;
  districtAccess: string[];
}
```

### District

```typescript
interface District {
  id: string;
  name: string;
  region: string;
}
```

### District Statistics

```typescript
interface DistrictStatistics {
  districtId: string;
  asOfDate: Date;
  membership: MembershipStats;
  clubs: ClubStats;
  education: EducationStats;
}

interface MembershipStats {
  total: number;
  change: number;
  changePercent: number;
  byClub: ClubMembership[];
  history: MembershipHistoryPoint[];
}

interface ClubMembership {
  clubId: string;
  clubName: string;
  memberCount: number;
}

interface MembershipHistoryPoint {
  date: Date;
  count: number;
}

interface ClubStats {
  total: number;
  active: number;
  suspended: number;
  distinguished: number;
  clubs: Club[];
}

interface Club {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'ineligible';
  memberCount: number;
  distinguished: boolean;
  distinguishedLevel?: 'select' | 'distinguished' | 'president';
  awards: number;
}

interface EducationStats {
  totalAwards: number;
  byType: AwardTypeCount[];
  byMonth: MonthlyAwards[];
  topClubs: ClubAwards[];
}

interface AwardTypeCount {
  type: string;
  count: number;
}

interface MonthlyAwards {
  month: Date;
  count: number;
}

interface ClubAwards {
  clubId: string;
  clubName: string;
  awards: number;
}
```

### Daily Report

```typescript
interface DailyReport {
  districtId: string;
  date: Date;
  newMembers: Member[];
  renewals: Member[];
  clubChanges: ClubChange[];
  awards: Award[];
  summary: DailyReportSummary;
}

interface Member {
  name: string;
  clubId: string;
  clubName: string;
}

interface ClubChange {
  clubId: string;
  clubName: string;
  changeType: 'chartered' | 'suspended' | 'reinstated' | 'closed';
  details?: string;
}

interface Award {
  type: string;
  level?: string;
  recipient: string;
  clubId: string;
  clubName: string;
}

interface DailyReportSummary {
  totalNewMembers: number;
  totalRenewals: number;
  totalAwards: number;
  netMembershipChange: number;
  dayOverDayChange: number;
}
```

### Export Data

```typescript
interface ExportData {
  filename: string;
  headers: string[];
  rows: string[][];
  metadata: {
    districtId: string;
    districtName: string;
    exportDate: Date;
    dataType: string;
  };
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
    code: string;
    message: string;
    details?: any;
  };
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
