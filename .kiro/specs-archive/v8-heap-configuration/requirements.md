# Requirements Document

## Introduction

This feature implements V8 heap memory configuration for the backend Dockerfile to prevent Out of Memory (OOM) crashes in production. The configuration follows the performance SLOs defined in `docs/performance-slos.md` Section 6.2 and 7.2, which specify that V8 heap limits must be set to approximately 75% of container memory to leave room for native memory and runtime overhead.

## Glossary

- **V8_Heap**: The memory space managed by the V8 JavaScript engine's garbage collector, controlled by the `--max-old-space-size` flag
- **Container_Memory**: The total memory allocated to the Docker container (512Mi default for Cloud Run)
- **NODE_OPTIONS**: Environment variable used to pass command-line options to the Node.js runtime
- **OOM**: Out of Memory condition where the process is killed due to exceeding memory limits
- **RSS**: Resident Set Size - total memory allocated to the Node.js process by the operating system
- **Heap_Validator**: A startup component that validates V8 heap configuration against container memory limits

## Requirements

### Requirement 1: V8 Heap Limit Configuration

**User Story:** As a DevOps engineer, I want the backend Dockerfile to configure V8 heap limits, so that the application does not crash due to OOM conditions in production.

#### Acceptance Criteria

1. THE Dockerfile SHALL set the NODE_OPTIONS environment variable with `--max-old-space-size=384`
2. THE Dockerfile SHALL place the NODE_OPTIONS configuration alongside other environment variables (NODE_ENV, PORT, CACHE_DIR)
3. WHEN the container starts, THE Node.js runtime SHALL respect the configured heap limit of 384MB

### Requirement 2: Heap Configuration Validation at Startup

**User Story:** As a developer, I want the application to validate heap configuration at startup, so that misconfiguration is detected early and logged.

#### Acceptance Criteria

1. WHEN the application starts, THE Heap_Validator SHALL read the current V8 heap size limit using the v8 module
2. WHEN the application starts, THE Heap_Validator SHALL log the configured heap size limit in megabytes
3. IF the heap limit exceeds 85% of container memory, THEN THE Heap_Validator SHALL log a warning with the recommended configuration
4. THE Heap_Validator SHALL execute before the HTTP server starts listening

### Requirement 3: Memory Metrics Logging

**User Story:** As an operations engineer, I want memory metrics logged periodically, so that I can monitor memory usage and detect potential issues.

#### Acceptance Criteria

1. THE Application SHALL log memory metrics (heapUsed, heapTotal, rss, external) at startup
2. THE Application SHALL log memory metrics periodically during operation (every 60 seconds)
3. WHEN logging memory metrics, THE Application SHALL include metric values in megabytes for readability
4. THE Memory_Logger SHALL use the existing logger infrastructure for consistent log formatting

### Requirement 4: Graceful Shutdown Memory Cleanup

**User Story:** As a developer, I want memory logging intervals to be cleaned up on shutdown, so that the application terminates cleanly.

#### Acceptance Criteria

1. WHEN SIGTERM is received, THE Application SHALL clear the memory logging interval
2. WHEN SIGINT is received, THE Application SHALL clear the memory logging interval
3. THE Application SHALL complete interval cleanup before closing the HTTP server
