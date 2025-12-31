---
name: 'lint-compliance-guide'
displayName: 'Lint Compliance Guide'
description: 'Comprehensive lint compliance standards and best practices for maintaining zero-error codebases with TypeScript, ESLint, and Prettier.'
keywords:
  ['lint', 'eslint', 'prettier', 'typescript', 'code-quality', 'compliance']
author: 'Engineering Team'
---

# Lint Compliance Guide

## Overview

This power provides comprehensive lint compliance standards for maintaining high-quality, consistent codebases. It establishes a zero-tolerance policy for lint violations and provides practical guidance for achieving and maintaining compliance.

The guide covers ESLint, Prettier, TypeScript integration, React-specific rules, and proven patterns for error resolution. It's designed for teams that want to enforce strict code quality standards while maintaining development velocity.

## Available Steering Files

This power includes specialized steering files for different aspects of lint compliance:

- **error-resolution** - Detailed patterns and strategies for fixing lint errors safely
- **ci-cd-integration** - Complete CI/CD pipeline setup and enforcement mechanisms
- **team-workflows** - Development workflows and team processes for maintaining compliance

Call action "readSteering" to access specific topics as needed.

## Core Principles

All code MUST follow these lint compliance principles:

1. **Zero lint errors are permitted** - All code must pass linting without errors
2. **Warnings should be minimized** - Lint warnings indicate potential issues and should be addressed
3. **Consistent code style is mandatory** - Automated formatting and linting ensure consistency
4. **Type safety is enforced** - No explicit `any` types without documented justification
5. **React best practices are required** - Follow React hooks rules and component patterns

## Mandatory Requirements

### Zero Error Policy

- **MUST NOT** introduce any new lint errors
- **MUST** fix existing lint errors before adding new features
- **MUST** have lint checks pass in CI/CD pipeline
- **MUST** treat lint errors as build-breaking failures

### Code Quality Standards

All projects MUST enforce:

- **No explicit `any` types** without documented exceptions
- **No unused variables or imports**
- **Proper React hooks usage** (no components during render, proper dependencies)
- **No console statements** in production code
- **Proper error handling** (no empty catch blocks)

### TypeScript Specific Requirements

- **MUST** use proper type definitions instead of `any`
- **MUST** define NodeJS types when using Node.js globals
- **MUST** use proper generic constraints
- **MUST** avoid type assertions unless absolutely necessary

### React Specific Requirements

- **MUST** declare components outside render functions
- **MUST NOT** call setState synchronously within effects
- **MUST** include all dependencies in useEffect/useMemo hooks
- **MUST** use proper prop types and interfaces

## Quick Start Implementation

### 1. Install Required Tools

```bash
# Install ESLint and TypeScript support
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

# Install Prettier
npm install --save-dev prettier

# Install React ESLint plugins (if using React)
npm install --save-dev eslint-plugin-react eslint-plugin-react-hooks
```

### 2. Basic ESLint Configuration

Create `.eslintrc.js`:

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': 'error',
  },
}
```

### 3. Prettier Configuration

Create `.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### 4. Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

## Error Resolution Priority

Fix lint errors in this priority order:

1. **Critical**: Explicit `any` types, React hooks violations
2. **High**: Unused variables, missing dependencies
3. **Medium**: Console statements, formatting issues
4. **Low**: Style and preference warnings

## Common Error Patterns and Solutions

### Explicit `any` Type Elimination

**Problem**: `@typescript-eslint/no-explicit-any` errors

**Solution**: Use the unknown-first pattern

```typescript
// BAD: Direct any usage
const result = data as any

// GOOD: Safe type assertion
const result = data as unknown as SpecificType
```

### React Hooks Dependencies

**Problem**: `react-hooks/exhaustive-deps` warnings

**Solution**: Include all dependencies or use useCallback

```typescript
// BAD: Missing dependency
useEffect(() => {
  fetchData(userId)
}, []) // userId missing from deps

// GOOD: Include all dependencies
useEffect(() => {
  fetchData(userId)
}, [userId])
```

### Unused Variables

**Problem**: `@typescript-eslint/no-unused-vars` errors

**Solution**: Remove unused variables or prefix with underscore

```typescript
// BAD: Unused variable
const unusedVar = getValue()

// GOOD: Remove or prefix with underscore
const _unusedVar = getValue() // If needed for debugging
```

## CI/CD Integration

### Pre-commit Hook Setup

Install husky and lint-staged:

```bash
npm install --save-dev husky lint-staged
```

Add to `package.json`:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### GitHub Actions Workflow

Create `.github/workflows/lint.yml`:

```yaml
name: Lint and Format Check

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
```

## Exception Handling

### Limited Exceptions Allowed

- **Third-party library** integration (temporary, with migration plan)
- **Legacy code** migration (with timeline for resolution)
- **Performance-critical** sections (with detailed justification)

### Exception Process

1. **Document** the specific need for exception
2. **Justify** why lint compliance isn't possible
3. **Plan** migration strategy to remove exception
4. **Get approval** from tech lead and architect
5. **Set timeline** for resolution

### ESLint Disable Comments

When exceptions are necessary, use specific disable comments:

```typescript
// Disable specific rule with justification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyData: any = thirdPartyLibrary.getData() // TODO: Add proper types in v2.0

// Disable for entire file (rare)
/* eslint-disable @typescript-eslint/no-explicit-any */
// Legacy file - scheduled for refactor in Q2 2024
```

## Monitoring and Metrics

### Key Metrics to Track

- **Total lint errors** (should be zero)
- **Error introduction rate** (new errors per commit)
- **Error resolution rate** (errors fixed per sprint)
- **Type safety percentage** (trending up)

### Reporting Tools

```bash
# Generate lint report
npm run lint -- --format json --output-file lint-report.json

# Check type coverage (if using type-coverage tool)
npx type-coverage --detail
```

## Best Practices

### Development Workflow

1. **Before Starting Work**
   - Verify lint checks pass: `npm run lint`
   - Check current error/warning count baseline
   - Ensure IDE shows lint errors in real-time

2. **During Development**
   - Fix lint errors as they appear
   - Use proper type definitions for new code
   - Avoid temporary `any` types or lint disables

3. **Before Committing**
   - Run lint checks locally: `npm run lint`
   - Run formatting: `npm run format`
   - Ensure no new errors introduced

### IDE Configuration

**VS Code Settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["typescript", "typescriptreact"]
}
```

### Team Guidelines

- **Code reviews** must verify lint compliance
- **Zero tolerance** for new lint errors
- **Immediate fixes** required for any violations
- **Documentation** required for any exceptions

## Troubleshooting

### Common Issues

**ESLint not running in IDE**

- Verify ESLint extension is installed
- Check workspace settings for ESLint configuration
- Restart IDE after configuration changes

**Prettier conflicts with ESLint**

- Install `eslint-config-prettier` to disable conflicting rules
- Ensure Prettier runs after ESLint in your workflow

**Performance issues with large codebases**

- Use `.eslintignore` to exclude unnecessary files
- Consider running lint checks only on changed files in CI
- Use ESLint cache: `eslint --cache`

## Success Metrics

A successful lint compliance implementation should achieve:

- ✅ **Zero lint errors** across entire codebase
- ✅ **Zero formatting errors** across entire codebase
- ✅ **Automated enforcement** via pre-commit hooks and CI/CD
- ✅ **Team adoption** with consistent development practices
- ✅ **Continuous compliance** maintained over time

## Final Rule

> **Zero lint errors are permitted in this repository.**  
> **Zero formatting errors are permitted in this repository.**  
> **Every change must maintain or improve code quality and consistency.**  
> **Lint violations and formatting errors are treated as critical bugs.**

**Enforcement**: Any commit introducing lint errors will be automatically rejected by the CI/CD pipeline.

**Accountability**: Team members are responsible for maintaining lint compliance in their code areas.

**Continuous Improvement**: Regular reviews of this policy to ensure it supports development velocity while maintaining quality.
