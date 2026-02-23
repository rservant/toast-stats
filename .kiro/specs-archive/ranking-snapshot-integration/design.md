# Design Document

## Overview

This design integrates district ranking calculations into the snapshot creation process, ensuring that the sophisticated Borda count ranking system is preserved in the new per-district snapshot architecture. The solution moves ranking calculations from the legacy cache system into the RefreshService workflow, storing computed rankings directly within district snapshot files.

The key architectural change is embedding the RankingCalculator into the snapshot creation pipeline, so that rankings are computed once during data ingestion and stored immutably with each snapshot. This eliminates the need for separate ranking cache files and ensures the `/api/districts/rankings` endpoint can serve complete data directly from snapshots.

## Architecture

```mermaid
graph TD
    A[ToastmastersCollector] --> B[RefreshService]
    B --> C[RankingCalculator]
    C --> D[PerDistrictSnapshotStore]
    D --> E[DistrictDataAggregator]
    E --> F[/api/districts/rankings]

    B --> G[Raw District Data]
    C --> H[Computed Rankings]
    G --> I[Combined District Statistics]
    H --> I
    I --> D

    subgraph "Snapshot Creation Process"
        B
        C
        G
        H
        I
    end

    subgraph "Snapshot Storage"
        D
        J[district_42.json]
        K[district_15.json]
        L[metadata.json]
        D --> J
        D --> K
        D --> L
    end

    subgraph "API Serving"
        E
        F
        M[Rankings Response]
        F --> M
    end
```

The architecture maintains the existing snapshot creation flow while adding ranking computation as an intermediate step. The RankingCalculator processes all district data before it's written to individual district files, ensuring rankings are computed across the complete dataset.

## Components and Interfaces

### RankingCalculator

```typescript
interface RankingCalculator {
  /**
   * Calculate rankings for all districts using Borda count system
   */
  calculateRankings(
    districts: DistrictStatistics[]
  ): Promise<DistrictStatistics[]>

  /**
   * Get the current ranking algorithm version
   */
  getRankingVersion(): string
}

class BordaCountRankingCalculator implements RankingCalculator {
  private readonly RANKING_VERSION = '2.0'

  async calculateRankings(
    districts: DistrictStatistics[]
  ): Promise<DistrictStatistics[]> {
    // Implementation details in next section
  }

  getRankingVersion(): string {
    return this.RANKING_VERSION
  }
}
```

### Enhanced DistrictStatistics

The existing DistrictStatistics interface will be extended to include ranking fields:

```typescript
interface DistrictStatistics {
  districtId: string
  asOfDate: string
  membership: MembershipStats
  clubs: ClubStats
  education: EducationStats
  goals?: DistrictGoals
  performance?: DistrictPerformance

  // New ranking fields
  ranking?: DistrictRankingData

  // Raw data arrays from collector (for caching purposes)
  districtPerformance?: ScrapedRecord[]
  divisionPerformance?: ScrapedRecord[]
  clubPerformance?: ScrapedRecord[]
}

interface DistrictRankingData {
  // Individual category ranks (1 = best)
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number

  // Aggregate Borda count score (higher = better)
  aggregateScore: number

  // Growth metrics used for ranking
  clubGrowthPercent: number
  paymentGrowthPercent: number
  distinguishedPercent: number

  // Base values for growth calculations
  paidClubBase: number
  paymentBase: number

  // Absolute values
  paidClubs: number
  totalPayments: number
  distinguishedClubs: number
  activeClubs: number

  // Regional information
  region: string
  districtName: string

  // Algorithm metadata
  rankingVersion: string
  calculatedAt: string
}
```

### RefreshService Integration

The RefreshService will be modified to include ranking calculation in its snapshot creation process:

```typescript
class RefreshService {
  constructor(
    private snapshotStore: SnapshotStore,
    private collector: ToastmastersCollector,
    private validator?: SnapshotValidator,
    private districtConfigService?: DistrictConfigurationService,
    private rankingCalculator?: RankingCalculator // New dependency
  ) {}

  async createSnapshot(): Promise<Snapshot> {
    // 1. Scrape raw data
    const rawData = await this.collector.getAllDistricts()

    // 2. Normalize to DistrictStatistics
    const districts = this.normalizeDistrictData(rawData)

    // 3. Calculate rankings (NEW STEP)
    const rankedDistricts =
      (await this.rankingCalculator?.calculateRankings(districts)) || districts

    // 4. Create snapshot with ranked data
    const snapshot = this.createSnapshotFromDistricts(rankedDistricts)

    // 5. Store snapshot
    await this.snapshotStore.writeSnapshot(snapshot)

    return snapshot
  }
}
```

## Data Models

### Ranking Calculation Flow

The ranking calculation follows this sequence:

1. **Data Collection**: Gather all district statistics from scraped data
2. **Metric Extraction**: Extract growth percentages and base values for ranking
3. **Category Ranking**: Rank districts in each category (clubs, payments, distinguished)
4. **Tie Handling**: Assign same rank to districts with equal values
5. **Borda Point Calculation**: Convert ranks to Borda points (totalDistricts - rank + 1)
6. **Aggregate Scoring**: Sum Borda points across all categories
7. **Final Sorting**: Order districts by aggregate score (highest first)

### Ranking Algorithm Details

```typescript
interface RankingMetrics {
  districtId: string
  clubGrowthPercent: number
  paymentGrowthPercent: number
  distinguishedPercent: number
  // ... other fields needed for ranking
}

interface CategoryRanking {
  districtId: string
  rank: number
  bordaPoints: number
  value: number
}

interface AggregateRanking {
  districtId: string
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  aggregateScore: number
}
```

The Borda count system ensures fair ranking across categories:

- Each district receives points based on their rank in each category
- Points = (total districts - rank + 1)
- Higher aggregate scores indicate better overall performance
- Ties are handled consistently within each category

## Error Handling

### Ranking Calculation Failures

The system handles ranking calculation failures gracefully:

1. **Individual District Errors**: If ranking data cannot be computed for a specific district, that district is stored without ranking fields
2. **Complete Ranking Failure**: If the entire ranking calculation fails, districts are stored with raw data only
3. **Partial Data**: Districts with incomplete source data receive default ranking values
4. **Algorithm Errors**: Ranking calculation errors are logged but do not prevent snapshot creation

### Backward Compatibility

The system maintains compatibility with existing snapshots:

1. **Legacy Snapshots**: Existing snapshots without ranking data continue to work
2. **API Responses**: The rankings endpoint handles districts with missing ranking data
3. **Version Migration**: Different ranking algorithm versions are supported simultaneously
4. **Graceful Degradation**: Missing ranking fields are handled transparently

## Testing Strategy

### Unit Testing Approach

- **RankingCalculator**: Test Borda count calculations with known input/output pairs
- **Tie Handling**: Verify correct rank assignment for districts with equal values
- **Edge Cases**: Test with empty datasets, single districts, and extreme values
- **Integration**: Test ranking calculation within the RefreshService workflow

### Property-Based Testing

Property-based tests will validate universal ranking properties across randomized inputs. The specific properties will be defined in the Correctness Properties section below.

### Golden Test Cases

Use historical district data to validate that ranking calculations produce expected results:

- Known district rankings from specific dates
- Verification of Borda point calculations
- Consistency checks across different data sizes

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

Based on the acceptance criteria analysis, the following properties must hold for the ranking snapshot integration system:

### Property 1: Borda Count Calculation Correctness

_For any_ set of districts with ranking data, the Borda points for each district in each category should equal the total number of districts minus the district's rank plus one, and the aggregate score should equal the sum of Borda points across all three categories.
**Validates: Requirements 1.6, 1.7**

### Property 2: Category Ranking Consistency

_For any_ set of districts, the district with the highest growth percentage in each category (clubs, payments, distinguished) should receive rank 1, and districts should be ordered by descending percentage values within each category.
**Validates: Requirements 1.2, 1.3, 1.4**

### Property 3: Tie Handling Correctness

_For any_ set of districts where multiple districts have equal values for a ranking metric, all tied districts should receive the same rank number.
**Validates: Requirements 1.5**

### Property 4: Final Ranking Order

_For any_ set of ranked districts, the final district order should be sorted in descending order by aggregate Borda score (highest score first).
**Validates: Requirements 1.8**

### Property 5: Ranking Data Persistence

_For any_ district with computed rankings, when stored to a snapshot file, the district data should include all required ranking fields (clubsRank, paymentsRank, distinguishedRank, aggregateScore, growth percentages, and base values).
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 6: Ranking Data Retrieval

_For any_ district stored with ranking data, when read from a snapshot, all ranking fields should be returned as part of the district statistics.
**Validates: Requirements 2.5**

### Property 7: Snapshot Metadata Versioning

_For any_ snapshot created with ranking calculations, the snapshot metadata should include the ranking algorithm version used for the calculations.
**Validates: Requirements 3.1**

### Property 8: Historical Data Immutability

_For any_ historical snapshot with ranking data, the ranking values should remain unchanged when accessed, regardless of current ranking algorithm versions.
**Validates: Requirements 3.3**

### Property 9: API Response Completeness

_For any_ successful call to `/api/districts/rankings`, the response should include all fields required by the DistrictRanking interface and snapshot metadata indicating data freshness and calculation version.
**Validates: Requirements 4.2, 4.4**

### Property 10: Snapshot Creation Integration

_For any_ snapshot creation process, if ranking calculation is enabled, rankings should be computed before district data is written to snapshot files, using the same source data that is stored in the snapshot.
**Validates: Requirements 5.2, 5.4**

### Property 11: Error Handling Resilience

_For any_ ranking calculation failure during snapshot creation, the system should log the error and continue with snapshot creation, storing districts without ranking data rather than failing the entire process.
**Validates: Requirements 5.3**

### Property 12: Backfill Consistency

_For any_ backfill operation that creates snapshots, the ranking calculations should use the same algorithm version to ensure consistency across historical snapshots created in the same batch.
**Validates: Requirements 5.5**
