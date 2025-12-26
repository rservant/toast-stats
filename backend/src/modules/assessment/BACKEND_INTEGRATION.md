# Assessment Module Backend Integration Guide

## Overview

This guide documents how to integrate the assessment module routes into the main Express.js backend application (`backend/src/index.ts`).

## Current Status

- ✅ Assessment services implemented and tested (all 288 tests passing)
- ✅ Assessment types and data models defined
- ✅ Storage layer complete
- ⏳ Routes file created with endpoint definitions
- ⏳ Main index.ts needs import and middleware registration

## Integration Steps

### Step 1: Create Routes File

**File**: `backend/src/modules/assessment/routes/assessmentRoutes.ts`

The routes file exports a Router with the following endpoints:

```typescript
export default router
```

Endpoints provided:

- `POST /api/assessment/monthly` - Create monthly assessment
- `GET /api/assessment/monthly/:districtId/:programYear/:month` - Get assessment
- `GET /api/assessment/goals` - Query goals with filters
- `POST /api/assessment/goals` - Create goal
- `PUT /api/assessment/goals/:goalId/status` - Update goal status
- `DELETE /api/assessment/goals/:goalId` - Delete goal
- `GET /api/assessment/report/:districtId/:programYear` - Generate report
- `GET /api/assessment/goals/statistics/:districtId/:programYear` - Get statistics

### Step 2: Import Routes in Main Index

**File**: `backend/src/index.ts`

Add this import at the top with other route imports:

```typescript
import assessmentRoutes from './modules/assessment/routes/assessmentRoutes.js'
```

### Step 3: Register Routes Middleware

**File**: `backend/src/index.ts`

Add this line after the districts routes registration:

```typescript
// Assessment routes
app.use('/api/assessment', assessmentRoutes)
```

### Step 4: Verify No Import Errors

Run the build command to verify no TypeScript errors:

```bash
cd backend
npm run build
```

Expected output: No errors, `dist/` directory created.

### Step 5: Test the Integration

Start the server:

```bash
npm run dev
```

Test endpoints:

```bash
# Test health check (verify server is running)
curl http://localhost:5001/health

# Test assessment API is accessible
curl http://localhost:5001/api

# Create a monthly assessment
curl -X POST http://localhost:5001/api/assessment/monthly \
  -H "Content-Type: application/json" \
  -d '{
    "district_number": 61,
    "program_year": "2024-2025",
    "month": "July",
    "membership_payments_ytd": 12,
    "paid_clubs_ytd": 1,
    "distinguished_clubs_ytd": 2,
    "csp_submissions_ytd": 5
  }'
```

## Route Details

### Assessment CRUD Operations

#### Create Monthly Assessment

```
POST /api/assessment/monthly

Request Body:
{
  "district_number": 61,
  "program_year": "2024-2025",
  "month": "July",
  "membership_payments_ytd": 12,
  "paid_clubs_ytd": 1,
  "distinguished_clubs_ytd": 2,
  "csp_submissions_ytd": 5
}

Response (201 Created):
{
  "success": true,
  "data": {
    "district_number": 61,
    "program_year": "2024-2025",
    "month": "July",
    "membership_payments_ytd": 12,
    "paid_clubs_ytd": 1,
    "distinguished_clubs_ytd": 2,
    "csp_submissions_ytd": 5,
    "created_at": "2024-12-19T10:00:00.000Z",
    "updated_at": "2024-12-19T10:00:00.000Z"
  }
}
```

#### Get Monthly Assessment

```
GET /api/assessment/monthly/61/2024-2025/July

Response (200 OK):
{
  "success": true,
  "data": { ...assessment object... }
}

Response (404 Not Found):
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Assessment not found"
  }
}
```

### District Leader Goal Operations

#### Query Goals

```
GET /api/assessment/goals?districtNumber=61&programYear=2024-2025&assignedTo=DD&month=July

Query Parameters:
- districtNumber (required): District number
- programYear (required): Program year (e.g., "2024-2025")
- assignedTo (optional): "DD", "PQD", or "CGD"
- month (optional): Month name
- status (optional): "in_progress", "completed", or "overdue"
- deadlineAfter (optional): ISO date string
- deadlineBefore (optional): ISO date string

Response (200 OK):
{
  "success": true,
  "data": [
    {
      "id": "uuid-1234",
      "district_number": 61,
      "program_year": "2024-2025",
      "text": "Increase membership by 20%",
      "assigned_to": "DD",
      "deadline": "2025-06-30",
      "month": "July",
      "status": "in_progress",
      "created_at": "2024-12-19T10:00:00.000Z",
      "updated_at": "2024-12-19T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

#### Create Goal

```
POST /api/assessment/goals

Request Body:
{
  "district_number": 61,
  "program_year": "2024-2025",
  "text": "Establish 2 new clubs",
  "assigned_to": "CGD",
  "deadline": "2025-04-30",
  "month": "April"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "id": "uuid-5678",
    "district_number": 61,
    "program_year": "2024-2025",
    "text": "Establish 2 new clubs",
    "assigned_to": "CGD",
    "deadline": "2025-04-30",
    "month": "April",
    "status": "in_progress",
    "created_at": "2024-12-19T10:00:00.000Z",
    "updated_at": "2024-12-19T10:00:00.000Z"
  }
}
```

#### Update Goal Status

```
PUT /api/assessment/goals/{goalId}/status

Request Body:
{
  "status": "completed"
}

Response (200 OK):
{
  "success": true,
  "data": {
    "id": "uuid-5678",
    ...goal object with updated status...
  }
}
```

#### Delete Goal

```
DELETE /api/assessment/goals/{goalId}

Response (200 OK):
{
  "success": true,
  "message": "Goal deleted"
}

Response (404 Not Found):
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Goal not found"
  }
}
```

### Report Generation

#### Generate Year-End Report

```
GET /api/assessment/report/61/2024-2025

Response (200 OK):
{
  "success": true,
  "data": {
    "district_number": 61,
    "program_year": "2024-2025",
    "monthly_reports": {
      "July": { ...monthly report... },
      "August": { ...monthly report... },
      ...
      "June": { ...monthly report... }
    },
    "year_end_summary": {
      "district_number": 61,
      "program_year": "2024-2025",
      "total_goals_on_track": 3,
      "overall_status": "On Track",
      ...
    },
    "generated_at": "2024-12-19T10:00:00.000Z"
  }
}

Response (404 Not Found):
{
  "error": {
    "code": "CONFIG_NOT_FOUND",
    "message": "No configuration found for District 61, Program Year 2024-2025"
  }
}
```

### Statistics

#### Get Goal Statistics

```
GET /api/assessment/goals/statistics/61/2024-2025

Response (200 OK):
{
  "success": true,
  "data": {
    "total_goals": 15,
    "completed_goals": 8,
    "in_progress_goals": 5,
    "overdue_goals": 2,
    "completion_percentage": 53.33,
    "avg_days_to_complete": 12.5
  }
}
```

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

Common error codes:

- `INVALID_REQUEST` (400): Missing or invalid parameters
- `NOT_FOUND` (404): Resource not found
- `CONFIG_NOT_FOUND` (404): Configuration missing for district/year
- `INTERNAL_SERVER_ERROR` (500): Server error

## Environment Variables

The assessment module respects these environment variables (set in `.env`):

```
# Configuration TTL (cache timeout in milliseconds, default: 900000 = 15 minutes)
ASSESSMENT_CONFIG_TTL=900000

# Storage directory (default: current working directory)
ASSESSMENT_STORAGE_DIR=./data
```

## Middleware Stack

The assessment routes are registered after the districts routes:

```
Express App
├── Health Check (/health)
├── Main API root (/api)
├── District Routes (/api/districts)
├── Assessment Routes (/api/assessment) ← NEW
└── Error Handler
```

Request flow for assessment endpoint:

1. Request arrives at `/api/assessment/...`
2. CORS middleware processes
3. JSON body parser processes
4. Assessment router matches and handles
5. Error handler catches any exceptions

## Testing After Integration

### 1. Unit Tests (should still pass)

```bash
npm test
```

Expected: 288 tests passing

### 2. Build Verification

```bash
npm run build
```

Expected: No TypeScript errors

### 3. Server Start

```bash
npm run dev
```

Expected: Server starts without errors on port 5001

### 4. Manual API Tests

```bash
# Create assessment
curl -X POST http://localhost:5001/api/assessment/monthly \
  -H "Content-Type: application/json" \
  -d '{...}'

# Query goals
curl "http://localhost:5001/api/assessment/goals?districtNumber=61&programYear=2024-2025"

# Get report
curl http://localhost:5001/api/assessment/report/61/2024-2025
```

## File Structure After Integration

```
backend/src/
├── index.ts (MODIFIED: add import and routes)
├── modules/
│   └── assessment/
│       ├── routes/
│       │   └── assessmentRoutes.ts (NEW: endpoint handlers)
│       ├── services/ (existing: ✅ all implemented)
│       ├── storage/ (existing: ✅ all implemented)
│       └── types/ (existing: ✅ all defined)
├── routes/
│   └── districts.ts (existing)
└── utils/
    └── logger.ts (existing)
```

## Deployment Checklist

Before deploying to production:

- [ ] Run `npm test` and verify 288 tests passing
- [ ] Run `npm run build` and verify no TypeScript errors
- [ ] Run `npm run lint` and verify no linting errors
- [ ] Test all 8 assessment endpoints manually
- [ ] Verify error handling for edge cases
- [ ] Check performance with large datasets
- [ ] Verify configuration loading from environment
- [ ] Test concurrent requests
- [ ] Verify CORS configuration allows frontend
- [ ] Check logs for any warnings

## Documentation References

- **Type Definitions**: `backend/src/modules/assessment/types/assessment.ts`
- **API Contract**: `backend/src/modules/assessment/ASSESSMENT_API.md`
- **Service Documentation**: `backend/src/modules/assessment/README.md`
- **Test Examples**: `backend/src/modules/assessment/__tests__/`
- **Performance Benchmark**: `backend/src/modules/assessment/PERFORMANCE_BENCHMARK.md`

## Next Steps

1. ✅ Complete the assessmentRoutes.ts file implementation
2. ✅ Add import to backend/src/index.ts
3. ✅ Register routes middleware in Express app
4. ✅ Run full test suite verification
5. ✅ Build and verify no errors
6. ✅ Manual endpoint testing
7. ✅ Deploy to production

## Production Considerations

### Scaling

For 1000+ districts with 500+ goals each:

- Current file-based storage: May need to migrate to database
- In-memory goal caching: Implement Redis for distributed caching
- Report generation: Consider async queue for large batches

### Security

- Add authentication middleware before assessment routes
- Validate district_number belongs to authenticated user
- Implement rate limiting on goal creation
- Add input sanitization for goal text

### Monitoring

- Add request logging to assessment endpoints
- Track response times and cache hit rates
- Monitor storage I/O performance
- Set alerts for error rates >1%

## Support & Troubleshooting

### Issue: Routes not found (404)

**Cause**: Routes not registered in index.ts  
**Fix**: Add `app.use('/api/assessment', assessmentRoutes)` before error handler

### Issue: TypeScript compilation error

**Cause**: Import path or function signature mismatch  
**Fix**: Verify import paths use `.js` extension, check function parameters match service definitions

### Issue: Database/config not found

**Cause**: Configuration file not present  
**Fix**: Run `npm run seed` to create sample data

### Issue: Slow response times

**Cause**: File I/O bottleneck or large report  
**Fix**: Migrate to database or implement caching layer

---

**Status**: ✅ READY FOR INTEGRATION  
**Last Updated**: 2024-12-19  
**Version**: 1.0.0
