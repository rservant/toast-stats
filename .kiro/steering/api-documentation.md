# API Documentation Steering Document

**Status:** Authoritative  
**Applies to:** All backend API routes and endpoints  
**Audience:** All developers and automation agents (including Kiro)  
**Owner:** Development Team

---

## 1. Purpose

This document defines **mandatory API documentation standards** for this codebase.

Its goals are to:

- Ensure all API endpoints are documented in OpenAPI specification
- Maintain synchronization between implementation and documentation
- Enable accurate API gateway configuration for production deployment
- Provide clear API contracts for frontend development

This document is **normative**.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be interpreted as described in RFC 2119.

Kiro MUST treat this document as the **primary source of truth** for all API documentation decisions.

---

## 2. Authority Model

In the event of conflict, API documentation rules MUST be applied according to the following precedence order (highest first):

1. **This Steering Document**
2. OpenAPI specification (`backend/openapi.yaml`)
3. Route implementation code
4. Inline code comments

Lower-precedence sources MUST NOT contradict higher-precedence rules.

---

## 3. Scope

This document applies to all code that:

- Creates new API endpoints
- Modifies existing API endpoint signatures
- Changes request/response schemas
- Adds or removes query parameters
- Changes HTTP methods or status codes

There are **no exceptions** for admin endpoints, internal endpoints, or test endpoints.

---

## 4. Core Principles

All API changes MUST adhere to the following principles:

1. **Documentation-first mindset**  
   API documentation is a first-class artifact, not an afterthought.

2. **Single source of truth**  
   `backend/openapi.yaml` is the authoritative API specification.

3. **Synchronization requirement**  
   Implementation and documentation MUST remain synchronized.

4. **Production deployment dependency**  
   The OpenAPI spec is used for API Gateway configuration in production.

---

## 5. OpenAPI Specification Locations

This project maintains **two** OpenAPI specification files for different purposes:

### 5.1 Production API Gateway Configuration

```
backend/openapi.yaml
```

This file:

- Uses **Swagger 2.0** format (required for Google Cloud API Gateway)
- Contains `x-google-backend` directives for routing
- Is deployed to Google Cloud API Gateway
- **MUST** be updated when adding/modifying production endpoints

### 5.2 Developer Documentation

```
docs/openapi.yaml
```

This file:

- Uses **OpenAPI 3.0.3** format
- Provides detailed developer documentation
- Includes comprehensive request/response schemas
- **SHOULD** be updated to match production endpoints

### 5.3 Synchronization Requirement

Both files **MUST** document the same endpoints. When adding new API routes:

1. **MUST** add to `backend/openapi.yaml` (production gateway)
2. **SHOULD** add to `docs/openapi.yaml` (developer docs)

The `backend/openapi.yaml` is the **authoritative source** for production routing.

---

## 6. Required Documentation Elements

### 6.1 For Each Endpoint

Every API endpoint MUST include:

```yaml
/path/to/endpoint:
  method:
    summary: Brief description of what the endpoint does
    operationId: uniqueOperationIdentifier
    tags:
      - CategoryTag
    x-google-backend:
      address: https://backend-service-url
      path_translation: APPEND_PATH_TO_ADDRESS
    produces:
      - application/json
    parameters:
      # All path, query, and body parameters
    responses:
      '200':
        description: Success response description
      '400':
        description: Bad request scenarios
      '404':
        description: Not found scenarios
      '500':
        description: Internal server error
```

### 6.2 For Request Bodies

Request body schemas MUST include:

- Property names and types
- Required vs optional designation
- Description for each property
- Enum values where applicable
- Format specifications (date, uuid, etc.)

### 6.3 For Response Bodies

Response documentation SHOULD include:

- Success response structure
- Error response structure
- Status code meanings

---

## 7. Synchronization Requirements

### 7.1 When Adding New Endpoints

When creating a new API route:

1. **MUST** add corresponding entry to `backend/openapi.yaml`
2. **MUST** include all parameters (path, query, body)
3. **MUST** document all response codes
4. **SHOULD** add to appropriate tag category

### 7.2 When Modifying Existing Endpoints

When changing an existing API route:

1. **MUST** update `backend/openapi.yaml` to reflect changes
2. **MUST** update parameter definitions if changed
3. **MUST** update response schemas if changed
4. **MUST NOT** remove documentation for endpoints still in use

### 7.3 When Deprecating Endpoints

When deprecating an API route:

1. **SHOULD** add `deprecated: true` to the endpoint
2. **SHOULD** add deprecation notice in description
3. **MUST NOT** remove from OpenAPI until endpoint is removed from code

---

## 8. Prohibited Patterns

### 8.1 Undocumented Endpoints

Creating API endpoints without corresponding OpenAPI documentation is **FORBIDDEN**.

```typescript
// ❌ FORBIDDEN - New endpoint without OpenAPI entry
router.post('/api/admin/new-feature', handler)

// ✅ CORRECT - Add to openapi.yaml first, then implement
```

### 8.2 Documentation Drift

Allowing implementation to diverge from documentation is **FORBIDDEN**.

If the implementation changes:

- Parameter names
- Request/response schemas
- HTTP methods
- Status codes

The OpenAPI specification **MUST** be updated in the same change.

---

## 9. Tag Categories

Endpoints SHOULD be organized into these tag categories:

| Tag       | Description                        |
| --------- | ---------------------------------- |
| Health    | Health check and status endpoints  |
| Districts | District data retrieval endpoints  |
| Rankings  | Ranking and comparison endpoints   |
| Analytics | Analytics and insights endpoints   |
| Backfill  | Data backfill operation endpoints  |
| Admin     | Administrative operation endpoints |
| Cache     | Cache management endpoints         |
| Config    | Configuration management endpoints |

---

## 10. Spec-Driven Development Integration

When implementing features via specs:

1. **Requirements phase**: Identify API endpoints needed
2. **Design phase**: Document endpoint contracts in design.md
3. **Tasks phase**: Include OpenAPI update as explicit task
4. **Implementation phase**: Update openapi.yaml alongside route code

### 10.1 Task Template for API Endpoints

When a spec includes new API endpoints, tasks SHOULD include:

```markdown
- [ ] X.Y Update OpenAPI specification
  - Add endpoint definition to `backend/openapi.yaml`
  - Document all parameters and responses
  - Add to appropriate tag category
  - _Requirements: [relevant requirements]_
```

---

## 11. Validation

### 11.1 Manual Validation

Before merging changes that affect API endpoints:

1. Verify endpoint exists in `backend/openapi.yaml`
2. Verify parameters match implementation
3. Verify response codes are documented

### 11.2 Production Deployment

The OpenAPI specification is deployed to Google Cloud API Gateway.

Changes to `backend/openapi.yaml`:

- Affect production API routing
- Require gateway redeployment
- Should be tested in staging first

---

## 12. Enforcement

API documentation violations are **blocking** for production deployment.

Code review MUST verify:

- New endpoints have OpenAPI entries
- Modified endpoints have updated documentation
- Deprecated endpoints are marked appropriately

---

## 13. Final Rules

> **All API endpoints MUST be documented in backend/openapi.yaml.**  
> **Implementation and documentation MUST remain synchronized.**  
> **Undocumented endpoints are forbidden.**  
> **OpenAPI updates are required when adding or modifying routes.**
