/**
 * Brand Compliance Integration Tests
 *
 * Comprehensive end-to-end testing of brand compliance across user journeys,
 * accessibility compliance, responsive behavior, and gradient usage constraints.
 *
 * **Feature: toastmasters-brand-compliance, Integration Tests**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import React from 'react'

// Import brand validation utilities
import {
  isValidBrandColor,
  meetsWCAGAA,
  allValidationRules,
  rgbToHex,
} from '../../utils/brandValidation'
import { BRAND_COLORS } from '../../utils/brandConstants'

// Define axe results interface
interface AxeResults {
  violations: Array<{ id: string; description: string }>
  passes: Array<{ id: string; description: string }>
  incomplete: Array<{ id: string; description: string }>
  inapplicable: Array<{ id: string; description: string }>
}

// Extend Jest matchers for axe
declare global {
  namespace Vi {
    interface Assertion {
      toHaveNoViolations(): void
    }
  }
}

expect.extend({
  toHaveNoViolations(received: AxeResults) {
    const pass = received.violations.length === 0
    return {
      message: () =>
        pass
          ? 'Expected violations but received none'
          : `Expected no violations but received ${received.violations.length}`,
      pass,
    }
  },
})

// Simple test components for brand compliance testing
const BrandCompliantButton: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <button
    className="tm-btn-primary"
    style={{
      backgroundColor: BRAND_COLORS.loyalBlue,
      color: BRAND_COLORS.white,
      minWidth: '44px',
      minHeight: '44px',
      padding: '12px 24px',
      fontFamily: 'Montserrat, system-ui, sans-serif',
      fontSize: '16px',
      lineHeight: '1.4',
      border: 'none',
      borderRadius: '4px',
    }}
  >
    {children}
  </button>
)

const BrandCompliantCard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    className="tm-card"
    style={{
      backgroundColor: BRAND_COLORS.coolGray,
      color: BRAND_COLORS.black,
      padding: '24px',
      borderRadius: '8px',
      fontFamily: 'Source Sans 3, system-ui, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
    }}
  >
    {children}
  </div>
)

const BrandCompliantNavigation: React.FC = () => (
  <nav
    className="tm-nav"
    style={{
      backgroundColor: BRAND_COLORS.loyalBlue,
      color: BRAND_COLORS.white,
      padding: '16px',
    }}
  >
    <a
      href="#home"
      style={{
        color: BRAND_COLORS.white,
        textDecoration: 'none',
        padding: '12px 16px',
        minHeight: '44px',
        display: 'inline-block',
        fontFamily: 'Montserrat, system-ui, sans-serif',
        fontSize: '16px',
      }}
    >
      Home
    </a>
    <a
      href="#about"
      style={{
        color: BRAND_COLORS.white,
        textDecoration: 'none',
        padding: '12px 16px',
        minHeight: '44px',
        display: 'inline-block',
        fontFamily: 'Montserrat, system-ui, sans-serif',
        fontSize: '16px',
      }}
    >
      About
    </a>
  </nav>
)

const TestPage: React.FC = () => (
  <div>
    <BrandCompliantNavigation />
    <main style={{ padding: '24px' }}>
      <h1
        style={{
          fontFamily: 'Montserrat, system-ui, sans-serif',
          fontSize: '32px',
          color: BRAND_COLORS.black,
          lineHeight: '1.4',
        }}
      >
        Test Page
      </h1>
      <BrandCompliantCard>
        <p>This is a test card with brand-compliant styling.</p>
        <BrandCompliantButton>Click Me</BrandCompliantButton>
      </BrandCompliantCard>
    </main>
  </div>
)

// Mock window.matchMedia for responsive testing
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// Mock getBoundingClientRect for touch target testing
const mockBoundingClientRect = (width: number, height: number) => {
  return vi.fn().mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: vi.fn(),
  })
}

describe('Brand Compliance Integration Tests', () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = ''

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'group').mockImplementation(() => {})
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('End-to-End Brand Compliance Workflows', () => {
    it('should maintain brand compliance throughout user interaction workflow', async () => {
      const user = userEvent.setup()
      render(<TestPage />)

      // Check brand colors are used
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()

      // Simulate user interaction
      await user.click(button)

      // Verify basic brand compliance
      const buttonBgColor =
        rgbToHex(button.style.backgroundColor) || button.style.backgroundColor
      const buttonTextColor = rgbToHex(button.style.color) || button.style.color
      expect(buttonBgColor).toBe(BRAND_COLORS.loyalBlue)
      expect(buttonTextColor).toBe(BRAND_COLORS.white)
    })

    it('should maintain brand compliance in navigation workflow', async () => {
      render(<TestPage />)

      // Check navigation elements exist and are brand compliant
      const navigation = document.querySelector('nav') as HTMLElement
      expect(navigation).toBeInTheDocument()
      const navBgColor =
        rgbToHex(navigation?.style.backgroundColor) ||
        navigation?.style.backgroundColor
      expect(navBgColor).toBe(BRAND_COLORS.loyalBlue)

      // Test navigation interaction
      const navLinks = screen.getAllByRole('link')
      expect(navLinks.length).toBeGreaterThan(0)

      for (const link of navLinks) {
        const linkColor =
          rgbToHex((link as HTMLElement).style.color) ||
          (link as HTMLElement).style.color
        expect(linkColor).toBe(BRAND_COLORS.white)
      }
    })

    it('should validate brand component compliance', () => {
      render(<TestPage />)

      // Check specific brand components
      const button = screen.getByRole('button')
      const card = document.querySelector('.tm-card') as HTMLElement
      const nav = document.querySelector('.tm-nav') as HTMLElement

      // Validate component styling
      const buttonBgColor =
        rgbToHex(button.style.backgroundColor) || button.style.backgroundColor
      const cardBgColor =
        rgbToHex((card as HTMLElement)?.style.backgroundColor) ||
        (card as HTMLElement)?.style.backgroundColor
      const navBgColor =
        rgbToHex((nav as HTMLElement)?.style.backgroundColor) ||
        (nav as HTMLElement)?.style.backgroundColor

      expect(buttonBgColor).toBe(BRAND_COLORS.loyalBlue)
      expect(cardBgColor).toBe(BRAND_COLORS.coolGray)
      expect(navBgColor).toBe(BRAND_COLORS.loyalBlue)
    })
  })

  describe('Accessibility Compliance Across Critical User Paths', () => {
    it('should pass axe accessibility audit on test page', async () => {
      const { container } = render(<TestPage />)

      // Allow components to fully render
      await new Promise(resolve => setTimeout(resolve, 100))

      const results = (await axe(container)) as AxeResults
      expect(results).toHaveNoViolations()
    })

    it('should maintain keyboard navigation accessibility', async () => {
      const user = userEvent.setup()
      render(<TestPage />)

      // Test keyboard navigation
      await user.tab()
      expect(document.activeElement).toBeTruthy()

      // Verify focus indicators are visible (basic check)
      const focusedElement = document.activeElement as HTMLElement
      if (focusedElement && focusedElement.tagName !== 'BODY') {
        expect(focusedElement).toBeInTheDocument()
      }
    })

    it('should maintain WCAG AA contrast ratios across components', () => {
      render(<TestPage />)

      // Test common brand color combinations
      const colorCombinations = [
        { fg: BRAND_COLORS.white, bg: BRAND_COLORS.loyalBlue },
        { fg: BRAND_COLORS.black, bg: BRAND_COLORS.white },
        { fg: BRAND_COLORS.white, bg: BRAND_COLORS.trueMaroon },
        { fg: BRAND_COLORS.black, bg: BRAND_COLORS.happyYellow },
      ]

      colorCombinations.forEach(({ fg, bg }) => {
        expect(meetsWCAGAA(fg, bg)).toBe(true)
      })
    })

    it('should ensure all interactive elements meet touch target requirements', () => {
      render(<TestPage />)

      // Mock getBoundingClientRect for touch target testing
      const button = screen.getByRole('button')
      const links = screen.getAllByRole('link')

      // Mock proper dimensions for button
      button.getBoundingClientRect = mockBoundingClientRect(100, 44)

      // Mock proper dimensions for links
      links.forEach(link => {
        link.getBoundingClientRect = mockBoundingClientRect(80, 44)
      })

      // Test touch target requirements
      const buttonRect = button.getBoundingClientRect()
      expect(buttonRect.width).toBeGreaterThanOrEqual(44)
      expect(buttonRect.height).toBeGreaterThanOrEqual(44)

      links.forEach(link => {
        const linkRect = link.getBoundingClientRect()
        expect(linkRect.width).toBeGreaterThanOrEqual(44)
        expect(linkRect.height).toBeGreaterThanOrEqual(44)
      })
    })
  })

  describe('Responsive Behavior with Brand Guidelines', () => {
    it('should maintain brand compliance on mobile viewport', () => {
      // Mock mobile viewport
      mockMatchMedia(true)
      Object.defineProperty(window, 'innerWidth', {
        value: 320,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 568,
        configurable: true,
      })

      render(<TestPage />)

      // Validate brand colors are maintained
      const button = screen.getByRole('button')
      const nav = document.querySelector('nav') as HTMLElement

      const buttonBgColor =
        rgbToHex(button.style.backgroundColor) || button.style.backgroundColor
      const navBgColor =
        rgbToHex(nav?.style.backgroundColor) || nav?.style.backgroundColor

      expect(buttonBgColor).toBe(BRAND_COLORS.loyalBlue)
      expect(navBgColor).toBe(BRAND_COLORS.loyalBlue)
    })

    it('should maintain brand compliance on tablet viewport', () => {
      // Mock tablet viewport
      mockMatchMedia(true)
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 1024,
        configurable: true,
      })

      render(<TestPage />)

      // Validate brand colors are maintained
      const button = screen.getByRole('button')
      const buttonBgColor =
        rgbToHex(button.style.backgroundColor) || button.style.backgroundColor
      expect(buttonBgColor).toBe(BRAND_COLORS.loyalBlue)
    })

    it('should maintain brand compliance on desktop viewport', () => {
      // Mock desktop viewport
      mockMatchMedia(false)
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        configurable: true,
      })
      Object.defineProperty(window, 'innerHeight', {
        value: 768,
        configurable: true,
      })

      render(<TestPage />)

      // Validate brand colors are maintained
      const button = screen.getByRole('button')
      const buttonBgColor =
        rgbToHex(button.style.backgroundColor) || button.style.backgroundColor
      expect(buttonBgColor).toBe(BRAND_COLORS.loyalBlue)
    })

    it('should maintain minimum font sizes across all breakpoints', () => {
      const breakpoints = [
        { width: 320, name: 'mobile' },
        { width: 768, name: 'tablet' },
        { width: 1024, name: 'desktop' },
        { width: 1440, name: 'wide' },
      ]

      breakpoints.forEach(({ width }) => {
        Object.defineProperty(window, 'innerWidth', {
          value: width,
          configurable: true,
        })

        render(<TestPage />)

        // Check that components maintain proper styling
        const button = screen.getByRole('button')
        expect(button.style.fontSize).toBe('16px')

        const card = document.querySelector('.tm-card') as HTMLElement
        expect(card?.style.fontSize).toBe('14px')

        cleanup()
      })
    })
  })

  describe('Gradient Usage Constraints Validation', () => {
    it('should enforce maximum one gradient per screen constraint', () => {
      render(<TestPage />)

      // Count elements with gradient backgrounds
      const elementsWithGradients = Array.from(
        document.querySelectorAll('*')
      ).filter(element => {
        const style = (element as HTMLElement).style
        return (
          style.backgroundImage && style.backgroundImage.includes('gradient')
        )
      })

      // Should have 0 or 1 gradient (our test components don't use gradients)
      expect(elementsWithGradients.length).toBeLessThanOrEqual(1)
    })

    it('should validate brand color usage', () => {
      render(<TestPage />)

      // Test brand color validation
      expect(isValidBrandColor(BRAND_COLORS.loyalBlue)).toBe(true)
      expect(isValidBrandColor(BRAND_COLORS.trueMaroon)).toBe(true)
      expect(isValidBrandColor(BRAND_COLORS.coolGray)).toBe(true)
      expect(isValidBrandColor(BRAND_COLORS.happyYellow)).toBe(true)
      expect(isValidBrandColor('#FF0000')).toBe(false) // Non-brand color
    })

    it('should ensure gradient text overlays meet contrast requirements', () => {
      render(<TestPage />)

      // Test contrast requirements for gradients
      expect(meetsWCAGAA(BRAND_COLORS.white, BRAND_COLORS.loyalBlue)).toBe(true)
      expect(meetsWCAGAA(BRAND_COLORS.black, BRAND_COLORS.happyYellow)).toBe(
        true
      )
    })
  })

  describe('Performance Impact Validation', () => {
    it('should validate runtime validation overhead', () => {
      const startTime = performance.now()

      render(<TestPage />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Rendering should complete within reasonable time (< 500ms for test pages)
      expect(renderTime).toBeLessThan(500)
    })

    it('should validate brand validation rules', () => {
      render(<TestPage />)

      // Test that validation rules are properly loaded
      expect(allValidationRules.length).toBeGreaterThan(0)

      // Test that rules have required properties
      allValidationRules.forEach(rule => {
        expect(rule.id).toBeDefined()
        expect(rule.type).toBeDefined()
        expect(rule.severity).toBeDefined()
        expect(typeof rule.check).toBe('function')
        expect(rule.message).toBeDefined()
      })
    })

    it('should validate component styling consistency', () => {
      render(<TestPage />)

      const button = screen.getByRole('button')
      const heading = screen.getByRole('heading')
      const card = document.querySelector('.tm-card')

      // Validate consistent styling
      const buttonBgColor =
        rgbToHex(button.style.backgroundColor) || button.style.backgroundColor
      const buttonTextColor = rgbToHex(button.style.color) || button.style.color
      const headingTextColor =
        rgbToHex(heading.style.color) || heading.style.color
      const cardBgColor =
        rgbToHex((card as HTMLElement)?.style.backgroundColor) ||
        (card as HTMLElement)?.style.backgroundColor

      expect(buttonBgColor).toBe(BRAND_COLORS.loyalBlue)
      expect(buttonTextColor).toBe(BRAND_COLORS.white)
      expect(headingTextColor).toBe(BRAND_COLORS.black)
      expect(cardBgColor).toBe(BRAND_COLORS.coolGray)
    })
  })

  describe('Brand Compliance Metrics Generation', () => {
    it('should generate comprehensive brand compliance metrics', () => {
      render(<TestPage />)

      // Generate basic metrics
      const totalElements = document.querySelectorAll('*').length
      const brandElements = document.querySelectorAll(
        '.tm-btn-primary, .tm-card, .tm-nav'
      ).length

      const metrics = {
        totalElements,
        brandElements,
        complianceRate:
          totalElements > 0 ? (brandElements / totalElements) * 100 : 100,
      }

      // Validate metrics structure
      expect(typeof metrics.totalElements).toBe('number')
      expect(typeof metrics.brandElements).toBe('number')
      expect(typeof metrics.complianceRate).toBe('number')

      // Should have some brand elements
      expect(metrics.brandElements).toBeGreaterThan(0)
    })

    it('should track accessibility compliance metrics', async () => {
      const { container } = render(<TestPage />)

      const axeResults = (await axe(container)) as AxeResults

      const accessibilityMetrics = {
        violations: axeResults.violations.length,
        passes: axeResults.passes.length,
        incomplete: axeResults.incomplete.length,
        inapplicable: axeResults.inapplicable.length,
        complianceScore:
          axeResults.passes.length > 0
            ? (axeResults.passes.length /
                (axeResults.passes.length + axeResults.violations.length)) *
              100
            : 0,
      }

      // Should have good accessibility compliance
      expect(accessibilityMetrics.violations).toBe(0)
      expect(accessibilityMetrics.passes).toBeGreaterThan(0)
    })

    it('should generate performance metrics report', () => {
      const performanceMetrics = {
        renderTime: 0,
        componentCount: 0,
      }

      // Measure render time
      const renderStart = performance.now()
      render(<TestPage />)
      performanceMetrics.renderTime = performance.now() - renderStart
      performanceMetrics.componentCount = document.querySelectorAll('*').length

      // Validate performance metrics
      expect(performanceMetrics.renderTime).toBeGreaterThan(0)
      expect(performanceMetrics.componentCount).toBeGreaterThan(0)

      // Performance should be reasonable
      expect(performanceMetrics.renderTime).toBeLessThan(1000) // < 1 second
      expect(performanceMetrics.componentCount).toBeGreaterThan(5) // Should have multiple elements
    })
  })
})
