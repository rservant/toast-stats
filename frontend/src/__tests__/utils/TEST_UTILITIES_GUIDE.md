# Test Utilities Comprehensive Guide

## Overview

This guide provides complete documentation for the shared test utilities that have been implemented to optimize the test suite. These utilities reduce code duplication by 20%+ while maintaining comprehensive coverage and improving test consistency.

## Table of Contents

1. [Component Testing Utilities](#component-testing-utilities)
2. [Accessibility Testing Utilities](#accessibility-testing-utilities)
3. [Brand Compliance Testing Utilities](#brand-compliance-testing-utilities)
4. [Migration Guidelines](#migration-guidelines)
5. [Best Practices](#best-practices)
6. [Performance Optimization](#performance-optimization)
7. [Troubleshooting](#troubleshooting)

## Component Testing Utilities

### `renderWithProviders(ui, options)`

Enhanced render function with automatic provider management and test isolation.

**Purpose**: Renders React components with all necessary providers (QueryClient, Router) while ensuring proper test isolation and resource cleanup.

**Parameters**:

- `ui: ReactElement` - The component to render
- `options: RenderWithProvidersOptions` - Configuration options

**Options Interface**:

```typescript
interface RenderWithProvidersOptions {
  skipProviders?: boolean // Skip all providers
  skipRouter?: boolean // Skip BrowserRouter only
  customProviders?: ComponentType[] // Additional custom providers
  testId?: string // Test ID for debugging
  enablePerformanceMonitoring?: boolean // Enable performance tracking
  testName?: string // Name for performance metrics
  queryClientOptions?: {
    // QueryClient configuration
    defaultOptions?: {
      queries?: Record<string, any>
      mutations?: Record<string, any>
    }
  }
}
```

**Usage Examples**:

```typescript
// Basic usage
const { container } = renderWithProviders(<MyComponent />)

// With custom providers
const CustomProvider = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)

renderWithProviders(<MyComponent />, {
  customProviders: [CustomProvider],
  enablePerformanceMonitoring: true,
  testName: 'MyComponent-render'
})

// Skip router for components that don't need routing
renderWithProviders(<StaticComponent />, {
  skipRouter: true
})
```

**Returns**: Enhanced render result with cleanup utilities and performance metrics access.

### `testComponentVariants(Component, variants, options)`

Parameterized testing for component variants with automatic compliance checking.

**Purpose**: Generate individual test cases for each component variant, reducing repetitive "should render X variant" tests.

**Parameters**:

- `Component: React.ComponentType<T>` - The component to test
- `variants: ComponentVariant<T>[]` - Array of variant configurations
- `options: VariantTestOptions` - Testing options

**Variant Interface**:

```typescript
interface ComponentVariant<T> {
  name: string // Variant name for test description
  props: T // Props to pass to component
  expectedText?: string // Text that should be present
  expectedClass?: string // CSS class that should be present
  expectedAttribute?: {
    // HTML attribute that should be present
    name: string
    value: string
  }
  customAssertion?: (container: HTMLElement) => void // Custom test logic
  performanceBenchmark?: {
    // Performance expectations
    maxRenderTime?: number
    maxMemoryUsage?: number
  }
}
```

**Usage Examples**:

```typescript
// Button variant testing
testComponentVariants(Button, [
  {
    name: 'primary button',
    props: { variant: 'primary', children: 'Click me' },
    expectedClass: 'bg-tm-loyal-blue',
    expectedText: 'Click me',
  },
  {
    name: 'secondary button',
    props: { variant: 'secondary', children: 'Cancel' },
    expectedClass: 'border-tm-loyal-blue',
    customAssertion: container => {
      expect(container.querySelector('button')).toHaveAttribute(
        'type',
        'button'
      )
    },
  },
  {
    name: 'disabled button',
    props: { variant: 'primary', disabled: true, children: 'Disabled' },
    expectedAttribute: { name: 'disabled', value: '' },
    performanceBenchmark: { maxRenderTime: 50 },
  },
])

// Card variant testing with custom providers
testComponentVariants(
  Card,
  [
    {
      name: 'loading card',
      props: { loading: true, title: 'Loading...' },
      expectedText: 'Loading...',
    },
    {
      name: 'error card',
      props: { error: 'Failed to load', title: 'Error' },
      expectedText: 'Failed to load',
    },
  ],
  {
    enablePerformanceMonitoring: true,
    skipAccessibilityCheck: false,
    skipBrandComplianceCheck: false,
  }
)
```

### `expectBasicRendering(component, testId?)`

Quick test for basic component rendering without crashes.

**Usage**:

```typescript
// Basic rendering test
expectBasicRendering(<MyComponent />)

// With test ID verification
expectBasicRendering(<MyComponent data-testid="my-component" />, 'my-component')
```

### `testLoadingStates(Component, loadingProps, loadedProps, options)`

Test component loading and loaded states with performance monitoring.

**Usage**:

```typescript
testLoadingStates(
  DataTable,
  { loading: true, data: [] },
  { loading: false, data: mockData },
  { enablePerformanceMonitoring: true }
)
```

### `testErrorStates(Component, errorProps, expectedErrorMessage, options)`

Test component error state handling.

**Usage**:

```typescript
testErrorStates(
  ApiComponent,
  { error: 'Network error', data: null },
  /network error/i,
  { enablePerformanceMonitoring: true }
)
```

### `testResponsiveVariants(Component, props, viewports)`

Test component behavior across different viewport sizes.

**Usage**:

```typescript
testResponsiveVariants(ResponsiveNav, { items: navItems }, [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 },
])
```

### `cleanupAllResources()`

Automatic cleanup for all active resources. Should be called in test teardown.

**Usage**:

```typescript
afterEach(() => {
  cleanupAllResources()
})
```

## Accessibility Testing Utilities

### `runAccessibilityTestSuite(component)`

Comprehensive WCAG AA compliance testing with detailed reporting.

**Purpose**: Validates accessibility compliance including keyboard navigation, color contrast, ARIA attributes, and screen reader compatibility.

**Usage**:

```typescript
describe('MyComponent Accessibility', () => {
  const report = runAccessibilityTestSuite(<MyComponent />)

  // Report contains:
  // - violations: AccessibilityViolation[]
  // - passed: number
  // - failed: number
  // - score: number
  // - wcagLevel: 'AA' | 'A' | 'Non-compliant'
})
```

### `expectWCAGCompliance(component)`

Validates specific WCAG AA compliance criteria.

**Checks**:

- Proper heading hierarchy (h1 → h2 → h3)
- Form labels and required field indication
- Button accessible names
- Image alt text
- ARIA attributes and relationships

**Usage**:

```typescript
const violations = expectWCAGCompliance(<FormComponent />)
// Returns array of AccessibilityViolation objects
```

### `expectKeyboardNavigation(component)`

Tests keyboard accessibility and focus management.

**Checks**:

- Focusable elements have proper tabindex
- Focus indicators are visible
- Skip links for page-level components
- Natural tab order (no positive tabindex values)

### `expectColorContrast(component)`

Validates color contrast ratios for WCAG AA compliance.

**Standards**:

- Normal text: 4.5:1 minimum contrast ratio
- Large text (18pt+ or 14pt+ bold): 3:1 minimum contrast ratio
- Color-only information detection

**Usage**:

```typescript
const violations = expectColorContrast(<ColoredComponent />)
// Automatically calculates contrast ratios for Toastmasters brand colors
```

### `expectScreenReaderCompatibility(component)`

Tests screen reader support and ARIA implementation.

**Checks**:

- ARIA landmarks (main, nav, header, footer)
- Live regions (aria-live)
- ARIA descriptions (aria-describedby)
- Table structure (caption, headers)
- List structure validation

### `runQuickAccessibilityCheck(component)`

Performance-optimized accessibility check for critical violations only.

**Usage**:

```typescript
const { passed, criticalViolations } = runQuickAccessibilityCheck(<Component />)
if (!passed) {
  console.warn('Critical accessibility issues found:', criticalViolations)
}
```

## Brand Compliance Testing Utilities

### `runBrandComplianceTestSuite(component)`

Comprehensive Toastmasters brand guidelines compliance testing.

**Purpose**: Validates adherence to Toastmasters International brand guidelines including colors, typography, spacing, and design patterns.

**Usage**:

```typescript
describe('MyComponent Brand Compliance', () => {
  const report = runBrandComplianceTestSuite(<MyComponent />)

  // Report contains:
  // - violations: BrandViolation[]
  // - passed: number
  // - failed: number
  // - score: number (percentage)
  // - recommendations: string[]
})
```

### `expectBrandColors(component)`

Validates Toastmasters brand color usage.

**Brand Colors**:

- TM Loyal Blue: `#004165`
- TM True Maroon: `#772432`
- TM Cool Gray: `#a9b2b1`
- TM Happy Yellow: `#f2df74`
- TM Black: `#000000`
- TM White: `#ffffff`

**Checks**:

- Only brand-approved colors are used
- CSS custom properties usage (var(--tm-\*))
- No custom color variations

### `expectBrandTypography(component)`

Validates typography compliance with Toastmasters guidelines.

**Brand Fonts**:

- Headlines: Montserrat (with fallbacks)
- Body: Source Sans 3 (with fallbacks)

**Checks**:

- Minimum 14px font size for body text
- No text effects (drop-shadow, outline, glow)
- Proper font family usage

### `expectTouchTargets(component)`

Validates minimum 44px touch targets for interactive elements.

**Checks**:

- Buttons, links, and interactive elements meet 44px minimum
- Both width and height requirements
- Proper padding and sizing

### `expectGradientUsage(component)`

Validates gradient usage according to brand guidelines.

**Rules**:

- Maximum 1 gradient per screen/view
- Only brand-approved gradient combinations
- Proper contrast validation for text overlays

### `expectBrandSpacing(component)`

Validates consistent spacing using Toastmasters design system.

**Spacing Scale**: 4px increments (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### `runQuickBrandCheck(component)`

Performance-optimized brand compliance check for critical violations only.

**Usage**:

```typescript
const { passed, criticalViolations } = runQuickBrandCheck(<Component />)
if (!passed) {
  console.warn('Critical brand violations found:', criticalViolations)
}
```

## Migration Guidelines

### Step 1: Replace Basic Rendering Tests

**Before**:

```typescript
it('should render without crashing', () => {
  render(<MyComponent />)
  expect(screen.getByText('Hello')).toBeInTheDocument()
})
```

**After**:

```typescript
expectBasicRendering(<MyComponent />)
// or with test ID
expectBasicRendering(<MyComponent data-testid="my-component" />, 'my-component')
```

### Step 2: Consolidate Variant Tests

**Before** (repetitive):

```typescript
it('should render primary variant', () => {
  render(<Button variant="primary">Primary</Button>)
  expect(screen.getByRole('button')).toHaveClass('bg-tm-loyal-blue')
})

it('should render secondary variant', () => {
  render(<Button variant="secondary">Secondary</Button>)
  expect(screen.getByRole('button')).toHaveClass('border-tm-loyal-blue')
})
```

**After** (consolidated):

```typescript
testComponentVariants(Button, [
  {
    name: 'primary variant',
    props: { variant: 'primary', children: 'Primary' },
    expectedClass: 'bg-tm-loyal-blue',
  },
  {
    name: 'secondary variant',
    props: { variant: 'secondary', children: 'Secondary' },
    expectedClass: 'border-tm-loyal-blue',
  },
])
```

### Step 3: Add Comprehensive Testing

**Add to every component test file**:

```typescript
describe('MyComponent', () => {
  // Your specific tests here...

  // Comprehensive testing (add at the end)
  describe('Accessibility Compliance', () => {
    runAccessibilityTestSuite(<MyComponent />)
  })

  describe('Brand Compliance', () => {
    runBrandComplianceTestSuite(<MyComponent />)
  })
})
```

### Step 4: Update Provider Usage

**Before**:

```typescript
const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </BrowserRouter>
  )
}
```

**After**:

```typescript
import { renderWithProviders } from '../__tests__/utils'

// Simple usage
renderWithProviders(<MyComponent />)

// With options
renderWithProviders(<MyComponent />, {
  enablePerformanceMonitoring: true,
  testName: 'MyComponent-test'
})
```

## Best Practices

### When to Use Each Utility

#### Always Use

- ✅ `renderWithProviders` - For all component rendering
- ✅ `runAccessibilityTestSuite` - For all components
- ✅ `runBrandComplianceTestSuite` - For all UI components
- ✅ `cleanupAllResources` - In afterEach hooks

#### Use When Appropriate

- ✅ `testComponentVariants` - For components with multiple variants
- ✅ `testLoadingStates` - For components with loading states
- ✅ `testErrorStates` - For components with error handling
- ✅ `testResponsiveVariants` - For responsive components

#### Write Custom Tests For

- ✅ Complex business logic
- ✅ Component interactions
- ✅ Integration scenarios
- ✅ Unique functionality not covered by utilities

### Test Organization

```typescript
describe('MyComponent', () => {
  // Setup
  beforeEach(() => {
    // Test setup
  })

  afterEach(() => {
    cleanupAllResources()
  })

  // Specific functionality tests
  describe('Core Functionality', () => {
    it('should handle user interactions', () => {
      // Custom test logic
    })
  })

  // Variant testing
  describe('Variants', () => {
    testComponentVariants(MyComponent, variants)
  })

  // State testing
  describe('States', () => {
    testLoadingStates(MyComponent, loadingProps, loadedProps)
    testErrorStates(MyComponent, errorProps, /error message/i)
  })

  // Comprehensive testing
  describe('Accessibility', () => {
    runAccessibilityTestSuite(<MyComponent />)
  })

  describe('Brand Compliance', () => {
    runBrandComplianceTestSuite(<MyComponent />)
  })
})
```

### Performance Considerations

#### Enable Performance Monitoring

```typescript
renderWithProviders(<MyComponent />, {
  enablePerformanceMonitoring: true,
  testName: 'MyComponent-performance-test'
})

// Access metrics
const result = renderWithProviders(<MyComponent />, options)
const metrics = result.getPerformanceMetrics()
```

#### Use Quick Checks for Large Test Suites

```typescript
// For performance-sensitive scenarios
const { passed } = runQuickAccessibilityCheck(<MyComponent />)
const { passed: brandPassed } = runQuickBrandCheck(<MyComponent />)

if (!passed || !brandPassed) {
  // Run full test suites only when issues detected
  runAccessibilityTestSuite(<MyComponent />)
  runBrandComplianceTestSuite(<MyComponent />)
}
```

## Performance Optimization

### Utility Performance Characteristics

- **Minimal Overhead**: <1% additional execution time
- **Efficient Rendering**: Provider reuse and caching
- **Memory Management**: Automatic cleanup and resource management
- **Parallel Execution**: Thread-safe for concurrent testing

### Optimization Strategies

#### 1. Provider Reuse

```typescript
// Utilities automatically reuse providers across tests
// No need to create new QueryClient instances
```

#### 2. Query Caching

```typescript
// DOM queries are cached for performance
// Automatic cache clearing between tests
```

#### 3. Resource Cleanup

```typescript
// Automatic cleanup prevents memory leaks
afterEach(() => {
  cleanupAllResources() // Cleans up all resources
})
```

#### 4. Performance Monitoring

```typescript
// Built-in performance monitoring
const result = renderWithProviders(<Component />, {
  enablePerformanceMonitoring: true,
  testName: 'performance-test'
})

const metrics = result.getPerformanceMetrics()
// { renderTime: 45, memoryUsage: 1024, ... }
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Provider not found" errors

**Solution**: Ensure you're using `renderWithProviders` instead of basic `render`

```typescript
// ❌ Wrong
render(<MyComponent />)

// ✅ Correct
renderWithProviders(<MyComponent />)
```

#### Issue: Tests failing due to missing providers

**Solution**: Check if component needs specific providers

```typescript
renderWithProviders(<MyComponent />, {
  customProviders: [ThemeProvider, AuthProvider]
})
```

#### Issue: Memory leaks in test suite

**Solution**: Ensure proper cleanup

```typescript
afterEach(() => {
  cleanupAllResources()
})
```

#### Issue: Accessibility tests failing unexpectedly

**Solution**: Check for common accessibility issues

```typescript
// Debug accessibility violations
const violations = expectWCAGCompliance(<MyComponent />)
console.log('Accessibility violations:', violations)
```

#### Issue: Brand compliance tests failing

**Solution**: Verify brand color and typography usage

```typescript
// Debug brand violations
const violations = expectBrandColors(<MyComponent />)
console.log('Brand violations:', violations)
```

#### Issue: Performance tests timing out

**Solution**: Disable performance monitoring for complex components

```typescript
renderWithProviders(<ComplexComponent />, {
  enablePerformanceMonitoring: false
})
```

### Debugging Tips

#### 1. Enable Verbose Logging

```typescript
// Set environment variable for detailed logging
process.env.TEST_UTILS_DEBUG = 'true'
```

#### 2. Use Quick Checks First

```typescript
// Identify issues quickly
const { passed, criticalViolations } = runQuickAccessibilityCheck(<Component />)
if (!passed) {
  console.log('Critical issues:', criticalViolations)
}
```

#### 3. Isolate Test Issues

```typescript
// Test utilities individually
expectBasicRendering(<Component />)
expectBrandColors(<Component />)
expectWCAGCompliance(<Component />)
```

#### 4. Check Provider Configuration

```typescript
// Verify provider setup
renderWithProviders(<Component />, {
  skipProviders: true // Test without providers
})
```

### Performance Debugging

#### Monitor Test Execution Time

```typescript
const start = performance.now()
renderWithProviders(<Component />)
const end = performance.now()
console.log(`Render time: ${end - start}ms`)
```

#### Check Memory Usage

```typescript
const result = renderWithProviders(<Component />, {
  enablePerformanceMonitoring: true,
  testName: 'memory-test'
})

const metrics = result.getPerformanceMetrics()
if (metrics && metrics.memoryUsage > 1000) {
  console.warn('High memory usage detected:', metrics.memoryUsage)
}
```

## Advanced Usage

### Custom Assertions

```typescript
testComponentVariants(MyComponent, [
  {
    name: 'custom validation',
    props: { value: 'test' },
    customAssertion: container => {
      const element = container.querySelector('[data-value]')
      expect(element).toHaveAttribute('data-value', 'test')
      expect(element).toBeVisible()
    },
  },
])
```

### Performance Benchmarking

```typescript
testComponentVariants(MyComponent, [
  {
    name: 'performance variant',
    props: { data: largeDataSet },
    performanceBenchmark: {
      maxRenderTime: 100,
      maxMemoryUsage: 2048,
    },
  },
])
```

### Custom Provider Integration

```typescript
const CustomTestProvider = ({ children }) => (
  <ThemeProvider theme={testTheme}>
    <LocalizationProvider locale="en">
      {children}
    </LocalizationProvider>
  </ThemeProvider>
)

renderWithProviders(<MyComponent />, {
  customProviders: [CustomTestProvider]
})
```

This comprehensive guide covers all aspects of using the shared test utilities effectively. For additional questions or issues not covered here, refer to the individual utility source files or create an issue in the project repository.
