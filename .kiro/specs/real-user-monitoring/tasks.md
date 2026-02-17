# Implementation Plan: Real User Monitoring

## Overview

This plan implements Real User Monitoring (RUM) by installing the web-vitals library, creating a frontend collection module, implementing a backend analytics endpoint, and integrating the collection into the application entry point.

## Tasks

- [ ] 1. Install web-vitals dependency
  - [ ] 1.1 Add web-vitals to frontend package.json
    - Run `npm install web-vitals` in frontend directory
    - Verify package.json includes web-vitals ^3.0.0 or higher
    - _Requirements: 1.3_

- [ ] 2. Create frontend webVitals module
  - [ ] 2.1 Create webVitals.ts utility file
    - Create `frontend/src/utils/webVitals.ts`
    - Import Metric type from web-vitals
    - Define VitalsPayload interface with all required fields
    - _Requirements: 3.1, 6.1_
  - [ ] 2.2 Implement isProduction helper function
    - Check hostname for localhost and 127.0.0.1
    - Return false for development, true for production
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ] 2.3 Implement sendToAnalytics function
    - Create VitalsPayload from Metric object
    - Serialize payload as JSON
    - Use SendBeacon API with fetch fallback
    - Skip transmission in development
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2_
  - [ ] 2.4 Implement initWebVitals function
    - Dynamically import web-vitals library
    - Register listeners for LCP, FID, CLS, INP, TTFB
    - Handle import failure gracefully
    - _Requirements: 1.1, 1.2, 1.4_

- [ ] 3. Create backend analytics endpoint
  - [ ] 3.1 Create analytics route file
    - Create `backend/src/routes/analytics.ts`
    - Import Router from express and z from zod
    - _Requirements: 4.1_
  - [ ] 3.2 Implement Zod validation schema
    - Define vitalsPayloadSchema with all required fields
    - Use z.enum for name and rating fields
    - Use z.number for value and delta
    - Use z.string for id and navigationType
    - _Requirements: 4.4, 6.2_
  - [ ] 3.3 Implement POST /vitals handler
    - Validate request body with Zod schema
    - Return 400 for invalid payloads with error details
    - Return 204 for valid payloads
    - Log metric in structured format for Cloud Monitoring
    - _Requirements: 4.2, 4.3, 4.5_
  - [ ] 3.4 Register analytics routes in backend index
    - Import analytics routes in backend/src/index.ts
    - Mount at /api/analytics path
    - _Requirements: 4.1_

- [ ] 4. Update OpenAPI specification
  - [ ] 4.1 Add /api/analytics/vitals endpoint to openapi.yaml
    - Document POST method with request body schema
    - Document 204 and 400 response codes
    - Add to appropriate tag category
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Integrate webVitals into application
  - [ ] 5.1 Call initWebVitals in main.tsx
    - Import initWebVitals from utils/webVitals
    - Call initWebVitals() after React app renders
    - _Requirements: 1.1_

- [ ] 6. Checkpoint - Verify implementation
  - Ensure TypeScript compilation succeeds with no errors
  - Verify backend starts without errors
  - Verify frontend builds without errors
  - Test endpoint manually with curl

- [ ] 7. Write tests
  - [ ]\* 7.1 Write unit tests for isProduction function
    - Test localhost returns false
    - Test 127.0.0.1 returns false
    - Test production hostname returns true
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]\* 7.2 Write unit tests for backend validation
    - Test valid payload returns 204
    - Test missing fields returns 400
    - Test invalid metric name returns 400
    - _Requirements: 4.2, 4.3, 4.4_
  - [ ]\* 7.3 Write property test for payload round-trip
    - **Property 1: Metric Payload Round-Trip**
    - **Validates: Requirements 3.2, 3.3**
  - [ ]\* 7.4 Write property test for production detection
    - **Property 2: Production Environment Detection**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass
  - Verify metrics are logged in backend when accessed from non-localhost

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The web-vitals library is dynamically imported to avoid blocking initial load
- SendBeacon is preferred over fetch for reliability during page unload
- Metrics are best-effort; failures are silently ignored to avoid impacting UX
- Backend logging uses structured format compatible with Cloud Monitoring
