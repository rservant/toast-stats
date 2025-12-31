# Team Workflows and Development Processes

This guide provides team workflows and development processes for maintaining lint compliance across development teams while preserving productivity and collaboration.

## Development Workflow Integration

### Daily Development Workflow

**Morning Routine:**

```bash
# 1. Pull latest changes
git pull origin main

# 2. Check current lint status
npm run lint
# Expected: 0 errors (if not, fix before starting work)

# 3. Verify development environment
npm run format:check
npx tsc --noEmit

# 4. Start development with clean slate
npm run dev
```

**During Development:**

- Fix lint errors immediately as they appear
- Use IDE real-time linting to catch issues early
- Run `npm run lint:fix` periodically to auto-fix simple issues
- Commit frequently with clean lint status

**Before Committing:**

```bash
# 1. Final lint check
npm run lint

# 2. Format code
npm run format

# 3. TypeScript check
npx tsc --noEmit

# 4. Run tests
npm test

# 5. Commit (pre-commit hooks will run automatically)
git commit -m "feat: add user authentication"
```

### Feature Development Workflow

**Starting a New Feature:**

1. **Create feature branch with clean baseline:**

   ```bash
   git checkout main
   git pull origin main
   npm run lint  # Ensure main branch is clean
   git checkout -b feature/user-authentication
   ```

2. **Set up development environment:**

   ```bash
   # Install dependencies
   npm ci

   # Verify tooling works
   npm run lint
   npm run format:check
   npm test
   ```

3. **Development with continuous compliance:**
   - Write code with real-time linting enabled
   - Fix lint errors as they appear (don't accumulate)
   - Use `npm run lint:fix` for auto-fixable issues
   - Commit small, clean changes frequently

**During Feature Development:**

```bash
# Regular check-ins (every few commits)
npm run lint && npm run format && npm test
git add .
git commit -m "wip: implement user login form"

# Before pushing to remote
npm run lint  # Must be 0 errors
git push origin feature/user-authentication
```

**Completing a Feature:**

1. **Final quality check:**

   ```bash
   npm run lint        # 0 errors required
   npm run format      # Apply consistent formatting
   npm test           # All tests pass
   npx tsc --noEmit   # No TypeScript errors
   ```

2. **Create pull request with quality metrics:**
   - Include lint status in PR description
   - Verify CI/CD checks pass
   - Request code review

### Code Review Workflow

**For Code Authors:**

**Pre-Review Checklist:**

- [ ] All lint errors fixed (0 errors)
- [ ] Warnings minimized and justified
- [ ] No new `any` types without documentation
- [ ] TypeScript compilation passes
- [ ] Tests pass and cover new code
- [ ] Prettier formatting applied

**PR Description Template:**

```markdown
## Changes

Brief description of changes made.

## Code Quality Status

- **ESLint Errors:** 0 ✅
- **ESLint Warnings:** 2 (justified in code comments)
- **TypeScript Errors:** 0 ✅
- **Test Coverage:** 95%

## Lint Compliance Notes

- Removed 5 explicit `any` types
- Added proper interfaces for new API responses
- Fixed React hooks dependencies in UserProfile component
```

**For Code Reviewers:**

**Review Checklist:**

- [ ] CI/CD lint checks are passing
- [ ] No new lint errors introduced
- [ ] Any new `any` types are documented and justified
- [ ] Code follows established patterns
- [ ] TypeScript types are properly defined

**Review Comments for Lint Issues:**

```markdown
## Lint Issues Found

### Critical (Must Fix)

- Line 45: Explicit `any` type without justification
- Line 78: Unused variable `oldData`

### Suggestions (Should Fix)

- Line 23: Consider using `unknown` instead of `any` for type assertion
- Line 156: Missing dependency in useEffect hook

Please fix critical issues before approval.
```

## Team Onboarding Process

### New Team Member Setup

**Day 1: Environment Setup**

1. **Repository setup:**

   ```bash
   git clone <repository-url>
   cd <project-name>
   npm install
   ```

2. **Verify lint tooling:**

   ```bash
   npm run lint        # Should show current project status
   npm run format      # Should format all files consistently
   npm test           # Should run all tests
   ```

3. **IDE configuration:**
   - Install ESLint extension
   - Install Prettier extension
   - Configure auto-format on save
   - Verify real-time error highlighting

4. **Pre-commit hooks:**
   ```bash
   npx husky install   # Set up git hooks
   ```

**Week 1: Learning and Practice**

- **Shadow experienced developer** for first few commits
- **Practice lint error resolution** on non-critical files
- **Learn team-specific patterns** and conventions
- **Complete lint compliance training** (this power!)

**Training Exercises:**

1. **Fix existing lint errors** (if any) in test files
2. **Convert `any` types** to proper TypeScript types
3. **Add proper type definitions** to untyped functions
4. **Practice pre-commit workflow** with small changes

### Team Training Program

**Monthly Lint Compliance Workshop:**

**Session 1: Fundamentals (1 hour)**

- Why lint compliance matters
- Tool overview (ESLint, Prettier, TypeScript)
- Common error types and solutions
- IDE setup and configuration

**Session 2: Advanced Patterns (1 hour)**

- Type safety patterns
- Test mock typing
- Error resolution strategies
- Performance considerations

**Session 3: Team Processes (30 minutes)**

- Code review guidelines
- CI/CD integration
- Metrics and monitoring
- Exception handling process

**Hands-on Practice:**

- Live coding session fixing real lint errors
- Pair programming on type safety improvements
- Code review simulation with lint issues

## Sprint Planning Integration

### Sprint Planning Considerations

**Include Lint Compliance in Sprint Planning:**

1. **Technical Debt Assessment:**

   ```bash
   # Generate current lint status
   npm run lint > sprint-lint-status.txt

   # Count errors by type
   npm run lint -- --format json | jq '.[] | .messages[] | .ruleId' | sort | uniq -c
   ```

2. **Capacity Planning:**
   - Reserve 10-15% of sprint capacity for lint compliance
   - Assign lint error cleanup to team members
   - Balance new features with technical debt reduction

3. **Sprint Goals:**
   - "Reduce lint errors by 50% this sprint"
   - "Achieve zero `any` types in authentication module"
   - "Implement pre-commit hooks for all team members"

### Story Estimation with Lint Compliance

**Include lint compliance effort in story estimation:**

**Story Points Adjustment:**

- +1 point if story touches files with existing lint errors
- +2 points if story requires significant type safety improvements
- +0.5 points for standard lint compliance (new code)

**Definition of Done Updates:**

- All new code passes lint checks
- No new lint errors introduced
- Existing lint errors in modified files are fixed
- Type safety maintained or improved

## Conflict Resolution

### Handling Lint Disagreements

**Common Team Conflicts:**

1. **"This lint rule is too strict"**
   - **Process:** Team discussion and vote
   - **Documentation:** Record decision and rationale
   - **Implementation:** Update ESLint config if needed
   - **Timeline:** Review decision in 3 months

2. **"Fixing this will take too long"**
   - **Assessment:** Estimate actual time required
   - **Options:**
     - Fix immediately (preferred)
     - Create technical debt ticket
     - Request exception with timeline
   - **Decision:** Tech lead approval required for exceptions

3. **"Legacy code is too risky to change"**
   - **Strategy:** Incremental improvement approach
   - **Process:** Fix lint errors only in files being modified
   - **Safety:** Comprehensive test coverage required
   - **Timeline:** Set long-term migration plan

### Exception Request Process

**When Exceptions Might Be Necessary:**

- Third-party library integration issues
- Performance-critical code sections
- Legacy code with high change risk
- Temporary workarounds with migration plan

**Exception Request Template:**

```markdown
## Lint Rule Exception Request

**Rule:** `@typescript-eslint/no-explicit-any`
**File:** `src/legacy/data-processor.ts`
**Lines:** 45-67

### Justification

Third-party library `legacy-data-lib` has no TypeScript definitions and
provides complex nested objects that change structure based on runtime configuration.

### Risk Assessment

- **Low risk:** Only used in data processing pipeline
- **Isolated:** No other code depends on these types
- **Temporary:** Library vendor plans TypeScript support in Q2 2024

### Migration Plan

1. **Q1 2024:** Create wrapper functions with known interfaces
2. **Q2 2024:** Migrate to typed library version when available
3. **Q3 2024:** Remove all `any` types from this module

### Approval

- **Requested by:** Developer Name
- **Tech Lead Approval:** [ ] Approved [ ] Rejected
- **Timeline:** 6 months maximum
- **Review Date:** March 1, 2024
```

## Performance and Productivity Balance

### Optimizing Lint Performance

**For Large Codebases:**

1. **Incremental linting:**

   ```bash
   # Only lint changed files
   npm run lint $(git diff --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx)$')
   ```

2. **Parallel processing:**

   ```json
   {
     "scripts": {
       "lint:parallel": "eslint --ext .ts,.tsx,.js,.jsx src --cache --cache-location node_modules/.cache/eslint"
     }
   }
   ```

3. **Smart caching:**
   ```javascript
   // .eslintrc.js
   module.exports = {
     cache: true,
     cacheLocation: 'node_modules/.cache/eslint/',
     // ... other config
   }
   ```

### Productivity Optimization

**IDE Integration Best Practices:**

**VS Code Settings (`.vscode/settings.json`):**

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "eslint.run": "onType",
  "typescript.preferences.includePackageJsonAutoImports": "auto"
}
```

**Keyboard Shortcuts:**

- `Cmd/Ctrl + Shift + P` → "ESLint: Fix all auto-fixable Problems"
- `Cmd/Ctrl + K, Cmd/Ctrl + F` → Format document
- `F8` → Go to next error/warning

### Team Productivity Metrics

**Track Team Performance:**

```javascript
// scripts/team-productivity-metrics.js
const fs = require('fs')
const { execSync } = require('child_process')

function generateTeamMetrics() {
  // Get git blame data for lint errors
  const lintOutput = execSync('npm run lint -- --format json', {
    encoding: 'utf8',
  })
  const lintResults = JSON.parse(lintOutput)

  const metrics = {
    totalErrors: 0,
    errorsByAuthor: {},
    errorsByFile: {},
    errorsByRule: {},
    timestamp: new Date().toISOString(),
  }

  lintResults.forEach(file => {
    if (file.errorCount > 0) {
      metrics.errorsByFile[file.filePath] = file.errorCount
      metrics.totalErrors += file.errorCount

      file.messages.forEach(message => {
        if (message.ruleId) {
          metrics.errorsByRule[message.ruleId] =
            (metrics.errorsByRule[message.ruleId] || 0) + 1
        }
      })
    }
  })

  // Save metrics
  fs.writeFileSync(
    'reports/team-metrics.json',
    JSON.stringify(metrics, null, 2)
  )

  console.log('Team productivity metrics generated')
  console.log(`Total errors: ${metrics.totalErrors}`)
  console.log(`Files with errors: ${Object.keys(metrics.errorsByFile).length}`)
}

generateTeamMetrics()
```

**Weekly Team Review:**

- Review lint error trends
- Identify common error patterns
- Celebrate improvements and clean code
- Plan training for problematic areas
- Adjust processes based on team feedback

This comprehensive team workflow guide ensures that lint compliance becomes a natural part of your team's development culture while maintaining high productivity and code quality.
