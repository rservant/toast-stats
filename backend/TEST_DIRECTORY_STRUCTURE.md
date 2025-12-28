# Test Directory Structure

## Overview

All temporary test directories are now created in `backend/test-dir/` to keep the project root clean and organized.

## Changes Made

### 1. Test Cache Helper Updates

- Updated `src/utils/test-cache-helper.ts` to create test directories in `./test-dir/` instead of directly in the backend root
- All test cache directories now follow the pattern: `./test-dir/test-cache-{testId}`

### 2. Test Configuration Updates

- Updated property-based tests to use the new directory structure
- Fixed `safeString().sample()` calls to work correctly with fast-check arbitraries
- Updated test string generators to use the new base directory

### 3. Vitest Configuration

- Added `**/test-dir/**` to the exclude patterns in `vitest.config.ts`
- Added test directory exclusions to coverage configuration

### 4. Git Ignore

- Added `test-dir/` to `.gitignore` to prevent temporary test artifacts from being committed

## Directory Structure

```
backend/
├── test-dir/                    # All test artifacts go here
│   ├── test-cache-{testId}/     # Temporary cache directories
│   ├── test-assessment-data/    # Assessment test data
│   └── test-reconciliation-*/   # Reconciliation test files
├── src/
│   └── utils/
│       └── test-cache-helper.ts # Updated to use test-dir
└── vitest.config.ts             # Updated to exclude test-dir
```

## Benefits

1. **Clean Project Root**: No more test directories cluttering the backend folder
2. **Better Organization**: All test artifacts are contained in one location
3. **Easier Cleanup**: Single directory to clean when needed
4. **CI/CD Friendly**: Test artifacts are properly excluded from builds and coverage

## Usage

Tests will automatically use the new directory structure. No changes needed in individual test files that use the test cache helper utilities.

For manual testing or debugging, temporary files will be created in `backend/test-dir/` and can be safely deleted after testing.
