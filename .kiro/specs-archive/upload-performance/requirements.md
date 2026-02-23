# Requirements Document

## Introduction

The collector-cli `upload` command currently suffers from severe performance and usability issues when operating at scale (2,362+ snapshot dates, tens of thousands of files). This feature enhances the upload pipeline with conditional checksum computation, progress reporting, date range filtering, a local upload manifest with fast-path skipping, concurrent GCS uploads, and streaming file collection. These changes make the upload command practical for large-scale daily use.

## Glossary

- **Upload_Service**: The service class (`UploadService`) responsible for collecting local snapshot files and uploading them to Google Cloud Storage.
- **CLI**: The commander-based command-line interface that exposes the `upload` command to the operator.
- **File_Collector**: The component within Upload_Service that recursively discovers and gathers file metadata from snapshot directories.
- **Checksum**: A SHA256 hash of file content used to detect changes between local and remote files.
- **Upload_Manifest**: A local JSON file (`.upload-manifest.json`) stored in the cache directory that records the checksum, file size, mtime, and upload timestamp of each successfully uploaded file, eliminating the need for per-file GCS metadata lookups.
- **Progress_Reporter**: An injectable component that streams human-readable progress messages to stderr during upload operations.
- **Concurrency_Pool**: A mechanism that limits the number of simultaneous GCS upload operations to a configurable maximum, with support for early abort on authentication errors.
- **Upload_Summary**: The JSON object written to stdout upon completion, containing file counts, errors, and timing information. Only additive field changes are permitted (no removals or renames).
- **Fast_Path**: A size+mtime comparison against the Upload_Manifest that allows skipping SHA256 computation entirely when file metadata has not changed.
- **FileSystem**: An injectable interface for filesystem operations (walk, stat, readFile), enabling unit tests to use fakes without real IO.
- **Hasher**: An injectable interface for computing SHA256 digests, enabling deterministic test behavior.
- **BucketClient**: An injectable interface wrapping GCS upload operations (upload only — no remote reads), enabling unit tests without network calls.
- **Clock**: An injectable interface for obtaining the current timestamp, enabling deterministic test behavior.

## Requirements

### Requirement 1: Conditional Checksum Computation

**User Story:** As an operator, I want checksum computation to only happen when actually needed, so that dry-run mode is instant and non-incremental uploads don't waste time hashing.

#### Acceptance Criteria for Requirement 1

1. WHEN the `--dry-run` flag is set, THE File_Collector SHALL skip SHA256 checksum computation for all discovered files.
2. WHEN the `--dry-run` flag is set, THE File_Collector SHALL still collect file path, remote path, and file size for each discovered file.
3. WHEN the `--dry-run` flag is set AND the `--incremental` flag is also set, THE Upload_Service SHALL skip incremental comparison and treat all files as candidates for upload.
4. WHEN `--incremental` is enabled AND `--dry-run` is false, THE File_Collector SHALL compute SHA256 checksums only for files that require content comparison (i.e., files whose size or mtime differ from the Upload_Manifest entry, or files with no manifest entry).
5. WHEN `--incremental` is disabled AND `--dry-run` is false, THE File_Collector SHALL NOT compute SHA256 checksums (checksums are not needed for non-incremental uploads).

### Requirement 2: Progress Output to Stderr

**User Story:** As an operator, I want to see progress messages on stderr as dates are processed, so that I know the command is working and can estimate completion time.

#### Acceptance Criteria for Requirement 2

1. AFTER scanning all files for a snapshot date, THE Progress_Reporter SHALL write a date-level progress line to stderr including the date index, total date count, date value, and discovered file count (e.g., `[1/2362] 2017-01-31: 47 files`). The file count SHALL only appear after scanning completes for that date.
2. WHEN the `--verbose` flag is set AND uploading files, THE Progress_Reporter SHALL write a file-level progress line to stderr for each file, including the file path and upload status.
3. THE Upload_Service SHALL write the JSON Upload_Summary to stdout only, keeping it separate from progress output on stderr.
4. WHEN the `--verbose` flag is not set, THE Progress_Reporter SHALL emit date-level progress lines only (no per-file output).
5. THE Progress_Reporter SHALL be injectable via the UploadService constructor to enable testing without real stderr writes.

### Requirement 3: Date Range Filtering

**User Story:** As an operator, I want to filter uploads by date range using `--since` and `--until` options, so that I can perform practical bulk operations like "upload everything since last month."

#### Acceptance Criteria for Requirement 3

1. WHEN the `--since` option is provided, THE CLI SHALL accept a value in YYYY-MM-DD format and THE Upload_Service SHALL only process snapshot dates on or after the specified date.
2. WHEN the `--until` option is provided, THE CLI SHALL accept a value in YYYY-MM-DD format and THE Upload_Service SHALL only process snapshot dates on or before the specified date.
3. WHEN both `--since` and `--until` are provided, THE Upload_Service SHALL only process snapshot dates within the inclusive range.
4. WHEN `--since` or `--until` contain an invalid date format, THE CLI SHALL reject the input with a descriptive error message and exit with code 2.
5. WHEN `--since` is after `--until`, THE CLI SHALL reject the input with a descriptive error message and exit with code 2.
6. WHEN `--date` is provided together with `--since` or `--until`, THE CLI SHALL reject the input with a descriptive error message and exit with code 2, because these options are mutually exclusive.
7. WHEN `--since` or `--until` is provided, THE Upload_Service SHALL include the boundary dates in the filtered set (inclusive range).

### Requirement 4: Local Upload Manifest for Incremental Mode

**User Story:** As an operator, I want incremental uploads to compare against a local manifest instead of making HTTP round-trips to GCS for each file, so that incremental mode is fast with zero network calls for unchanged files.

#### Acceptance Criteria for Requirement 4

1. WHEN a file is successfully uploaded to GCS, THE Upload_Service SHALL record the file's remote path, SHA256 checksum, file size, mtime, and upload timestamp in the Upload_Manifest.
2. WHEN incremental mode is enabled, THE Upload_Service SHALL first perform a fast-path check: if a file's size and mtimeMs match the Upload_Manifest entry, THE Upload_Service SHALL skip that file without computing its checksum or making any network calls.
3. WHEN a file's size or mtimeMs differ from the Upload_Manifest entry, THE Upload_Service SHALL compute the file's SHA256 checksum and compare it against the manifest entry.
4. WHEN a file's computed checksum matches the Upload_Manifest entry, THE Upload_Service SHALL skip that file without any network calls.
5. WHEN a file's computed checksum does not match the Upload_Manifest entry or no entry exists, THE Upload_Service SHALL upload the file to GCS.
6. THE Upload_Service SHALL persist the Upload_Manifest to disk as `.upload-manifest.json` in the cache directory using atomic writes (write to temp file, then rename).
7. THE Upload_Service SHALL flush the manifest to disk after each date completes rather than only at the end.
8. IF the Upload_Manifest file is missing or corrupted, THEN THE Upload_Service SHALL log a warning and treat all files as new, proceeding with a full upload without crashing.
9. IF a manifest write (flush) fails, THE Upload_Service SHALL retry once. IF the retry also fails, THE Upload_Service SHALL log an error (not just a warning), include a `manifestWriteError: true` flag in the Upload_Summary, and continue uploading. The operator SHOULD be aware that the next incremental run may re-upload files that were already uploaded in this run.
10. THE Upload_Manifest SHALL use a JSON format with a `schemaVersion` field to support future format changes.

### Requirement 5: Concurrent GCS Uploads

**User Story:** As an operator, I want GCS uploads to run concurrently with a configurable limit, so that upload throughput is improved over sequential processing.

#### Acceptance Criteria for Requirement 5

1. THE Upload_Service SHALL upload files to GCS using a Concurrency_Pool with a default concurrency limit of 10.
2. WHEN the `--concurrency` option is provided, THE CLI SHALL accept a positive integer and THE Upload_Service SHALL use that value as the concurrency limit.
3. WHEN a file upload fails within the Concurrency_Pool with a non-authentication error, THE Upload_Service SHALL record the failure and continue processing remaining files.
4. WHEN a GCS authentication error occurs within the Concurrency_Pool, THE Upload_Service SHALL classify it using a deterministic, code-based check only: GCS error property `code` matching `UNAUTHENTICATED` or `PERMISSION_DENIED`, or numeric error code 7 or 16. Message-pattern heuristics SHALL NOT be used for auth error classification. THE Upload_Service SHALL set a shared abort flag, cancel pending upload tasks (do not start new ones), and report the authentication error with `authError: true` in the result.
5. IF the `--concurrency` value is less than 1 or not a valid integer, THEN THE CLI SHALL reject the input with a descriptive error message and exit with code 2.
6. WHEN uploads complete (whether fully or partially due to auth abort), THE Upload_Service SHALL still emit a complete Upload_Summary with accurate counts for uploaded, failed, and skipped files.

### Requirement 6: Streaming File Collection

**User Story:** As an operator, I want file collection to use streaming instead of loading all files into memory, so that memory usage stays flat regardless of dataset size.

#### Acceptance Criteria for Requirement 6

1. THE File_Collector SHALL yield files as they are discovered using an async generator pattern instead of collecting all files into an array.
2. THE Upload_Service SHALL process files from the async generator incrementally, without buffering the entire file list in memory.
3. WHEN processing files from the async generator, THE Upload_Service SHALL maintain accurate file counts for the Upload_Summary.

### Requirement 7: Backward Compatibility

**User Story:** As an operator, I want the existing JSON output format and CLI options to remain unchanged, so that any scripts depending on the upload command continue to work.

#### Acceptance Criteria for Requirement 7

1. THE Upload_Summary JSON output format SHALL remain backward-compatible: no fields SHALL be removed or renamed; only additive fields are permitted.
2. THE CLI SHALL continue to support the existing `--date`, `--incremental`, `--dry-run`, `--verbose`, and `--config` options with unchanged behavior.
3. WHEN no new options are provided, THE Upload_Service SHALL behave identically to the current implementation (excluding performance improvements).

### Requirement 8: Testability via Dependency Injection

**User Story:** As a developer, I want UploadService to accept injected dependencies for filesystem, hashing, GCS client, clock, and progress reporting, so that unit tests can use fakes without real IO or network calls.

#### Acceptance Criteria for Requirement 8

1. THE UploadService constructor SHALL accept optional injectable dependencies: FileSystem, Hasher, BucketClient, Clock, and ProgressReporter.
2. WHEN injectable dependencies are not provided, THE UploadService SHALL use default production implementations (real fs, crypto, GCS Storage, Date.now, stderr writer).
3. THE injectable interfaces SHALL be minimal: FileSystem (readdir, stat, readFile, writeFile, rename, access), Hasher (sha256(path): Promise of string), BucketClient (uploadStream(remotePath, stream, contentType, metadata): Promise of void — accepts a Readable stream, not a Buffer), Clock (now(): string). BucketClient SHALL NOT include an `exists()` method; incremental mode uses the local manifest exclusively and never queries remote state.
4. Unit tests SHALL use fake implementations of these interfaces to test upload logic without real filesystem, network, or clock dependencies.
