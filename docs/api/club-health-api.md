# Club Health Classification API Documentation

**Version:** 1.0.0  
**Base URL:** `/api/club-health`  
**Content-Type:** `application/json`

## Overview

The Club Health Classification API provides endpoints for evaluating Toastmasters clubs using a comprehensive 2D classification model. The system determines both Health Status (Thriving/Vulnerable/Intervention Required) and Trajectory (Recovering/Stable/Declining) based on membership data, Distinguished Club Program (DCP) progress, and Club Success Plan (CSP) submission status.

## Authentication

Currently, the API does not require authentication. Future versions will implement JWT-based authentication with role-based access control.

## Rate Limiting

- **Individual Classification:** 100 requests per minute per IP
- **Batch Classification:** 10 requests per minute per IP (max 100 clubs per batch)
- **History Retrieval:** 50 requests per minute per IP
- **District Summary:** 20 requests per minute per IP

## Response Format

All API responses follow a consistent structure:

```json
{
  "success": boolean,
  "data": object | array | null,
  "error": {
    "code": "string",
    "message": "string",
    "details": object | null
  } | null,
  "metadata": {
    "timestamp": "ISO 8601 string",
    "additional_fields": "varies by endpoint"
  }
}
```

## Endpoints

### 1. Classify Single Club

Evaluates a single club's health status and trajectory based on provided data.

**Endpoint:** `POST /api/club-health/classify`

#### Request Body

```json
{
  "club_name": "string (required)",
  "current_members": "number (required, >= 0)",
  "member_growth_since_july": "number (required, can be negative)",
  "current_month": "Month (required)",
  "dcp_goals_achieved_ytd": "number (required, >= 0)",
  "csp_submitted": "boolean (required)",
  "officer_list_submitted": "boolean (required)",
  "officers_trained": "boolean (required)",
  "previous_month_members": "number (required, >= 0)",
  "previous_month_dcp_goals_achieved_ytd": "number (required, >= 0)",
  "previous_month_health_status": "HealthStatus (required)"
}
```

#### Data Types

- **Month:** `"July" | "August" | "September" | "October" | "November" | "December" | "January" | "February" | "March" | "April" | "May" | "June"`
- **HealthStatus:** `"Thriving" | "Vulnerable" | "Intervention Required"`

#### Example Request

```json
{
  "club_name": "Downtown Speakers",
  "current_members": 25,
  "member_growth_since_july": 5,
  "current_month": "October",
  "dcp_goals_achieved_ytd": 3,
  "csp_submitted": true,
  "officer_list_submitted": true,
  "officers_trained": true,
  "previous_month_members": 23,
  "previous_month_dcp_goals_achieved_ytd": 2,
  "previous_month_health_status": "Vulnerable"
}
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "club_name": "Downtown Speakers",
    "health_status": "Thriving",
    "reasons": [
      "Membership requirement met: 25 members (≥20 required)",
      "DCP requirement met: 3 goals achieved (≥2 required for October)",
      "CSP requirement met: Club Success Plan submitted"
    ],
    "trajectory": "Recovering",
    "trajectory_reasons": [
      "Health status improved from Vulnerable to Thriving"
    ],
    "composite_key": "Thriving__Recovering",
    "composite_label": "Thriving · Recovering",
    "members_delta_mom": 2,
    "dcp_delta_mom": 1,
    "metadata": {
      "evaluation_date": "2024-10-15T14:30:00.000Z",
      "processing_time_ms": 45,
      "rule_version": "1.0.0"
    }
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z",
    "api_processing_time_ms": 67
  }
}
```

#### Error Responses

**400 Bad Request - Validation Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "code": "MISSING_REQUIRED_FIELD",
        "message": "club_name is required and must be a non-empty string",
        "field": "club_name",
        "value": null
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "error": {
    "code": "CLASSIFICATION_ERROR",
    "message": "Failed to classify club health"
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

### 2. Batch Classify Clubs

Evaluates multiple clubs in a single request for improved performance.

**Endpoint:** `POST /api/club-health/batch`

#### Request Body

Array of club health input objects (max 100 clubs per request):

```json
[
  {
    "club_name": "Downtown Speakers",
    "current_members": 25
    // ... other required fields
  },
  {
    "club_name": "Evening Toastmasters",
    "current_members": 18
    // ... other required fields
  }
]
```

#### Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "club_name": "Downtown Speakers",
      "health_status": "Thriving"
      // ... complete classification result
    },
    {
      "club_name": "Evening Toastmasters",
      "health_status": "Vulnerable"
      // ... complete classification result
    }
  ],
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z",
    "total_clubs": 2,
    "successful_classifications": 2,
    "api_processing_time_ms": 123
  }
}
```

#### Error Responses

**400 Bad Request - Invalid Array**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT_TYPE",
    "message": "Input must be an array of club health data"
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

**400 Bad Request - Array Too Large**

```json
{
  "success": false,
  "error": {
    "code": "INPUT_ARRAY_TOO_LARGE",
    "message": "Batch size cannot exceed 100 clubs"
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

**400 Bad Request - Batch Validation Error**

```json
{
  "success": false,
  "error": {
    "code": "BATCH_VALIDATION_ERROR",
    "message": "2 of 5 inputs failed validation",
    "details": [
      {
        "index": 1,
        "errors": [
          {
            "code": "MISSING_REQUIRED_FIELD",
            "message": "club_name is required and must be a non-empty string",
            "field": "club_name",
            "value": null
          }
        ]
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

### 3. Get Club Health History

Retrieves historical health data for a specific club over a specified time period.

**Endpoint:** `GET /api/club-health/{clubName}/history`

#### Path Parameters

- **clubName** (string, required): Name of the club (URL encoded)

#### Query Parameters

- **months** (number, optional): Number of months of history to retrieve (1-24, default: 12)

#### Example Request

```
GET /api/club-health/Downtown%20Speakers/history?months=6
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "club_name": "Downtown Speakers",
    "months_requested": 6,
    "history": [
      {
        "evaluation_date": "2024-10-01T00:00:00.000Z",
        "health_status": "Thriving",
        "trajectory": "Recovering",
        "members": 25,
        "dcp_goals": 3
      },
      {
        "evaluation_date": "2024-09-01T00:00:00.000Z",
        "health_status": "Vulnerable",
        "trajectory": "Stable",
        "members": 23,
        "dcp_goals": 2
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z",
    "record_count": 2
  }
}
```

#### Error Responses

**400 Bad Request - Invalid Club Name**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CLUB_NAME",
    "message": "Club name must be a non-empty string"
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

**400 Bad Request - Invalid Months Parameter**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_MONTHS_PARAMETER",
    "message": "Months parameter must be a number between 1 and 24"
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "error": {
    "code": "HISTORY_RETRIEVAL_ERROR",
    "message": "Failed to retrieve club health history"
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

### 4. Get District Health Summary

Retrieves aggregate health statistics for all clubs in a district.

**Endpoint:** `GET /api/districts/{districtId}/health-summary`

#### Path Parameters

- **districtId** (string, required): District identifier (alphanumeric)

#### Example Request

```
GET /api/districts/D42/health-summary
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "district_id": "D42",
    "total_clubs": 45,
    "health_distribution": {
      "Thriving": 20,
      "Vulnerable": 18,
      "Intervention Required": 7
    },
    "trajectory_distribution": {
      "Recovering": 15,
      "Stable": 22,
      "Declining": 8
    },
    "clubs_needing_attention": [
      {
        "club_name": "Struggling Speakers",
        "health_status": "Intervention Required",
        "trajectory": "Declining",
        "composite_key": "Intervention Required__Declining",
        "composite_label": "Intervention Required · Declining",
        "reasons": [
          "Membership below intervention threshold: 8 members (<12 required)",
          "Insufficient growth: -2 members since July (<3 required for override)"
        ]
      }
    ],
    "evaluation_date": "2024-10-15T14:30:00.000Z"
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Invalid District ID**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DISTRICT_ID",
    "message": "Invalid district ID format. District ID must be alphanumeric."
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

**404 Not Found**

```json
{
  "success": false,
  "error": {
    "code": "DISTRICT_NOT_FOUND",
    "message": "District not found or no health data available"
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "error": {
    "code": "SUMMARY_RETRIEVAL_ERROR",
    "message": "Failed to retrieve district health summary"
  },
  "metadata": {
    "timestamp": "2024-10-15T14:30:00.000Z"
  }
}
```

## Error Codes Reference

### Validation Errors (400)

| Code                       | Description                                           |
| -------------------------- | ----------------------------------------------------- |
| `VALIDATION_ERROR`         | General validation failure                            |
| `INVALID_INPUT_TYPE`       | Input is not the expected type                        |
| `MISSING_REQUIRED_FIELD`   | Required field is missing or empty                    |
| `INVALID_FIELD_TYPE`       | Field has incorrect data type                         |
| `INVALID_FIELD_VALUE`      | Field value is outside acceptable range               |
| `INVALID_MONTH`            | Month value is not a valid Toastmasters program month |
| `INVALID_HEALTH_STATUS`    | Health status value is not valid                      |
| `EMPTY_INPUT_ARRAY`        | Batch input array is empty                            |
| `INPUT_ARRAY_TOO_LARGE`    | Batch input exceeds maximum size                      |
| `BATCH_VALIDATION_ERROR`   | One or more items in batch failed validation          |
| `INVALID_DISTRICT_ID`      | District ID format is invalid                         |
| `INVALID_CLUB_NAME`        | Club name format is invalid                           |
| `INVALID_MONTHS_PARAMETER` | Months parameter is out of range                      |

### Processing Errors (500)

| Code                         | Description                            |
| ---------------------------- | -------------------------------------- |
| `CLASSIFICATION_ERROR`       | Failed to classify club health         |
| `BATCH_CLASSIFICATION_ERROR` | Failed to process batch classification |
| `HISTORY_RETRIEVAL_ERROR`    | Failed to retrieve club history        |
| `SUMMARY_RETRIEVAL_ERROR`    | Failed to retrieve district summary    |
| `INTERNAL_SERVER_ERROR`      | General server error                   |

### Resource Errors (404)

| Code                 | Description                             |
| -------------------- | --------------------------------------- |
| `DISTRICT_NOT_FOUND` | District not found or no data available |
| `NOT_FOUND`          | General resource not found              |

### Other Errors

| Code              | Description                | Status |
| ----------------- | -------------------------- | ------ |
| `REQUEST_TIMEOUT` | Request processing timeout | 408    |
| `UNAUTHORIZED`    | Authentication required    | 401    |

## Business Rules

### Health Status Classification

1. **Intervention Required**: Membership < 12 AND net growth since July < 3
2. **Thriving**: All requirements met (membership, DCP, CSP)
3. **Vulnerable**: Some but not all requirements met

### Membership Requirements

- **Met if**: Current members ≥ 20 OR net growth since July ≥ 3
- **Not met**: Current members < 20 AND net growth since July < 3

### DCP Requirements by Month

| Month             | Required Goals           |
| ----------------- | ------------------------ |
| August, September | 1+                       |
| October, November | 2+                       |
| December, January | 3+                       |
| February, March   | 4+                       |
| April, May, June  | 5+                       |
| July              | Officer list OR training |

### Trajectory Classification

1. **Recovering**: Health status improved from previous month
2. **Declining**: Health status worsened from previous month
3. **Stable**: Health status unchanged, determined by momentum:
   - Vulnerable clubs with +2 members → Recovering
   - Vulnerable clubs losing members/DCP → Declining
   - Otherwise → Stable

## Integration Guide

### Getting Started

1. **Base URL**: Use `/api/club-health` as the base for all endpoints
2. **Content-Type**: Always send `application/json` for POST requests
3. **Error Handling**: Check the `success` field in responses
4. **Rate Limiting**: Implement exponential backoff for rate limit errors

### Example Integration (JavaScript)

```javascript
class ClubHealthAPI {
  constructor(baseURL) {
    this.baseURL = baseURL
  }

  async classifyClub(clubData) {
    const response = await fetch(`${this.baseURL}/api/club-health/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clubData),
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(`API Error: ${result.error.message}`)
    }

    return result.data
  }

  async getClubHistory(clubName, months = 12) {
    const encodedName = encodeURIComponent(clubName)
    const response = await fetch(
      `${this.baseURL}/api/club-health/${encodedName}/history?months=${months}`
    )

    const result = await response.json()

    if (!result.success) {
      throw new Error(`API Error: ${result.error.message}`)
    }

    return result.data
  }

  async getDistrictSummary(districtId) {
    const response = await fetch(
      `${this.baseURL}/api/districts/${districtId}/health-summary`
    )

    const result = await response.json()

    if (!result.success) {
      throw new Error(`API Error: ${result.error.message}`)
    }

    return result.data
  }
}

// Usage
const api = new ClubHealthAPI('https://your-domain.com')

try {
  const classification = await api.classifyClub({
    club_name: 'Downtown Speakers',
    current_members: 25,
    member_growth_since_july: 5,
    current_month: 'October',
    dcp_goals_achieved_ytd: 3,
    csp_submitted: true,
    officer_list_submitted: true,
    officers_trained: true,
    previous_month_members: 23,
    previous_month_dcp_goals_achieved_ytd: 2,
    previous_month_health_status: 'Vulnerable',
  })

  console.log('Club Health:', classification.health_status)
  console.log('Trajectory:', classification.trajectory)
} catch (error) {
  console.error('Classification failed:', error.message)
}
```

### Example Integration (Python)

```python
import requests
from typing import Dict, List, Optional

class ClubHealthAPI:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def classify_club(self, club_data: Dict) -> Dict:
        response = self.session.post(
            f"{self.base_url}/api/club-health/classify",
            json=club_data
        )

        result = response.json()

        if not result['success']:
            raise Exception(f"API Error: {result['error']['message']}")

        return result['data']

    def get_club_history(self, club_name: str, months: int = 12) -> Dict:
        response = self.session.get(
            f"{self.base_url}/api/club-health/{club_name}/history",
            params={'months': months}
        )

        result = response.json()

        if not result['success']:
            raise Exception(f"API Error: {result['error']['message']}")

        return result['data']

    def get_district_summary(self, district_id: str) -> Dict:
        response = self.session.get(
            f"{self.base_url}/api/districts/{district_id}/health-summary"
        )

        result = response.json()

        if not result['success']:
            raise Exception(f"API Error: {result['error']['message']}")

        return result['data']

# Usage
api = ClubHealthAPI('https://your-domain.com')

try:
    classification = api.classify_club({
        'club_name': 'Downtown Speakers',
        'current_members': 25,
        'member_growth_since_july': 5,
        'current_month': 'October',
        'dcp_goals_achieved_ytd': 3,
        'csp_submitted': True,
        'officer_list_submitted': True,
        'officers_trained': True,
        'previous_month_members': 23,
        'previous_month_dcp_goals_achieved_ytd': 2,
        'previous_month_health_status': 'Vulnerable'
    })

    print(f"Club Health: {classification['health_status']}")
    print(f"Trajectory: {classification['trajectory']}")
except Exception as error:
    print(f"Classification failed: {error}")
```

## Performance Considerations

### Response Times

- **Single Classification**: < 100ms (95th percentile)
- **Batch Classification**: < 10 seconds for 100 clubs (95th percentile)
- **History Retrieval**: < 500ms (95th percentile)
- **District Summary**: < 2 seconds (95th percentile)

### Caching

- **History Endpoint**: 30-minute cache TTL
- **District Summary**: 20-minute cache TTL
- **Classification Endpoints**: No caching (real-time processing)

### Best Practices

1. **Use Batch Endpoint**: For multiple clubs, use batch processing instead of individual requests
2. **Implement Retry Logic**: Use exponential backoff for transient failures
3. **Cache Results**: Cache classification results on your side when appropriate
4. **Monitor Rate Limits**: Implement proper rate limiting in your application
5. **Validate Input**: Pre-validate input data to reduce API errors

## Changelog

### Version 1.0.0 (Current)

- Initial API release
- Single club classification endpoint
- Batch club classification endpoint
- Club health history endpoint
- District health summary endpoint
- Comprehensive validation and error handling
- Consistent response format
- Rate limiting implementation

### Planned Features

- **Authentication**: JWT-based authentication with role-based access
- **Webhooks**: Real-time notifications for health status changes
- **Bulk Export**: CSV/Excel export endpoints for large datasets
- **Advanced Filtering**: Enhanced filtering options for district summaries
- **Real-time Updates**: WebSocket support for live dashboard updates

## Support

For API support, integration questions, or bug reports:

- **Documentation**: This document and inline code comments
- **Error Handling**: All errors include descriptive messages and error codes
- **Logging**: All API requests are logged for debugging purposes
- **Monitoring**: API performance and availability are continuously monitored

## Security

### Current Implementation

- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Rate limiting
- Error message sanitization (no sensitive data exposure)

### Future Security Features

- JWT authentication
- Role-based access control (RBAC)
- API key management
- Request signing
- Audit logging
- Data encryption at rest and in transit
