# Coding Principles — Dave Farley's Modern Software Engineering

This project enforces the core engineering practices from
[Modern Software Engineering](https://www.davefarley.net/?p=352) by Dave Farley.
Every contributor — human or AI — must follow these principles.

---

## 1. Test-Driven Development (TDD)

**Every change to production code must be driven by a test.**

### Red → Green → Refactor

1. **Red** — Write a failing test that describes the desired behavior
2. **Green** — Write the _minimum_ production code to make the test pass
3. **Refactor** — Clean up the code while keeping all tests green

### Rules

- Never write production code without a failing test first
- Each commit that adds or modifies logic **must** include corresponding tests
- Tests must be fast, isolated, and deterministic
- Use descriptive test names that document behavior: `it('returns empty array when no data exists')`

### Coverage Policy

All workspaces enforce minimum coverage thresholds via Vitest:

| Metric   | Minimum |
| -------- | ------- |
| Lines    | 50%     |
| Branches | 40%     |

Coverage is checked on every `git push` and in CI. PRs that reduce coverage below the floor are rejected.

---

## 2. Frequent, Small Commits

**Commit early, commit often.** Each commit should represent a single, complete, logical change.

### Guidelines

- Aim to commit every **15–30 minutes** of active work
- Each commit must leave the codebase in a **working state** — all tests passing
- Never batch unrelated changes into a single commit
- Write clear, descriptive commit messages following conventional commits

### Commit Sizing Examples

| ✅ Good (small, focused)               | ❌ Bad (large, mixed)                                |
| -------------------------------------- | ---------------------------------------------------- |
| `feat: add validation for email field` | `feat: add user module with validation, API, and UI` |
| `test: add edge case for empty input`  | `chore: fix tests and update styles`                 |
| `refactor: extract helper function`    | `refactor: rewrite entire service layer`             |

---

## 3. Quality Gates

The following automated checks enforce these principles:

### Pre-commit (every commit)

- Prettier formatting (lint-staged)
- TypeScript type checking
- ESLint + YAML lint
- Full test suite

### Pre-push (every push)

- Full test suite **with coverage enforcement**

### CI/CD Pipeline

- Quality gates (TypeScript, lint, format)
- Full test suite with coverage thresholds
- Security scanning
- Build verification

---

## 4. Working with This Codebase

- **Monorepo**: `frontend/`, `backend/`, `packages/*` — each workspace has its own Vitest config
- **Test runner**: Vitest (`npm run test`, `npm run test:watch`)
- **Coverage**: `npm run test -- --coverage`
- **Formatting**: `npm run format` (Prettier — no semicolons, single quotes, 2-space indent)
- **Linting**: `npm run lint`
- **Type checking**: `npm run typecheck`
