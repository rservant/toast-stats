# Assessment Module API Documentation

## OpenAPI Contract

### Base URL

```
http://localhost:3000/api/assessment
```

### Authentication

No authentication required for MVP.

---

## Endpoints

### 1. Submit Monthly Assessment Data

**POST** `/assessment/monthly`

Submit monthly assessment data for a district and calculate goal statuses.

#### Request Body

```json
{
  "district_number": 61,
  "program_year": "2024-2025",
  "month": "August",
  "membership_payments_ytd": 45,
  "paid_clubs_ytd": 2,
  "distinguished_clubs_ytd": 3,
  "csp_submissions_ytd": 10
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Monthly assessment submitted successfully",
  "data": {
    "district_number": 61,
    "program_year": "2024-2025",
    "month": "August",
    "goal_1_status": {
      "goal_number": 1,
      "status": "On Track",
      "actual": 45,
      "target": 10,
      "delta": 35
    },
    "goal_2_status": {
      "goal_number": 2,
      "status": "On Track",
      "actual": 2,
      "target": 1,
      "delta": 1
    },
    "goal_3_status": {
      "goal_number": 3,
      "status": "On Track",
      "actual": 3,
      "target": 2,
      "delta": 1
    }
  }
}
```

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "code": "INVALID_REQUEST",
  "message": "Validation failed",
  "errors": [
    {
      "field": "membership_payments_ytd",
      "message": "must be a non-negative number"
    }
  ]
}
```

#### HTTP Status Codes

- `201 Created` - Assessment submitted successfully
- `400 Bad Request` - Validation error
- `500 Internal Server Error` - Server error

---

### 2. Retrieve Monthly Report

**GET** `/assessment/monthly/:month`

Retrieve a previously submitted monthly assessment report.

#### Query Parameters

- `district_number` (required, integer): District number
- `program_year` (required, string): Program year (YYYY-YYYY format)

#### Example Request

```
GET /assessment/monthly/August?district_number=61&program_year=2024-2025
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "district_number": 61,
    "program_year": "2024-2025",
    "month": "August",
    "goal_1_status": { ... },
    "goal_2_status": { ... },
    "goal_3_status": { ... },
    "created_at": "2025-11-26T00:00:00.000Z",
    "updated_at": "2025-11-26T00:00:00.000Z"
  }
}
```

#### Error Response (404 Not Found)

```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Assessment not found for August 2024-2025"
}
```

#### HTTP Status Codes

- `200 OK` - Report retrieved successfully
- `400 Bad Request` - Invalid parameters
- `404 Not Found` - Assessment not found
- `500 Internal Server Error` - Server error

---

### 3. Retrieve Year-End Summary

**GET** `/assessment/year-end`

Retrieve aggregated assessment data for all 12 months of the program year.

#### Query Parameters

- `district_number` (required, integer): District number
- `program_year` (required, string): Program year (YYYY-YYYY format)

#### Example Request

```
GET /assessment/year-end?district_number=61&program_year=2024-2025
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "district_number": 61,
    "program_year": "2024-2025",
    "goal_1_status": {
      "actual_ytd": 600,
      "target_ytd": 120,
      "delta_ytd": 480,
      "status": "On Track",
      "percentage_achieved": 500
    },
    "goal_2_status": {
      "actual_ytd": 24,
      "target_ytd": 12,
      "delta_ytd": 12,
      "status": "On Track",
      "percentage_achieved": 200
    },
    "goal_3_status": {
      "actual_ytd": 36,
      "target_ytd": 24,
      "delta_ytd": 12,
      "status": "On Track",
      "percentage_achieved": 150
    },
    "monthly_summaries": [
      {
        "month": "July",
        "goal_1": "On Track",
        "goal_2": "On Track",
        "goal_3": "On Track"
      },
      ...
    ]
  }
}
```

#### HTTP Status Codes

- `200 OK` - Year-end report retrieved successfully
- `400 Bad Request` - Invalid parameters
- `404 Not Found` - Year-end data not found
- `500 Internal Server Error` - Server error

---

### 4. Create District Leader Goal

**POST** `/assessment/goals`

Create a new district leader goal (action item for DD/PQD/CGD).

#### Request Body

```json
{
  "district_number": 61,
  "program_year": "2024-2025",
  "text": "Increase club membership by 20%",
  "assigned_to": "DD",
  "deadline": "2025-06-30",
  "month": "June"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Goal created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "district_number": 61,
    "program_year": "2024-2025",
    "text": "Increase club membership by 20%",
    "assigned_to": "DD",
    "deadline": "2025-06-30",
    "month": "June",
    "status": "in_progress",
    "created_at": "2025-11-26T12:00:00.000Z",
    "updated_at": "2025-11-26T12:00:00.000Z"
  }
}
```

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "code": "INVALID_REQUEST",
  "message": "Validation failed",
  "errors": [
    {
      "field": "text",
      "message": "cannot be empty"
    },
    {
      "field": "assigned_to",
      "message": "must be one of: DD, PQD, CGD"
    }
  ]
}
```

#### HTTP Status Codes

- `201 Created` - Goal created successfully
- `400 Bad Request` - Validation error
- `500 Internal Server Error` - Server error

---

### 5. Query District Leader Goals

**GET** `/assessment/goals`

Query goals with optional filters.

#### Query Parameters

- `district_number` (required, integer): District number
- `program_year` (required, string): Program year
- `role` (optional, string): Filter by role (DD, PQD, CGD)
- `month` (optional, string): Filter by month
- `status` (optional, string): Filter by status (in_progress, completed, overdue)
- `startDate` (optional, string): Filter by deadline range (ISO 8601)
- `endDate` (optional, string): Filter by deadline range (ISO 8601)

#### Example Request

```
GET /assessment/goals?district_number=61&program_year=2024-2025&role=DD&status=in_progress
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "district_number": 61,
      "program_year": "2024-2025",
      "text": "Increase club membership by 20%",
      "assigned_to": "DD",
      "deadline": "2025-06-30",
      "month": "June",
      "status": "in_progress",
      "created_at": "2025-11-26T12:00:00.000Z",
      "updated_at": "2025-11-26T12:00:00.000Z"
    },
    ...
  ],
  "count": 3
}
```

#### HTTP Status Codes

- `200 OK` - Goals retrieved successfully
- `400 Bad Request` - Invalid parameters
- `500 Internal Server Error` - Server error

---

### 6. Update Goal Status

**PUT** `/assessment/goals/:id`

Update a goal's status and optional notes.

#### URL Parameters

- `id` (required, string): Goal ID (UUID)

#### Request Body

```json
{
  "status": "completed",
  "notes": "All targets achieved!"
}
```

Valid status values: `in_progress`, `completed`, `overdue`

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Goal updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "district_number": 61,
    "program_year": "2024-2025",
    "text": "Increase club membership by 20%",
    "assigned_to": "DD",
    "deadline": "2025-06-30",
    "month": "June",
    "status": "completed",
    "notes": "All targets achieved!",
    "date_completed": "2025-11-26T14:00:00.000Z",
    "created_at": "2025-11-26T12:00:00.000Z",
    "updated_at": "2025-11-26T14:00:00.000Z"
  }
}
```

#### Error Response (404 Not Found)

```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Goal not found: 550e8400-e29b-41d4-a716-446655440000"
}
```

#### HTTP Status Codes

- `200 OK` - Goal updated successfully
- `400 Bad Request` - Invalid status value
- `404 Not Found` - Goal not found
- `500 Internal Server Error` - Server error

---

### 7. Load/Update Configuration

**POST** `/assessment/config`

Load or update district configuration (recognition thresholds, year-end targets).

#### Request Body

```json
{
  "district_number": 61,
  "program_year": "2024-2025",
  "year_end_targets": {
    "membership_growth": 120,
    "club_growth": 12,
    "distinguished_clubs": 24
  },
  "recognition_levels": [
    {
      "level": "Distinguished",
      "membershipPaymentsTarget": 60,
      "paidClubsTarget": 6,
      "distinguishedClubsTarget": 12
    },
    {
      "level": "Select",
      "membershipPaymentsTarget": 40,
      "paidClubsTarget": 4,
      "distinguishedClubsTarget": 8
    },
    {
      "level": "President's",
      "membershipPaymentsTarget": 15,
      "paidClubsTarget": 1.5,
      "distinguishedClubsTarget": 3
    },
    {
      "level": "Smedley Distinguished",
      "membershipPaymentsTarget": 5,
      "paidClubsTarget": 0.5,
      "distinguishedClubsTarget": 1
    }
  ],
  "csp_submission_target": 60,
  "csp_to_distinguished_clubs_ratio": 0.5
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "data": {
    "district_number": 61,
    "program_year": "2024-2025",
    "year_end_targets": { ... },
    "recognition_levels": [ ... ],
    "csp_submission_target": 60,
    "csp_to_distinguished_clubs_ratio": 0.5
  }
}
```

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "code": "INVALID_CONFIG",
  "message": "Configuration validation failed",
  "errors": [
    {
      "field": "year_end_targets.membership_growth",
      "message": "must be a positive number"
    },
    {
      "field": "csp_to_distinguished_clubs_ratio",
      "message": "must be between 0 and 1"
    }
  ]
}
```

#### HTTP Status Codes

- `200 OK` - Configuration updated successfully
- `400 Bad Request` - Validation error
- `500 Internal Server Error` - Server error

---

## Data Types & Schemas

### GoalStatus

```typescript
{
  goal_number: 1 | 2 | 3,
  status: "On Track" | "Off Track" | "Pending Data",
  actual: number,
  target: number,
  delta: number
}
```

### MonthlyAssessment

```typescript
{
  district_number: number,
  program_year: string,     // YYYY-YYYY format
  month: string,             // July-June
  membership_payments_ytd: number,
  paid_clubs_ytd: number,
  distinguished_clubs_ytd: number | null,
  csp_submissions_ytd: number
}
```

### DistrictLeaderGoal

```typescript
{
  id: string,                // UUID
  district_number: number,
  program_year: string,
  text: string,
  assigned_to: "DD" | "PQD" | "CGD",
  deadline: string,          // ISO 8601 date
  month: string,
  status: "in_progress" | "completed" | "overdue",
  notes?: string,
  date_completed?: string,   // ISO 8601 datetime
  created_at: string,        // ISO 8601 datetime
  updated_at: string         // ISO 8601 datetime
}
```

### DistrictConfig

```typescript
{
  district_number: number,
  program_year: string,
  year_end_targets: {
    membership_growth: number,
    club_growth: number,
    distinguished_clubs: number
  },
  recognition_levels: Array<{
    level: string,
    membershipPaymentsTarget: number,
    paidClubsTarget: number,
    distinguishedClubsTarget: number
  }>,
  csp_submission_target: number,
  csp_to_distinguished_clubs_ratio: number  // 0-1
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Input validation failed |
| `INVALID_CONFIG` | 400 | Configuration validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Example Workflows

### Workflow 1: Submit Monthly Assessment

```bash
# 1. Load configuration
curl -X POST http://localhost:3000/api/assessment/config \
  -H "Content-Type: application/json" \
  -d @config.json

# 2. Submit monthly data
curl -X POST http://localhost:3000/api/assessment/monthly \
  -H "Content-Type: application/json" \
  -d '{
    "district_number": 61,
    "program_year": "2024-2025",
    "month": "August",
    "membership_payments_ytd": 45,
    "paid_clubs_ytd": 2,
    "distinguished_clubs_ytd": 3,
    "csp_submissions_ytd": 10
  }'

# 3. Retrieve report
curl http://localhost:3000/api/assessment/monthly/August?district_number=61&program_year=2024-2025
```

### Workflow 2: Create and Track Goals

```bash
# 1. Create a goal
curl -X POST http://localhost:3000/api/assessment/goals \
  -H "Content-Type: application/json" \
  -d '{
    "district_number": 61,
    "program_year": "2024-2025",
    "text": "Increase club membership by 20%",
    "assigned_to": "DD",
    "deadline": "2025-06-30",
    "month": "June"
  }'

# 2. Query goals for DD
curl http://localhost:3000/api/assessment/goals?district_number=61&program_year=2024-2025&role=DD

# 3. Mark goal as completed
curl -X PUT http://localhost:3000/api/assessment/goals/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "notes": "All targets achieved!"
  }'
```

---

## Implementation Notes

- All timestamps are in ISO 8601 format with UTC timezone
- District numbers are unique per year
- Program years use YYYY-YYYY format (e.g., "2024-2025")
- Goal deadlines must be valid ISO 8601 dates
- CSP ratio must be between 0 and 1 (inclusive)

---

**API Version**: 1.0.0  
**Last Updated**: November 26, 2025  
**Status**: ✅ Complete and tested
