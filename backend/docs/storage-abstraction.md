# Storage Abstraction Steering Document

**Status:** Authoritative  
**Applies to:** All backend code that reads or writes persistent data  
**Audience:** All developers and automation agents (including Kiro)  
**Owner:** Development Team

---

## 1. Purpose

This document defines **mandatory storage abstraction standards** for this codebase.

Its goals are to:

- Enforce consistent data access patterns across all storage backends
- Enable environment-based selection between local and cloud storage
- Prevent direct filesystem operations outside of storage implementations
- Maintain clear separation between business logic and storage concerns

This document is **normative**.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be interpreted as described in RFC 2119.

Kiro MUST treat this document as the **primary source of truth** for all storage-related decisions.

---

## 2. Authority Model

In the event of conflict, storage rules MUST be applied according to the following precedence order (highest first):

1. **This Steering Document**
2. Storage interface definitions (`storageInterfaces.ts`)
3. Environment configuration (`STORAGE_PROVIDER`)
4. Implementation-specific code

Lower-precedence sources MUST NOT weaken higher-precedence rules.

---

## 3. Scope

This document applies to all code that:

- Reads or writes snapshot data
- Reads or writes raw CSV cache data
- Reads or writes district configuration data
- Reads or writes time-series index data
- Reads or writes pre-computed analytics data

There are **no exceptions** for test code, scripts, or utilities.

---

## 4. Core Principles

All storage access MUST adhere to the following principles:

1. **Abstraction over implementation**  
   Business logic MUST NOT depend on specific storage backends.

2. **Interface-driven design**  
   All storage operations MUST go through defined interfaces.

3. **Environment-based selection**  
   Storage provider selection MUST be determined by configuration, not code.

4. **Single responsibility**  
   Only storage implementation classes MAY perform direct I/O operations.

---

## 5. Storage Interfaces

### 5.1 ISnapshotStorage

All snapshot operations MUST use the `ISnapshotStorage` interface:

```typescript
interface ISnapshotStorage {
  getLatestSuccessful(): Promise<Snapshot | null>
  getLatest(): Promise<Snapshot | null>
  writeSnapshot(
    snapshot: Snapshot,
    rankings?: AllDistrictsRankingsData,
    options?: WriteSnapshotOptions
  ): Promise<void>
  listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]>
  getSnapshot(snapshotId: string): Promise<Snapshot | null>
  deleteSnapshot(snapshotId: string): Promise<boolean>
  isReady(): Promise<boolean>
  // Per-district operations
  writeDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): Promise<void>
  readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null>
  listDistrictsInSnapshot(snapshotId: string): Promise<string[]>
  getSnapshotManifest(snapshotId: string): Promise<SnapshotManifest | null>
  getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null>
  // Rankings operations
  writeAllDistrictsRankings(
    snapshotId: string,
    rankingsData: AllDistrictsRankingsData
  ): Promise<void>
  readAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null>
  hasAllDistrictsRankings(snapshotId: string): Promise<boolean>
}
```

### 5.2 IRawCSVStorage

All raw CSV cache operations MUST use the `IRawCSVStorage` interface.

### 5.3 IDistrictConfigStorage

All district configuration operations MUST use the `IDistrictConfigStorage` interface.

---

## 6. Prohibited Patterns

### 6.1 Direct Filesystem Operations

Direct filesystem operations (`fs.readFile`, `fs.writeFile`, `fs.rm`, `fs.unlink`, `fs.readdir`, etc.) are **STRICTLY FORBIDDEN** outside of storage implementation classes.

**Rule:** Only classes implementing storage interfaces MAY use `fs` module operations.

```typescript
// ❌ FORBIDDEN - Direct filesystem access in route handler
import fs from 'fs/promises'

router.delete('/snapshots', async (req, res) => {
  await fs.rm(snapshotDir, { recursive: true }) // VIOLATION
})

// ✅ CORRECT - Using storage abstraction
router.delete('/snapshots', async (req, res) => {
  const storage = getSnapshotStorage()
  await storage.deleteSnapshot(snapshotId)
})
```

### 6.2 Path Construction for Data Access

Constructing file paths for data access is **FORBIDDEN** outside of storage implementations.

```typescript
// ❌ FORBIDDEN - Path construction in business logic
const snapshotDir = path.join(cacheDir, 'snapshots', snapshotId)
await fs.access(snapshotDir)

// ✅ CORRECT - Using storage abstraction
const snapshot = await storage.getSnapshot(snapshotId)
```

### 6.3 Storage Provider Assumptions

Code MUST NOT assume a specific storage provider.

```typescript
// ❌ FORBIDDEN - Assuming local filesystem
const snapshotsDir = path.join(cacheDir, 'snapshots')
const entries = await fs.readdir(snapshotsDir)

// ✅ CORRECT - Using storage abstraction
const snapshots = await storage.listSnapshots()
```

---

## 7. Approved Patterns

### 7.1 Storage Access via Factory

```typescript
import { StorageProviderFactory } from './storage/StorageProviderFactory.js'

const storageProviders = StorageProviderFactory.createFromEnvironment()
const snapshotStorage = storageProviders.snapshotStorage
```

### 7.2 Storage Access via Service Factory

```typescript
import { getProductionServiceFactory } from './ProductionServiceFactory.js'

const factory = getProductionServiceFactory()
const snapshotStorage = factory.createSnapshotStorage()
```

### 7.3 Storage Access via Dependency Injection

```typescript
class MyService {
  constructor(private readonly snapshotStorage: ISnapshotStorage) {}

  async doSomething(): Promise<void> {
    const snapshot = await this.snapshotStorage.getLatestSuccessful()
  }
}
```

---

## 8. Storage Implementations

### 8.1 Local Storage

- `LocalSnapshotStorage` - Wraps `FileSnapshotStore` for local filesystem
- `LocalRawCSVStorage` - Wraps `RawCSVCacheService` for local filesystem
- `LocalDistrictConfigStorage` - Local filesystem district configuration

### 8.2 Cloud Storage (GCP)

- `FirestoreSnapshotStorage` - Google Cloud Firestore for snapshots
- `GCSRawCSVStorage` - Google Cloud Storage for CSV files
- `FirestoreDistrictConfigStorage` - Firestore for district configuration

### 8.3 Implementation Requirements

Storage implementations:

- **MUST** implement the complete interface
- **MUST** handle errors gracefully with `StorageOperationError`
- **MUST** provide consistent behavior across backends
- **SHOULD** integrate with circuit breakers for resilience
- **SHOULD** provide detailed logging for operations

---

## 9. Environment Configuration

Storage provider selection is controlled by the `STORAGE_PROVIDER` environment variable:

| Value   | Description                             |
| ------- | --------------------------------------- |
| `local` | Local filesystem storage (default)      |
| `gcp`   | Google Cloud Platform (Firestore + GCS) |

Code MUST NOT check this variable directly. Use `StorageProviderFactory.createFromEnvironment()`.

---

## 10. Migration Requirements

### 10.1 Existing Code

Existing code that violates these rules MUST be migrated to use storage abstractions.

Priority order for migration:

1. Route handlers with direct filesystem access
2. Services with direct filesystem access
3. Utilities and scripts

### 10.2 New Code

New code MUST use storage abstractions from the start.

Pull requests introducing direct filesystem access for data operations MUST be rejected.

---

## 11. Enforcement

Storage abstraction violations are **always blocking**.

Code review MUST verify:

- No direct `fs` module usage outside storage implementations
- No path construction for data access outside storage implementations
- All data operations use appropriate storage interfaces

---

## 12. Final Rules

> **All data access MUST go through storage abstractions.**  
> **Direct filesystem operations are forbidden outside storage implementations.**  
> **Storage provider selection is determined by environment configuration, not code.**

```

```
