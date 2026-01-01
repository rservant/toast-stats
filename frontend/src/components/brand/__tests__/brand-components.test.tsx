/**
 * Basic tests for brand component library foundation
 *
 * These tests verify that the brand components can be imported and instantiated correctly.
 * Migrated to use shared test utilities for consistency and reduced redundancy.
 */

import { describe, it, expect } from 'vitest'
import React from 'react'
import {
  testComponentVariants,
  runQuickAccessibilityCheck,
} from '../../../__tests__/utils'
import {
  ThemeProvider,
  AccessibilityChecker,
  BRAND_COLORS,
  BRAND_GRADIENTS,
  TYPOGRAPHY_STACKS,
  BREAKPOINTS,
  calculateContrastRatio,
  validateContrast,
  isBrandColor,
} from '../index'

describe('Brand Component Library Foundation', () => {
  describe('Component Imports', () => {
    it('should import ThemeProvider component', () => {
      expect(ThemeProvider).toBeDefined()
      expect(typeof ThemeProvider).toBe('function')
    })

    it('should import AccessibilityChecker component', () => {
      expect(AccessibilityChecker).toBeDefined()
      expect(typeof AccessibilityChecker).toBe('function')
    })
  })

  describe('Brand Constants', () => {
    it('should export brand colors', () => {
      expect(BRAND_COLORS).toBeDefined()
      expect(BRAND_COLORS.loyalBlue).toBe('#004165')
      expect(BRAND_COLORS.trueMaroon).toBe('#772432')
      expect(BRAND_COLORS.coolGray).toBe('#A9B2B1')
      expect(BRAND_COLORS.happyYellow).toBe('#F2DF74')
      expect(BRAND_COLORS.black).toBe('#000000')
      expect(BRAND_COLORS.white).toBe('#FFFFFF')
    })

    it('should export brand gradients', () => {
      expect(BRAND_GRADIENTS).toBeDefined()
      expect(BRAND_GRADIENTS.loyalBlue).toContain('#004165')
      expect(BRAND_GRADIENTS.trueMaroon).toContain('#3B0104')
      expect(BRAND_GRADIENTS.coolGray).toContain('#A9B2B1')
    })

    it('should export typography stacks', () => {
      expect(TYPOGRAPHY_STACKS).toBeDefined()
      expect(TYPOGRAPHY_STACKS.headline).toContain('Montserrat')
      expect(TYPOGRAPHY_STACKS.body).toContain('Source Sans 3')
    })

    it('should export breakpoints', () => {
      expect(BREAKPOINTS).toBeDefined()
      expect(BREAKPOINTS.mobile).toBe('320px')
      expect(BREAKPOINTS.tablet).toBe('768px')
      expect(BREAKPOINTS.desktop).toBe('1024px')
      expect(BREAKPOINTS.wide).toBe('1440px')
    })
  })

  describe('Utility Functions', () => {
    it('should calculate contrast ratios correctly', () => {
      const ratio = calculateContrastRatio('#000000', '#FFFFFF')
      expect(ratio).toBe(21) // Perfect contrast
    })

    it('should validate contrast correctly', () => {
      const result = validateContrast('#000000', '#FFFFFF')
      expect(result.passes).toBe(true)
      expect(result.level).toBe('AAA')
    })

    it('should identify brand colors correctly', () => {
      expect(isBrandColor('#004165')).toBe(true)
      expect(isBrandColor('#FF0000')).toBe(false)
    })
  })

  describe('Component Rendering', () => {
    // Migrate to shared utilities for consistent testing patterns
    const testContent = <div>Test Content</div>

    testComponentVariants(
      ThemeProvider as unknown as React.ComponentType<Record<string, unknown>>,
      [
        {
          name: 'with children',
          props: { children: testContent },
          expectedText: 'Test Content',
        },
      ]
    )

    testComponentVariants(
      AccessibilityChecker as unknown as React.ComponentType<
        Record<string, unknown>
      >,
      [
        {
          name: 'with children in ThemeProvider',
          props: { children: testContent },
          expectedText: 'Test Content',
          customAssertion: container => {
            // Ensure AccessibilityChecker is properly wrapped
            expect(container.querySelector('div')).toBeInTheDocument()
          },
        },
      ],
      {
        customProviders: [ThemeProvider],
      }
    )

    // Add comprehensive compliance testing for brand components
    it('should meet accessibility standards', () => {
      const component = (
        <ThemeProvider>
          <AccessibilityChecker>
            <div>Accessibility Test Content</div>
          </AccessibilityChecker>
        </ThemeProvider>
      )

      // Use quick accessibility check instead of full suite to avoid nested describe blocks
      const { passed, criticalViolations } =
        runQuickAccessibilityCheck(component)
      if (!passed) {
        const errorMessage = `Critical accessibility violations found:\n${criticalViolations.map(v => `- ${v.violation}: ${v.remediation}`).join('\n')}`
        throw new Error(errorMessage)
      }
    })
  })
})
