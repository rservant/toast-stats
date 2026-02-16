# Design Document: Division and Area Data Wiring

## Overview

This design addresses the data format mismatch between the scraper-cli pipeline and the frontend's Divisions & Areas tab. The `DataTransformer` class in analytics-core currently discards raw CSV arrays during transformation, but the frontend's `extractDivisionPerformance` function requires these raw arrays to calculate division/area status and recognition levels.

The solution modifies the `DataTransformer` to preserve raw CSV arrays alongside transformed data. This follows the data-computation-separation steering document: scraper-cli generates the data, backend serves it as-is.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SCRAPER-CLI                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Raw CSV Files                    DataTransformer                            │
│  ┌──────────────────┐            ┌──────────────────────────────────────┐   │
│  │ club-performance │───────────▶│ transformRawCSV()                    │   │
│  │ .csv             │            │                                      │   │
│  ├──────────────────┤            │ 1. Parse CSV to 2D arrays            │   │
│  │ division-        │───────────▶│ 2. Convert to ScrapedRecord[]        │   │
│  │ performance.csv  │            │ 3. Extract transformed data          │   │
│  ├──────────────────┤            │ 4. Include raw arrays in output      │   │
│  │ district-        │───────────▶│                                      │   │
│  │ performance.csv  │            └──────────────┬───────────────────────┘   │
│  └──────────────────┘                           │                            │
│                                                 ▼                            │
│                              ┌──────────────────────────────────────────┐   │
│                              │ DistrictStatistics                       │   │
│                              │ ├── clubs: ClubStatistics[]              │   │
│                              │ ├── divisions: DivisionStatistics[]      │   │
│                              │ ├── areas: AreaStatistics[]              │   │
│                              │ ├── totals: DistrictTotals               │   │
│                              │ ├── clubPerformance: ScrapedRecord[]     │◀──NEW
│                              │ ├── divisionPerformance: ScrapedRecord[] │◀──NEW
│                              │ └── districtPerformance: ScrapedRecord[] │◀──NEW
│                              └──────────────────┬───────────────────────┘   │
│                                                 │                            │
│                              TransformService   │                            │
│                              ┌──────────────────▼───────────────────────┐   │
│                              │ Writes to:                               │   │
│                              │ snapshots/{date}/district_{id}.json      │   │
│                              └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                BACKEND                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SnapshotStore                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ readDistrictData(snapshotId, districtId)                             │   │
│  │ - Reads district_{id}.json from snapshot directory                   │   │
│  │ - Returns DistrictStatistics including raw arrays                    │   │
│  │ - NO computation, just file read                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  API Route: GET /api/districts/:districtId/statistics                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ - Serves DistrictStatistics from snapshot                            │   │
│  │ - Includes clubPerformance, divisionPerformance, districtPerformance │   │
│  │ - NO transformation or computation                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  useDistrictStatistics hook                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Fetches district statistics from API                                 │   │
│  │ Returns: { divisionPerformance, clubPerformance, ... }               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  extractDivisionPerformance()                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Processes raw CSV arrays to produce DivisionPerformance[]            │   │
│  │ - Reads Division Club Base, Area Club Base                           │   │
│  │ - Counts visit completions from Nov/May Visit award fields           │   │
│  │ - Determines distinguished status from Club Distinguished Status     │   │
│  │ - Calculates recognition levels and gaps                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  DivisionAreaRecognitionPanel                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Displays division/area performance cards and text recommendations    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Affected Components

| Package | File | Change Type |
|---------|------|-------------|
| shared-contracts | `src/types/district-statistics-file.ts` | Add raw data fields |
| shared-contracts | `src/types/scraped-record.ts` | New file - ScrapedRecord type |
| shared-contracts | `src/schemas/district-statistics-file.schema.ts` | Add Zod validation for raw data |
| analytics-core | `src/interfaces.ts` | Add raw data fields to DistrictStatistics |
| analytics-core | `src/transformation/DataTransformer.ts` | Preserve raw CSV arrays in output |
| backend | `src/types/districts.ts` | Verify compatibility (already has fields) |

## Components and Interfaces

### ScrapedRecord Type (shared-contracts)

New type definition for raw CSV records:

```typescript
// packages/shared-contracts/src/types/scraped-record.ts

/**
 * A single record from scraped CSV data.
 * 
 * Represents one row from a CSV file with column names as keys
 * and cell values as strings, numbers, or null.
 */
export type ScrapedRecord = Record<string, string | number | null>
```

### Updated DistrictStatisticsFile (shared-contracts)

```typescript
// packages/shared-contracts/src/types/district-statistics-file.ts

import type { ScrapedRecord } from './scraped-record.js'

export interface DistrictStatisticsFile {
  districtId: string
  snapshotDate: string
  clubs: ClubStatisticsFile[]
  divisions: DivisionStatisticsFile[]
  areas: AreaStatisticsFile[]
  totals: DistrictTotalsFile
  
  // Raw CSV data arrays - required for frontend division/area calculations
  divisionPerformance: ScrapedRecord[]
  clubPerformance: ScrapedRecord[]
  districtPerformance: ScrapedRecord[]
}
```

### Updated DistrictStatistics Interface (analytics-core)

```typescript
// packages/analytics-core/src/interfaces.ts

import type { ScrapedRecord } from '@toastmasters/shared-contracts'

export interface DistrictStatistics {
  districtId: string
  snapshotDate: string
  clubs: ClubStatistics[]
  divisions: DivisionStatistics[]
  areas: AreaStatistics[]
  totals: DistrictTotals
  
  // Raw CSV data arrays - required for frontend division/area calculations
  divisionPerformance: ScrapedRecord[]
  clubPerformance: ScrapedRecord[]
  districtPerformance: ScrapedRecord[]
}
```

### Updated DataTransformer.transformRawCSV Method

```typescript
// packages/analytics-core/src/transformation/DataTransformer.ts

async transformRawCSV(
  date: string,
  districtId: string,
  csvData: RawCSVData
): Promise<DistrictStatistics> {
  // Parse CSV rows to records (existing logic)
  const clubPerformanceRecords = this.parseCSVRows(csvData.clubPerformance ?? [])
  const divisionPerformanceRecords = this.parseCSVRows(csvData.divisionPerformance ?? [])
  const districtPerformanceRecords = this.parseCSVRows(csvData.districtPerformance ?? [])

  // Extract transformed data (existing logic)
  const clubs = this.extractClubs(clubPerformanceRecords)
  const divisions = this.extractDivisions(divisionPerformanceRecords)
  const areas = this.extractAreas(clubPerformanceRecords)
  const totals = this.calculateTotals(clubs, districtPerformanceRecords)

  // Return with raw arrays included (NEW)
  return {
    districtId,
    snapshotDate: date,
    clubs,
    divisions,
    areas,
    totals,
    // Include raw CSV arrays for frontend consumption
    clubPerformance: clubPerformanceRecords,
    divisionPerformance: divisionPerformanceRecords,
    districtPerformance: districtPerformanceRecords,
  }
}
```

## Data Models

### CSV Field Mappings

The raw CSV arrays preserve all original column names. Key fields used by the frontend:

| CSV File | Field Name | Usage |
|----------|------------|-------|
| division-performance.csv | Division | Division identifier |
| division-performance.csv | Area | Area identifier |
| division-performance.csv | Division Club Base | Division's club base for threshold calculations |
| division-performance.csv | Area Club Base | Area's club base for threshold calculations |
| division-performance.csv | Nov Visit award | First round visit completion ("1" = completed) |
| division-performance.csv | May visit award | Second round visit completion ("1" = completed) |
| division-performance.csv | Club | Club identifier for lookup |
| club-performance.csv | Club Number | Club identifier |
| club-performance.csv | Club Status | Club operational status (Active, Suspended, etc.) |
| club-performance.csv | Club Distinguished Status | Distinguished level from CSV |
| club-performance.csv | Goals Met | DCP goals achieved |
| club-performance.csv | Active Members | Current membership count |
| club-performance.csv | Mem. Base | Membership base for net growth |

### Zod Schema for Validation

```typescript
// packages/shared-contracts/src/schemas/district-statistics-file.schema.ts

import { z } from 'zod'

// Schema for a single scraped record
export const ScrapedRecordSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.null()])
)

// Updated DistrictStatisticsFile schema
export const DistrictStatisticsFileSchema = z.object({
  districtId: z.string(),
  snapshotDate: z.string(),
  clubs: z.array(ClubStatisticsFileSchema),
  divisions: z.array(DivisionStatisticsFileSchema),
  areas: z.array(AreaStatisticsFileSchema),
  totals: DistrictTotalsFileSchema,
  // Raw CSV data arrays - required
  divisionPerformance: z.array(ScrapedRecordSchema),
  clubPerformance: z.array(ScrapedRecordSchema),
  districtPerformance: z.array(ScrapedRecordSchema),
})
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties have been consolidated to eliminate redundancy:

### Property 1: Raw Data Preservation

*For any* raw CSV input with clubPerformance, divisionPerformance, and districtPerformance arrays, the transformed DistrictStatistics output SHALL include all three raw arrays with all original column names and values preserved exactly as they appeared in the input.

**Validates: Requirements 1.1, 1.2, 1.3, 1.6**

### Property 2: CSV to ScrapedRecord Parsing

*For any* 2D CSV array where the first row contains headers and subsequent rows contain data values, parsing SHALL produce an array of ScrapedRecord objects where each record maps header names to corresponding row values, with the number of output records equal to the number of data rows (excluding the header row).

**Validates: Requirements 1.4**

### Property 3: ScrapedRecord Value Type Validation

*For any* ScrapedRecord object, the Zod schema SHALL accept records containing only string, number, or null values, and SHALL reject records containing any other value types (objects, arrays, undefined, boolean, etc.).

**Validates: Requirements 2.5, 5.3**

### Property 4: Backend Data Integrity

*For any* snapshot containing raw data arrays (clubPerformance, divisionPerformance, districtPerformance), the backend API response SHALL contain the exact same data as stored in the snapshot file, with no computation, transformation, or modification applied.

**Validates: Requirements 4.1, 4.2**

## Error Handling

### Empty or Missing CSV Arrays

**Scenario**: Raw CSV array is empty or not provided in input

**Handling**:
- DataTransformer SHALL include an empty array `[]` in the output
- No error or warning logged (this is a valid state)
- Downstream consumers (frontend) handle empty arrays gracefully

```typescript
// Example handling in DataTransformer
const clubPerformanceRecords = this.parseCSVRows(csvData.clubPerformance ?? [])
// If csvData.clubPerformance is undefined or empty, result is []
```

### Invalid CSV Structure

**Scenario**: CSV array has no header row or malformed structure

**Handling**:
- If array has fewer than 2 rows (no data rows), return empty array
- Log debug message for troubleshooting
- Continue processing without throwing

```typescript
private parseCSVRows(rows: string[][]): ScrapedRecord[] {
  if (rows.length < 2) {
    this.logger.debug('CSV has no data rows', { rowCount: rows.length })
    return []
  }
  // ... parsing logic
}
```

### Zod Validation Failures

**Scenario**: District statistics file fails Zod validation

**Handling**:
- TransformService logs error with validation details
- Throws error to prevent writing invalid data
- Error message includes which field failed and why

```typescript
const validationResult = validatePerDistrictData(perDistrictData)
if (!validationResult.success) {
  this.logger.error(`Validation failed for district ${districtId}`, {
    error: validationResult.error,
  })
  throw new Error(`Validation failed: ${validationResult.error}`)
}
```

### Backend Read Failures

**Scenario**: Snapshot file exists but cannot be parsed

**Handling**:
- Backend returns 500 error with descriptive message
- Logs error with file path and parse error details
- Does not attempt to compute or generate data (per data-computation-separation steering)

## Testing Strategy

Per the testing steering document, this feature uses **unit tests with well-chosen examples**. Property-based tests are not warranted because:

1. The logic is straightforward data passthrough (not complex transformations)
2. 5 well-chosen examples provide equivalent confidence to property tests
3. The input space is not genuinely complex
4. There are no mathematical invariants or algebraic properties

> "Prefer the simplest test that provides confidence. Property tests are for invariants, not for everything."

### Unit Tests

**DataTransformer Tests** (`packages/analytics-core/src/__tests__/DataTransformer.test.ts`):

Raw Data Preservation (validates Property 1):
- Test with CSV containing Division Club Base, Area Club Base columns → verify preserved in output
- Test with CSV containing Nov Visit award, May visit award columns → verify preserved in output
- Test with CSV containing Club Status, Club Distinguished Status columns → verify preserved in output
- Test with empty CSV arrays → verify empty arrays in output
- Test with CSV containing only header row → verify empty arrays in output

CSV to ScrapedRecord Parsing (validates Property 2):
- Test with 3-column header and 2 data rows → verify 2 records with correct keys
- Test with numeric values in CSV → verify preserved as numbers in records
- Test with string values in CSV → verify preserved as strings in records
- Test with null/empty values in CSV → verify preserved as null in records

**Zod Schema Tests** (`packages/shared-contracts/src/__tests__/district-statistics-file.schema.test.ts`):

ScrapedRecord Validation (validates Property 3):
- Test with valid ScrapedRecord (string values) → passes validation
- Test with valid ScrapedRecord (number values) → passes validation
- Test with valid ScrapedRecord (null values) → passes validation
- Test with invalid ScrapedRecord (object value) → fails validation with error
- Test with invalid ScrapedRecord (array value) → fails validation with error
- Test with invalid ScrapedRecord (boolean value) → fails validation with error

DistrictStatisticsFile Validation:
- Test with all required fields including raw arrays → passes validation
- Test with missing divisionPerformance field → fails validation
- Test with missing clubPerformance field → fails validation
- Test with missing districtPerformance field → fails validation

### Integration Tests

**TransformService Integration** (`packages/scraper-cli/src/__tests__/TransformService.integration.test.ts`):

Backend Data Integrity (validates Property 4):
- Transform CSV files with known content → verify JSON output contains exact raw arrays
- Read generated JSON file → verify Zod validation passes
- Verify specific column values are preserved exactly as input

### Test Organization

```
packages/
├── shared-contracts/
│   └── src/__tests__/
│       └── district-statistics-file.schema.test.ts  (Zod validation tests)
├── analytics-core/
│   └── src/__tests__/
│       └── DataTransformer.test.ts                  (unit tests)
└── scraper-cli/
    └── src/__tests__/
        └── TransformService.integration.test.ts     (integration tests)
```

### Test Coverage Summary

| Property | Test Type | Location |
|----------|-----------|----------|
| Property 1: Raw Data Preservation | Unit tests | DataTransformer.test.ts |
| Property 2: CSV to ScrapedRecord Parsing | Unit tests | DataTransformer.test.ts |
| Property 3: ScrapedRecord Value Type Validation | Unit tests | district-statistics-file.schema.test.ts |
| Property 4: Backend Data Integrity | Integration tests | TransformService.integration.test.ts |
