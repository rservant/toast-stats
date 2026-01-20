# Implementation Plan: Ranking Consistency Fix

## Overview

This plan implements the fix for the global ranking discrepancy between the main rankings page and the Global Rankings tab. The approach is to add `overallRank` to the backend rank-history API response and update the frontend to use it instead of calculating by averaging category ranks.

## Tasks

- [x] 1. Update TypeScript types for HistoricalRankPoint
  - [x] 1.1 Add optional overallRank field to frontend HistoricalRankPoint interface
    - Add `overallRank?: number` to `frontend/src/types/districts.ts`
    - Field is optional for backward compatibility with existing data
    - _Requirements: 4.1, 4.2_

- [x] 2. Update backend rank-history endpoint to include overallRank
  - [x] 2.1 Modify rank-history endpoint to calculate overallRank for each history entry
    - In `backend/src/routes/districts/core.ts`, update the history building loop
    - Sort all districts in snapshot by aggregateScore descending
    - Find target district's position (1-indexed) as overallRank
    - Add overallRank to each HistoryEntry
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Write unit tests for overallRank calculation in rank-history endpoint
    - Test district ranked #1 gets overallRank = 1
    - Test district in middle position gets correct overallRank
    - Test district ranked last gets overallRank = totalDistricts
    - Test tied aggregate scores get same overallRank
    - _Requirements: 2.2_

- [x] 3. Checkpoint - Verify backend changes
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 4. Update frontend useGlobalRankings hook to use overallRank
  - [x] 4.1 Update extractEndOfYearRankings to use overallRank from API
    - In `frontend/src/hooks/useGlobalRankings.ts`
    - Replace averaging calculation with `latestPoint.overallRank`
    - Add fallback for legacy data without overallRank
    - _Requirements: 3.1, 3.4_
  - [x] 4.2 Update buildYearlyRankingSummaries to use overallRank from API
    - In `frontend/src/hooks/useGlobalRankings.ts`
    - Replace averaging calculation with `latestPoint.overallRank`
    - Add fallback for legacy data without overallRank
    - _Requirements: 3.3, 3.4_
  - [x] 4.3 Write unit tests for updated useGlobalRankings functions
    - Test extractEndOfYearRankings uses overallRank when present
    - Test extractEndOfYearRankings fallback when overallRank missing
    - Test buildYearlyRankingSummaries uses overallRank when present
    - _Requirements: 3.1, 3.3, 3.4_

- [x] 5. Final checkpoint - Verify all changes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- The fix is backward compatible - existing snapshots without overallRank will use fallback calculation
- No changes needed to LandingPage.tsx as it already uses correct ranking
