---
description: How to follow TDD (Test-Driven Development) when implementing features or fixing bugs
---

## TDD Workflow — Red, Green, Refactor

Follow this workflow for **every** code change. Never write production code without a failing test first.

// turbo-all

### 1. Understand the requirement

Before writing any code, clearly define:

- What behavior needs to change or be added?
- What are the edge cases?
- What module/file will contain the production code?

### 2. Write a failing test (RED)

1. Create or open the corresponding test file (e.g., `foo.test.ts` for `foo.ts`)
2. Write a test that describes the expected behavior
3. Run the test to confirm it **fails**: `npm run test -- --run <path-to-test-file>`
4. **Commit the failing test**: `git commit -m "test: add failing test for <behavior>"`

### 3. Make it pass (GREEN)

1. Write the **minimum** production code to make the failing test pass
2. Run the test to confirm it **passes**: `npm run test -- --run <path-to-test-file>`
3. Run the full test suite to confirm nothing is broken: `npm run test`
4. **Commit**: `git commit -m "feat: implement <behavior>"`

### 4. Refactor (REFACTOR)

1. Clean up the production code and test code (remove duplication, improve names, etc.)
2. Run the full test suite again: `npm run test`
3. **Commit**: `git commit -m "refactor: clean up <area>"`

### 5. Verify coverage

Before pushing, always check coverage:

1. Run `npm run test -- --coverage` to verify coverage thresholds are met
2. If coverage is below thresholds (50% lines, 40% branches), add more tests

### 6. Push

1. Run `git push` — the pre-push hook will run tests with coverage enforcement
2. If the push is rejected, fix coverage and try again

## Key Reminders

- **One test at a time** — don't write multiple failing tests before making them pass
- **Commit after each step** — red commit, green commit, refactor commit
- **Small commits** — aim for commits every 15–30 minutes
- **Descriptive test names** — `it('returns 404 when user not found')` not `it('works')`
