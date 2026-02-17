# Requirements Document

## Introduction

This feature introduces a read-only GCSSnapshotStorage implementation that reads snapshot data directly from a Google Cloud Storage (GCS) bucket. The scraper-cli uploads pre-computed snapshot JSON files to GCS, but the backend currently reads snapshot data from Firestore via FirestoreSnapshotStorage. GCSSnapshotStorage eliminates the Firestore dependency by reading directly from the GCS bucket where the scraper-cli uploads files.

All data mutation (writes, deletes) is the exclusive responsibility of the scraper-cli. The backend is a read-only API server. GCSSnapshotStorage enforces this by throwing on any write or delete call. This aligns with the data-computation-separation principle: "pre-computed files are the contract."

GCS has no directory concept. All references to "listing snapshots" or "finding files" operate on object key prefixes with delimiters, not filesystem directories.

## Glossary

- **GCSSnapshotStorage**: A read-only class implementing ISnapshotStorage that reads snapshot data from a GCS bucket. All write and delete methods throw StorageOperationError unconditionally.
- **ISnapshotStorage**: The existing storage interface that abstracts snapshot persistence operations (read, write, delete, list)
- **StorageProviderFactory**: The factory class that creates storage provider instances based on environment configuration
- **Snapshot**: An immutable, versioned capture of normalized application data for a specific date
- **Snapshot_ID**: A unique identifier for a snapshot, which is a valid calendar date in YYYY-MM-DD format. Lexically sortable: chronological order is derived via string comparison, not date parsing. Must pass calendar validation (not just regex). Must not contain path traversal sequences, unicode separators, or encoded characters.
- **GCS_Bucket**: A Google Cloud Storage bucket where pre-computed snapshot files are stored
- **Object_Prefix**: A configurable path prefix for snapshot objects in the GCS bucket (default: "snapshots"). All GCS operations are scoped to this prefix.
- **Object_Key**: A full GCS object path in the form {Object_Prefix}/{Snapshot_ID}/{filename}. GCS has no directories; keys are flat strings with "/" as a conventional delimiter.
- **Prefix_Listing**: A GCS list-objects operation using a prefix and "/" delimiter to enumerate logical groupings. Must use pagination (page tokens) to handle large result sets. Must never perform unbounded full-bucket scans.
- **Metadata_File**: The metadata.json object at {Object_Prefix}/{Snapshot_ID}/metadata.json containing snapshot status and summary information
- **Manifest_File**: The manifest.json object at {Object_Prefix}/{Snapshot_ID}/manifest.json listing all district files and their status, including the writeComplete flag
- **District_File**: A district*{id}.json object at {Object_Prefix}/{Snapshot_ID}/district*{id}.json containing per-district statistics
- **Rankings_File**: The all-districts-rankings.json object at {Object_Prefix}/{Snapshot_ID}/all-districts-rankings.json containing BordaCount rankings
- **Circuit_Breaker**: A fault-tolerance pattern that prevents cascading failures by short-circuiting operations when error thresholds are exceeded. Scoped per-provider (one breaker for all GCSSnapshotStorage operations).
- **StorageOperationError**: The standard error class for storage operation failures, including operation name, provider ("gcs"), cause, and retryable flag
- **Write_Complete_Flag**: The writeComplete boolean field in the Manifest_File. Set to true by the scraper-cli as the final step of a snapshot upload. The backend treats a snapshot as coherent only when this flag is true.

## Requirements

### Requirement 1: Read Snapshot Data from GCS

**User Story:** As the backend application, I want to read snapshot data from GCS objects, so that I can serve pre-computed data uploaded by the scraper-cli without depending on Firestore.

#### Acceptance Criteria

1. WHEN the backend requests the latest successful snapshot, THE GCSSnapshotStorage SHALL enumerate Snapshot_ID prefixes using a Prefix_Listing with delimiter "/", process them incrementally in reverse lexical order (which equals reverse chronological order), and return the first snapshot whose Metadata_File has status "success" and whose Manifest_File has Write_Complete_Flag set to true. THE GCSSnapshotStorage SHALL stop enumeration immediately once a qualifying snapshot is found, without reading Metadata_Files for older prefixes.
2. WHEN the backend requests a specific snapshot by Snapshot_ID, THE GCSSnapshotStorage SHALL read the Metadata_File, the Manifest_File, and all District_Files listed in the manifest to assemble a complete Snapshot object. THE GCSSnapshotStorage SHALL verify isSnapshotWriteComplete before and after reading constituent objects; if the flag is false or changes during the read, THE GCSSnapshotStorage SHALL return null
3. WHEN the backend requests district data for a specific Snapshot*ID and district ID, THE GCSSnapshotStorage SHALL read the object at {Object_Prefix}/{Snapshot_ID}/district*{id}.json and return the validated DistrictStatistics
4. WHEN the backend requests the snapshot manifest, THE GCSSnapshotStorage SHALL read the object at {Object_Prefix}/{Snapshot_ID}/manifest.json and return the validated SnapshotManifest
5. WHEN the backend requests snapshot metadata, THE GCSSnapshotStorage SHALL read the object at {Object_Prefix}/{Snapshot_ID}/metadata.json and return the validated PerDistrictSnapshotMetadata
6. WHEN the backend requests a list of districts in a snapshot, THE GCSSnapshotStorage SHALL use a paginated Prefix*Listing with prefix {Object_Prefix}/{Snapshot_ID}/district* and extract district IDs incrementally from matching Object_Keys without loading all object metadata into memory
7. WHEN the backend requests a list of snapshots, THE GCSSnapshotStorage SHALL use a paginated Prefix_Listing to enumerate Snapshot_ID prefixes, read each Metadata_File, apply any provided SnapshotFilters, and return SnapshotMetadata sorted newest-first using lexical string comparison
8. WHEN enumerating Snapshot_ID prefixes, THE GCSSnapshotStorage SHALL use a Prefix_Listing with delimiter "/" to retrieve only first-level logical groupings under Object_Prefix and SHALL NOT perform full recursive scans

### Requirement 2: Read Rankings Data from GCS

**User Story:** As the backend application, I want to read rankings data from GCS, so that I can serve pre-computed BordaCount rankings without Firestore.

#### Acceptance Criteria

1. WHEN the backend requests all-districts rankings for a Snapshot_ID, THE GCSSnapshotStorage SHALL read the object at {Object_Prefix}/{Snapshot_ID}/all-districts-rankings.json and return the validated AllDistrictsRankingsData
2. WHEN the backend checks whether rankings exist for a Snapshot_ID, THE GCSSnapshotStorage SHALL check for the existence of the object at {Object_Prefix}/{Snapshot_ID}/all-districts-rankings.json and return a boolean result
3. WHEN the Rankings_File does not exist for a Snapshot_ID, THE GCSSnapshotStorage SHALL return null from readAllDistrictsRankings without throwing an error
4. WHEN reading rankings data, THE GCSSnapshotStorage SHALL verify that isSnapshotWriteComplete returns true for the Snapshot_ID; if the snapshot is not write-complete, THE GCSSnapshotStorage SHALL return null

### Requirement 3: Enforce Read-Only Contract

**User Story:** As the backend application, I want write and delete operations to be unconditionally rejected, so that the read-only contract is enforced and accidental mutations are impossible.

#### Acceptance Criteria

1. WHEN writeSnapshot is called, THE GCSSnapshotStorage SHALL throw a StorageOperationError with a message indicating that write operations are not supported on the read-only GCS backend, with retryable set to false
2. WHEN writeDistrictData is called, THE GCSSnapshotStorage SHALL throw a StorageOperationError with a message indicating that write operations are not supported on the read-only GCS backend, with retryable set to false
3. WHEN writeAllDistrictsRankings is called, THE GCSSnapshotStorage SHALL throw a StorageOperationError with a message indicating that write operations are not supported on the read-only GCS backend, with retryable set to false
4. WHEN deleteSnapshot is called, THE GCSSnapshotStorage SHALL throw a StorageOperationError with a message indicating that delete operations are not supported on the read-only GCS backend, with retryable set to false

### Requirement 4: Error Handling and Resilience

**User Story:** As the backend application, I want GCS read operations to handle errors with clear, consistent semantics, so that callers can distinguish transient failures from permanent ones and missing data from corruption.

#### Acceptance Criteria

1. WHEN a GCS read operation receives an HTTP 404 (object not found), THE GCSSnapshotStorage SHALL return null to the caller without throwing an error and without counting the 404 as a Circuit_Breaker failure
2. WHEN a GCS read operation fails with a transient error (network timeout, ECONNRESET, ENOTFOUND, ECONNREFUSED, unavailable, deadline exceeded, internal server error), THE GCSSnapshotStorage SHALL throw a StorageOperationError with retryable set to true
3. WHEN a GCS read operation fails with a permanent error (permission denied, invalid argument, forbidden), THE GCSSnapshotStorage SHALL throw a StorageOperationError with retryable set to false
4. WHEN data read from GCS fails Zod schema validation, THE GCSSnapshotStorage SHALL throw a StorageOperationError with retryable set to false and a message describing the validation failure
5. THE GCSSnapshotStorage SHALL wrap all thrown errors in StorageOperationError with provider set to "gcs", the operation name, the retryable flag, and the original error as cause
6. WHEN a Snapshot_ID or district ID fails input validation, THE GCSSnapshotStorage SHALL throw a StorageOperationError with retryable set to false before making any GCS call

### Requirement 5: Circuit Breaker Integration

**User Story:** As the backend application, I want GCS operations to be protected by a circuit breaker, so that sustained GCS outages do not cause cascading failures.

#### Acceptance Criteria

1. THE GCSSnapshotStorage SHALL use a single Circuit_Breaker instance scoped to the "gcs-snapshot" provider for all GCS read operations
2. THE Circuit_Breaker SHALL be configured so that HTTP 404 (object not found) responses do not count as failures toward the failure threshold
3. WHEN the Circuit_Breaker is in the open state, THE GCSSnapshotStorage SHALL throw a StorageOperationError with retryable set to true and a message indicating the circuit is open, without making any GCS call
4. THE Circuit_Breaker SHALL use the same configuration pattern as the existing GCSRawCSVStorage circuit breaker (created via CircuitBreaker.createCacheCircuitBreaker) with a custom expectedErrors function that excludes 404 responses

### Requirement 6: Input Validation

**User Story:** As the backend application, I want all inputs to GCSSnapshotStorage to be validated before any GCS call, so that invalid or malicious inputs are rejected early.

#### Acceptance Criteria

1. WHEN a Snapshot_ID does not represent a valid calendar date in YYYY-MM-DD format (e.g., "2024-02-30" is invalid, "2024-13-01" is invalid), THE GCSSnapshotStorage SHALL throw a StorageOperationError with retryable set to false
2. WHEN a Snapshot_ID contains path traversal sequences (../, ..\), unicode separators, or percent-encoded characters, THE GCSSnapshotStorage SHALL throw a StorageOperationError with retryable set to false
3. WHEN a district ID is empty, contains whitespace, or contains path traversal characters, THE GCSSnapshotStorage SHALL throw a StorageOperationError with retryable set to false
4. THE GCSSnapshotStorage SHALL validate all data read from GCS against the shared-contracts Zod schemas before returning the data to callers

### Requirement 7: Storage Provider Factory Integration

**User Story:** As the backend application, I want the StorageProviderFactory to create GCSSnapshotStorage when the storage provider is "gcp", so that the backend uses GCS for snapshot storage in production instead of Firestore.

#### Acceptance Criteria

1. WHEN STORAGE_PROVIDER is set to "gcp", THE StorageProviderFactory SHALL create a GCSSnapshotStorage instance using the GCS_BUCKET_NAME and GCP_PROJECT_ID environment variables, replacing FirestoreSnapshotStorage
2. WHEN STORAGE_PROVIDER is set to "gcp" and GCS_BUCKET_NAME is not configured, THE StorageProviderFactory SHALL throw a StorageConfigurationError
3. THE GCSSnapshotStorage SHALL accept an optional Object_Prefix configuration parameter with a default value of "snapshots"

### Requirement 8: Readiness Check

**User Story:** As the backend application, I want to verify GCS bucket accessibility at startup, so that misconfiguration is detected early.

#### Acceptance Criteria

1. WHEN isReady is called, THE GCSSnapshotStorage SHALL verify that the configured GCS_Bucket exists, that the service account has permission to perform a Prefix_Listing scoped to Object_Prefix, and that the operation completes without error, returning true
2. WHEN the GCS_Bucket is not accessible (permission denied, bucket not found, network error), THE GCSSnapshotStorage SHALL return false without throwing an error

### Requirement 9: Write Completion and Snapshot Coherence

**User Story:** As the backend application, I want to verify that a snapshot was fully written by the scraper-cli before serving it, so that partially uploaded snapshots are never treated as complete.

#### Acceptance Criteria

1. WHEN isSnapshotWriteComplete is called, THE GCSSnapshotStorage SHALL read the Manifest_File and check the Write_Complete_Flag to determine if the scraper-cli finished the upload
2. WHEN the Manifest_File does not exist for a Snapshot_ID, THE GCSSnapshotStorage SHALL return false
3. WHEN the Manifest_File exists but the Write_Complete_Flag is absent, THE GCSSnapshotStorage SHALL return false (no legacy exception — missing flag means incomplete)
4. WHEN assembling a Snapshot object via getSnapshot, THE GCSSnapshotStorage SHALL verify isSnapshotWriteComplete both before and after reading constituent objects; if the write completion status changes or becomes false during the read, THE GCSSnapshotStorage SHALL return null
5. WHEN getLatestSuccessful or getLatest reads snapshot candidates, THE GCSSnapshotStorage SHALL skip any snapshot where isSnapshotWriteComplete returns false

### Requirement 10: Performance and Scalability

**User Story:** As the backend application, I want GCS operations to remain performant as the number of snapshots grows, so that API response times stay within acceptable bounds.

#### Acceptance Criteria

1. THE GCSSnapshotStorage SHALL use paginated Prefix_Listings with bounded page sizes when enumerating snapshots, and SHALL process results incrementally rather than loading all results into memory
2. WHEN listSnapshots is called with a limit parameter, THE GCSSnapshotStorage SHALL stop reading Metadata_Files once the limit is satisfied (short-circuit evaluation)
3. WHEN listing district objects, THE GCSSnapshotStorage SHALL use pagination and extract district IDs incrementally without loading all object metadata into memory
4. THE GCSSnapshotStorage SHALL derive chronological ordering of Snapshot_IDs using lexical string comparison, not date parsing, to avoid unnecessary conversions
