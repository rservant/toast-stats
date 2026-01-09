# Implementation Plan: Assessment Module Removal

## Overview

This plan systematically removes the Assessment module from both backend and frontend, verifying compilation and functionality at each step. The approach is bottom-up: remove route registration first, then delete files, then clean up references.

## Tasks

- [x] 1. Remove backend Assessment route registration
  - [x] 1.1 Remove assessment route import from `backend/src/index.ts`
    - Delete line: `import assessmentRoutes from './modules/assessment/routes/assessmentRoutes.js'`
    - _Requirements: 1.1_
  - [x] 1.2 Remove assessment route mounting from `backend/src/index.ts`
    - Delete lines: `// Assessment routes` and `app.use('/api/assessment', assessmentRoutes)`
    - _Requirements: 1.2_
  - [x] 1.3 Verify backend compiles after route removal
    - Run `npx tsc --noEmit` in backend directory
    - _Requirements: 1.3_

- [x] 2. Delete backend Assessment module directory
  - [x] 2.1 Delete the entire `backend/src/modules/assessment/` directory
    - This removes all services, routes, types, tests, config, storage, utils, and documentation
    - _Requirements: 3.1_
  - [x] 2.2 Verify backend compiles after module deletion
    - Run `npx tsc --noEmit` in backend directory
    - _Requirements: 1.3_
  - [x] 2.3 Verify backend tests pass after module deletion
    - Run `npm test` in backend directory
    - _Requirements: 1.4_

- [x] 3. Checkpoint - Backend removal complete
  - Ensure backend compiles and tests pass
  - Ask user if questions arise

- [x] 4. Remove frontend Assessment components
  - [x] 4.1 Update DistrictDetailPage to remove Assessment tab
    - Remove import: `import AssessmentPanel from '../components/AssessmentPanel'`
    - Remove `'assessment'` from TabType union type
    - Remove `{ id: 'assessment', label: 'Assessment' }` from tabs array
    - Remove the `{activeTab === 'assessment' && ...}` conditional rendering block
    - _Requirements: 2.1_
  - [x] 4.2 Delete `frontend/src/components/AssessmentPanel.tsx`
    - _Requirements: 3.2, 2.2_
  - [x] 4.3 Delete `frontend/src/hooks/useAssessment.ts`
    - _Requirements: 3.3, 2.3_
  - [x] 4.4 Verify frontend compiles after component removal
    - Run `npm run build` in frontend directory
    - _Requirements: 2.4, 5.2_
  - [x] 4.5 Verify frontend tests pass after component removal
    - Run `npm test` in frontend directory
    - _Requirements: 2.5_

- [x] 5. Checkpoint - Frontend removal complete
  - Ensure frontend builds and tests pass
  - Ask user if questions arise

- [x] 6. Archive Assessment-related specs
  - [x] 6.1 Move `001-assessment-worksheet-generator` spec to archive
    - Move `.kiro/specs/001-assessment-worksheet-generator/` to `.kiro/specs-archive/001-assessment-worksheet-generator/`
    - _Requirements: 4.1, 4.2_

- [x] 7. Final verification
  - [x] 7.1 Search for orphaned assessment references
    - Run grep search for "assessment" in TypeScript/TSX files
    - Verify no orphaned imports or references remain
    - _Requirements: 3.4_
  - [x] 7.2 Verify complete system functionality
    - Start backend server
    - Build and serve frontend
    - Navigate to District Detail page and confirm Assessment tab is absent
    - Verify remaining tabs work correctly
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

## Notes

- This is a deletion-focused task list with verification steps
- Each checkpoint ensures the system remains functional before proceeding
- The order is important: backend first, then frontend, to avoid broken API calls during transition
- All acceptance criteria are verified through compilation, test execution, and manual verification
