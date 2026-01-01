# Test Migration Guide

## Overview

This guide provides step-by-step instructions for migrating existing tests to use the shared test utilities and establishing standards for new test development.

## Table of Contents

1. [Pre-Migration Assessment](#pre-migration-assessment)
2. [Step-by-Step Migration Process](#step-by-step-migration-process)
3. [Common Migration Patterns](#common-migration-patterns)
4. [Standards for New Tests](#standards-for-new-tests)
5. [Quality Assurance](#quality-assurance)
6. [Troubleshooting](#troubleshooting)

## Pre-Migration Assessment

### Identify Migration Candidates

Before starting migration, identify which tests can benefit from shared utilities:

#### High-Priority Candidates

- ✅ Tests with "should render" patterns
- ✅ Tests with "should display" patterns
- ✅ Repetitive component variant tests
- ✅ Tests with custom provider setup
- ✅ Tests missing accessibility validation
- ✅ Tests missing brand compliance validation

#### Medium-Priority Candidates

- ✅ Tests with loading/error state patterns
- ✅ Tests with responsive behavior
- ✅ Tests with form validation patterns

#### Low-Priority Candidates (Keep Custom)

- ✅ Complex business logic tests
- ✅ Integration tests with specific workflows
- ✅ Tests with unique assertion patterns

### Assessment Checklist

```typescript
// Use this checklist to evaluate each test file:

// ❓ Does this test file have repetitive "should render" tests?
// ❓ Does this test file test multiple component variants?
// ❓ Does this test file set up providers manually?
// ❓ Does this test file lack accessibility testing?
// ❓ Does this test file lack brand compliance testing?
// ❓ Does this test file have loading/error state tests?

// If you answered "yes" to 2+ questions, the file is a good migration candidate
```

## Step-by-Step Migration Process

### Phase 1: Setup and Imports

#### Step 1.1: Update Imports

**Before**:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
```

**After**:

```typescript
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  renderWithProviders,
  testComponentVariants,
  expectBasicRendering,
  testLoadingStates,
  testErrorStates,
  cleanupAllResources,
} from '../__tests__/utils/componentTestUtils'
import {
  runAccessibilityTestSuite,
  runQuickAccessibilityCheck,
} from '../__tests__/utils/accessibilityTestUtils'
import {
  runBrandComplianceTestSuite,
  runQuickBrandCheck,
} from '../__tests__/utils/brandComplianceTestUtils'
```

#### Step 1.2: Add Cleanup

**Add to every test file**:

```typescript
import { afterEach } from 'vitest'

describe('YourComponent', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  // Your tests here...
})
```

### Phase 2: Replace Basic Rendering Tests

#### Step 2.1: Simple Rendering Tests

**Before**:

```typescript
it('should render without crashing', () => {
  render(<MyComponent />)
  expect(screen.getByText('Hello')).toBeInTheDocument()
})

it('should render with correct text', () => {
  render(<MyComponent text="Custom Text" />)
  expect(screen.getByText('Custom Text')).toBeInTheDocument()
})
```

**After**:

```typescript
it('should render without crashing', () => {
  expectBasicRendering(<MyComponent />)
})

it('should render with correct text', () => {
  renderWithProviders(<MyComponent text="Custom Text" />)
  expect(screen.getByText('Custom Text')).toBeInTheDocument()
})
```

#### Step 2.2: Provider Setup Replacement

**Before**:

```typescript
const renderWithRouter = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </BrowserRouter>
  )
}

it('should render with providers', () => {
  renderWithRouter(<MyComponent />)
  expect(screen.getByText('Content')).toBeInTheDocument()
})
```

**After**:

```typescript
it('should render with providers', () => {
  renderWithProviders(<MyComponent />)
  expect(screen.getByText('Content')).toBeInTheDocument()
})
```

### Phase 3: Consolidate Variant Tests

#### Step 3.1: Multiple Similar Tests

**Before**:

```typescript
it('should render primary button', () => {
  render(<Button variant="primary">Primary</Button>)
  expect(screen.getByRole('button')).toHaveClass('btn-primary')
})

it('should render secondary button', () => {
  render(<Button variant="secondary">Secondary</Button>)
  expect(screen.getByRole('button')).toHaveClass('btn-secondary')
})

it('should render danger button', () => {
  render(<Button variant="danger">Delete</Button>)
  expect(screen.getByRole('button')).toHaveClass('btn-danger')
})

it('should render small button', () => {
  render(<Button size="small">Small</Button>)
  expect(screen.getByRole('button')).toHaveClass('btn-small')
})

it('should render large button', () => {
  render(<Button size="large">Large</Button>)
  expect(screen.getByRole('button')).toHaveClass('btn-large')
})
```

**After**:

```typescript
describe('Button Variants', () => {
  testComponentVariants(Button, [
    {
      name: 'primary button',
      props: { variant: 'primary', children: 'Primary' },
      expectedClass: 'btn-primary',
    },
    {
      name: 'secondary button',
      props: { variant: 'secondary', children: 'Secondary' },
      expectedClass: 'btn-secondary',
    },
    {
      name: 'danger button',
      props: { variant: 'danger', children: 'Delete' },
      expectedClass: 'btn-danger',
    },
    {
      name: 'small button',
      props: { size: 'small', children: 'Small' },
      expectedClass: 'btn-small',
    },
    {
      name: 'large button',
      props: { size: 'large', children: 'Large' },
      expectedClass: 'btn-large',
    },
  ])
})
```

#### Step 3.2: Complex Variant Tests with Custom Assertions

**Before**:

```typescript
it('should render disabled button correctly', () => {
  render(<Button disabled>Disabled</Button>)
  const button = screen.getByRole('button')
  expect(button).toBeDisabled()
  expect(button).toHaveClass('btn-disabled')
  expect(button).toHaveAttribute('aria-disabled', 'true')
})
```

**After**:

```typescript
testComponentVariants(Button, [
  {
    name: 'disabled button',
    props: { disabled: true, children: 'Disabled' },
    expectedClass: 'btn-disabled',
    customAssertion: container => {
      const button = container.querySelector('button')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled', 'true')
    },
  },
])
```

### Phase 4: Replace State Testing

#### Step 4.1: Loading States

**Before**:

```typescript
it('should show loading state', () => {
  render(<DataComponent loading={true} />)
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})

it('should show loaded state', () => {
  render(<DataComponent loading={false} data={mockData} />)
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  expect(screen.getByText('Data loaded')).toBeInTheDocument()
})
```

**After**:

```typescript
testLoadingStates(
  DataComponent,
  { loading: true },
  { loading: false, data: mockData }
)
```

#### Step 4.2: Error States

**Before**:

```typescript
it('should display error message', () => {
  render(<ApiComponent error="Network failed" />)
  expect(screen.getByText('Network failed')).toBeInTheDocument()
})
```

**After**:

```typescript
testErrorStates(ApiComponent, { error: 'Network failed' }, /network failed/i)
```

### Phase 5: Add Comprehensive Testing

#### Step 5.1: Add Accessibility Testing

**Add to every component test file**:

```typescript
describe('MyComponent Accessibility', () => {
  it('should meet accessibility standards', () => {
    runAccessibilityTestSuite(<MyComponent />)
  })
})
```

#### Step 5.2: Add Brand Compliance Testing

**Add to every UI component test file**:

```typescript
describe('MyComponent Brand Compliance', () => {
  it('should meet brand compliance standards', () => {
    runBrandComplianceTestSuite(<MyComponent />)
  })
})
```

#### Step 5.3: Performance-Optimized Testing

**For large test suites, use quick checks first**:

```typescript
describe('MyComponent Compliance', () => {
  it('should pass quick compliance checks', () => {
    const { passed: accessibilityPassed } = runQuickAccessibilityCheck(<MyComponent />)
    const { passed: brandPassed } = runQuickBrandCheck(<MyComponent />)

    expect(accessibilityPassed).toBe(true)
    expect(brandPassed).toBe(true)
  })
})
```

## Common Migration Patterns

### Pattern 1: Custom Provider Wrapper

**Before**:

```typescript
const CustomWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={testTheme}>
    <AuthProvider user={mockUser}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
)

const renderWithCustomProviders = (component: React.ReactElement) => {
  return render(component, { wrapper: CustomWrapper })
}
```

**After**:

```typescript
const ThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeContext.Provider value={testTheme}>{children}</ThemeContext.Provider>
)

const AuthProvider = ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider value={mockUser}>{children}</AuthContext.Provider>
)

// Use in tests
renderWithProviders(<MyComponent />, {
  customProviders: [ThemeProvider, AuthProvider]
})
```

### Pattern 2: Repetitive Prop Testing

**Before**:

```typescript
it('should handle string prop', () => {
  render(<MyComponent value="test" />)
  expect(screen.getByDisplayValue('test')).toBeInTheDocument()
})

it('should handle number prop', () => {
  render(<MyComponent value={42} />)
  expect(screen.getByDisplayValue('42')).toBeInTheDocument()
})

it('should handle boolean prop', () => {
  render(<MyComponent enabled={true} />)
  expect(screen.getByRole('button')).not.toBeDisabled()
})
```

**After**:

```typescript
testComponentVariants(MyComponent, [
  {
    name: 'with string value',
    props: { value: 'test' },
    customAssertion: container => {
      expect(container.querySelector('[value="test"]')).toBeInTheDocument()
    },
  },
  {
    name: 'with number value',
    props: { value: 42 },
    customAssertion: container => {
      expect(container.querySelector('[value="42"]')).toBeInTheDocument()
    },
  },
  {
    name: 'when enabled',
    props: { enabled: true },
    customAssertion: container => {
      expect(container.querySelector('button')).not.toBeDisabled()
    },
  },
])
```

### Pattern 3: Form Testing

**Before**:

```typescript
it('should validate required fields', () => {
  render(<ContactForm />)

  fireEvent.click(screen.getByRole('button', { name: /submit/i }))

  expect(screen.getByText('Name is required')).toBeInTheDocument()
  expect(screen.getByText('Email is required')).toBeInTheDocument()
})

it('should submit valid form', () => {
  const onSubmit = vi.fn()
  render(<ContactForm onSubmit={onSubmit} />)

  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /submit/i }))

  expect(onSubmit).toHaveBeenCalledWith({ name: 'John', email: 'john@example.com' })
})
```

**After**:

```typescript
describe('ContactForm', () => {
  // Keep custom tests for complex business logic
  it('should validate required fields', () => {
    renderWithProviders(<ContactForm />)

    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
  })

  it('should submit valid form', () => {
    const onSubmit = vi.fn()
    renderWithProviders(<ContactForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(onSubmit).toHaveBeenCalledWith({ name: 'John', email: 'john@example.com' })
  })

  // Add comprehensive testing
  describe('Accessibility', () => {
    runAccessibilityTestSuite(<ContactForm />)
  })

  describe('Brand Compliance', () => {
    runBrandComplianceTestSuite(<ContactForm />)
  })
})
```

## Standards for New Tests

### Mandatory Standards

#### 1. Always Use Shared Utilities

```typescript
// ✅ REQUIRED: Use renderWithProviders instead of render
renderWithProviders(<MyComponent />)

// ✅ REQUIRED: Use testComponentVariants for multiple similar tests
testComponentVariants(MyComponent, variants)

// ✅ REQUIRED: Add cleanup
afterEach(() => {
  cleanupAllResources()
})
```

#### 2. Always Include Comprehensive Testing

```typescript
// ✅ REQUIRED: Add accessibility testing for all components
describe('MyComponent Accessibility', () => {
  runAccessibilityTestSuite(<MyComponent />)
})

// ✅ REQUIRED: Add brand compliance testing for all UI components
describe('MyComponent Brand Compliance', () => {
  runBrandComplianceTestSuite(<MyComponent />)
})
```

#### 3. Follow Test Organization Pattern

```typescript
describe('MyComponent', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  // Core functionality tests
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

### Recommended Standards

#### 1. Use Performance Monitoring for Complex Components

```typescript
renderWithProviders(<ComplexComponent />, {
  enablePerformanceMonitoring: true,
  testName: 'complex-component-test'
})
```

#### 2. Use Quick Checks for Large Test Suites

```typescript
// For performance-sensitive scenarios
const { passed: accessibilityPassed } = runQuickAccessibilityCheck(<MyComponent />)
const { passed: brandPassed } = runQuickBrandCheck(<MyComponent />)

if (!accessibilityPassed || !brandPassed) {
  // Run full test suites only when issues detected
  runAccessibilityTestSuite(<MyComponent />)
  runBrandComplianceTestSuite(<MyComponent />)
}
```

#### 3. Use Descriptive Test Names

```typescript
// ✅ Good: Descriptive and specific
testComponentVariants(Button, [
  {
    name: 'primary button with loading state',
    props: { variant: 'primary', loading: true, children: 'Submit' },
    expectedText: 'Loading...',
  },
])

// ❌ Bad: Vague and unclear
testComponentVariants(Button, [
  {
    name: 'test 1',
    props: { variant: 'primary' },
  },
])
```

### Template for New Component Tests

```typescript
/**
 * MyComponent Test Suite
 *
 * Tests for MyComponent functionality, variants, states, accessibility, and brand compliance.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import {
  renderWithProviders,
  testComponentVariants,
  expectBasicRendering,
  testLoadingStates,
  testErrorStates,
  cleanupAllResources,
  ComponentVariant
} from '../__tests__/utils/componentTestUtils'
import {
  runAccessibilityTestSuite
} from '../__tests__/utils/accessibilityTestUtils'
import {
  runBrandComplianceTestSuite
} from '../__tests__/utils/brandComplianceTestUtils'
import MyComponent from './MyComponent'

// Mock data and props
const mockProps = {
  // Define mock props here
}

const componentVariants: ComponentVariant<MyComponentProps>[] = [
  {
    name: 'default variant',
    props: { ...mockProps },
    expectedText: 'Expected text'
  },
  // Add more variants as needed
]

describe('MyComponent', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('Core Functionality', () => {
    it('should render without crashing', () => {
      expectBasicRendering(<MyComponent {...mockProps} />)
    })

    it('should handle user interactions', () => {
      renderWithProviders(<MyComponent {...mockProps} />)

      // Add specific interaction tests here
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('Expected result')).toBeInTheDocument()
    })

    // Add more specific functionality tests
  })

  describe('Variants', () => {
    testComponentVariants(MyComponent, componentVariants)
  })

  describe('States', () => {
    testLoadingStates(
      MyComponent,
      { ...mockProps, loading: true },
      { ...mockProps, loading: false, data: mockData }
    )

    testErrorStates(
      MyComponent,
      { ...mockProps, error: 'Test error' },
      /test error/i
    )
  })

  describe('Accessibility', () => {
    runAccessibilityTestSuite(<MyComponent {...mockProps} />)
  })

  describe('Brand Compliance', () => {
    runBrandComplianceTestSuite(<MyComponent {...mockProps} />)
  })
})
```

## Quality Assurance

### Pre-Migration Checklist

- [ ] Identified all tests that can benefit from shared utilities
- [ ] Backed up original test files
- [ ] Set up shared utility imports
- [ ] Added cleanup hooks

### During Migration Checklist

- [ ] Replaced basic rendering tests with `expectBasicRendering` or `renderWithProviders`
- [ ] Consolidated variant tests using `testComponentVariants`
- [ ] Replaced custom provider setup with `renderWithProviders` options
- [ ] Added loading/error state testing where applicable
- [ ] Added accessibility testing to all components
- [ ] Added brand compliance testing to all UI components

### Post-Migration Checklist

- [ ] All tests pass with same or better coverage
- [ ] Test execution time is maintained or improved
- [ ] No functionality is lost during migration
- [ ] Code reduction of 20%+ achieved
- [ ] Accessibility and brand compliance testing added

### Validation Commands

```bash
# Run tests to ensure everything works
npm test

# Check test coverage
npm run test:coverage

# Run linting to ensure code quality
npm run lint

# Check TypeScript compilation
npx tsc --noEmit
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: Tests failing after migration

**Symptoms**: Tests that passed before migration now fail

**Solutions**:

1. Check that all required props are provided to utilities
2. Verify that custom assertions are correctly implemented
3. Ensure cleanup is properly configured
4. Check that provider configuration matches original setup

```typescript
// Debug by comparing before/after renders
console.log('Before migration render result:', originalRender)
console.log('After migration render result:', renderWithProviders)
```

#### Issue: Performance degradation

**Symptoms**: Tests run slower after migration

**Solutions**:

1. Use quick checks for large test suites
2. Disable performance monitoring for simple tests
3. Optimize custom assertions
4. Check for memory leaks in cleanup

```typescript
// Use quick checks for better performance
const { passed } = runQuickAccessibilityCheck(<MyComponent />)
if (!passed) {
  runAccessibilityTestSuite(<MyComponent />)
}
```

#### Issue: Provider configuration not working

**Symptoms**: Components that need specific providers fail

**Solutions**:

1. Check custom provider implementation
2. Verify provider order (outermost first in array)
3. Ensure providers accept children prop correctly

```typescript
// Correct provider implementation
const CustomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Context.Provider value={mockValue}>{children}</Context.Provider>
)

renderWithProviders(<MyComponent />, {
  customProviders: [CustomProvider]
})
```

#### Issue: Accessibility/Brand tests failing unexpectedly

**Symptoms**: New comprehensive tests reveal issues not caught before

**Solutions**:

1. This is expected - the utilities catch real issues
2. Fix the underlying accessibility/brand compliance issues
3. Use quick checks to identify critical issues first
4. Refer to violation remediation suggestions

```typescript
// Debug violations
const violations = expectWCAGCompliance(<MyComponent />)
violations.forEach(v => {
  console.log(`Issue: ${v.violation}`)
  console.log(`Fix: ${v.remediation}`)
})
```

#### Issue: Custom assertions not working

**Symptoms**: Custom assertion logic fails in testComponentVariants

**Solutions**:

1. Check that container parameter is used correctly
2. Verify selectors work with rendered DOM
3. Use screen queries when appropriate

```typescript
// Correct custom assertion
customAssertion: container => {
  const element = container.querySelector('.specific-class')
  expect(element).toBeInTheDocument()

  // Or use screen for better queries
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
}
```

### Getting Help

If you encounter issues not covered in this guide:

1. Check the comprehensive documentation in `TEST_UTILITIES_GUIDE.md`
2. Review the example files in the `examples/` directory
3. Look at successfully migrated test files for patterns
4. Check the utility source code for implementation details
5. Create an issue with specific error messages and test code

### Migration Success Metrics

Track these metrics to measure migration success:

- **Code Reduction**: Aim for 20%+ reduction in test code lines
- **Test Coverage**: Maintain or improve coverage percentage
- **Execution Time**: Keep under 25 seconds for full test suite
- **Pass Rate**: Maintain 99.8%+ pass rate
- **Accessibility Coverage**: 100% of components tested
- **Brand Compliance Coverage**: 100% of UI components tested

## Conclusion

Following this migration guide will help you:

1. **Reduce code duplication** by 20%+ through shared utilities
2. **Improve test consistency** across all components
3. **Add comprehensive testing** for accessibility and brand compliance
4. **Maintain high quality** while reducing maintenance burden
5. **Establish standards** for future test development

The migration process is designed to be incremental and safe, allowing you to validate improvements at each step while maintaining full test functionality.
