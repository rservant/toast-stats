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

## 11. Final Rule

> **Zero lint errors are permitted in this repository.**  
> **Every change must maintain or improve code quality.**  
> **Lint violations are treated as critical bugs.**

**Enforcement**: Any commit introducing lint errors will be automatically rejected by the CI/CD pipeline.

**Accountability**: Team members are responsible for maintaining lint compliance in their code areas.

**Continuous Improvement**: Regular reviews of this policy to ensure it supports development velocity while maintaining quality.