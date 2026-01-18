# Design Document: Tailwind CSS v4 Migration

## Overview

This design document outlines the technical approach for completing the Tailwind CSS v3 to v4 migration for the Toast-Stats frontend application. The migration follows Tailwind v4's CSS-first configuration paradigm, replacing the JavaScript-based `tailwind.config.js` with CSS `@theme` directives while preserving the existing design token system and brand compliance.

## Architecture

### Migration Strategy: Full CSS-First Approach

The migration adopts Tailwind v4's recommended CSS-first configuration approach:

1. **Configuration Migration**: Move all theme configuration from `tailwind.config.js` to `@theme` blocks in `index.css`
2. **Color Palette Import**: Import default Tailwind colors via `@import "tailwindcss/theme"` or explicit `@theme` definitions
3. **Utility Class Updates**: Update renamed utility classes throughout the codebase
4. **Legacy Cleanup**: Remove `tailwind.config.js` after migration is complete

### File Structure

```
frontend/
├── src/
│   ├── index.css                    # Main CSS with @theme configuration
│   ├── styles/
│   │   ├── tokens/
│   │   │   ├── colors.css           # CSS custom properties (preserved)
│   │   │   ├── typography.css       # CSS custom properties (preserved)
│   │   │   ├── spacing.css          # CSS custom properties (preserved)
│   │   │   └── gradients.css        # CSS custom properties (preserved)
│   │   └── components/              # Component styles (preserved)
│   ├── components/                  # React components (utility class updates)
│   └── pages/                       # Page components (utility class updates)
├── postcss.config.js                # PostCSS config (already updated)
└── tailwind.config.js               # To be removed after migration
```

## Components and Interfaces

### 1. Theme Configuration Component

The `@theme` block in `index.css` serves as the central configuration:

```css
@theme {
  /* Brand Colors - mapped from CSS custom properties */
  --color-tm-loyal-blue: #004165;
  --color-tm-true-maroon: #772432;
  --color-tm-cool-gray: #a9b2b1;
  --color-tm-happy-yellow: #f2df74;
  --color-tm-black: #000000;
  --color-tm-white: #ffffff;

  /* Opacity variations follow pattern: --color-{name}-{opacity} */
  --color-tm-loyal-blue-90: rgba(0, 65, 101, 0.9);
  /* ... additional opacity variations ... */

  /* Typography */
  --font-family-tm-headline: 'Montserrat', system-ui, sans-serif;
  --font-family-tm-body: 'Source Sans 3', system-ui, sans-serif;

  /* Spacing */
  --spacing-tm-xs: 4px;
  --spacing-tm-sm: 8px;
  /* ... additional spacing values ... */

  /* Border Radius */
  --radius-tm-sm: 4px;
  --radius-tm-md: 8px;
  /* ... additional radius values ... */
}
```

### 2. Default Color Palette Import

Tailwind v4 requires explicit import of default colors:

```css
@import 'tailwindcss';

/* Option A: Import entire default theme */
@import 'tailwindcss/theme' layer(theme);

/* Option B: Define colors explicitly in @theme */
@theme {
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  /* ... full gray palette ... */

  --color-red-50: #fef2f2;
  --color-red-100: #fee2e2;
  /* ... full red palette ... */
}
```

### 3. Utility Class Mapping

| v3 Class       | v4 Class         | Affected Files      |
| -------------- | ---------------- | ------------------- |
| `shadow-sm`    | `shadow-xs`      | Multiple components |
| `shadow`       | `shadow-sm`      | Multiple components |
| `rounded-sm`   | `rounded-xs`     | Multiple components |
| `rounded`      | `rounded-sm`     | Multiple components |
| `outline-none` | `outline-hidden` | Form components     |
| `ring`         | `ring-3`         | Focus states        |

## Data Models

### Theme Token Structure

The @theme configuration follows Tailwind v4's naming conventions:

```typescript
interface ThemeTokens {
  // Colors: --color-{name}
  colors: {
    [key: string]: string // e.g., 'tm-loyal-blue': '#004165'
  }

  // Font Families: --font-family-{name}
  fontFamily: {
    [key: string]: string // e.g., 'tm-headline': 'Montserrat, ...'
  }

  // Spacing: --spacing-{name}
  spacing: {
    [key: string]: string // e.g., 'tm-xs': '4px'
  }

  // Border Radius: --radius-{name}
  borderRadius: {
    [key: string]: string // e.g., 'tm-sm': '4px'
  }

  // Font Sizes: --font-size-{name}
  fontSize: {
    [key: string]: string
  }

  // Font Weights: --font-weight-{name}
  fontWeight: {
    [key: string]: string
  }

  // Line Heights: --line-height-{name}
  lineHeight: {
    [key: string]: string
  }

  // Letter Spacing: --letter-spacing-{name}
  letterSpacing: {
    [key: string]: string
  }
}
```

### Utility Class Transformation

```typescript
interface UtilityClassTransformation {
  v3Class: string
  v4Class: string
  pattern: RegExp
  replacement: string
}

const transformations: UtilityClassTransformation[] = [
  {
    v3Class: 'shadow-sm',
    v4Class: 'shadow-xs',
    pattern: /\bshadow-sm\b/g,
    replacement: 'shadow-xs',
  },
  {
    v3Class: 'shadow',
    v4Class: 'shadow-sm',
    pattern: /\bshadow\b(?!-)/g,
    replacement: 'shadow-sm',
  },
  {
    v3Class: 'rounded-sm',
    v4Class: 'rounded-xs',
    pattern: /\brounded-sm\b/g,
    replacement: 'rounded-xs',
  },
  {
    v3Class: 'rounded',
    v4Class: 'rounded-sm',
    pattern: /\brounded\b(?!-)/g,
    replacement: 'rounded-sm',
  },
  {
    v3Class: 'outline-none',
    v4Class: 'outline-hidden',
    pattern: /\boutline-none\b/g,
    replacement: 'outline-hidden',
  },
  {
    v3Class: 'ring',
    v4Class: 'ring-3',
    pattern: /\bring\b(?!-)/g,
    replacement: 'ring-3',
  },
]
```

## Migration Validation Criteria

The migration is considered complete when:

1. **Build Success**: `npm run build` completes without CSS errors or warnings
2. **Visual Parity**: Application appearance matches pre-migration state
3. **Test Suite Passes**: All existing tests continue to pass
4. **No Legacy Config**: `tailwind.config.js` is removed
5. **Design Tokens Work**: CSS custom properties resolve correctly

## Error Handling

### CSS Compilation Errors

If the @theme configuration contains invalid syntax or unsupported properties:

- The build process will fail with a descriptive error message
- The error will indicate the specific line and property causing the issue
- Resolution: Fix the syntax error in the @theme block

### Missing Color Definitions

If a component uses a color utility that is not defined:

- The utility class will not apply any styles
- The browser dev tools will show the class but no computed styles
- Resolution: Add the missing color to the @theme configuration or import the default palette

### Utility Class Conflicts

If both v3 and v4 utility classes are present:

- The last defined class takes precedence
- This may cause unexpected styling
- Resolution: Ensure complete transformation of all v3 classes to v4 equivalents

### CSS Custom Property Resolution

If a CSS custom property is not defined:

- The property will resolve to `initial` or the fallback value
- This may cause visual inconsistencies
- Resolution: Ensure all referenced custom properties are defined in the token files

## Verification Strategy

This migration is a styling/configuration change where failures are immediately observable. Per the Property-Based Testing Guidance, PBT is NOT appropriate here because:

1. No mathematical invariants exist
2. The input space is bounded and enumerable (specific color names, utility classes)
3. Well-chosen examples provide equivalent confidence
4. Failures are immediately obvious (visual inspection, build errors)

### Verification Approach

1. **Build Verification**
   - `npm run build` must succeed without CSS compilation errors
   - No @theme CSS warnings in build output

2. **Visual Inspection**
   - Key pages render correctly with expected colors
   - Typography displays with correct fonts
   - Spacing and layout match pre-migration state

3. **Existing Test Suite**
   - All existing tests must continue to pass
   - Component tests validate rendering behavior

4. **Manual Checklist**
   - Brand colors resolve correctly (spot check 2-3 colors)
   - Default Tailwind colors work (bg-gray-100, text-red-500)
   - Renamed utilities apply correctly (shadow-xs, rounded-xs)
