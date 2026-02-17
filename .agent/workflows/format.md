---
description: How to format code and verify formatting before committing
---

## Formatting Rules (Prettier)

This project uses **Prettier** for code formatting. The configuration is in `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "avoid"
}
```

### Key rules to follow when writing code:

1. **No semicolons** — never end statements with `;`
2. **Single quotes** — use `'string'` not `"string"`
3. **2-space indentation** — not 4 spaces, not tabs
4. **Trailing commas (es5)** — add trailing commas in objects, arrays, function parameters
5. **80 character line width** — wrap lines that exceed 80 characters
6. **No parens on single arrow params** — use `x => x` not `(x) => x`

### Before committing, always run:

// turbo

1. Run `npm run format` from the project root to auto-fix formatting
2. Verify no formatting changes remain with `git diff`

### Format check in CI:

The CI pipeline runs a format check in the quality-gates job. If formatting is wrong, the pipeline will fail.
