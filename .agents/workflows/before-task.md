---
description: Mandatory pre-task orientation — read engineering rules and recent lessons before starting any work
---

# Before Starting Any Task

Run this at the start of every task, BEFORE any planning or code exploration.

// turbo-all

1. Read the full engineering rules (curated, always current):

```bash
cat tasks/rules.md
```

2. Read the last 5 lessons from the append-style archive:

```bash
tail -n 120 tasks/lessons.md
```

## Why

- `tasks/rules.md` is the curated, high-signal list of rules distilled from all past lessons. It fits in ~60 seconds and tells you what NOT to do in this codebase.
- `tasks/lessons.md` is the full chronological archive. The tail gives you the most recent context — what just burned us, what traps are freshly loaded.
- Skipping this step is the leading cause of repeating the same class of mistake.
