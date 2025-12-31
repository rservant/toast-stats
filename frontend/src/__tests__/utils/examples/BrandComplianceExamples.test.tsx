/**
 * Brand Compliance Testing Utilities - Usage Examples
 *
 * This file demonstrates how to use the shared brand compliance testing utilities
 * with real-world examples and best practices for Toastmasters brand guidelines.
 */

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { cleanupAllResources } from '../componentTestUtils'
import {
  runBrandComplianceTestSuite,
  expectBrandColors,
  expectBrandTypography,
  expectTouchTargets,
  expectGradientUsage,
  expectBrandSpacing,
  expectBrandAccessibility,
  expectToastmastersPatterns,
  runQuickBrandCheck,
} from '../brandComplianceTestUtils'

// Example components demonstrating proper Toastmasters brand compliance
const BrandCompliantButton: React.FC<{
  variant?: 'primary' | 'secondary'
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}> = ({ variant = 'primary', children, onClick, disabled }) => (
  <button
    className={`
      ${variant === 'primary' ? 'bg-tm-loyal-blue text-tm-white' : 'bg-transparent text-tm-loyal-blue border-2 border-tm-loyal-blue'}
      font-montserrat font-semibold
      px-6 py-3
      rounded-md
      min-h-[44px] min-w-[44px]
      focus:ring-2 focus:ring-blue-300
      disabled:opacity-50
    `}
    onClick={onClick}
    disabled={disabled}
    style={{
      minHeight: '44px',
      minWidth: '44px',
      fontFamily:
        'Montserrat, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
    }}
  >
    {children}
  </button>
)

const BrandCompliantCard: React.FC<{
  title: string
  content: string
  variant?: 'default' | 'highlighted'
}> = ({ title, content, variant = 'default' }) => (
  <div
    className={`
      ${variant === 'default' ? 'bg-tm-white' : 'bg-tm-cool-gray'}
      border border-tm-cool-gray
      rounded-lg
      p-6
      shadow-sm
    `}
    style={{ padding: '24px' }}
  >
    <h3
      className="text-xl font-montserrat font-bold text-tm-black mb-4"
      style={{
        fontFamily:
          'Montserrat, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        fontSize: '20px',
        marginBottom: '16px',
      }}
    >
      {title}
    </h3>
    <p
      className="text-tm-black font-source-sans"
      style={{
        fontFamily:
          'Source Sans 3, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        fontSize: '16px',
        lineHeight: '1.5',
      }}
    >
      {content}
    </p>
  </div>
)

const BrandCompliantNavigation: React.FC = () => (
  <nav
    className="bg-tm-loyal-blue text-tm-white p-4"
    role="navigation"
    aria-label="Main navigation"
  >
    <div className="flex space-x-6">
      <a
        href="/home"
        className="font-montserrat font-semibold text-tm-white hover:text-tm-happy-yellow px-4 py-2 rounded focus:ring-2 focus:ring-white"
        style={{
          minHeight: '44px',
          minWidth: '44px',
          display: 'inline-flex',
          alignItems: 'center',
          fontFamily:
            'Montserrat, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        }}
      >
        Home
      </a>
      <a
        href="/about"
        className="font-montserrat font-semibold text-tm-white hover:text-tm-happy-yellow px-4 py-2 rounded focus:ring-2 focus:ring-white"
        style={{
          minHeight: '44px',
          minWidth: '44px',
          display: 'inline-flex',
          alignItems: 'center',
          fontFamily:
            'Montserrat, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        }}
      >
        About
      </a>
      <a
        href="/contact"
        className="font-montserrat font-semibold text-tm-white hover:text-tm-happy-yellow px-4 py-2 rounded focus:ring-2 focus:ring-white"
        style={{
          minHeight: '44px',
          minWidth: '44px',
          display: 'inline-flex',
          alignItems: 'center',
          fontFamily:
            'Montserrat, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        }}
      >
        Contact
      </a>
    </div>
  </nav>
)

const BrandCompliantHeroSection: React.FC = () => (
  <section
    className="bg-gradient-to-r from-tm-loyal-blue to-blue-700 text-tm-white py-16 px-8"
    style={{
      background: 'linear-gradient(135deg, #004165 0%, #006094 100%)',
    }}
  >
    <div className="max-w-4xl mx-auto text-center">
      <h1
        className="text-4xl font-montserrat font-black mb-6"
        style={{
          fontFamily:
            'Montserrat, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
          fontSize: '36px',
          marginBottom: '24px',
        }}
      >
        Welcome to Toastmasters
      </h1>
      <p
        className="text-xl font-source-sans mb-8"
        style={{
          fontFamily:
            'Source Sans 3, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
          fontSize: '20px',
          marginBottom: '32px',
        }}
      >
        Develop your communication and leadership skills with confidence.
      </p>
      <BrandCompliantButton variant="secondary">
        Get Started Today
      </BrandCompliantButton>
    </div>
  </section>
)

const BrandCompliantTypography: React.FC = () => (
  <div className="space-y-6 p-8">
    <h1
      className="text-4xl font-montserrat font-black text-tm-black"
      style={{
        fontFamily:
          'Montserrat, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        fontSize: '36px',
      }}
    >
      Headline Level 1 - Montserrat Black
    </h1>
    <h2
      className="text-3xl font-montserrat font-bold text-tm-black"
      style={{
        fontFamily:
          'Montserrat, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        fontSize: '30px',
      }}
    >
      Headline Level 2 - Montserrat Bold
    </h2>
    <h3
      className="text-2xl font-montserrat font-semibold text-tm-black"
      style={{
        fontFamily:
          'Montserrat, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        fontSize: '24px',
      }}
    >
      Headline Level 3 - Montserrat Semibold
    </h3>
    <p
      className="text-lg font-source-sans text-tm-black"
      style={{
        fontFamily:
          'Source Sans 3, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        fontSize: '18px',
        lineHeight: '1.6',
      }}
    >
      Body text uses Source Sans 3 Regular with proper line height for
      readability. This ensures excellent readability while maintaining brand
      consistency.
    </p>
    <p
      className="text-base font-source-sans font-semibold text-tm-black"
      style={{
        fontFamily:
          'Source Sans 3, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        fontSize: '16px',
      }}
    >
      Body text can also use Source Sans 3 Semibold for emphasis.
    </p>
    <p
      className="text-sm font-source-sans text-tm-black"
      style={{
        fontFamily:
          'Source Sans 3, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        fontSize: '14px',
      }}
    >
      Small text maintains the 14px minimum size requirement for accessibility.
    </p>
  </div>
)

// Examples of brand violations for testing
const BrandViolationExamples = {
  // Non-brand colors
  CustomColorButton: () => (
    <button
      className="px-4 py-2 rounded"
      style={{ backgroundColor: '#ff6b6b', color: 'white' }}
    >
      Custom Color Button
    </button>
  ),

  // Small touch targets
  SmallButton: () => (
    <button
      className="bg-tm-loyal-blue text-tm-white px-2 py-1 text-xs rounded"
      style={{ minHeight: '20px', minWidth: '30px' }}
    >
      Too Small
    </button>
  ),

  // Wrong typography
  WrongFontButton: () => (
    <button
      className="bg-tm-loyal-blue text-tm-white px-4 py-2 rounded"
      style={{
        fontFamily: 'Comic Sans MS, cursive',
        minHeight: '44px',
        minWidth: '44px',
      }}
    >
      Wrong Font
    </button>
  ),

  // Multiple gradients
  MultipleGradients: () => (
    <div>
      <div
        className="p-4 mb-4"
        style={{
          background: 'linear-gradient(135deg, #004165 0%, #006094 100%)',
        }}
      >
        First Gradient
      </div>
      <div
        className="p-4"
        style={{
          background: 'linear-gradient(135deg, #772432 0%, #a03040 100%)',
        }}
      >
        Second Gradient (Violation!)
      </div>
    </div>
  ),

  // Text too small
  SmallText: () => (
    <p style={{ fontSize: '10px' }}>
      This text is too small (10px) - minimum is 14px
    </p>
  ),

  // Poor contrast
  PoorContrast: () => (
    <div className="bg-tm-cool-gray">
      <p style={{ color: '#b0b0b0' }}>Poor contrast text on gray background</p>
    </div>
  ),

  // Non-standard spacing
  BadSpacing: () => (
    <div className="p-7 m-9">
      Non-standard spacing (28px padding, 36px margin)
    </div>
  ),
}

describe('Brand Compliance Testing Utilities - Examples', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('runBrandComplianceTestSuite Examples', () => {
    it('should run comprehensive brand compliance tests on compliant button', () => {
      const report = runBrandComplianceTestSuite(
        <BrandCompliantButton>Brand Compliant Button</BrandCompliantButton>
      )

      expect(report.score).toBeGreaterThanOrEqual(80)
      expect(report.violations.length).toBe(0)
    })

    it('should run comprehensive brand compliance tests on compliant card', () => {
      const report = runBrandComplianceTestSuite(
        <BrandCompliantCard
          title="Brand Compliant Card"
          content="This card follows all Toastmasters brand guidelines."
        />
      )

      expect(report.score).toBeGreaterThanOrEqual(80)
    })

    it('should run comprehensive brand compliance tests on navigation', () => {
      const report = runBrandComplianceTestSuite(<BrandCompliantNavigation />)

      expect(report.score).toBeGreaterThanOrEqual(80)
      expect(report.violations.length).toBe(0)
    })

    it('should run comprehensive brand compliance tests on hero section', () => {
      const report = runBrandComplianceTestSuite(<BrandCompliantHeroSection />)

      expect(report.score).toBeGreaterThanOrEqual(80)
    })

    it('should run comprehensive brand compliance tests on typography', () => {
      const report = runBrandComplianceTestSuite(<BrandCompliantTypography />)

      expect(report.score).toBeGreaterThanOrEqual(80)
    })
  })

  describe('expectBrandColors Examples', () => {
    it('should validate proper Toastmasters brand colors', () => {
      const violations = expectBrandColors(
        <div>
          <div className="bg-tm-loyal-blue text-tm-white p-4">Loyal Blue</div>
          <div className="bg-tm-true-maroon text-tm-white p-4">True Maroon</div>
          <div className="bg-tm-cool-gray text-tm-black p-4">Cool Gray</div>
          <div className="bg-tm-happy-yellow text-tm-black p-4">
            Happy Yellow
          </div>
        </div>
      )

      expect(violations.length).toBe(0)
    })

    it('should detect non-brand colors', () => {
      const violations = expectBrandColors(
        <BrandViolationExamples.CustomColorButton />
      )

      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some(v => v.violation.includes('Non-brand'))).toBe(true)
    })

    it('should validate CSS custom properties usage', () => {
      const CustomPropertiesComponent = () => (
        <div
          style={{
            backgroundColor: 'var(--tm-loyal-blue)',
            color: 'var(--tm-white)',
          }}
        >
          Using CSS Custom Properties
        </div>
      )

      const violations = expectBrandColors(<CustomPropertiesComponent />)
      expect(violations.length).toBe(0)
    })

    it('should detect inline style color violations', () => {
      const InlineStyleViolation = () => (
        <div style={{ backgroundColor: '#ff0000', color: '#ffffff' }}>
          Red background (not brand color)
        </div>
      )

      const violations = expectBrandColors(<InlineStyleViolation />)
      expect(violations.some(v => v.violation.includes('inline style'))).toBe(
        true
      )
    })
  })

  describe('expectBrandTypography Examples', () => {
    it('should validate proper Toastmasters typography', () => {
      const violations = expectBrandTypography(<BrandCompliantTypography />)

      expect(violations.length).toBe(0)
    })

    it('should detect non-brand fonts', () => {
      const violations = expectBrandTypography(
        <BrandViolationExamples.WrongFontButton />
      )

      expect(violations.some(v => v.violation.includes('Non-brand font'))).toBe(
        true
      )
    })

    it('should detect text that is too small', () => {
      const violations = expectBrandTypography(
        <BrandViolationExamples.SmallText />
      )

      expect(violations.some(v => v.violation.includes('too small'))).toBe(true)
    })

    it('should validate minimum font sizes', () => {
      const ProperFontSizes = () => (
        <div>
          <p style={{ fontSize: '14px' }}>Minimum body text size (14px)</p>
          <p style={{ fontSize: '16px' }}>Standard body text size (16px)</p>
          <h3 style={{ fontSize: '20px' }}>Heading text (20px)</h3>
        </div>
      )

      const violations = expectBrandTypography(<ProperFontSizes />)
      expect(
        violations.filter(v => v.violation.includes('too small')).length
      ).toBe(0)
    })

    it('should detect text effects violations', () => {
      const TextEffectsViolation = () => (
        <h1 style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
          Text with shadow effect
        </h1>
      )

      const violations = expectBrandTypography(<TextEffectsViolation />)
      expect(violations.some(v => v.violation.includes('Text effects'))).toBe(
        true
      )
    })
  })

  describe('expectTouchTargets Examples', () => {
    it('should validate proper touch targets', () => {
      const violations = expectTouchTargets(
        <BrandCompliantButton>Proper Size</BrandCompliantButton>
      )

      expect(violations.length).toBe(0)
    })

    it('should detect touch targets that are too small', () => {
      const violations = expectTouchTargets(
        <BrandViolationExamples.SmallButton />
      )

      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some(v => v.violation.includes('too small'))).toBe(true)
    })

    it('should validate 44px minimum requirement', () => {
      const ProperTouchTargets = () => (
        <div>
          <button style={{ minHeight: '44px', minWidth: '44px' }}>
            44px Button
          </button>
          <a
            href="#"
            style={{
              minHeight: '48px',
              minWidth: '48px',
              display: 'inline-block',
            }}
          >
            48px Link
          </a>
          <input
            type="button"
            value="Input Button"
            style={{ minHeight: '50px', minWidth: '100px' }}
          />
        </div>
      )

      const violations = expectTouchTargets(<ProperTouchTargets />)
      expect(violations.length).toBe(0)
    })

    it('should check both width and height requirements', () => {
      const NarrowButton = () => (
        <button style={{ minHeight: '44px', minWidth: '20px' }}>
          Too Narrow
        </button>
      )

      const ShortButton = () => (
        <button style={{ minHeight: '20px', minWidth: '44px' }}>
          Too Short
        </button>
      )

      const narrowViolations = expectTouchTargets(<NarrowButton />)
      const shortViolations = expectTouchTargets(<ShortButton />)

      expect(narrowViolations.some(v => v.violation.includes('width'))).toBe(
        true
      )
      expect(shortViolations.some(v => v.violation.includes('height'))).toBe(
        true
      )
    })
  })

  describe('expectGradientUsage Examples', () => {
    it('should validate single gradient usage', () => {
      const SingleGradient = () => (
        <div
          className="p-8"
          style={{
            background: 'linear-gradient(135deg, #004165 0%, #006094 100%)',
          }}
        >
          Single TM Loyal Blue Gradient
        </div>
      )

      const violations = expectGradientUsage(<SingleGradient />)
      expect(violations.length).toBe(0)
    })

    it('should detect multiple gradients violation', () => {
      const violations = expectGradientUsage(
        <BrandViolationExamples.MultipleGradients />
      )

      expect(
        violations.some(v => v.violation.includes('Multiple gradients'))
      ).toBe(true)
    })

    it('should validate brand gradient colors', () => {
      const BrandGradients = () => (
        <div>
          <div
            className="p-4 mb-4"
            style={{
              background: 'linear-gradient(135deg, #004165 0%, #006094 100%)',
            }}
          >
            TM Loyal Blue Gradient
          </div>
        </div>
      )

      const violations = expectGradientUsage(<BrandGradients />)
      expect(
        violations.filter(v => v.violation.includes('non-brand colors')).length
      ).toBe(0)
    })

    it('should detect non-brand gradient colors', () => {
      const NonBrandGradient = () => (
        <div
          className="p-4"
          style={{
            background: 'linear-gradient(135deg, #ff0000 0%, #00ff00 100%)',
          }}
        >
          Non-brand gradient colors
        </div>
      )

      const violations = expectGradientUsage(<NonBrandGradient />)
      expect(
        violations.some(v => v.violation.includes('non-brand colors'))
      ).toBe(true)
    })
  })

  describe('expectBrandSpacing Examples', () => {
    it('should validate proper Toastmasters spacing scale', () => {
      const ProperSpacing = () => (
        <div className="p-4 m-6 space-y-4">
          <div className="p-2">4px increments</div>
          <div className="p-3">12px spacing</div>
          <div className="p-6">24px spacing</div>
          <div className="p-8">32px spacing</div>
        </div>
      )

      const violations = expectBrandSpacing(<ProperSpacing />)
      expect(violations.length).toBe(0)
    })

    it('should detect non-standard spacing values', () => {
      const violations = expectBrandSpacing(
        <BrandViolationExamples.BadSpacing />
      )

      expect(
        violations.some(v => v.violation.includes('Non-standard spacing'))
      ).toBe(true)
    })

    it('should validate 4px increment spacing scale', () => {
      const validSpacingValues = [
        0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64,
      ]

      validSpacingValues.forEach(value => {
        const ValidSpacing = () => (
          <div className={`p-${value}`}>Valid spacing: {value * 4}px</div>
        )

        const violations = expectBrandSpacing(<ValidSpacing />)
        expect(
          violations.filter(v => v.violation.includes(`p-${value}`)).length
        ).toBe(0)
      })
    })
  })

  describe('expectBrandAccessibility Examples', () => {
    it('should validate brand color accessibility', () => {
      const AccessibleBrandColors = () => (
        <div>
          <div className="bg-tm-loyal-blue text-tm-white p-4">
            White text on Loyal Blue (9.8:1 contrast)
          </div>
          <div className="bg-tm-true-maroon text-tm-white p-4">
            White text on True Maroon (8.2:1 contrast)
          </div>
          <div className="bg-tm-happy-yellow text-tm-black p-4">
            Black text on Happy Yellow (12.5:1 contrast)
          </div>
        </div>
      )

      const violations = expectBrandAccessibility(<AccessibleBrandColors />)
      expect(
        violations.filter(v => v.violation.includes('contrast')).length
      ).toBe(0)
    })

    it('should detect insufficient contrast with brand colors', () => {
      const PoorContrastWithBrandColors = () => (
        <div>
          <div className="bg-tm-loyal-blue text-tm-black p-4">
            Black text on Loyal Blue (poor contrast)
          </div>
          <div className="bg-tm-true-maroon text-tm-black p-4">
            Black text on True Maroon (poor contrast)
          </div>
        </div>
      )

      const violations = expectBrandAccessibility(
        <PoorContrastWithBrandColors />
      )
      expect(
        violations.some(v => v.violation.includes('Insufficient contrast'))
      ).toBe(true)
    })

    it('should validate proper image alt text', () => {
      const ImagesWithAltText = () => (
        <div>
          <img src="/logo.png" alt="Toastmasters International Logo" />
          <img
            src="/hero.jpg"
            alt="Group of people practicing public speaking"
          />
        </div>
      )

      const violations = expectBrandAccessibility(<ImagesWithAltText />)
      expect(
        violations.filter(v => v.violation.includes('alt text')).length
      ).toBe(0)
    })

    it('should detect missing image alt text', () => {
      const ImagesWithoutAltText = () => (
        <div>
          <img src="/logo.png" />
          <img src="/hero.jpg" />
        </div>
      )

      const violations = expectBrandAccessibility(<ImagesWithoutAltText />)
      expect(violations.some(v => v.violation.includes('alt text'))).toBe(true)
    })
  })

  describe('expectToastmastersPatterns Examples', () => {
    it('should validate proper Toastmasters button patterns', () => {
      const violations = expectToastmastersPatterns(
        <BrandCompliantButton>TM Button</BrandCompliantButton>
      )

      expect(
        violations.filter(v => v.violation.includes('Button missing')).length
      ).toBe(0)
    })

    it('should validate proper Toastmasters card patterns', () => {
      const violations = expectToastmastersPatterns(
        <BrandCompliantCard title="TM Card" content="Proper card styling" />
      )

      expect(
        violations.filter(v => v.violation.includes('Card/Panel missing'))
          .length
      ).toBe(0)
    })

    it('should detect buttons without proper styling', () => {
      const UnstyledButton = () => <button>Unstyled Button</button>

      const violations = expectToastmastersPatterns(<UnstyledButton />)
      expect(
        violations.some(v =>
          v.violation.includes('Button missing proper styling')
        )
      ).toBe(true)
    })

    it('should detect cards without proper styling', () => {
      const UnstyledCard = () => (
        <div className="card">
          <h3>Unstyled Card</h3>
          <p>No proper styling classes</p>
        </div>
      )

      const violations = expectToastmastersPatterns(<UnstyledCard />)
      expect(
        violations.some(v => v.violation.includes('Card/Panel missing'))
      ).toBe(true)
    })

    it('should validate proper button background colors', () => {
      const ProperButtonColors = () => (
        <div>
          <button className="bg-tm-loyal-blue text-tm-white px-4 py-2">
            Primary Button
          </button>
          <button className="bg-tm-true-maroon text-tm-white px-4 py-2">
            Secondary Button
          </button>
        </div>
      )

      const violations = expectToastmastersPatterns(<ProperButtonColors />)
      expect(
        violations.filter(v => v.violation.includes('non-brand background'))
          .length
      ).toBe(0)
    })
  })

  describe('runQuickBrandCheck Examples', () => {
    it('should perform quick brand check on compliant components', () => {
      const { passed, criticalViolations } = runQuickBrandCheck(
        <BrandCompliantButton>Quick Check Button</BrandCompliantButton>
      )

      expect(passed).toBe(true)
      expect(criticalViolations).toHaveLength(0)
    })

    it('should detect critical brand violations quickly', () => {
      const { passed, criticalViolations } = runQuickBrandCheck(
        <BrandViolationExamples.CustomColorButton />
      )

      expect(passed).toBe(false)
      expect(criticalViolations.length).toBeGreaterThan(0)
    })

    it('should be used for performance-sensitive scenarios', () => {
      const start = performance.now()

      const { passed } = runQuickBrandCheck(
        <BrandCompliantCard title="Test" content="Test" />
      )

      const end = performance.now()
      const executionTime = end - start

      expect(passed).toBe(true)
      expect(executionTime).toBeLessThan(100) // Should be fast
    })
  })

  describe('Real-world Integration Examples', () => {
    it('should integrate brand compliance testing with component variants', () => {
      const buttonVariants = [
        { variant: 'primary' as const, children: 'Primary' },
        { variant: 'secondary' as const, children: 'Secondary' },
      ]

      buttonVariants.forEach(({ variant, children }) => {
        const { passed } = runQuickBrandCheck(
          <BrandCompliantButton variant={variant}>
            {children}
          </BrandCompliantButton>
        )
        expect(passed).toBe(true)
      })
    })

    it('should demonstrate progressive brand compliance testing', () => {
      // Start with quick check
      const { passed, criticalViolations } = runQuickBrandCheck(
        <BrandCompliantNavigation />
      )

      if (!passed) {
        console.warn('Critical brand violations found:', criticalViolations)

        // Run full test suite for detailed analysis
        const report = runBrandComplianceTestSuite(<BrandCompliantNavigation />)
        console.log('Full brand compliance report:', report)
      } else {
        // Component passed quick check
        expect(passed).toBe(true)
      }
    })

    it('should demonstrate comprehensive brand testing workflow', () => {
      const component = <BrandCompliantHeroSection />

      // Step 1: Quick check for critical issues
      const { passed: quickPassed } = runQuickBrandCheck(component)
      expect(quickPassed).toBe(true)

      // Step 2: Full compliance test suite
      const report = runBrandComplianceTestSuite(component)
      expect(report.score).toBeGreaterThanOrEqual(80)

      // Step 3: Individual compliance checks for detailed analysis
      const colorViolations = expectBrandColors(component)
      const typographyViolations = expectBrandTypography(component)
      const touchTargetViolations = expectTouchTargets(component)
      const gradientViolations = expectGradientUsage(component)

      expect(colorViolations.length).toBe(0)
      expect(typographyViolations.length).toBe(0)
      expect(touchTargetViolations.length).toBe(0)
      expect(gradientViolations.length).toBe(0)
    })
  })

  describe('Debugging and Troubleshooting Examples', () => {
    it('should demonstrate how to debug brand violations', () => {
      const violations = expectBrandColors(
        <BrandViolationExamples.CustomColorButton />
      )

      // Log violations for debugging
      violations.forEach(violation => {
        console.log(`Violation: ${violation.violation}`)
        console.log(`Remediation: ${violation.remediation}`)
        console.log(`Severity: ${violation.severity}`)
        console.log(`Type: ${violation.type}`)
        console.log('---')
      })

      expect(violations.length).toBeGreaterThan(0)
    })

    it('should demonstrate how to test specific brand features', () => {
      // Test only colors
      const colorViolations = expectBrandColors(
        <BrandCompliantButton>Test</BrandCompliantButton>
      )
      expect(colorViolations.length).toBe(0)

      // Test only typography
      const typographyViolations = expectBrandTypography(
        <BrandCompliantTypography />
      )
      expect(typographyViolations.length).toBe(0)

      // Test only touch targets
      const touchTargetViolations = expectTouchTargets(
        <BrandCompliantButton>Test</BrandCompliantButton>
      )
      expect(touchTargetViolations.length).toBe(0)

      // Test only gradients
      const gradientViolations = expectGradientUsage(
        <BrandCompliantHeroSection />
      )
      expect(gradientViolations.length).toBe(0)
    })

    it('should demonstrate brand compliance report analysis', () => {
      const report = runBrandComplianceTestSuite(
        <BrandCompliantCard title="Test" content="Test" />
      )

      console.log('Brand Compliance Report:')
      console.log(`Score: ${report.score}%`)
      console.log(`Passed: ${report.passed} tests`)
      console.log(`Failed: ${report.failed} tests`)
      console.log(`Violations: ${report.violations.length}`)
      console.log('Top Recommendations:')
      report.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`)
      })

      expect(report.score).toBeGreaterThanOrEqual(80)
    })
  })

  describe('Advanced Brand Compliance Examples', () => {
    it('should test complex layouts with multiple brand elements', () => {
      const ComplexLayout = () => (
        <div>
          <BrandCompliantNavigation />
          <BrandCompliantHeroSection />
          <div className="p-8 space-y-6">
            <BrandCompliantCard title="Card 1" content="First card content" />
            <BrandCompliantCard
              title="Card 2"
              content="Second card content"
              variant="highlighted"
            />
            <BrandCompliantTypography />
          </div>
        </div>
      )

      const report = runBrandComplianceTestSuite(<ComplexLayout />)
      expect(report.score).toBeGreaterThanOrEqual(80)
    })

    it('should validate brand compliance across different component states', () => {
      const states = [
        { disabled: false, variant: 'primary' as const },
        { disabled: true, variant: 'primary' as const },
        { disabled: false, variant: 'secondary' as const },
        { disabled: true, variant: 'secondary' as const },
      ]

      states.forEach(({ disabled, variant }) => {
        const { passed } = runQuickBrandCheck(
          <BrandCompliantButton variant={variant} disabled={disabled}>
            {variant} {disabled ? 'Disabled' : 'Enabled'}
          </BrandCompliantButton>
        )
        expect(passed).toBe(true)
      })
    })

    it('should test brand compliance with dynamic content', () => {
      const DynamicContent = ({ theme }: { theme: 'light' | 'dark' }) => (
        <div className={theme === 'light' ? 'bg-tm-white' : 'bg-tm-loyal-blue'}>
          <BrandCompliantCard
            title={`${theme} Theme Card`}
            content={`This card adapts to ${theme} theme while maintaining brand compliance.`}
          />
        </div>
      )

      const lightReport = runBrandComplianceTestSuite(
        <DynamicContent theme="light" />
      )
      const darkReport = runBrandComplianceTestSuite(
        <DynamicContent theme="dark" />
      )

      expect(lightReport.score).toBeGreaterThanOrEqual(80)
      expect(darkReport.score).toBeGreaterThanOrEqual(80)
    })
  })
})

// Export example components for use in other test files
export {
  BrandCompliantButton,
  BrandCompliantCard,
  BrandCompliantNavigation,
  BrandCompliantHeroSection,
  BrandCompliantTypography,
  BrandViolationExamples,
}
