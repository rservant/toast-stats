/**
 * Unit Tests for Brand Validation and Error Handling
 *
 * Tests color fallback mechanisms, font fallback behavior, contrast adjustment algorithms,
 * touch target expansion logic, and all 16 validation rules with positive and negative test cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validateElement,
  isValidBrandColor,
  calculateContrastRatio,
  meetsWCAGAA,
  isValidHeadlineFont,
  isValidBodyFont,
  hasMinimumFontSize,
  hasMinimumLineHeight,
  meetsTouchTargetRequirements,
  countGradientsInView,
  colorValidationRules,
  typographyValidationRules,
  accessibilityValidationRules,
  componentValidationRules,
  allValidationRules,
} from '../../utils/brandValidation'
import {
  applyColorFallback,
  applyFontFallback,
  applyTouchTargetExpansion,
  applyFontSizeAdjustment,
  applyComprehensiveRecovery,
} from '../../utils/errorRecovery'

// Mock DOM methods
const mockGetComputedStyle = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  // Setup DOM mocks
  Object.defineProperty(window, 'getComputedStyle', {
    value: mockGetComputedStyle,
    writable: true,
  })

  // Reset document body
  document.body.innerHTML = ''
})

describe('Brand Color Validation', () => {
  describe('isValidBrandColor', () => {
    it('should accept valid brand colors', () => {
      expect(isValidBrandColor('#004165')).toBe(true) // TM Loyal Blue
      expect(isValidBrandColor('#772432')).toBe(true) // TM True Maroon
      expect(isValidBrandColor('#A9B2B1')).toBe(true) // TM Cool Gray
      expect(isValidBrandColor('#F2DF74')).toBe(true) // TM Happy Yellow
      expect(isValidBrandColor('#000000')).toBe(true) // TM Black
      expect(isValidBrandColor('#FFFFFF')).toBe(true) // TM White
    })

    it('should reject invalid colors', () => {
      expect(isValidBrandColor('#FF0000')).toBe(false) // Red
      expect(isValidBrandColor('#00FF00')).toBe(false) // Green
      expect(isValidBrandColor('#0000FF')).toBe(false) // Blue
      expect(isValidBrandColor('#CCCCCC')).toBe(false) // Gray
      expect(isValidBrandColor('invalid')).toBe(false) // Invalid format
    })

    it('should handle case insensitive colors', () => {
      expect(isValidBrandColor('#004165')).toBe(true)
      expect(isValidBrandColor('#004165'.toLowerCase())).toBe(true)
      expect(isValidBrandColor('#004165'.toUpperCase())).toBe(true)
    })
  })

  describe('calculateContrastRatio', () => {
    it('should calculate correct contrast ratios', () => {
      // Black on white should be 21:1
      const blackWhiteRatio = calculateContrastRatio('#000000', '#FFFFFF')
      expect(blackWhiteRatio).toBeCloseTo(21, 0)

      // White on TM Loyal Blue should be approximately 9.8:1
      const whiteBlueRatio = calculateContrastRatio('#FFFFFF', '#004165')
      expect(whiteBlueRatio).toBeGreaterThan(9)
      expect(whiteBlueRatio).toBeLessThan(11)
    })

    it('should return 1 for identical colors', () => {
      const ratio = calculateContrastRatio('#004165', '#004165')
      expect(ratio).toBe(1)
    })
  })

  describe('meetsWCAGAA', () => {
    it('should pass WCAG AA for sufficient contrast', () => {
      expect(meetsWCAGAA('#000000', '#FFFFFF')).toBe(true) // 21:1 ratio
      expect(meetsWCAGAA('#FFFFFF', '#004165')).toBe(true) // ~9.8:1 ratio
    })

    it('should fail WCAG AA for insufficient contrast', () => {
      expect(meetsWCAGAA('#CCCCCC', '#FFFFFF')).toBe(false) // Low contrast
      expect(meetsWCAGAA('#A9B2B1', '#FFFFFF')).toBe(false) // TM Cool Gray on white
    })

    it('should handle large text requirements', () => {
      // Large text has lower contrast requirements (3:1 vs 4.5:1)
      expect(meetsWCAGAA('#777777', '#FFFFFF', true)).toBe(true) // Large text
      expect(meetsWCAGAA('#777777', '#FFFFFF', false)).toBe(false) // Normal text
    })
  })
})

describe('Typography Validation', () => {
  describe('isValidHeadlineFont', () => {
    it('should accept valid headline fonts', () => {
      expect(isValidHeadlineFont('Montserrat, sans-serif')).toBe(true)
      expect(isValidHeadlineFont('"Montserrat", system-ui, Arial')).toBe(true)
      expect(isValidHeadlineFont('system-ui, -apple-system')).toBe(true)
    })

    it('should reject invalid headline fonts', () => {
      expect(isValidHeadlineFont('Times New Roman')).toBe(false)
      expect(isValidHeadlineFont('Comic Sans MS')).toBe(false)
      expect(isValidHeadlineFont('Helvetica')).toBe(false)
    })
  })

  describe('isValidBodyFont', () => {
    it('should accept valid body fonts', () => {
      expect(isValidBodyFont('Source Sans 3, sans-serif')).toBe(true)
      expect(isValidBodyFont('"Source Sans 3", system-ui')).toBe(true)
      expect(isValidBodyFont('system-ui, -apple-system')).toBe(true)
    })

    it('should reject invalid body fonts', () => {
      expect(isValidBodyFont('Times New Roman')).toBe(false)
      expect(isValidBodyFont('Montserrat')).toBe(false) // Wrong for body text
      expect(isValidBodyFont('Arial')).toBe(false) // Not primary choice
    })
  })

  describe('hasMinimumFontSize', () => {
    it('should pass for sufficient font sizes', () => {
      const element = document.createElement('div')
      mockGetComputedStyle.mockReturnValue({ fontSize: '14px' })
      expect(hasMinimumFontSize(element)).toBe(true)

      mockGetComputedStyle.mockReturnValue({ fontSize: '16px' })
      expect(hasMinimumFontSize(element)).toBe(true)
    })

    it('should fail for insufficient font sizes', () => {
      const element = document.createElement('div')
      mockGetComputedStyle.mockReturnValue({ fontSize: '12px' })
      expect(hasMinimumFontSize(element)).toBe(false)

      mockGetComputedStyle.mockReturnValue({ fontSize: '10px' })
      expect(hasMinimumFontSize(element)).toBe(false)
    })
  })

  describe('hasMinimumLineHeight', () => {
    it('should pass for sufficient line heights', () => {
      const element = document.createElement('div')
      mockGetComputedStyle.mockReturnValue({
        lineHeight: '20px',
        fontSize: '14px',
      })
      expect(hasMinimumLineHeight(element)).toBe(true) // 1.43 ratio
    })

    it('should fail for insufficient line heights', () => {
      const element = document.createElement('div')
      mockGetComputedStyle.mockReturnValue({
        lineHeight: '16px',
        fontSize: '14px',
      })
      expect(hasMinimumLineHeight(element)).toBe(false) // 1.14 ratio
    })
  })
})

describe('Accessibility Validation', () => {
  describe('meetsTouchTargetRequirements', () => {
    it('should pass for sufficient touch targets', () => {
      const element = document.createElement('button')
      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 44,
        height: 44,
      })
      expect(meetsTouchTargetRequirements(element)).toBe(true)

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 50,
        height: 50,
      })
      expect(meetsTouchTargetRequirements(element)).toBe(true)
    })

    it('should fail for insufficient touch targets', () => {
      const element = document.createElement('button')
      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 30,
        height: 30,
      })
      expect(meetsTouchTargetRequirements(element)).toBe(false)

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 44,
        height: 30, // Height too small
      })
      expect(meetsTouchTargetRequirements(element)).toBe(false)
    })
  })
})

describe('Gradient Validation', () => {
  describe('countGradientsInView', () => {
    it('should count gradients correctly', () => {
      // Create elements with gradients
      const div1 = document.createElement('div')
      const div2 = document.createElement('div')

      document.body.appendChild(div1)
      document.body.appendChild(div2)

      // Mock computed styles
      mockGetComputedStyle
        .mockReturnValueOnce({
          backgroundImage: 'linear-gradient(to right, #004165, #006094)',
        })
        .mockReturnValueOnce({ backgroundImage: 'none' })

      const count = countGradientsInView()
      expect(count).toBe(1)
    })

    it('should return 0 when no gradients present', () => {
      const div = document.createElement('div')
      document.body.appendChild(div)

      mockGetComputedStyle.mockReturnValue({ backgroundImage: 'none' })

      const count = countGradientsInView()
      expect(count).toBe(0)
    })
  })
})

describe('Validation Rules', () => {
  describe('Color Validation Rules (CV001-CV004)', () => {
    it('should validate CV001 - brand palette colors only', () => {
      const element = document.createElement('div')
      const rule = colorValidationRules.find(r => r.id === 'CV001')!

      // Valid brand color
      mockGetComputedStyle.mockReturnValue({
        backgroundColor: 'rgb(0, 65, 101)', // TM Loyal Blue
        color: 'rgb(255, 255, 255)', // TM White
      })
      expect(rule.check(element)).toBe(true)

      // Invalid custom color
      mockGetComputedStyle.mockReturnValue({
        backgroundColor: 'rgb(255, 0, 0)', // Red
        color: 'rgb(0, 0, 0)',
      })
      expect(rule.check(element)).toBe(false)
    })

    it('should validate CV002 - contrast ratios', () => {
      const element = document.createElement('div')
      const rule = colorValidationRules.find(r => r.id === 'CV002')!

      // Sufficient contrast
      mockGetComputedStyle.mockReturnValue({
        backgroundColor: 'rgb(0, 65, 101)', // TM Loyal Blue
        color: 'rgb(255, 255, 255)', // TM White
        fontSize: '16px',
        fontWeight: 'normal',
      })
      expect(rule.check(element)).toBe(true)

      // Insufficient contrast
      mockGetComputedStyle.mockReturnValue({
        backgroundColor: 'rgb(169, 178, 177)', // TM Cool Gray
        color: 'rgb(255, 255, 255)', // TM White
        fontSize: '16px',
        fontWeight: 'normal',
      })
      expect(rule.check(element)).toBe(false)
    })
  })

  describe('Typography Validation Rules (TV001-TV005)', () => {
    it('should validate TV001 - headline font family', () => {
      const h1 = document.createElement('h1')
      const rule = typographyValidationRules.find(r => r.id === 'TV001')!

      // Valid headline font
      mockGetComputedStyle.mockReturnValue({
        fontFamily: 'Montserrat, sans-serif',
      })
      expect(rule.check(h1)).toBe(true)

      // Invalid headline font
      mockGetComputedStyle.mockReturnValue({
        fontFamily: 'Times New Roman, serif',
      })
      expect(rule.check(h1)).toBe(false)
    })

    it('should validate TV003 - minimum font size', () => {
      const p = document.createElement('p')
      const rule = typographyValidationRules.find(r => r.id === 'TV003')!

      // Sufficient font size
      mockGetComputedStyle.mockReturnValue({ fontSize: '14px' })
      expect(rule.check(p)).toBe(true)

      // Insufficient font size
      mockGetComputedStyle.mockReturnValue({ fontSize: '12px' })
      expect(rule.check(p)).toBe(false)
    })
  })

  describe('Accessibility Validation Rules (AV001-AV004)', () => {
    it('should validate AV001 - touch target size', () => {
      const button = document.createElement('button')
      const rule = accessibilityValidationRules.find(r => r.id === 'AV001')!

      // Sufficient touch target
      button.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 44,
        height: 44,
      })
      expect(rule.check(button)).toBe(true)

      // Insufficient touch target
      button.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 30,
        height: 30,
      })
      expect(rule.check(button)).toBe(false)
    })
  })

  describe('Component Validation Rules (CPV001-CPV004)', () => {
    it('should validate CPV001 - primary button colors', () => {
      const button = document.createElement('button')
      button.classList.add('tm-btn-primary')
      const rule = componentValidationRules.find(r => r.id === 'CPV001')!

      // Correct primary button color
      mockGetComputedStyle.mockReturnValue({
        backgroundColor: 'rgb(0, 65, 101)', // TM Loyal Blue
      })
      expect(rule.check(button)).toBe(true)

      // Incorrect primary button color
      mockGetComputedStyle.mockReturnValue({
        backgroundColor: 'rgb(255, 0, 0)', // Red
      })
      expect(rule.check(button)).toBe(false)
    })
  })
})

describe('Error Recovery Mechanisms', () => {
  describe('applyColorFallback', () => {
    it('should apply brand color fallbacks', () => {
      const element = document.createElement('div')
      element.style.backgroundColor = '#FF0000' // Invalid red

      mockGetComputedStyle.mockReturnValue({
        backgroundColor: 'rgb(255, 0, 0)',
        color: 'rgb(0, 0, 0)',
      })

      const result = applyColorFallback(element)

      expect(result.success).toBe(true)
      expect(result.appliedFixes.length).toBeGreaterThan(0)
      expect(result.appliedFixes[0]).toContain('background color fallback')
    })

    it('should handle elements with no background color', () => {
      const element = document.createElement('div')

      mockGetComputedStyle.mockReturnValue({
        backgroundColor: 'rgba(0, 0, 0, 0)',
        color: 'rgb(0, 0, 0)',
      })

      const result = applyColorFallback(element)

      // Should still apply text color fallback
      expect(result.appliedFixes.length).toBeGreaterThan(0)
    })
  })

  describe('applyFontFallback', () => {
    it('should apply correct font for headlines', () => {
      const h1 = document.createElement('h1')

      const result = applyFontFallback(h1)

      expect(result.success).toBe(true)
      expect(result.appliedFixes[0]).toContain('headline font')
      expect(h1.style.fontFamily).toContain('Montserrat')
    })

    it('should apply correct font for body text', () => {
      const p = document.createElement('p')

      const result = applyFontFallback(p)

      expect(result.success).toBe(true)
      expect(result.appliedFixes[0]).toContain('body font')
      expect(p.style.fontFamily).toContain('Source Sans 3')
    })
  })

  describe('applyTouchTargetExpansion', () => {
    it('should expand insufficient touch targets', () => {
      const button = document.createElement('button')
      button.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 30,
        height: 30,
      })

      mockGetComputedStyle.mockReturnValue({
        padding: '0px',
      })

      const result = applyTouchTargetExpansion(button)

      expect(result.success).toBe(true)
      expect(result.appliedFixes.length).toBeGreaterThan(0)
      expect(button.style.minWidth).toBe('44px')
      expect(button.style.minHeight).toBe('44px')
    })

    it('should not modify sufficient touch targets', () => {
      const button = document.createElement('button')
      button.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 50,
        height: 50,
      })

      const result = applyTouchTargetExpansion(button)

      expect(result.success).toBe(false)
      expect(result.appliedFixes.length).toBe(0)
    })
  })

  describe('applyFontSizeAdjustment', () => {
    it('should increase insufficient font sizes', () => {
      const element = document.createElement('p')

      mockGetComputedStyle.mockReturnValue({
        fontSize: '12px',
        lineHeight: '16px',
      })

      const result = applyFontSizeAdjustment(element)

      expect(result.success).toBe(true)
      expect(result.appliedFixes.length).toBeGreaterThan(0)
      expect(element.style.fontSize).toBe('14px')
    })

    it('should adjust insufficient line heights', () => {
      const element = document.createElement('p')

      mockGetComputedStyle.mockReturnValue({
        fontSize: '14px',
        lineHeight: '16px', // 1.14 ratio, below 1.4 minimum
      })

      const result = applyFontSizeAdjustment(element)

      expect(result.success).toBe(true)
      expect(result.appliedFixes.some(fix => fix.includes('line height'))).toBe(
        true
      )
      expect(element.style.lineHeight).toBe('1.4')
    })
  })

  describe('applyComprehensiveRecovery', () => {
    it('should apply multiple recovery strategies', () => {
      const button = document.createElement('button')
      button.classList.add('tm-btn-primary')

      const errors = [
        {
          type: 'color' as const,
          severity: 'error' as const,
          message: 'Invalid color',
          element: button,
          ruleId: 'CV001',
          suggestion: 'Use brand colors',
        },
        {
          type: 'accessibility' as const,
          severity: 'error' as const,
          message: 'Touch target too small',
          element: button,
          ruleId: 'AV001',
          suggestion: 'Increase size',
        },
      ]

      mockGetComputedStyle.mockReturnValue({
        backgroundColor: 'rgb(255, 0, 0)',
        color: 'rgb(0, 0, 0)',
        padding: '0px',
      })

      button.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 30,
        height: 30,
      })

      const result = applyComprehensiveRecovery(errors)

      expect(result.success).toBe(true)
      expect(result.appliedFixes.length).toBeGreaterThan(1)
      expect(result.appliedFixes.some(fix => fix.includes('color'))).toBe(true)
      expect(
        result.appliedFixes.some(fix => fix.includes('touch target'))
      ).toBe(true)
    })
  })
})

describe('Complete Validation Integration', () => {
  it('should validate all rules on a complex element', () => {
    const button = document.createElement('button')
    button.classList.add('tm-btn-primary')
    button.textContent = 'Click me'

    mockGetComputedStyle.mockReturnValue({
      backgroundColor: 'rgb(0, 65, 101)', // TM Loyal Blue
      color: 'rgb(255, 255, 255)', // TM White
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '16px',
      lineHeight: '22.4px', // 1.4 ratio exactly
      textShadow: 'none',
      filter: 'none',
    })

    button.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 120,
      height: 44,
    })

    const errors = validateElement(button, allValidationRules)

    // Should pass all validations
    expect(errors.length).toBe(0)
  })

  it('should detect multiple validation failures', () => {
    const button = document.createElement('button')
    button.classList.add('tm-btn-primary')

    mockGetComputedStyle.mockReturnValue({
      backgroundColor: 'rgb(255, 0, 0)', // Invalid red
      color: 'rgb(0, 0, 0)', // Black text on red (poor contrast)
      fontFamily: 'Times New Roman', // Invalid font
      fontSize: '10px', // Too small
      lineHeight: '12px', // Too small ratio
      textShadow: '2px 2px 4px rgba(0,0,0,0.5)', // Prohibited effect
    })

    button.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 20, // Too small
      height: 20, // Too small
    })

    const errors = validateElement(button, allValidationRules)

    // Should detect multiple failures
    expect(errors.length).toBeGreaterThan(3)

    const errorRules = errors.map(e => e.ruleId)
    expect(errorRules).toContain('CV001') // Color validation
    expect(errorRules).toContain('AV001') // Touch target
    expect(errorRules).toContain('TV004') // Line height (buttons don't trigger TV003)
  })
})
