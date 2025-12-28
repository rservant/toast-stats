# Testing Commands Reference

## The Problem

I consistently make the mistake of using duplicate `--run` flags when running tests, which causes vitest to fail with:

```
Error: Expected a single value for option "--run", received [true, true]
```

## Root Cause

The backend package.json already defines `"test": "vitest --run"`, so when I use:

```bash
npm run test --workspace=backend -- --run "path/to/test.ts"
```

It becomes: `vitest --run --run path/to/test.ts` (duplicate --run flags)

## Correct Commands

### Run All Tests

```bash
# Root level - all workspaces
npm test

# Backend only
npm run test:backend
# OR
npm run test --workspace=backend

# Frontend only
npm run test:frontend
# OR
npm run test --workspace=frontend
```

### Run Specific Test File

```bash
# From root directory
npm run test --workspace=backend -- "src/path/to/test.ts"

# From backend directory
npm test -- "src/path/to/test.ts"
# OR
npx vitest --run "src/path/to/test.ts"
```

### Run Tests in Watch Mode

```bash
# Backend watch mode
npm run test:watch --workspace=backend

# From backend directory
npm run test:watch
# OR
npx vitest
```

## Key Points

1. **NEVER use `--run` flag when using npm scripts** - it's already included in the backend test script
2. **Use double dash `--`** to pass arguments to the underlying command
3. **Paths should be relative to the workspace directory** (backend/ or frontend/)
4. **When in doubt, run from the specific workspace directory** using `npx vitest --run`

## Quick Reference

- ✅ `npm run test --workspace=backend -- "src/services/__tests__/MyTest.test.ts"`
- ✅ `npx vitest --run "src/services/__tests__/MyTest.test.ts"` (from backend/)
- ❌ `npm run test --workspace=backend -- --run "src/services/__tests__/MyTest.test.ts"`
- ❌ `npm test -- --run backend/src/services/__tests__/MyTest.test.ts`
