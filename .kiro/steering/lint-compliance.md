# Lint Compliance Steering Document

**Status:** Authoritative  
**Applies to:** All repositories, services, libraries, and pipelines  
**Audience:** Engineers, Tech Leads, Architects  
**Owner:** Engineering

---

## 1. Purpose

This document defines **lint compliance standards** for this organization.

Its goal is to:

- Maintain consistent code quality across all codebases
- Prevent common programming errors and anti-patterns
- Ensure code readability and maintainability
- Establish zero-tolerance for lint violations

This document is **normative**.  
Where it uses **MUST**, **MUST NOT**, **SHOULD**, and **MAY**, those words are intentional.

Kiro should treat this document as the **primary source of truth** for lint compliance decisions.

---

## 2. Core Principles

All code MUST follow these lint compliance principles:

1. **Zero lint errors are permitted**  
   All code must pass linting without errors.

2. **Warnings should be minimized**  
   Lint warnings indicate potential issues and should be addressed.

3. **Consistent code style is mandatory**  
   Automated formatting and linting ensure consistency.

4. **Type safety is enforced**  
   No explicit `any` types without documented justification.

5. **React best practices are required**  
   Follow React hooks rules and component patterns.

---

## 3. Mandatory Requirements

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

---

## 4. CI/CD Pipeline Requirements

### Build Pipeline MUST Include:

1. **ESLint Check**

   ```bash
   npm run lint
   ```

   - Must return exit code 0 (no errors)
   - Must run on every commit and pull request
   - Must block merge if lint errors exist

2. **Automated Formatting Check**

   ```bash
   npm run format:check
   ```

   - Ensure consistent code formatting
   - Block commits with formatting violations

3. **Type Coverage Reporting**
   - Track percentage of properly typed code
   - Set minimum type safety thresholds
   - Report type coverage in pull requests

### Pull Request Requirements

Every pull request MUST:

- Pass all lint checks without errors
- Have zero or minimal warnings
- Include proper type definitions for new code
- Document any necessary lint rule exceptions

---

## 5. Error Resolution Strategy

### Immediate Actions (Required)

- **MUST** fix all lint errors before new feature development
- **MUST** prioritize error resolution in sprint planning
- **MUST** assign lint error cleanup to team members

### Systematic Approach

1. **Fix Critical Errors** first (explicit any, unused variables)
2. **Address React Violations** second (hooks rules, component patterns)
3. **Clean Up Warnings** third (dependency arrays, formatting)
4. **Optimize Type Safety** fourth (improve type definitions)

### Error Types Priority:

1. **Critical**: Explicit `any` types, React hooks violations
2. **High**: Unused variables, missing dependencies
3. **Medium**: Console statements, formatting issues
4. **Low**: Style and preference warnings

---

## 6. Development Workflow

### Before Starting Work

- **MUST** verify lint checks pass
- **MUST** check current error/warning count baseline
- **MUST** ensure development environment shows lint errors

### During Development

- **MUST** fix lint errors as they appear
- **MUST** use proper type definitions for new code
- **MUST** avoid temporary `any` types or lint disables

### Before Committing

- **MUST** run lint checks locally
- **MUST** ensure no new errors introduced
- **MUST** fix any errors before commit

---

## 7. Enforcement Mechanisms

### Automated Enforcement

- **Pre-commit hooks** to check lint compliance
- **CI/CD pipeline** failures on lint errors
- **Branch protection rules** requiring lint checks
- **Automated PR comments** showing error counts

### Manual Enforcement

- **Code review requirements** for lint compliance
- **Team lead approval** required for lint rule exceptions
- **Architecture review** for major linting configuration changes

---

## 8. Exception Handling

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

---

## 9. Tools and Configuration

### Required Tools

- **ESLint** with TypeScript support
- **Prettier** for code formatting
- **React ESLint plugins** for React-specific rules
- **Pre-commit hooks** for automated checking

### Configuration Standards

- Use strict ESLint configurations
- Enable all recommended TypeScript rules
- Enforce React hooks rules
- Configure Prettier for consistent formatting

---

## 10. Monitoring and Reporting

### Metrics to Track

- **Total lint errors** (trending down)
- **Error introduction rate** (new errors per commit)
- **Error resolution rate** (errors fixed per sprint)
- **Type safety percentage** (trending up)

### Regular Reporting

- **Daily**: Error count in team standups
- **Weekly**: Progress reports to leadership
- **Monthly**: Lint compliance and quality metrics
- **Quarterly**: Linting policy effectiveness review

---

## 12. Code Formatting Requirements

### Mandatory Formatting Standards

All code MUST be consistently formatted using Prettier:

- **MUST** pass `npm run format` without errors
- **MUST** use consistent indentation, spacing, and line breaks
- **MUST** follow established formatting rules for TypeScript, JavaScript, JSON, and Markdown
- **MUST** fix any formatting violations before commit

### Formatting Policy

- **Zero formatting errors permitted** in the codebase
- **Automated formatting** is required for all supported file types
- **Consistent style** across all files and contributors
- **Pre-commit formatting checks** must pass

### File Types Covered

- TypeScript/JavaScript files (`.ts`, `.tsx`, `.js`, `.jsx`)
- JSON files (`.json`) - must be valid JSON syntax
- Markdown files (`.md`)
- Configuration files

### CI/CD Pipeline Requirements

The build pipeline MUST include:

1. **Formatting Check**

   ```bash
   npm run format
   ```

   - Must return exit code 0 (no formatting errors)
   - Must run on every commit and pull request
   - Must block merge if formatting errors exist

2. **Automated Formatting Verification**
   - Ensure all files follow consistent formatting rules
   - Block commits with formatting violations
   - Generate detailed error reports for violations

### Error Resolution Priority

1. **Critical**: JSON syntax errors (prevent parsing)
2. **High**: TypeScript/JavaScript formatting violations
3. **Medium**: Markdown formatting inconsistencies
4. **Low**: Minor spacing and style issues

### Development Workflow

- **MUST** run `npm run format` before committing
- **MUST** fix any formatting errors as they appear
- **MUST** ensure IDE is configured with Prettier integration
- **MUST** verify formatting compliance in CI/CD pipeline

### Current Status - ZERO ERROR ACHIEVEMENT ✅

**✅ COMPLETE COMPLIANCE ACHIEVED AND MAINTAINED**

- Zero lint errors across entire codebase ✅
- Zero formatting errors across entire codebase ✅  
- Zero TypeScript errors across entire codebase ✅
- All CI/CD pipeline requirements met ✅
- Automated enforcement active ✅

**Project Status**: Production-ready with full compliance maintained through:
- Pre-commit hooks blocking error introduction
- CI/CD pipeline enforcement
- Automated formatting and linting
- Team adherence to zero-error policy

---

## 13. Final Rule

> **Zero lint errors are permitted in this repository.**  
> **Zero formatting errors are permitted in this repository.**  
> **Every change must maintain or improve code quality and consistency.**  
> **Lint violations and formatting errors are treated as critical bugs.**

**Enforcement**: Any commit introducing lint errors will be automatically rejected by the CI/CD pipeline.

**Accountability**: Team members are responsible for maintaining lint compliance in their code areas.

**Continuous Improvement**: Regular reviews of this policy to ensure it supports development velocity while maintaining quality.

## 12. Lint-TypeScript Compatibility Patterns

### Safe `any` Type Elimination

When removing `any` types to achieve lint compliance:

1. **MUST** use `unknown` as intermediate step
2. **SHOULD** create proper interfaces for complex objects
3. **MAY** use `unknown as SpecificType` for type assertions
4. **MUST NOT** use `any` even temporarily

### Test Mock Type Safety

All test mocks MUST have proper type definitions:

- Create mock-specific interfaces
- Use `ReturnType<typeof vi.fn>` for mock functions
- Avoid `Partial<RealType>` when possible - create dedicated mock interfaces

### Type Assertion Best Practices

When type assertions are necessary:

1. **Prefer**: `unknown as SpecificType`
2. **Avoid**: `value as any as SpecificType`
3. **Document**: Why the assertion is safe
4. **Plan**: Migration to proper typing

### Error Resolution Order

Fix lint errors in this priority order:

1. **Explicit `any` types** (critical - breaks lint and safety)
2. **Unused variables/imports** (high - breaks lint)
3. **Missing type definitions** (medium - improves safety)
4. **Style violations** (low - consistency)

### Verification Workflow

After fixing lint errors:

1. **MUST** run `npm run lint` (verify 0 errors)
2. **MUST** run `npx tsc --noEmit` (verify no new TypeScript errors)
3. **SHOULD** run tests to ensure functionality preserved
4. **MAY** run type coverage tools to measure improvement

### Proven Patterns for Safe Error Resolution

#### Type Safety Patterns

1. **Unknown-First Pattern**: Always use `unknown` as intermediate step when eliminating `any`

   ```typescript
   // GOOD: Safe type assertion
   const result = data as unknown as SpecificType

   // BAD: Direct any casting
   const result = data as any as SpecificType
   ```

2. **Helper Function Pattern**: Create type-safe parsing utilities

   ```typescript
   // Create reusable helpers
   function parseIntSafe(value: unknown): number {
     return typeof value === 'string' ? parseInt(value, 10) : 0
   }

   function ensureString(value: unknown): string {
     return typeof value === 'string' ? value : ''
   }
   ```

3. **Interface Creation Pattern**: Define proper interfaces instead of using `Partial<RealType>`

   ```typescript
   // GOOD: Dedicated mock interface
   interface MockToastmastersScraper {
     scrapeDistrictData: Mock<Procedure | Constructable>
     scrapeClubData: Mock<Procedure | Constructable>
   }

   // BAD: Partial real type
   const mock: Partial<ToastmastersScraper> = { ... }
   ```

#### Test Mock Safety Patterns

1. **Complete Mock Interfaces**: Always define all required properties for test mocks
2. **Type-Safe Mock Creation**: Use proper typing for mock return values
3. **Null Safety in Tests**: Add proper null checks before assertions

#### Error Resolution Priority

1. **Critical**: Explicit `any` types (breaks both lint and type safety)
2. **High**: Incomplete mock interfaces (breaks type safety)
3. **Medium**: Missing null checks in tests (runtime safety)
4. **Low**: Style and formatting issues

### Common Anti-Patterns to Avoid

- Using `@ts-ignore` to suppress lint errors
- Converting `any` directly to specific types without `unknown`
- Creating overly broad interfaces just to satisfy linting
- Disabling lint rules instead of fixing violations
- Using `Partial<RealType>` for test mocks instead of dedicated interfaces
- Skipping null checks in test assertions
