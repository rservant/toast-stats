# Design Document: Assessment Module Removal

## Overview

This design describes the systematic removal of the Assessment module from the Toast-Stats application. The removal involves deleting backend module files, frontend components, updating route registrations, and cleaning up any orphaned references. The approach prioritizes safety by verifying compilation and test success at each step.

## Architecture

The Assessment module currently integrates with the system at these points:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend App                              │
│  ┌─────────────────┐    ┌──────────────────┐                    │
│  │ DistrictDetail  │───▶│ AssessmentPanel  │ ◀── TO BE REMOVED  │
│  │     Page        │    └──────────────────┘                    │
│  └─────────────────┘              │                             │
│                                   ▼                             │
│                    ┌──────────────────────┐                     │
│                    │  useAssessment Hook  │ ◀── TO BE REMOVED   │
│                    └──────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP API
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Server                            │
│  ┌─────────────────┐                                            │
│  │    index.ts     │──▶ app.use('/api/assessment', ...)         │
│  └─────────────────┘              │                             │
│                                   ▼                             │
│              ┌────────────────────────────────────┐             │
│              │  modules/assessment/               │             │
│              │  ├── routes/                       │             │
│              │  ├── services/                     │             │
│              │  ├── types/                        │             │
│              │  ├── config/                       │             │
│              │  ├── storage/                      │             │
│              │  ├── utils/                        │             │
│              │  └── __tests__/                    │ ◀── ALL TO  │
│              └────────────────────────────────────┘    BE REMOVED│
└─────────────────────────────────────────────────────────────────┘
```

### Removal Strategy

The removal follows a bottom-up approach:

1. Remove backend route registration (breaks API)
2. Delete backend module directory
3. Remove frontend component imports and usage
4. Delete frontend component and hook files
5. Archive or remove related specs
6. Verify compilation and tests

## Components and Interfaces

### Files to Remove

#### Backend Files

- `backend/src/modules/assessment/` (entire directory)
  - `__tests__/` - Test files
  - `config/` - Configuration files
  - `routes/` - Express route handlers
  - `scripts/` - Utility scripts
  - `services/` - Business logic
  - `storage/` - Data persistence
  - `types/` - TypeScript interfaces
  - `utils/` - Helper functions
  - Documentation files (README.md, etc.)

#### Frontend Files

- `frontend/src/components/AssessmentPanel.tsx`
- `frontend/src/hooks/useAssessment.ts`

### Files to Modify

#### Backend Modifications

- `backend/src/index.ts`
  - Remove: `import assessmentRoutes from './modules/assessment/routes/assessmentRoutes.js'`
  - Remove: `app.use('/api/assessment', assessmentRoutes)`

#### Frontend Modifications

- `frontend/src/pages/DistrictDetailPage.tsx`
  - Remove: `import AssessmentPanel from '../components/AssessmentPanel'`
  - Remove: `'assessment'` from `TabType` union
  - Remove: `{ id: 'assessment', label: 'Assessment' }` from tabs array
  - Remove: `{activeTab === 'assessment' && ...}` conditional rendering block

### Spec Files to Archive

- `.kiro/specs/001-assessment-worksheet-generator/` → Move to `.kiro/specs-archive/`

## Data Models

No data model changes required. The Assessment module uses its own isolated storage that will be deleted with the module.

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

Since this is a removal operation, the correctness properties focus on ensuring the system remains functional after removal.

### Property 1: Backend Compilation Integrity

_For any_ valid backend source state after removal, compiling the TypeScript code SHALL produce zero errors.
**Validates: Requirements 1.3, 5.1**

### Property 2: Frontend Compilation Integrity

_For any_ valid frontend source state after removal, building the React application SHALL produce zero errors.
**Validates: Requirements 2.4, 5.2**

### Property 3: No Orphaned Imports

_For any_ source file in the repository after removal, all import statements SHALL resolve to existing files.
**Validates: Requirements 3.4**

### Property 4: Tab Navigation Completeness

_For any_ District Detail page render after removal, the tab navigation SHALL include exactly the tabs: Overview, Clubs, Divisions & Areas, Trends, Analytics.
**Validates: Requirements 2.1, 5.4**

### Property 5: API Route Exclusion

_For any_ HTTP request to `/api/assessment/*` after removal, the Backend_Server SHALL return a 404 Not Found response.
**Validates: Requirements 1.2**

## Error Handling

### Compilation Errors

If compilation fails after file removal:

1. Check for orphaned imports in remaining files
2. Verify all removed file references are cleaned up
3. Run `grep -r "assessment" --include="*.ts" --include="*.tsx"` to find remaining references

### Test Failures

If tests fail after removal:

1. Identify if failing tests were testing Assessment functionality (should be deleted)
2. Check if failing tests have indirect dependencies on Assessment module
3. Update or remove affected tests as appropriate

## Testing Strategy

### Verification Approach

This removal operation uses verification testing rather than property-based testing, as the goal is to confirm absence of functionality rather than correctness of behavior.

### Unit Tests

- Verify no Assessment-related test files remain in test directories
- Verify remaining tests pass without Assessment module

### Integration Tests

- Verify backend server starts successfully
- Verify frontend application builds successfully
- Verify District Detail page renders without Assessment tab

### Manual Verification Checklist

1. Start backend server: `npm run dev` in backend directory
2. Build frontend: `npm run build` in frontend directory
3. Navigate to District Detail page
4. Confirm Assessment tab is not visible
5. Confirm all other tabs function correctly

### Compilation Verification Commands

```bash
# Backend TypeScript compilation
cd backend && npx tsc --noEmit

# Frontend build
cd frontend && npm run build

# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test
```
