# Implementation Plan: CSS Layer Architecture

## Overview

This implementation plan establishes CSS Cascade Layers to resolve specificity conflicts between Toastmasters brand CSS and Tailwind v4 utilities. The goal is to enable predictable style overrides where Tailwind utilities always win when explicitly applied.

## Tasks

- [x] 1. Establish Layer Declaration and Import Order
  - [x] 1.1 Add `@layer base, brand, utilities;` declaration at the top of index.css
  - [x] 1.2 Update Tailwind import to use `@import "tailwindcss" layer(utilities);`
  - [x] 1.3 Verify token imports precede component imports
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2. Create Base Layer for Element Defaults
  - [x] 2.1 Create `frontend/src/styles/layers/base.css` file
  - [x] 2.2 Move element-level typography defaults (body, h1-h6 font-family) to base layer
  - [x] 2.3 Move touch target defaults (button, a, input min-height/min-width) to base layer
  - [x] 2.4 Move focus indicator styles to base layer
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 4.1, 4.4, 4.5, 5.1, 5.2_

- [x] 3. Wrap Component Classes in Brand Layer
  - [x] 3.1 Wrap typography.css classes in `@layer brand { }`
  - [x] 3.2 Wrap buttons.css classes in `@layer brand { }`
  - [x] 3.3 Wrap navigation.css classes in `@layer brand { }`
  - [x] 3.4 Wrap forms.css classes in `@layer brand { }`
  - [x] 3.5 Wrap cards.css classes in `@layer brand { }`
  - [x] 3.6 Wrap remaining component CSS files in `@layer brand { }`
  - _Requirements: 1.2, 6.5_

- [x] 4. Consolidate Duplicate Class Definitions
  - [x] 4.1 Identify `.tm-*` classes defined in multiple files
  - [x] 4.2 Remove duplicate definitions from index.css
  - [x] 4.3 Remove duplicate definitions from brand.css
  - [x] 4.4 Ensure each `.tm-*` class has exactly one authoritative definition
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5. Remove Element Selectors from Brand Layer
  - [x] 5.1 Audit component CSS files for element selectors setting overridable properties
  - [x] 5.2 Move or remove element selectors that set min-height, min-width, font-family, line-height, padding, font-size
  - [x] 5.3 Replace element selectors with class selectors where appropriate (reviewed - no changes needed, see Notes)
  - _Requirements: 2.4_

- [x] 6. Remove !important Declarations
  - [x] 6.1 Audit CSS files for `!important` on overridable properties
  - [x] 6.2 Remove `!important` from font-family, font-size, line-height, padding, min-height, min-width, box-shadow
  - [x] 6.3 Preserve `text-shadow: none !important` per brand guidelines
  - _Requirements: 5.4_

- [x] 7. Verify Tailwind Utility Overrides Work
  - [x] 7.1 Test that `p-2` overrides `.tm-btn-primary` padding
  - [x] 7.2 Test that `h-8` overrides base layer min-height
  - [x] 7.3 Test that `font-sans` overrides brand typography
  - [x] 7.4 Test that `shadow-lg` works on `.tm-card`
  - _Requirements: 1.5, 2.5, 4.2, 4.6, 5.3, 6.1, 6.2, 6.4, 7.2, 7.4_

- [x] 8. Build and Test Verification
  - [x] 8.1 Run `npm run build` and verify no CSS compilation errors
  - [x] 8.2 Run existing test suite and verify all tests pass
  - [x] 8.3 Visually inspect key pages for styling issues
  - _Requirements: All_

## Notes

- Property-based tests are NOT included per PBT steering guidance - CSS styling changes are easily observable through visual inspection and build errors
- The layer order (base → brand → utilities) ensures Tailwind utilities have highest priority
- Design tokens in `:root` remain unlayered as they define values, not styles
- This work builds on the completed Tailwind v4 migration spec

### Task 5.3 Analysis: Remaining Element Selectors

The following element selectors remain in the brand layer but are **acceptable** because they are **descendant selectors within class contexts**, not bare element selectors:

1. **`cards.css` - `.tm-card-header h1, .tm-card-header h2, .tm-card-header h3`**
   - Scoped within `.tm-card-header` class context
   - Sets `margin: 0` (reset), `font-family`, `color` (brand defaults)
   - Does not conflict with Tailwind utilities applied to the heading elements directly
   - **Decision: Keep as-is** - properly scoped component styling

2. **`alerts.css` - `.tm-alert h4`**
   - Scoped within `.tm-alert` class context
   - Sets `font-family`, `font-weight`, `margin` for alert titles
   - **Decision: Keep as-is** - properly scoped component styling

3. **`alerts.css` - `.tm-alert button[aria-label="Close alert"]`**
   - Highly specific attribute selector within `.tm-alert` class context
   - Sets touch target dimensions for accessibility compliance
   - **Decision: Keep as-is** - accessibility-critical styling with proper scoping

**Rationale:** Requirement 2.4 states "THE Refactored_CSS SHALL NOT use element selectors in the `brand` layer for properties that Tailwind utilities commonly override." The key distinction is:

- **Bare element selectors** (e.g., `button { }`) - Problematic, moved to base layer ✓
- **Descendant selectors within class context** (e.g., `.tm-card-header h1`) - Acceptable, as they're scoped to specific component contexts and don't create global specificity conflicts
