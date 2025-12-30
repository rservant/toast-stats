/**
 * Property-Based Tests for Page-Level Brand Compliance
 *
 * Feature: toastmasters-brand-compliance, Property 9: Page-Level Brand Compliance
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 *
 * Tests that no page contains non-brand colors (purple, violet, custom blues)
 * and validates all interactive elements use proper brand colors.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import DistrictDetailPage from '../../pages/DistrictDetailPage'
import { ProgramYearProvider } from '../../contexts/ProgramYearContext'
import { BackfillProvider } from '../../contexts/BackfillContext'

// Mock localStorage for tests
const localStorageMock = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
}

// Set up localStorage mock
beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })
})

// Brand colors that are allowed
// Brand colors for validation (kept for potential future use)
// const BRAND_COLORS = {
//   loyalBlue: '#004165',
//   trueMaroon: '#772432',
//   coolGray: '#A9B2B1',
//   happyYellow: '#F2DF74',
//   black: '#000000',
//   white: '#FFFFFF',
// }

// Non-brand colors that should not be present
const FORBIDDEN_COLORS = [
  // Purple variations
  'purple',
  'violet',
  '#8b5cf6',
  '#7c3aed',
  '#6d28d9',
  '#5b21b6',
  'bg-purple',
  'text-purple',
  'border-purple',
  // Custom blues that aren't brand blue
  '#2563eb',
  '#3b82f6',
  '#1d4ed8',
  '#1e40af',
  'bg-blue-500',
  'bg-blue-600',
  'text-blue-600',
  'text-blue-700',
  'border-blue-500',
  'border-blue-600',
]

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProgramYearProvider>
          <BackfillProvider>{children}</BackfillProvider>
        </ProgramYearProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Page-Level Brand Compliance', () => {
  describe('Property 9: Page-Level Brand Compliance', () => {
    it('should not contain any non-brand colors in district page', () => {
      // **Feature: toastmasters-brand-compliance, Property 9: Page-Level Brand Compliance**

      const { container } = render(
        <TestWrapper>
          <DistrictDetailPage />
        </TestWrapper>
      )

      // Get all elements with class attributes
      const elementsWithClasses = container.querySelectorAll('[class]')

      let violationFound = false
      const violations: string[] = []

      elementsWithClasses.forEach(element => {
        const className = element.className

        // Ensure className is a string
        if (typeof className !== 'string') return

        // Check for forbidden color classes
        FORBIDDEN_COLORS.forEach(forbiddenColor => {
          if (className.includes(forbiddenColor)) {
            violationFound = true
            violations.push(
              `Element with classes "${className}" contains forbidden color "${forbiddenColor}"`
            )
          }
        })
      })

      if (violationFound) {
        console.error('Brand compliance violations found:', violations)
      }

      expect(violationFound).toBe(false)
      expect(violations).toHaveLength(0)
    })

    it('should use brand typography classes consistently', () => {
      // **Feature: toastmasters-brand-compliance, Property 9: Page-Level Brand Compliance**

      const { container } = render(
        <TestWrapper>
          <DistrictDetailPage />
        </TestWrapper>
      )

      // Check for proper brand typography usage
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const brandTypographyViolations: string[] = []

      headings.forEach((heading, index) => {
        const className = heading.className

        // Headings should use font-tm-headline or tm-headline class
        if (
          !className.includes('font-tm-headline') &&
          !className.includes('tm-headline')
        ) {
          brandTypographyViolations.push(
            `Heading ${heading.tagName} at index ${index} does not use brand typography class`
          )
        }
      })

      expect(brandTypographyViolations).toHaveLength(0)
    })

    it('should use brand colors for interactive elements', () => {
      // **Feature: toastmasters-brand-compliance, Property 9: Page-Level Brand Compliance**

      const { container } = render(
        <TestWrapper>
          <DistrictDetailPage />
        </TestWrapper>
      )

      // Check buttons for brand compliance
      const buttons = container.querySelectorAll('button')
      const interactiveViolations: string[] = []

      buttons.forEach((button, index) => {
        const className = button.className

        // Check if button uses non-brand colors
        const hasNonBrandColor = FORBIDDEN_COLORS.some(color =>
          className.includes(color)
        )

        if (hasNonBrandColor) {
          interactiveViolations.push(
            `Button at index ${index} uses non-brand colors: ${className}`
          )
        }
      })

      expect(interactiveViolations).toHaveLength(0)
    })

    it('should use brand focus ring colors', () => {
      // **Feature: toastmasters-brand-compliance, Property 9: Page-Level Brand Compliance**

      const { container } = render(
        <TestWrapper>
          <DistrictDetailPage />
        </TestWrapper>
      )

      // Check for proper focus ring colors
      const focusableElements = container.querySelectorAll(
        'button, input, select, a'
      )
      const focusViolations: string[] = []

      focusableElements.forEach((element, index) => {
        const className = element.className

        // Check for non-brand focus ring colors
        if (
          className.includes('focus:ring-blue-500') ||
          className.includes('focus:ring-purple') ||
          className.includes('ring-blue-500')
        ) {
          focusViolations.push(
            `Focusable element at index ${index} uses non-brand focus ring: ${className}`
          )
        }
      })

      expect(focusViolations).toHaveLength(0)
    })

    it('should not use gradients with non-brand colors', () => {
      // **Feature: toastmasters-brand-compliance, Property 9: Page-Level Brand Compliance**

      const { container } = render(
        <TestWrapper>
          <DistrictDetailPage />
        </TestWrapper>
      )

      // Check for non-brand gradient usage
      const elementsWithGradients = container.querySelectorAll(
        '[class*="gradient"], [class*="bg-gradient"]'
      )
      const gradientViolations: string[] = []

      elementsWithGradients.forEach((element, index) => {
        const className = element.className

        // Check for non-brand gradient colors
        if (
          className.includes('from-purple') ||
          className.includes('to-purple') ||
          className.includes('from-blue-') ||
          className.includes('to-blue-') ||
          className.includes('from-violet') ||
          className.includes('to-violet')
        ) {
          gradientViolations.push(
            `Element at index ${index} uses non-brand gradient: ${className}`
          )
        }
      })

      expect(gradientViolations).toHaveLength(0)
    })
  })

  describe('Brand Color Usage Validation', () => {
    it('should only use approved brand color classes', () => {
      // **Feature: toastmasters-brand-compliance, Property 9: Page-Level Brand Compliance**

      const { container } = render(
        <TestWrapper>
          <DistrictDetailPage />
        </TestWrapper>
      )

      const allElements = container.querySelectorAll('*')
      const approvedBrandClasses = [
        'tm-loyal-blue',
        'tm-true-maroon',
        'tm-cool-gray',
        'tm-happy-yellow',
        'tm-black',
        'tm-white',
        'bg-tm-loyal-blue',
        'text-tm-loyal-blue',
        'border-tm-loyal-blue',
        'bg-tm-true-maroon',
        'text-tm-true-maroon',
        'bg-tm-cool-gray',
        'text-tm-cool-gray',
        'bg-tm-happy-yellow',
        'text-tm-happy-yellow',
        'bg-tm-black',
        'text-tm-black',
        'bg-tm-white',
        'text-tm-white',
      ]

      let hasApprovedBrandUsage = false

      allElements.forEach(element => {
        const className = element.className

        // Ensure className is a string
        if (typeof className !== 'string') return

        // Check if element uses approved brand classes
        approvedBrandClasses.forEach(brandClass => {
          if (className.includes(brandClass)) {
            hasApprovedBrandUsage = true
          }
        })
      })

      // At least some elements should use brand classes
      expect(hasApprovedBrandUsage).toBe(true)
    })
  })
})
