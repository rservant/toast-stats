# Spec Creation Prompt: Snapshot Data Architecture Fix

## Problem Statement

The current snapshot data architecture has a critical design flaw where system-wide "All Districts CSV" data is duplicated across individual district records, violating DRY principles and creating data inconsistency risks.

**Current Problematic Pattern:**

```typescript
// All Districts CSV data duplicated in every district
interface DistrictStatistics {
  districtId: string
  districtPerformance?: ScrapedRecord[] // Contains All Districts CSV data
  // ... other fields
}

// RankingCalculator accesses duplicated data
const districtPerformance = district
  .districtPerformance?.[0] as AllDistrictsCSVRecord
```

**Root Cause:**

- `collector.getAllDistricts()` returns system-wide ranking data for all districts
- This data gets stored in each district's `districtPerformance[0]` field
- Borda Count rankings are calculated from this duplicated data
- District-specific data from `collector.getDistrictPerformance(districtId)` gets mixed with system-wide data

## Specification Requirements

Create a comprehensive specification to fix this architectural issue with the following requirements:

### 1. Data Separation

- **System-wide data** (All Districts CSV) should be stored once per snapshot at the snapshot level
- **District-specific data** should remain in individual district records
- Clear separation between ranking source data and district operational data

### 2. Snapshot Structure Redesign

- Add `allDistrictsData: AllDistrictsCSVRecord[]` to snapshot payload
- Ensure `districtPerformance` contains only district-specific performance data
- Design clean structure from scratch (greenfield approach)

### 3. Ranking Calculation Refactor

- Update `BordaCountRankingCalculator` to use centralized `allDistrictsData`
- Remove dependency on duplicated data in `district.districtPerformance[0]`
- Ensure ranking calculations remain identical (no behavioral changes)

### 4. Data Flow Updates

- Update `RefreshService.normalizeData()` to properly separate data types
- Update scraping workflow to distinguish between system-wide and district-specific data
- Update snapshot creation to store data in correct locations
- Implement clean data flow from scratch (greenfield approach)

### 5. API Compatibility

- Ensure `/api/districts/rankings` endpoint continues to work unchanged
- Maintain all existing API response formats
- No breaking changes to frontend or external consumers

### 6. Storage Implementation

- Update both `FileSnapshotStore` and `PerDistrictSnapshotStore` implementations
- Implement clean storage structure from scratch (greenfield approach)
- Ensure storage efficiency improvements from reduced duplication

### 7. Testing Strategy

- Golden tests to ensure ranking calculations remain identical
- Integration tests for snapshot creation and retrieval
- Property-based tests for data consistency
- Tests for new clean data structure implementation

### 8. Performance Considerations

- Reduce storage overhead from eliminated duplication
- Maintain or improve ranking calculation performance
- Ensure no regression in API response times

## Constraints and Considerations

### Steering Document Alignment

- **Production Maintenance**: Maintain operational simplicity and low overhead
- **Snapshot Immutability**: Preserve immutable snapshot characteristics
- **Last-Known-Good Data**: Ensure no disruption to current data availability
- **Testing Focus**: Concentrate on correctness of ranking calculations

### Implementation Constraints

- **No Behavioral Changes**: Rankings must calculate identically
- **Clean Implementation**: Greenfield approach with proper data separation
- **Zero Downtime**: Implementation must not disrupt service availability
- **Single-User Deployment**: Solution must work in current deployment model

### Risk Mitigation

- **Data Integrity**: Ensure proper data separation in new implementation
- **Calculation Accuracy**: Preserve exact ranking algorithm behavior
- **Implementation Quality**: Comprehensive testing of new data structure
- **Monitoring**: Detect any inconsistencies in new implementation

## Deliverables Expected

1. **Requirements Document**: Detailed functional and non-functional requirements
2. **Design Document**: New snapshot structure, data flow diagrams, API contracts
3. **Implementation Plan**: Clean implementation strategy for proper data separation
4. **Testing Strategy**: Comprehensive test plan including golden tests and property tests
5. **Implementation Guide**: Instructions for clean greenfield implementation

## Success Criteria

- [ ] All Districts CSV data stored once per snapshot (not duplicated)
- [ ] Ranking calculations produce identical results
- [ ] All existing APIs continue to work unchanged
- [ ] Storage overhead reduced through eliminated duplication
- [ ] Comprehensive test coverage ensures correctness
- [ ] Documentation updated to reflect new architecture

## Context Files to Reference

- `docs/BACKEND_ARCHITECTURE.md` - Current architecture documentation
- `backend/src/services/RankingCalculator.ts` - Current ranking implementation
- `backend/src/services/RefreshService.ts` - Data normalization logic
- `backend/src/types/snapshots.ts` - Current snapshot structure
- `backend/src/types/districts.ts` - District data types
- `.kiro/steering/production-maintenance.md` - Operational constraints
- `.kiro/steering/testing.md` - Testing requirements

## Additional Instructions

- Follow the existing spec template structure used in `.kiro/specs/`
- Include mermaid diagrams for data flow visualization
- Provide concrete TypeScript interface definitions
- Consider both FileSnapshotStore and PerDistrictSnapshotStore implementations
- Address potential edge cases and error scenarios
- Include performance impact analysis
- Provide clear acceptance criteria for each requirement

This specification should result in a cleaner, more maintainable architecture that eliminates data duplication while preserving all existing functionality and ensuring ranking calculation accuracy.
