---
description: How to monitor the deployment pipeline and verify changes on the live site before closing an issue
---

## Deploy & Live Verification Workflow

This workflow is **mandatory** after pushing code that closes a GitHub issue. An issue is **not done** until the change is verified live.

// turbo-all

### 1. Push and identify the pipeline run

1. Push to `main`: `git push origin main`
2. List pipeline runs to find the deploy: `gh run list --limit 3 --json databaseId,status,conclusion,name,displayTitle`
3. Note the **Deploy** workflow run ID

### 2. Monitor the pipeline

1. Watch the deploy run: `gh run watch <run-id> --exit-status`
2. If the run fails, inspect logs: `gh run view <run-id> --log-failed | tail -50`
3. Fix any issues and re-push. Do not proceed until the deploy succeeds.

### 3. Verify all pipeline jobs passed

Confirm each job completed successfully:

| Job                         | Expected |
| --------------------------- | -------- |
| Build                       | ✅       |
| Frontend (Firebase Hosting) | ✅       |
| Backend (Cloud Run)         | ✅       |
| Post-Deploy Health Check    | ✅       |

### 4. Live site audit

Using the browser, verify **each change** on the live site (`https://ts.taverns.red`):

1. **Navigate** to the affected page(s)
2. **Interact** with the changed feature (click buttons, open modals, check data)
3. **Screenshot** key states as evidence
4. **Compare** against the acceptance criteria in the GitHub issue

### 5. Close the issue

Only after live verification passes:

1. Confirm the issue's acceptance criteria are all met
2. If the commit message included `Closes #N`, verify the issue is auto-closed on GitHub
3. If not auto-closed, close manually: `gh issue close <N> --comment "Verified live on ts.taverns.red"`

## Key Rules

- **Never close an issue before live verification** — passing tests and a green pipeline are necessary but not sufficient
- **If the deploy pipeline is slow** (Cloud Run builds can take 5+ min), wait — do not move on to the next issue
- **If live verification reveals a regression**, revert and re-enter the TDD loop
- **Screenshots are required** — embed them in the walkthrough artifact as proof of live verification
