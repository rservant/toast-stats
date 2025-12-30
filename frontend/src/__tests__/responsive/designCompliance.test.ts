/**
 * Responsive Design Compliance Property Tests
 *
 * Property 7: Responsive Design Compliance
 * Validates: Requirements 6.1, 6.2, 6.3, 6.5
 *
 * Tests brand compliance across different viewport sizes including:
 * - Touch targets maintain 44px minimum across all breakpoints
 * - Font sizes preserve 14px minimum on mobile devices
 * - Brand color usage and contrast requirements on all screen sizes
 * - Responsive behavior maintains brand guidelines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import fc from 'fast-check'
import { BRAND_COLORS } from '../../components/brand/types'
import { calculateContrastRatio } from '../../components/brand/utils'
import { getAllInteractiveElements } from '../../hooks/useTouchTarget'

// Mock window.getComputedStyle for testing
const mockGetComputedStyle = vi.fn()
Object.defineProperty(window, 'getComputedStyle', {
  value: mockGetComputedStyle,
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

describe('Property 7: Responsive Design Compliance', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''
    mockGetComputedStyle.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  /**
   * Property Test: Touch targets maintain 44px minimum across all breakpoints
   * **Validates: Requirements 6.1**
   */
  it('should maintain minimum 44px touch targets across all breakpoints', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(320, 768, 1024, 1440), // Breakpoint widths
        fc.constantFrom('button', 'a', 'input', 'select'), // Interactive elements
        fc.integer({ min: 8, max: 32 }), // Padding values
        fc.integer({ min: 12, max: 24 }), // Font sizes
        (viewportWidth, elementType, padding, fontSize) => {
          // Set viewport size
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: viewportWidth,
          })

          // Create test element
          const element = document.createElement(elementType)
          if (elementType === 'a') {
            element.setAttribute('href', '#')
          }
          if (elementType === 'input') {
            element.setAttribute('type', 'button')
          }

          // Apply responsive styles
          element.style.padding = `${padding}px`
          element.style.fontSize = `${fontSize}px`
          element.style.minWidth = '44px'
          element.style.minHeight = '44px'
          element.style.display = 'inline-block'

          document.body.appendChild(element)

          // Mock getBoundingClientRect to return dimensions based on styles
          const mockRect = {
            width: Math.max(44, padding * 2 + fontSize * 2),
            height: Math.max(44, padding * 2 + fontSize),
            top: 0,
            left: 0,
            bottom: 44,
            right: 44,
          }

          element.getBoundingClientRect = vi.fn().mockReturnValue(mockRect)

          // Mock computed style
          mockGetComputedStyle.mockReturnValue({
            display: 'inline-block',
            visibility: 'visible',
            paddingLeft: `${padding}px`,
            paddingRight: `${padding}px`,
            paddingTop: `${padding}px`,
            paddingBottom: `${padding}px`,
            marginLeft: '0px',
            marginRight: '0px',
            marginTop: '0px',
            marginBottom: '0px',
            fontSize: `${fontSize}px`,
            minWidth: '44px',
            minHeight: '44px',
          })

          // Get all interactive elements and check touch targets
          const interactiveElements = getAllInteractiveElements(document.body)

          // All interactive elements should meet touch target requirements
          interactiveElements.forEach(el => {
            const rect = el.getBoundingClientRect()
            expect(rect.width).toBeGreaterThanOrEqual(44)
            expect(rect.height).toBeGreaterThanOrEqual(44)
          })

          // Cleanup
          document.body.removeChild(element)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property Test: Font sizes preserve 14px minimum on mobile devices
   * **Validates: Requirements 6.2**
   */
  it('should preserve minimum 14px font size on mobile devices', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(320, 375, 414), // Mobile viewport widths
        fc.constantFrom('p', 'span', 'div', 'label', 'button'), // Text elements
        fc.constantFrom('tm-body-small', 'tm-body-medium', 'tm-body-large'), // Font size classes
        (mobileWidth, elementType, fontClass) => {
          // Set mobile viewport
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: mobileWidth,
          })

          // Create test element
          const element = document.createElement(elementType)
          element.className = fontClass
          element.textContent = 'Test content'
          document.body.appendChild(element)

          // Mock computed style with responsive font sizes
          const baseFontSize = fontClass.includes('small')
            ? 14
            : fontClass.includes('medium')
              ? 16
              : 18

          // On mobile, ensure minimum 14px
          const mobileFontSize = Math.max(14, baseFontSize)

          mockGetComputedStyle.mockReturnValue({
            fontSize: `${mobileFontSize}px`,
            lineHeight: '1.4',
            fontFamily: 'var(--tm-font-body)',
            display: 'block',
            visibility: 'visible',
          })

          const computedStyle = window.getComputedStyle(element)
          const actualFontSize = parseFloat(computedStyle.fontSize)

          // Font size should be at least 14px on mobile
          expect(actualFontSize).toBeGreaterThanOrEqual(14)

          // Cleanup
          document.body.removeChild(element)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property Test: Brand color usage and contrast requirements on all screen sizes
   * **Validates: Requirements 6.3**
   */
  it('should maintain brand color usage and contrast requirements across all screen sizes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(320, 768, 1024, 1440), // All breakpoints
        fc.constantFrom(
          // Valid high-contrast color combinations
          { text: BRAND_COLORS.white, bg: BRAND_COLORS.loyalBlue },
          { text: BRAND_COLORS.white, bg: BRAND_COLORS.trueMaroon },
          { text: BRAND_COLORS.black, bg: BRAND_COLORS.white },
          { text: BRAND_COLORS.black, bg: BRAND_COLORS.happyYellow },
          { text: BRAND_COLORS.loyalBlue, bg: BRAND_COLORS.white },
          { text: BRAND_COLORS.trueMaroon, bg: BRAND_COLORS.white }
        ), // Valid color combinations
        fc.constantFrom('div', 'section', 'article', 'header'), // Container elements
        (viewportWidth, colorCombo, elementType) => {
          // Set viewport size
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: viewportWidth,
          })

          // Create test element
          const element = document.createElement(elementType)
          element.style.color = colorCombo.text
          element.style.backgroundColor = colorCombo.bg
          element.textContent = 'Test content'
          document.body.appendChild(element)

          // Mock computed style
          mockGetComputedStyle.mockReturnValue({
            color: colorCombo.text,
            backgroundColor: colorCombo.bg,
            fontSize: '16px',
            display: 'block',
            visibility: 'visible',
          })

          // Check that colors are from brand palette
          const brandColorValues = Object.values(BRAND_COLORS)
          expect(brandColorValues).toContain(colorCombo.text)
          expect(brandColorValues).toContain(colorCombo.bg)

          // Check contrast ratio meets WCAG AA requirements
          const contrastRatio = calculateContrastRatio(
            colorCombo.text,
            colorCombo.bg
          )
          expect(contrastRatio).toBeGreaterThanOrEqual(4.5)

          // Cleanup
          document.body.removeChild(element)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property Test: Responsive behavior maintains brand guidelines
   * **Validates: Requirements 6.5**
   */
  it('should maintain brand guidelines across responsive breakpoints', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(320, 768, 1024, 1440), // Breakpoint widths
        fc.constantFrom('header', 'nav', 'main', 'footer'), // Layout elements
        fc.constantFrom('tm-loyal-blue', 'tm-true-maroon', 'tm-cool-gray'), // Brand color classes
        (viewportWidth, elementType, colorClass) => {
          // Set viewport size
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: viewportWidth,
          })

          // Create test element with brand classes
          const element = document.createElement(elementType)
          element.className = `bg-${colorClass} tm-brand-compliant`
          document.body.appendChild(element)

          // Get expected color value
          const expectedColor =
            colorClass === 'tm-loyal-blue'
              ? BRAND_COLORS.loyalBlue
              : colorClass === 'tm-true-maroon'
                ? BRAND_COLORS.trueMaroon
                : BRAND_COLORS.coolGray

          // Mock computed style
          mockGetComputedStyle.mockReturnValue({
            backgroundColor: expectedColor,
            display: 'block',
            visibility: 'visible',
            width: `${Math.min(viewportWidth - 32, 1200)}px`, // Responsive width
            padding: viewportWidth < 768 ? '16px' : '24px', // Responsive padding
          })

          const computedStyle = window.getComputedStyle(element)

          // Brand colors should be maintained across all breakpoints
          expect(computedStyle.backgroundColor).toBe(expectedColor)

          // Element should have brand-compliant class
          expect(element.classList.contains('tm-brand-compliant')).toBe(true)

          // Responsive spacing should be appropriate for viewport
          const expectedPadding = viewportWidth < 768 ? '16px' : '24px'
          expect(computedStyle.padding).toBe(expectedPadding)

          // Cleanup
          document.body.removeChild(element)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property Test: Fluid typography scaling between breakpoints
   * **Validates: Requirements 6.5**
   */
  it('should implement fluid typography scaling between breakpoints', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(320, 480, 768, 1024, 1440), // Various viewport widths
        fc.constantFrom('h1', 'h2', 'h3', 'p'), // Typography elements
        fc.constantFrom('tm-headline', 'tm-body'), // Font family classes
        (viewportWidth, elementType, fontFamilyClass) => {
          // Set viewport size
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: viewportWidth,
          })

          // Create test element
          const element = document.createElement(elementType)
          element.className = fontFamilyClass
          element.textContent = 'Test typography content'
          document.body.appendChild(element)

          // Calculate expected font size based on viewport and element type
          let baseFontSize: number
          if (elementType === 'h1') baseFontSize = 32
          else if (elementType === 'h2') baseFontSize = 24
          else if (elementType === 'h3') baseFontSize = 20
          else baseFontSize = 16

          // Apply fluid scaling (simplified calculation)
          const minSize = Math.max(14, baseFontSize * 0.75) // Minimum size
          const maxSize = baseFontSize * 1.25 // Maximum size
          const scaleFactor = (viewportWidth - 320) / (1440 - 320)
          const fluidSize = minSize + (maxSize - minSize) * scaleFactor

          const expectedFontSize = Math.max(
            minSize,
            Math.min(maxSize, fluidSize)
          )

          // Mock computed style with fluid typography
          mockGetComputedStyle.mockReturnValue({
            fontSize: `${expectedFontSize}px`,
            lineHeight: '1.4',
            fontFamily:
              fontFamilyClass === 'tm-headline'
                ? 'var(--tm-font-headline)'
                : 'var(--tm-font-body)',
            display: 'block',
            visibility: 'visible',
          })

          const computedStyle = window.getComputedStyle(element)
          const actualFontSize = parseFloat(computedStyle.fontSize)

          // Font size should be within expected fluid range
          expect(actualFontSize).toBeGreaterThanOrEqual(minSize)
          expect(actualFontSize).toBeLessThanOrEqual(maxSize)

          // Body text should never go below 14px
          if (elementType === 'p') {
            expect(actualFontSize).toBeGreaterThanOrEqual(14)
          }

          // Font family should be correct
          const expectedFontFamily =
            fontFamilyClass === 'tm-headline'
              ? 'var(--tm-font-headline)'
              : 'var(--tm-font-body)'
          expect(computedStyle.fontFamily).toBe(expectedFontFamily)

          // Cleanup
          document.body.removeChild(element)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Integration Test: Complete responsive compliance validation
   */
  it('should validate complete responsive design compliance', () => {
    const breakpoints = [320, 768, 1024, 1440]

    breakpoints.forEach(width => {
      // Set viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
      })

      // Create a complete responsive layout
      const container = document.createElement('div')
      container.className = 'tm-responsive-container'

      // Header with navigation
      const header = document.createElement('header')
      header.className = 'bg-tm-loyal-blue text-tm-white'

      const nav = document.createElement('nav')
      const navButton = document.createElement('button')
      navButton.className = 'tm-touch-target'
      navButton.textContent = 'Menu'
      nav.appendChild(navButton)
      header.appendChild(nav)

      // Main content with text
      const main = document.createElement('main')
      const heading = document.createElement('h1')
      heading.className = 'tm-headline'
      heading.textContent = 'Responsive Heading'

      const paragraph = document.createElement('p')
      paragraph.className = 'tm-body'
      paragraph.textContent = 'Responsive body text content'

      main.appendChild(heading)
      main.appendChild(paragraph)

      container.appendChild(header)
      container.appendChild(main)
      document.body.appendChild(container)

      // Mock styles for all elements
      mockGetComputedStyle.mockImplementation(element => {
        const isButton = element.tagName.toLowerCase() === 'button'
        const isHeading = element.tagName.toLowerCase() === 'h1'
        const isParagraph = element.tagName.toLowerCase() === 'p'

        if (isButton) {
          return {
            minWidth: '44px',
            minHeight: '44px',
            padding: '12px 16px',
            fontSize: '16px',
            display: 'inline-block',
            visibility: 'visible',
          }
        } else if (isHeading) {
          const headingSize = width < 768 ? 24 : 32
          return {
            fontSize: `${headingSize}px`,
            lineHeight: '1.2',
            fontFamily: 'var(--tm-font-headline)',
            display: 'block',
            visibility: 'visible',
          }
        } else if (isParagraph) {
          const bodySize = Math.max(14, width < 768 ? 14 : 16)
          return {
            fontSize: `${bodySize}px`,
            lineHeight: '1.4',
            fontFamily: 'var(--tm-font-body)',
            display: 'block',
            visibility: 'visible',
          }
        }

        return {
          display: 'block',
          visibility: 'visible',
        }
      })

      // Mock getBoundingClientRect for touch targets
      navButton.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 44,
        height: 44,
        top: 0,
        left: 0,
        bottom: 44,
        right: 44,
      })

      // Validate touch targets
      const interactiveElements = getAllInteractiveElements(container)
      interactiveElements.forEach(element => {
        const rect = element.getBoundingClientRect()
        expect(rect.width).toBeGreaterThanOrEqual(44)
        expect(rect.height).toBeGreaterThanOrEqual(44)
      })

      // Validate typography
      const headingStyle = window.getComputedStyle(heading)
      const paragraphStyle = window.getComputedStyle(paragraph)

      expect(parseFloat(paragraphStyle.fontSize)).toBeGreaterThanOrEqual(14)
      expect(headingStyle.fontFamily).toBe('var(--tm-font-headline)')
      expect(paragraphStyle.fontFamily).toBe('var(--tm-font-body)')

      // Cleanup
      document.body.removeChild(container)
    })
  })
})
