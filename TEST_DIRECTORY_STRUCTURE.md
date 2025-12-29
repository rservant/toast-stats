# Test Directory Structure

## Overview

This project uses a consistent `test-dir/` pattern for all temporary test files and directories across both frontend and backend components. This approach ensures clean organization, reliable cleanup, and consistent behavior across different environments.

## Directory Structure

```
project-root/
├── test-dir/                    # Root-level test artifacts (if any)
├── backend/
│   ├── test-dir/                # Backend test artifacts
│   │   ├── test-cache-*/        # Temporary cache directories
│   │   ├── test-assessment-*/   # Assessment test data
│   │   └── test-reconciliation-*/ # Reconciliation test files
│   └── scripts/
│       └── cleanup-test-dirs.sh # Backend cleanup script
├── frontend/
│   ├── test-dir/                # Frontend test artifacts (future use)
│   └── scripts/
│       └── cleanup-test-dirs.sh # Frontend cleanup script
└── scripts/
    └── cleanup-all-test-dirs.sh # Project-wide cleanup script
```

## Benefits

### 1. **Predictable Location**

- All test artifacts are in known locations relative to the project
- Easy to inspect test files during development and debugging
- Consistent across different environments (dev, CI, containers)

### 2. **Clean Organization**

- No test files cluttering project root directories
- Clear separation between production and test artifacts
- Easy to identify and manage test-related files

### 3. **Reliable Cleanup**

- Automated cleanup scripts for each component
- Global cleanup utilities handle process exit scenarios
- CI/CD friendly - no leftover artifacts between builds

### 4. **Cross-Platform Compatibility**

- Works consistently on macOS, Linux, Windows, and containers
- No permission issues with system directories
- Avoids platform-specific temporary directory behaviors

### 5. **Version Control Integration**

- Properly excluded from git via `.gitignore`
- Excluded from build processes via vitest configurations
- No accidental commits of test artifacts

## Configuration

### Git Ignore

```gitignore
# Test artifacts - temporary directories only
test-cache*/
test-dir/
```

### Vitest Configuration

```typescript
// Backend: backend/vitest.config.ts
exclude: [
  '**/test-dir/**',
],
coverage: {
  exclude: [
    '**/test-dir/**',
  ],
}

// Frontend: frontend/vitest.config.ts
exclude: [
  '**/test-dir/**',
],
coverage: {
  exclude: [
    '**/test-dir/**',
  ],
}
```

## Usage Patterns

### Backend Test Files

```typescript
// Use test-dir for cache directories
const testCacheDir = './test-dir/test-cache-unique-id'

// Use test-dir for assessment data
const testDataDir = './test-dir/test-assessment-data'

// Use test-dir for reconciliation files
const testConfigPath = './test-dir/test-reconciliation-config.json'
```

### Frontend Test Files

```typescript
// Future use - consistent with backend pattern
const testCacheDir = './test-dir/test-cache-unique-id'
```

### Property-Based Test Generators

```typescript
// Generate safe test directory paths
export const safeCachePath = (
  baseDir: string = './test-dir/test-cache',
  minLength: number = 5,
  maxLength: number = 15
): fc.Arbitrary<string> =>
  safeString(minLength, maxLength).map(s => `${baseDir}-${s}`)
```

## Cleanup Scripts

### Project-Wide Cleanup

```bash
# Clean all test directories across the entire project
npm run cleanup:test-dirs
```

### Component-Specific Cleanup

```bash
# Clean only backend test directories
npm run cleanup:backend

# Clean only frontend test directories
npm run cleanup:frontend
```

### Manual Cleanup

```bash
# Backend only
cd backend && npm run cleanup:test-dirs

# Frontend only
cd frontend && npm run cleanup:test-dirs
```

## Automated Cleanup

### Global Test Cleanup Utilities

Both frontend and backend include global cleanup utilities that:

- Run automatically when test processes exit
- Handle various exit scenarios (SIGINT, SIGTERM, uncaught exceptions)
- Clean up test directories that may have been left behind
- Provide verbose logging for debugging

### Usage in Tests

```typescript
import { setupGlobalTestCleanup } from '../utils/global-test-cleanup'

// Setup cleanup for the entire test suite
setupGlobalTestCleanup(true) // verbose = true for debugging
```

## Environment Variables

### Test Environment Setup

```bash
# Use test-dir for cache configuration in tests
CACHE_DIR=./test-dir/test-cache-default

# CI/CD environments
CACHE_DIR=./test-dir/test-cache-${BUILD_ID}
```

## Migration from /tmp

This project has been migrated from using `/tmp` directories to local `test-dir/` directories for the following reasons:

1. **Consistency**: Same behavior across all environments
2. **Debugging**: Easier to inspect test artifacts
3. **Permissions**: No system directory permission issues
4. **CI/CD**: More reliable in containerized environments
5. **Organization**: Better project structure and cleanup

### Before (❌ Old Pattern)

```typescript
// Don't use system temp directories
const testDir = '/tmp/test-cache-123'
process.env.CACHE_DIR = '/tmp/some-cache'
```

### After (✅ New Pattern)

```typescript
// Use project-local test directories
const testDir = './test-dir/test-cache-123'
process.env.CACHE_DIR = './test-dir/some-cache'
```

## Best Practices

### 1. **Use Unique Identifiers**

Always include unique identifiers in test directory names to avoid conflicts:

```typescript
const testId = Date.now()
const testDir = `./test-dir/test-cache-${testId}`
```

### 2. **Clean Up After Tests**

Use `afterEach` or `afterAll` hooks to clean up test directories:

```typescript
afterEach(async () => {
  await cleanupTestDirectory(testDir)
})
```

### 3. **Use Safe String Generators**

Use the provided safe string generators for test directory names:

```typescript
import { safeCachePath } from '../utils/test-string-generators'

const testDirArbitrary = safeCachePath('./test-dir/test-cache')
```

### 4. **Document Test Artifacts**

When creating test files, document their purpose and cleanup requirements:

```typescript
// Creates temporary cache directory for integration testing
// Cleaned up automatically by global test cleanup utilities
const testCacheDir = './test-dir/test-cache-integration'
```

## Troubleshooting

### Test Directories Not Cleaned Up

1. Check if cleanup scripts have execute permissions:

   ```bash
   chmod +x backend/scripts/cleanup-test-dirs.sh
   chmod +x frontend/scripts/cleanup-test-dirs.sh
   chmod +x scripts/cleanup-all-test-dirs.sh
   ```

2. Run manual cleanup:

   ```bash
   npm run cleanup:test-dirs
   ```

3. Check for processes holding directory handles:
   ```bash
   lsof +D ./test-dir
   ```

### Permission Issues

If you encounter permission issues:

1. Ensure the project directory is writable
2. Check that test processes aren't running as different users
3. Verify that cleanup scripts have proper permissions

### CI/CD Issues

For CI/CD environments:

1. Ensure cleanup scripts run in the correct working directory
2. Add cleanup steps to CI/CD pipeline after test execution
3. Use unique build identifiers in test directory names

## Future Enhancements

### Planned Improvements

1. **Size Monitoring**: Track test directory sizes to prevent disk space issues
2. **Age-Based Cleanup**: Automatically clean up old test directories
3. **Parallel Test Safety**: Enhanced isolation for parallel test execution
4. **Performance Metrics**: Monitor cleanup performance and optimize

### Integration Opportunities

1. **IDE Integration**: Add cleanup commands to IDE task runners
2. **Git Hooks**: Integrate cleanup into pre-commit or post-merge hooks
3. **Docker Integration**: Ensure proper cleanup in containerized environments
