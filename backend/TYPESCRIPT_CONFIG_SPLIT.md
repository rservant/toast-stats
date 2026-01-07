# TypeScript Configuration Split

This document explains the TypeScript configuration split between production and test code in the backend.

## Configuration Files

### `tsconfig.json` (Production Code)
- **Strict TypeScript rules** following the TypeScript Steering Document
- Excludes all test files (`**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**/*`, `**/__*`)
- Enforces strict type safety for production code

### `tsconfig.test.json` (Test Code)
- **Relaxed TypeScript rules** for test files
- Extends `tsconfig.json` but overrides strict settings
- Allows `any` types, relaxes null checks, and disables unused variable warnings
- Includes only test files

### `tsconfig.all.json` (All Code)
- Includes both production and test code
- Used for comprehensive type checking across the entire codebase

## ESLint Configuration Split

### Production Code Rules (Strict)
- `@typescript-eslint/no-explicit-any`: **error**
- `@typescript-eslint/explicit-function-return-type`: **error**
- `@typescript-eslint/no-unused-vars`: **error**

### Test Code Rules (Relaxed)
- `@typescript-eslint/no-explicit-any`: **warn** (instead of error)
- `@typescript-eslint/explicit-function-return-type`: **off**
- `@typescript-eslint/no-unused-vars`: **off**
- `@typescript-eslint/ban-ts-comment`: **off**
- `@typescript-eslint/no-non-null-assertion`: **off**
- `@typescript-eslint/no-empty-function`: **off**

## Available Scripts

### TypeScript Checking
- `npm run typecheck` - Check production code only (560 errors currently)
- `npm run typecheck:test` - Check test code only (88 errors currently)
- `npm run typecheck:all` - Check all code (production + test)

### Error Counting
- `npm run typecheck:count` - Count production TypeScript errors
- `npm run typecheck:count:test` - Count test TypeScript errors
- `npm run typecheck:count:all` - Count all TypeScript errors

### Error Listing
- `npm run typecheck:errors` - List production TypeScript errors
- `npm run typecheck:errors:test` - List test TypeScript errors
- `npm run typecheck:errors:all` - List all TypeScript errors

### Linting
- `npm run lint` - Lint all files (strict rules for production, relaxed for tests)
- `npm run lint:test` - Lint only test files (9 warnings currently)

## Benefits

1. **Maintains Type Safety**: Production code still follows strict TypeScript rules
2. **Reduces Test Friction**: Test code can use `any` types and other relaxed patterns when needed
3. **Clear Separation**: Easy to see which errors are in production vs test code
4. **Gradual Migration**: Can fix production errors first, then address test errors separately
5. **CI/CD Flexibility**: Can choose to block on production errors while allowing test warnings

## Current Status

- **Production Code**: 560 TypeScript errors (strict rules)
- **Test Code**: 88 TypeScript errors (relaxed rules)
- **Test Linting**: 9 warnings (no errors)

This split allows the team to focus on fixing critical production type issues while maintaining test functionality.