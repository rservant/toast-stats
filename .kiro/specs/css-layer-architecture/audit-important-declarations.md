# CSS `!important` Declaration Audit Report

**Task:** 6.1 Audit CSS files for `!important` on overridable properties  
**Date:** Audit completed  
**Requirement:** 5.4 - THE Brand_Typography SHALL NOT use `!important` declarations that prevent Tailwind overrides

## Summary

**Total `!important` declarations found:** 18  
**Violations found:** 0  
**All declarations are ACCEPTABLE**

## Overridable Properties (Per Requirement 5.4)

The following properties MUST NOT use `!important`:

- `font-family`
- `font-size`
- `line-height`
- `padding`
- `min-height`
- `min-width`
- `box-shadow`

**Exception:** `text-shadow: none !important` IS permitted per brand guidelines (Requirement 5.5)

---

## Audit Findings by File

### 1. `frontend/src/index.css` - Accessibility Media Queries

| Line | Declaration                                | Property                  | Status        |
| ---- | ------------------------------------------ | ------------------------- | ------------- |
| 435  | `border-color: currentColor !important;`   | border-color              | ✅ ACCEPTABLE |
| 448  | `animation-duration: 0.01ms !important;`   | animation-duration        | ✅ ACCEPTABLE |
| 449  | `animation-iteration-count: 1 !important;` | animation-iteration-count | ✅ ACCEPTABLE |
| 450  | `transition-duration: 0.01ms !important;`  | transition-duration       | ✅ ACCEPTABLE |

**Context:** High contrast mode (`@media (prefers-contrast: high)`) and reduced motion (`@media (prefers-reduced-motion: reduce)`) accessibility overrides.

**Rationale:** These are accessibility-critical overrides that MUST take precedence for users with accessibility needs. None of these properties are in the "overridable properties" list.

---

### 2. `frontend/src/styles/responsive.css` - Print Styles

| Line | Declaration                           | Property   | Status        |
| ---- | ------------------------------------- | ---------- | ------------- |
| 729  | `background: transparent !important;` | background | ✅ ACCEPTABLE |
| 730  | `color: var(--tm-black) !important;`  | color      | ✅ ACCEPTABLE |
| 736  | `background: transparent !important;` | background | ✅ ACCEPTABLE |
| 737  | `color: var(--tm-black) !important;`  | color      | ✅ ACCEPTABLE |
| 742  | `display: none !important;`           | display    | ✅ ACCEPTABLE |

**Context:** Print media query (`@media print`) for ensuring proper print output.

**Rationale:** Print styles require `!important` to override screen styles for proper print output. None of these properties are in the "overridable properties" list.

---

### 3. `frontend/src/styles/components/typography.css` - Brand Compliance

| Line | Declaration                             | Property            | Status                    |
| ---- | --------------------------------------- | ------------------- | ------------------------- |
| 100  | `text-shadow: none !important;`         | text-shadow         | ✅ ACCEPTABLE (Exception) |
| 101  | `-webkit-text-stroke: none !important;` | -webkit-text-stroke | ✅ ACCEPTABLE             |
| 102  | `text-stroke: none !important;`         | text-stroke         | ✅ ACCEPTABLE             |
| 158  | `text-shadow: none !important;`         | text-shadow         | ✅ ACCEPTABLE (Exception) |
| 159  | `-webkit-text-stroke: none !important;` | -webkit-text-stroke | ✅ ACCEPTABLE             |
| 167  | `text-shadow: none !important;`         | text-shadow         | ✅ ACCEPTABLE (Exception) |
| 168  | `-webkit-text-stroke: none !important;` | -webkit-text-stroke | ✅ ACCEPTABLE             |
| 176  | `text-shadow: none !important;`         | text-shadow         | ✅ ACCEPTABLE (Exception) |
| 177  | `-webkit-text-stroke: none !important;` | -webkit-text-stroke | ✅ ACCEPTABLE             |

**Context:** Brand typography classes (`.tm-typography`, `.tm-headline`, `.tm-headline-h1`, `.tm-headline-h2`, `.tm-headline-h3`, `.h1`, `.h2`, `.h3`, etc.)

**Rationale:** Per Toastmasters brand guidelines, text effects (drop-shadow, word-art, distort, outline, glow) are PROHIBITED. The `text-shadow: none !important` is explicitly permitted by Requirement 5.5. The `-webkit-text-stroke` and `text-stroke` properties are vendor-prefixed text effect properties that fall under the same brand prohibition.

---

## Verification Against Overridable Properties

| Property    | `!important` Found? | Violation?      |
| ----------- | ------------------- | --------------- |
| font-family | ❌ No               | ✅ No violation |
| font-size   | ❌ No               | ✅ No violation |
| line-height | ❌ No               | ✅ No violation |
| padding     | ❌ No               | ✅ No violation |
| min-height  | ❌ No               | ✅ No violation |
| min-width   | ❌ No               | ✅ No violation |
| box-shadow  | ❌ No               | ✅ No violation |

---

## Conclusion

**All `!important` declarations in the codebase are ACCEPTABLE.**

The declarations fall into three categories:

1. **Accessibility overrides** (index.css) - Required for users with accessibility needs
2. **Print media overrides** (responsive.css) - Required for proper print output
3. **Brand compliance enforcement** (typography.css) - Explicitly permitted per brand guidelines

**No action required for Task 6.2** - There are no violations to remove.

---

## Recommendations for Task 6.2 and 6.3

- **Task 6.2:** Mark as complete with no changes needed - no `!important` declarations exist on overridable properties
- **Task 6.3:** Mark as complete - `text-shadow: none !important` is already preserved per brand guidelines
