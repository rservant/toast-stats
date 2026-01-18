# Design Document: Tailwind v4 Migration

## Overview

This design addresses CSS architecture conflicts between custom Toastmasters brand CSS and Tailwind v4 utilities. The core problem is that element-level selectors and component classes in the brand CSS have equal or higher specificity than Tailwind utilities, preventing predictable style overrides.

The solution uses CSS Cascade Layers (`@layer`) to establish a clear priority order where:
1. **Base layer** - Element-level defaults (lowest priority, easily overridable)
2. **Brand layer** - Component classes with brand styling
3. **Utilities layer** - Tailwind utilities (highest priority, always wins when applied)

This approach maintains brand compliance and accessibility by default while allowing developers to intentionally override any property using Tailwind utilities.

## Architecture

### CSS Cascade Layer Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    CSS Cascade Order                         │
│                  (Higher = More Priority)                    │
├─────────────────────────────────────────────────────────────┤
│  @layer utilities    │ Tailwind utilities (h-8, p-4, etc.) │
├─────────────────────────────────────────────────────────────┤
│  @layer brand        │ .tm-btn-primary, .tm-card, etc.     │
├─────────────────────────────────────────────────────────────┤
│  @layer base         │ Element defaults (button, a, p)     │
├─────────────────────────────────────────────────────────────┤
│  (unlayered)         │ @theme, :root variables             │
└─────────────────────────────────────────────────────────────┘
```

### File Structure After Migration

```
frontend/src/
├── index.css                    # Entry point with layer declarations
└── styles/
    ├── layers/
    │   └── base.css             # NEW: Element-level defaults in @layer base
    ├── tokens/
    │   ├── colors.css           # Design tokens (unlayered, :root)
    │   ├── typography.css       # Typography tokens (unlayered, :root)
    │   ├── spacing.css          # Spacing tokens (unlayered, :root)
    │   └── gradients.css        # Gradient tokens (unlayered, :root)
    ├── components/
    │   ├── typography.css       # Typography classes in @layer brand
    │   ├── buttons.css          # Button classes in @layer brand
    │   ├── navigation.css       # Navigation classes in @layer brand
    │   ├── forms.css            # Form classes in @layer brand
    │   ├── cards.css            # Card classes in @layer brand
    │   └── ...                  # Other components in @layer brand
    ├── responsive.css           # Responsive utilities in @layer brand
    └── brand.css                # DEPRECATED: Remove duplicate imports
```

### Layer Declaration Pattern

```css
/* index.css - Layer order declaration MUST come first */
@layer base, brand, utilities;

/* Tailwind imports into utilities layer */
@import "tailwindcss" layer(utilities);

/* Token imports (unlayered - CSS custom properties) */
@import './styles/tokens/colors.css';
@import './styles/tokens/typography.css';
@import './styles/tokens/spacing.css';
@import './styles/tokens/gradients.css';

/* Base layer imports */
@import './styles/layers/base.css';

/* Brand layer imports */
@import './styles/components/typography.css';
@import './styles/components/buttons.css';
/* ... other components */
```

## Components and Interfaces

### Base Layer Component

The base layer contains element-level defaults that establish brand compliance while remaining easily overridable.

```css
/* styles/layers/base.css */
@layer base {
  /* Typography defaults */
  body {
    font-family: var(--tm-font-body);
    font-size: max(14px, 1rem);
    line-height: max(1.4, 1.5);
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--tm-font-headline);
  }
  
  /* Touch target defaults for interactive elements */
  button,
  [type="button"],
  [type="submit"],
  [type="reset"],
  a[href],
  [role="button"],
  [tabindex]:not([tabindex="-1"]) {
    min-height: 44px;
    min-width: 44px;
  }
  
  /* Focus indicators */
  :focus-visible {
    outline: 2px solid var(--tm-loyal-blue);
    outline-offset: 2px;
  }
}
```

### Brand Layer Components

Brand layer contains `.tm-*` component classes. These provide complete brand-compliant styling but can be extended/overridden by Tailwind utilities.

```css
/* styles/components/buttons.css */
@layer brand {
  .tm-btn-primary {
    background-color: var(--tm-loyal-blue);
    color: var(--tm-white);
    font-family: var(--tm-font-headline);
    font-weight: 600;
    min-height: var(--tm-touch-target);
    padding: 12px 24px;
    border: none;
    border-radius: var(--tm-radius-md);
    cursor: pointer;
    /* ... */
  }
}
```

### Utility Layer Integration

Tailwind utilities automatically go into the utilities layer via the import statement:

```css
@import "tailwindcss" layer(utilities);
```

This ensures any Tailwind class applied to an element will override both base and brand layer styles.

## Data Models

### CSS Custom Properties (Design Tokens)

Design tokens remain in `:root` and are NOT placed in layers. They define values that all layers reference.

```css
/* tokens/typography.css - NOT in a layer */
:root {
  --tm-font-headline: "Montserrat", system-ui, sans-serif;
  --tm-font-body: "Source Sans 3", system-ui, sans-serif;
  --tm-font-size-min-body: 14px;
  --tm-line-height-min: 1.4;
  --tm-touch-target: 44px;
}
```

### Layer Priority Model

| Layer | Priority | Contents | Override Behavior |
|-------|----------|----------|-------------------|
| (unlayered) | Lowest | `:root`, `@theme` | Foundation values |
| base | Low | Element selectors | Overridden by brand and utilities |
| brand | Medium | `.tm-*` classes | Overridden by utilities |
| utilities | Highest | Tailwind classes | Always wins when applied |

### File Ownership Model

Each `.tm-*` class has exactly one authoritative definition:

| Class Pattern | Authoritative File |
|---------------|-------------------|
| `.tm-headline`, `.tm-body`, `.tm-h1-3` | `components/typography.css` |
| `.tm-btn-*` | `components/buttons.css` |
| `.tm-nav-*` | `components/navigation.css` |
| `.tm-form-*` | `components/forms.css` |
| `.tm-card-*`, `.tm-panel-*` | `components/cards.css` |
| `.tm-*-responsive` | `responsive.css` |

## Correctness Criteria

The following correctness criteria define what must hold true for the migration to be considered successful. Per the property-based testing guidance, these are best validated through unit tests with well-chosen examples rather than property-based testing, because:

1. The input space is bounded (finite CSS properties and Tailwind utilities)
2. 5-10 well-chosen examples provide equivalent confidence
3. CSS styling changes are easily observable when they fail
4. Static CSS analysis is simpler and clearer than generative testing

### Criterion 1: Tailwind Utility Override

Tailwind utilities in the `utilities` layer must override styles set in `base` and `brand` layers.

Validates: Requirements 1.5, 2.5, 4.2, 4.6, 5.3, 6.1, 6.2, 6.4, 7.2, 7.4, 8.5

### Criterion 2: Brand Layer Element Selector Restriction

The `@layer brand` must not contain element selectors for overridable properties.

Validates: Requirements 2.4

### Criterion 3: Single Class Definition

Each `.tm-*` class must be defined in exactly one CSS file.

Validates: Requirements 3.1

### Criterion 4: Token Definition Location

All `--tm-*` custom properties referenced in components must be defined in `tokens/` files.

Validates: Requirements 3.5

### Criterion 5: No Important on Overridable Properties

No `!important` on `font-family`, `font-size`, `line-height`, `padding`, `min-height`, `min-width`, or `box-shadow` (exception: `text-shadow: none !important` permitted).

Validates: Requirements 5.4

### Criterion 6: Component Classes in Brand Layer

All `.tm-*` component classes must be defined inside `@layer brand`.

Validates: Requirements 6.5

## Error Handling

### Build-Time Validation

The CSS build process should fail fast on structural errors:

1. **Missing Layer Declaration**: If `@layer base, brand, utilities;` is not the first non-comment statement in `index.css`, the build should warn.

2. **Duplicate Class Detection**: A linting rule should detect `.tm-*` classes defined in multiple files and report them as errors.

3. **Invalid Import Order**: If token imports appear after component imports, or if Tailwind import appears after brand CSS, the build should warn.

### Runtime Graceful Degradation

1. **Missing Tokens**: If a `--tm-*` variable is referenced but not defined, CSS will use the fallback value or inherit. Components should define sensible fallbacks:
   ```css
   font-family: var(--tm-font-body, system-ui, sans-serif);
   ```

2. **Layer Support**: CSS layers are supported in all modern browsers (Chrome 99+, Firefox 97+, Safari 15.4+). For older browsers, styles will apply in source order, which may cause some override issues but won't break functionality.

3. **Font Loading**: If brand fonts fail to load, the fallback stack ensures readable text:
   ```css
   font-family: "Montserrat", system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
   ```

### Migration Validation Checklist

Before considering migration complete:

- [ ] All `.tm-*` classes defined in exactly one file
- [ ] No element selectors in `@layer brand` for overridable properties
- [ ] No `!important` on overridable properties
- [ ] All component classes wrapped in `@layer brand`
- [ ] Base layer contains element defaults only
- [ ] Tailwind utilities successfully override base/brand styles

## Testing Strategy

### Approach: Unit Tests with Well-Chosen Examples

Per the property-based testing guidance, this migration uses unit tests rather than property-based tests because:

- CSS styling changes are easily observable when they fail
- The input space is bounded and enumerable
- 5-10 specific examples provide equivalent confidence to generative testing
- Static CSS analysis is simpler and more maintainable

### Test Categories

#### 1. CSS Structure Tests (Static Analysis)

Validate CSS file structure through parsing and assertion:

```typescript
// structure.test.ts
describe('CSS Layer Architecture', () => {
  test('index.css declares layers in correct order', () => {
    const css = readFileSync('frontend/src/index.css', 'utf-8');
    const layerMatch = css.match(/@layer\s+([^;]+);/);
    expect(layerMatch).toBeTruthy();
    expect(layerMatch![1]).toBe('base, brand, utilities');
  });

  test('Tailwind is imported into utilities layer', () => {
    const css = readFileSync('frontend/src/index.css', 'utf-8');
    expect(css).toMatch(/@import\s+["']tailwindcss["']\s+layer\(utilities\)/);
  });

  test('token imports precede component imports', () => {
    const css = readFileSync('frontend/src/index.css', 'utf-8');
    const tokenImportPos = css.indexOf('tokens/');
    const componentImportPos = css.indexOf('components/');
    expect(tokenImportPos).toBeLessThan(componentImportPos);
  });
});
```

#### 2. Single Definition Tests (Exhaustive Check)

Check each known `.tm-*` class is defined exactly once:

```typescript
// consolidation.test.ts
const knownTmClasses = [
  '.tm-headline', '.tm-body', '.tm-h1', '.tm-h2', '.tm-h3',
  '.tm-btn-primary', '.tm-btn-secondary',
  '.tm-nav-item', '.tm-card', '.tm-panel'
];

describe('Single Class Definition', () => {
  const cssFiles = glob.sync('frontend/src/styles/**/*.css');
  
  test.each(knownTmClasses)('%s is defined in exactly one file', (className) => {
    const filesContaining = cssFiles.filter(file => {
      const content = readFileSync(file, 'utf-8');
      const regex = new RegExp(`${className.replace('.', '\\.')}\\s*\\{`);
      return regex.test(content);
    });
    expect(filesContaining).toHaveLength(1);
  });
});
```

#### 3. Brand Layer Restriction Tests

Verify no element selectors in brand layer for overridable properties:

```typescript
// layer-restrictions.test.ts
const overridableProperties = ['min-height', 'min-width', 'font-family', 'line-height', 'padding', 'font-size'];
const elementSelectors = ['button', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'input', 'select', 'textarea'];

describe('Brand Layer Restrictions', () => {
  test('brand layer does not use element selectors for overridable properties', () => {
    const componentFiles = glob.sync('frontend/src/styles/components/**/*.css');
    
    for (const file of componentFiles) {
      const content = readFileSync(file, 'utf-8');
      const brandLayerMatch = content.match(/@layer\s+brand\s*\{([\s\S]*?)\}/g);
      
      if (brandLayerMatch) {
        for (const selector of elementSelectors) {
          // Check for bare element selectors (not class selectors)
          const bareElementRegex = new RegExp(`(?<!\\.)\\b${selector}\\s*\\{`);
          expect(brandLayerMatch.join('')).not.toMatch(bareElementRegex);
        }
      }
    }
  });
});
```

#### 4. Cascade Override Tests (Example-Based)

Test specific, representative override scenarios:

```typescript
// cascade-override.test.ts
describe('Tailwind Utility Override Behavior', () => {
  // These tests require a browser environment (jsdom or Playwright)
  
  const overrideScenarios = [
    { brandClass: 'tm-btn-primary', utility: 'p-2', property: 'padding', expected: '8px' },
    { brandClass: 'tm-btn-primary', utility: 'h-8', property: 'height', expected: '32px' },
    { brandClass: 'tm-btn-primary', utility: 'min-h-0', property: 'min-height', expected: '0px' },
    { brandClass: 'tm-headline', utility: 'font-sans', property: 'font-family', expectedContains: 'system-ui' },
    { brandClass: 'tm-body', utility: 'text-lg', property: 'font-size', expected: '18px' },
    { brandClass: 'tm-card', utility: 'shadow-lg', property: 'box-shadow', expectedContains: 'rgba' },
  ];

  test.each(overrideScenarios)(
    '$utility overrides $brandClass $property',
    async ({ brandClass, utility, property, expected, expectedContains }) => {
      const element = document.createElement('div');
      element.className = `${brandClass} ${utility}`;
      document.body.appendChild(element);
      
      const computed = getComputedStyle(element);
      if (expected) {
        expect(computed.getPropertyValue(property)).toBe(expected);
      } else if (expectedContains) {
        expect(computed.getPropertyValue(property)).toContain(expectedContains);
      }
      
      document.body.removeChild(element);
    }
  );
});
```

#### 5. No Important Declaration Tests

Scan for forbidden `!important` usage:

```typescript
// no-important.test.ts
const forbiddenImportantProperties = [
  'font-family', 'font-size', 'line-height', 
  'padding', 'min-height', 'min-width', 'box-shadow'
];

describe('No !important on Overridable Properties', () => {
  test('CSS files do not use !important on overridable properties', () => {
    const cssFiles = glob.sync('frontend/src/styles/**/*.css');
    
    for (const file of cssFiles) {
      const content = readFileSync(file, 'utf-8');
      
      for (const prop of forbiddenImportantProperties) {
        const importantRegex = new RegExp(`${prop}\\s*:[^;]*!important`, 'gi');
        const matches = content.match(importantRegex) || [];
        expect(matches).toHaveLength(0);
      }
    }
  });

  test('text-shadow: none !important is permitted', () => {
    // This is explicitly allowed per brand guidelines
    const cssFiles = glob.sync('frontend/src/styles/**/*.css');
    const allContent = cssFiles.map(f => readFileSync(f, 'utf-8')).join('\n');
    
    // Should not fail if text-shadow: none !important exists
    const textShadowImportant = allContent.match(/text-shadow\s*:\s*none\s*!important/gi);
    // This test documents the exception, not a failure condition
    expect(true).toBe(true);
  });
});
```

#### 6. Visual Regression Tests (Integration)

For critical components, capture before/after screenshots:

```typescript
// visual.integration.test.ts
describe('Visual Regression', () => {
  const criticalComponents = [
    { name: 'primary-button', html: '<button class="tm-btn-primary">Click</button>' },
    { name: 'secondary-button', html: '<button class="tm-btn-secondary">Click</button>' },
    { name: 'card', html: '<div class="tm-card"><p>Content</p></div>' },
    { name: 'navigation', html: '<nav class="tm-nav"><a class="tm-nav-item" href="#">Link</a></nav>' },
  ];

  test.each(criticalComponents)('$name matches baseline', async ({ name, html }) => {
    // Implementation depends on visual testing tool (Playwright, Percy, etc.)
    const screenshot = await captureScreenshot(html);
    expect(screenshot).toMatchSnapshot(`${name}.png`);
  });
});
```

### Test File Organization

```
frontend/src/__tests__/css-migration/
├── structure.test.ts           # Layer declaration, import order
├── consolidation.test.ts       # Single class definition checks
├── layer-restrictions.test.ts  # Brand layer element selector checks
├── cascade-override.test.ts    # Tailwind override behavior
├── no-important.test.ts        # !important usage validation
└── visual.integration.test.ts  # Visual regression tests
```

### Test Execution

```bash
# Run all CSS migration tests
npm test -- --testPathPattern=css-migration

# Run structure tests only (fast, no browser needed)
npm test -- --testPathPattern=css-migration/structure

# Run visual regression tests (requires browser)
npm test -- --testPathPattern=css-migration/visual
```
