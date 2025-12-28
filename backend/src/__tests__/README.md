# Test Directory Management

## Issue: Test Directory Cleanup

This project uses property-based testing and isolated cache directories for tests. During test execution, temporary directories are created with names like:

- `test-cache-*` - Cache-related test directories
- `test-progress-tracker-*` - Progress tracker test directories
- `test-*` - General property-based test directories

## Problem

Previously, these test directories were not being properly cleaned up, leading to thousands of leftover directories in the backend folder. This happened because:

1. Some tests only called `storageManager.clearAll()` which clears files but not the directory itself
2. Property-based tests create many temporary directories during execution
3. If tests are interrupted or fail, cleanup might not happen

## Solution

### 1. Fixed Test Cleanup

Updated test files to properly remove test directories:

```typescript
afterEach(async () => {
  try {
    await storageManager.clearAll()
    // Also remove the test directory itself
    await fs.rm(testCacheDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
})
```

### 2. Cleanup Script

Created `backend/scripts/cleanup-test-dirs.sh` to manually clean up any leftover test directories:

```bash
# Run the cleanup script
npm run test:cleanup
```

### 3. Best Practices

When writing new tests that create temporary directories:

1. **Always store the directory path** in a variable so you can clean it up
2. **Use `afterEach` or `afterAll`** to remove the directory with `fs.rm(dir, { recursive: true, force: true })`
3. **Use unique directory names** to avoid conflicts between parallel tests
4. **Wrap cleanup in try-catch** to avoid test failures due to cleanup issues

### Example Test Pattern

```typescript
describe('My Test', () => {
  let testCacheDir: string
  let storageManager: SomeStorageManager

  beforeEach(async () => {
    const testId = Math.random().toString(36).substring(7)
    testCacheDir = path.join(process.cwd(), `test-my-feature-${testId}`)
    storageManager = new SomeStorageManager(testCacheDir)
    await storageManager.init()
  })

  afterEach(async () => {
    try {
      await storageManager.clearAll() // Clear files
      await fs.rm(testCacheDir, { recursive: true, force: true }) // Remove directory
    } catch {
      // Ignore cleanup errors
    }
  })

  // ... your tests
})
```

## Monitoring

To check for leftover test directories:

```bash
# Count temporary test directories
find . -type d -name "test-cache*" | wc -l

# List temporary test directories
find . -type d -name "test-cache*"

# Clean up all temporary test directories
npm run test:cleanup
```

## .gitignore Configuration

The .gitignore file has been configured with a simple pattern to ignore all temporary test directories:

```gitignore
# Test artifacts - temporary directories only
test-cache*/
```

This ensures that any directory starting with `test-cache` is ignored by git, while legitimate test files like `test-cache-helper.ts` and `test-helpers.ts` are preserved.
