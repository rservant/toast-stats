# Implementation Plan: Frontend Code Splitting

## Overview

This plan implements route-based code splitting by converting static page imports to React.lazy() dynamic imports, adding Suspense boundaries with LoadingSkeleton fallbacks, and implementing error boundaries for chunk loading failures.

## Tasks

- [ ] 1. Convert page imports to lazy loading
  - [ ] 1.1 Update App.tsx imports to use React.lazy()
    - Import `lazy` and `Suspense` from React
    - Convert all five page component imports to lazy() with dynamic import()
    - Remove static imports for LandingPage, DistrictDetailPage, DistrictConfigurationPage, AdminDashboardPage, AdminPage
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Implement Suspense fallback component
  - [ ] 2.1 Create PageLoadingFallback component in App.tsx
    - Create a functional component that renders LoadingSkeleton components
    - Include card, chart, and table skeleton variants for realistic page loading appearance
    - Ensure proper accessibility with existing LoadingSkeleton ARIA attributes
    - _Requirements: 2.2, 2.3, 2.4_

- [ ] 3. Add Suspense boundaries to routes
  - [ ] 3.1 Wrap each route element with Suspense
    - Wrap LandingPage route with Suspense and PageLoadingFallback
    - Wrap DistrictDetailPage route with Suspense and PageLoadingFallback
    - Wrap DistrictConfigurationPage route with Suspense and PageLoadingFallback
    - Wrap AdminDashboardPage route with Suspense and PageLoadingFallback
    - Wrap AdminPage route with Suspense and PageLoadingFallback
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Implement error boundary for chunk loading failures
  - [ ] 4.1 Create ChunkErrorBoundary class component
    - Implement React error boundary with getDerivedStateFromError
    - Track error state and provide reset mechanism
    - _Requirements: 5.1, 5.3_
  
  - [ ] 4.2 Create ChunkLoadError display component
    - Display user-friendly error message
    - Include retry button that reloads the page
    - Style consistently with application design
    - _Requirements: 5.2_
  
  - [ ] 4.3 Wrap router with ChunkErrorBoundary
    - Add error boundary around RouterProvider or route elements
    - Ensure errors are caught at appropriate level
    - _Requirements: 5.1, 5.3_

- [ ] 5. Checkpoint - Verify implementation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify TypeScript compilation succeeds with no errors
  - Verify routes still navigate correctly

- [ ] 6. Write tests for code splitting
  - [ ]* 6.1 Write unit tests for PageLoadingFallback
    - Test that component renders skeleton elements
    - Test accessibility attributes are present
    - _Requirements: 2.3, 2.4_
  
  - [ ]* 6.2 Write unit tests for ChunkErrorBoundary
    - Test error catching behavior
    - Test retry functionality
    - _Requirements: 5.1, 5.2_
  
  - [ ]* 6.3 Write property test for fallback display
    - **Property 1: Fallback Display During Loading**
    - **Validates: Requirements 2.2**
  
  - [ ]* 6.4 Write property test for error containment
    - **Property 3: Error Boundary Containment**
    - **Validates: Requirements 5.1, 5.3**

- [ ] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify bundle output contains separate chunks for each page
  - Verify initial bundle size is reduced

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The implementation uses existing LoadingSkeleton component for fallback UI
- Vite automatically handles chunk generation for dynamic imports
- Error boundary uses page reload for retry since chunk caching may cause issues with simple re-render
