# CI/CD Integration and Enforcement

This guide provides complete CI/CD pipeline setup and enforcement mechanisms for maintaining lint compliance across teams and projects.

## Pre-commit Hook Setup

### Husky + Lint-Staged Configuration

Install the required packages:

```bash
npm install --save-dev husky lint-staged
```

Initialize husky:

```bash
npx husky install
```

Add pre-commit hook:

```bash
npx husky add .husky/pre-commit "npx lint-staged"
```

Configure lint-staged in `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"],
    "*.{ts,tsx}": ["bash -c 'npx tsc --noEmit'"]
  }
}
```

### Alternative: Simple Pre-commit Script

Create `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running lint checks..."

# Run ESLint
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ ESLint failed. Please fix errors before committing."
  exit 1
fi

# Run Prettier check
npm run format:check
if [ $? -ne 0 ]; then
  echo "❌ Prettier check failed. Run 'npm run format' to fix."
  exit 1
fi

# Run TypeScript check
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript check failed. Please fix type errors."
  exit 1
fi

echo "✅ All checks passed!"
```

## GitHub Actions Workflows

### Basic Lint and Format Check

Create `.github/workflows/lint.yml`:

```yaml
name: Lint and Format Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    name: Lint and Format
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Check Prettier formatting
        run: npm run format:check

      - name: TypeScript check
        run: npx tsc --noEmit
```

### Advanced Workflow with Error Reporting

Create `.github/workflows/code-quality.yml`:

```yaml
name: Code Quality

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  code-quality:
    name: Code Quality Checks
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint with reporting
        run: |
          npm run lint -- --format json --output-file eslint-report.json
          npm run lint -- --format stylish
        continue-on-error: true

      - name: Check Prettier formatting
        run: npm run format:check

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Upload ESLint report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: eslint-report
          path: eslint-report.json

      - name: Comment PR with lint results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            try {
              const report = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));
              const errorCount = report.reduce((sum, file) => sum + file.errorCount, 0);
              const warningCount = report.reduce((sum, file) => sum + file.warningCount, 0);
              
              const comment = `## 🔍 Lint Results
              
              - **Errors:** ${errorCount}
              - **Warnings:** ${warningCount}
              
              ${errorCount === 0 ? '✅ No lint errors found!' : '❌ Please fix lint errors before merging.'}
              `;
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            } catch (error) {
              console.log('Could not read lint report:', error);
            }
```

### Workflow with Type Coverage

Create `.github/workflows/type-coverage.yml`:

```yaml
name: Type Coverage

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  type-coverage:
    name: Type Coverage Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install type-coverage
        run: npm install -g type-coverage

      - name: Check type coverage
        run: |
          type-coverage --detail --strict --ignore-files "**/*.test.ts" --ignore-files "**/*.spec.ts"

      - name: Generate type coverage report
        run: |
          type-coverage --detail --strict --ignore-files "**/*.test.ts" --ignore-files "**/*.spec.ts" > type-coverage-report.txt

      - name: Upload type coverage report
        uses: actions/upload-artifact@v3
        with:
          name: type-coverage-report
          path: type-coverage-report.txt
```

## Branch Protection Rules

### GitHub Branch Protection

Configure branch protection rules in GitHub repository settings:

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint and Format",
      "Code Quality Checks",
      "Type Coverage Check"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true
  },
  "restrictions": null
}
```

### GitLab CI/CD Pipeline

Create `.gitlab-ci.yml`:

```yaml
stages:
  - lint
  - test

variables:
  NODE_VERSION: '18'

cache:
  paths:
    - node_modules/

before_script:
  - node --version
  - npm --version
  - npm ci

lint:
  stage: lint
  script:
    - npm run lint
    - npm run format:check
    - npx tsc --noEmit
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_COMMIT_BRANCH == "develop"
  artifacts:
    reports:
      junit: lint-results.xml
    when: always
    expire_in: 1 week
```

## Automated Error Reporting

### ESLint Report Generation

Create a script to generate detailed lint reports:

```javascript
// scripts/generate-lint-report.js
const { ESLint } = require('eslint')
const fs = require('fs')

async function generateReport() {
  const eslint = new ESLint()
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx,js,jsx}'])

  // Generate JSON report
  const jsonReport = JSON.stringify(results, null, 2)
  fs.writeFileSync('reports/eslint-report.json', jsonReport)

  // Generate HTML report
  const htmlFormatter = await eslint.loadFormatter('html')
  const htmlReport = htmlFormatter.format(results)
  fs.writeFileSync('reports/eslint-report.html', htmlReport)

  // Generate summary
  const errorCount = results.reduce((sum, result) => sum + result.errorCount, 0)
  const warningCount = results.reduce(
    (sum, result) => sum + result.warningCount,
    0
  )

  const summary = {
    totalFiles: results.length,
    errorCount,
    warningCount,
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(
    'reports/lint-summary.json',
    JSON.stringify(summary, null, 2)
  )

  console.log(
    `Lint report generated: ${errorCount} errors, ${warningCount} warnings`
  )

  // Exit with error code if there are errors
  process.exit(errorCount > 0 ? 1 : 0)
}

generateReport().catch(console.error)
```

Add to `package.json`:

```json
{
  "scripts": {
    "lint:report": "node scripts/generate-lint-report.js"
  }
}
```

### Slack/Teams Integration

Create a webhook script for notifications:

```javascript
// scripts/notify-lint-results.js
const https = require('https')
const fs = require('fs')

function sendSlackNotification(webhookUrl, message) {
  const payload = JSON.stringify({
    text: message,
    username: 'Lint Bot',
    icon_emoji: ':warning:',
  })

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
    },
  }

  const req = https.request(webhookUrl, options, res => {
    console.log(`Notification sent: ${res.statusCode}`)
  })

  req.on('error', error => {
    console.error('Error sending notification:', error)
  })

  req.write(payload)
  req.end()
}

// Read lint summary
try {
  const summary = JSON.parse(
    fs.readFileSync('reports/lint-summary.json', 'utf8')
  )

  if (summary.errorCount > 0) {
    const message = `🚨 Lint errors detected: ${summary.errorCount} errors, ${summary.warningCount} warnings in ${summary.totalFiles} files`
    sendSlackNotification(process.env.SLACK_WEBHOOK_URL, message)
  }
} catch (error) {
  console.error('Could not read lint summary:', error)
}
```

## Monitoring and Metrics

### Lint Metrics Dashboard

Create a script to track lint metrics over time:

```javascript
// scripts/track-lint-metrics.js
const { ESLint } = require('eslint')
const fs = require('fs')
const path = require('path')

async function trackMetrics() {
  const eslint = new ESLint()
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx,js,jsx}'])

  const metrics = {
    timestamp: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || 'unknown',
    branch: process.env.GITHUB_REF_NAME || 'unknown',
    totalFiles: results.length,
    errorCount: results.reduce((sum, result) => sum + result.errorCount, 0),
    warningCount: results.reduce((sum, result) => sum + result.warningCount, 0),
    ruleBreakdown: {},
  }

  // Count errors by rule
  results.forEach(result => {
    result.messages.forEach(message => {
      if (message.ruleId) {
        metrics.ruleBreakdown[message.ruleId] =
          (metrics.ruleBreakdown[message.ruleId] || 0) + 1
      }
    })
  })

  // Append to metrics file
  const metricsFile = 'reports/lint-metrics.jsonl'
  fs.appendFileSync(metricsFile, JSON.stringify(metrics) + '\n')

  console.log('Metrics tracked:', metrics)
}

trackMetrics().catch(console.error)
```

### Quality Gate Configuration

Create quality gates that fail builds based on thresholds:

```javascript
// scripts/quality-gate.js
const fs = require('fs')

function checkQualityGate() {
  const summary = JSON.parse(
    fs.readFileSync('reports/lint-summary.json', 'utf8')
  )

  const thresholds = {
    maxErrors: 0, // Zero tolerance for errors
    maxWarnings: 10, // Allow some warnings
    maxFilesWithIssues: 5, // Limit files with any issues
  }

  const filesWithIssues = summary.totalFiles - summary.cleanFiles

  const failures = []

  if (summary.errorCount > thresholds.maxErrors) {
    failures.push(
      `Too many errors: ${summary.errorCount} > ${thresholds.maxErrors}`
    )
  }

  if (summary.warningCount > thresholds.maxWarnings) {
    failures.push(
      `Too many warnings: ${summary.warningCount} > ${thresholds.maxWarnings}`
    )
  }

  if (filesWithIssues > thresholds.maxFilesWithIssues) {
    failures.push(
      `Too many files with issues: ${filesWithIssues} > ${thresholds.maxFilesWithIssues}`
    )
  }

  if (failures.length > 0) {
    console.error('❌ Quality gate failed:')
    failures.forEach(failure => console.error(`  - ${failure}`))
    process.exit(1)
  } else {
    console.log('✅ Quality gate passed')
  }
}

checkQualityGate()
```

## Team Enforcement Strategies

### Code Review Checklist

Create a PR template with lint compliance checklist:

```markdown
<!-- .github/pull_request_template.md -->

## Code Quality Checklist

- [ ] All lint errors have been fixed (0 errors)
- [ ] Warnings have been minimized or justified
- [ ] No new `any` types introduced without documentation
- [ ] All new code follows TypeScript best practices
- [ ] Prettier formatting has been applied
- [ ] Pre-commit hooks are passing

## Lint Compliance

- **ESLint Errors:** <!-- Add count or "0" -->
- **ESLint Warnings:** <!-- Add count -->
- **TypeScript Errors:** <!-- Add count or "0" -->

If any errors exist, please fix them before requesting review.
```

### Automated PR Comments

Use GitHub Actions to automatically comment on PRs with lint results:

```yaml
# In your GitHub Actions workflow
- name: Comment PR with detailed results
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v6
  with:
    script: |
      const fs = require('fs');
      const report = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));

      let comment = '## 🔍 Code Quality Report\n\n';

      const totalErrors = report.reduce((sum, file) => sum + file.errorCount, 0);
      const totalWarnings = report.reduce((sum, file) => sum + file.warningCount, 0);

      if (totalErrors === 0 && totalWarnings === 0) {
        comment += '✅ **Perfect!** No lint errors or warnings found.\n';
      } else {
        comment += `- **Errors:** ${totalErrors}\n`;
        comment += `- **Warnings:** ${totalWarnings}\n\n`;
        
        if (totalErrors > 0) {
          comment += '❌ **Action Required:** Please fix all lint errors before merging.\n\n';
          
          // Show top error types
          const errorsByRule = {};
          report.forEach(file => {
            file.messages.forEach(msg => {
              if (msg.severity === 2 && msg.ruleId) {
                errorsByRule[msg.ruleId] = (errorsByRule[msg.ruleId] || 0) + 1;
              }
            });
          });
          
          const topErrors = Object.entries(errorsByRule)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
            
          if (topErrors.length > 0) {
            comment += '### Most Common Errors:\n';
            topErrors.forEach(([rule, count]) => {
              comment += `- \`${rule}\`: ${count} occurrences\n`;
            });
          }
        }
      }

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: comment
      });
```

This comprehensive CI/CD integration guide ensures that lint compliance is automatically enforced across your entire development workflow.
