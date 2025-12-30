/**
 * PostCSS Plugin for Toastmasters Brand Validation
 *
 * Build-time CSS validation for brand compliance and accessibility
 */

const postcss = require('postcss')

const BRAND_COLORS = {
  loyalBlue: '#004165',
  trueMaroon: '#772432',
  coolGray: '#A9B2B1',
  happyYellow: '#F2DF74',
  black: '#000000',
  white: '#FFFFFF',
}

const BRAND_FONTS = {
  headline: [
    'Montserrat',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Arial',
    'sans-serif',
  ],
  body: [
    'Source Sans 3',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Arial',
    'sans-serif',
  ],
}

function isValidBrandColor(color) {
  if (!color || typeof color !== 'string') return false

  const normalizedColor = color.toLowerCase().replace(/\s/g, '')
  const brandColorValues = Object.values(BRAND_COLORS).map(c => c.toLowerCase())

  return brandColorValues.includes(normalizedColor)
}

function isValidBrandFont(fontFamily) {
  if (!fontFamily || typeof fontFamily !== 'string') return false

  const normalizedFont = fontFamily.toLowerCase()
  const validFonts = [...BRAND_FONTS.headline, ...BRAND_FONTS.body].map(f =>
    f.toLowerCase()
  )

  return validFonts.some(font => normalizedFont.includes(font))
}

function calculateContrastRatio(color1, color2) {
  // Simplified contrast calculation - in production, use a proper color library
  function getLuminance(hex) {
    const rgb = hexToRgb(hex)
    if (!rgb) return 0

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null
  }

  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

function meetsWCAGAA(foreground, background, isLargeText = false) {
  const ratio = calculateContrastRatio(foreground, background)
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

module.exports = (opts = {}) => {
  const options = {
    enableColorValidation: true,
    enableFontValidation: true,
    enableContrastValidation: true,
    enableSizeValidation: true,
    enableGradientValidation: true,
    failOnError: false,
    ...opts,
  }

  return {
    postcssPlugin: 'postcss-brand-validation',

    Once(root, { result }) {
      const errors = []
      let gradientCount = 0

      root.walkRules(rule => {
        rule.walkDecls(decl => {
          // Color validation
          if (
            options.enableColorValidation &&
            ['color', 'background-color', 'border-color'].includes(decl.prop)
          ) {
            const colorValue = decl.value
            if (colorValue.startsWith('#') && !isValidBrandColor(colorValue)) {
              errors.push({
                type: 'color',
                message: `Custom color "${colorValue}" is not allowed. Use brand palette colors only.`,
                line: decl.source?.start?.line,
                column: decl.source?.start?.column,
                file: decl.source?.input?.from,
              })
            }
          }

          // Font validation
          if (options.enableFontValidation && decl.prop === 'font-family') {
            const fontValue = decl.value.replace(/['"]/g, '')
            if (!isValidBrandFont(fontValue)) {
              errors.push({
                type: 'font',
                message: `Custom font "${fontValue}" is not allowed. Use Montserrat for headlines or Source Sans 3 for body text.`,
                line: decl.source?.start?.line,
                column: decl.source?.start?.column,
                file: decl.source?.input?.from,
              })
            }
          }

          // Font size validation
          if (options.enableSizeValidation && decl.prop === 'font-size') {
            const fontSize = parseFloat(decl.value)
            const unit = decl.value.replace(fontSize.toString(), '')

            if (unit === 'px' && fontSize < 14) {
              errors.push({
                type: 'size',
                message: `Font size ${decl.value} is below minimum 14px requirement.`,
                line: decl.source?.start?.line,
                column: decl.source?.start?.column,
                file: decl.source?.input?.from,
              })
            }
          }

          // Touch target validation
          if (
            options.enableSizeValidation &&
            ['width', 'height', 'min-width', 'min-height'].includes(decl.prop)
          ) {
            const size = parseFloat(decl.value)
            const unit = decl.value.replace(size.toString(), '')

            if (unit === 'px' && size < 44) {
              // Check if this rule targets interactive elements
              const selector = rule.selector
              const isInteractive =
                /button|input|select|textarea|\.btn|\.interactive|\[role="button"\]/.test(
                  selector
                )

              if (isInteractive) {
                errors.push({
                  type: 'touch-target',
                  message: `Interactive element ${decl.prop} ${decl.value} is below minimum 44px touch target requirement.`,
                  line: decl.source?.start?.line,
                  column: decl.source?.start?.column,
                  file: decl.source?.input?.from,
                })
              }
            }
          }

          // Gradient validation
          if (
            options.enableGradientValidation &&
            ['background', 'background-image'].includes(decl.prop) &&
            decl.value.includes('gradient')
          ) {
            gradientCount++

            if (gradientCount > 1) {
              errors.push({
                type: 'gradient',
                message:
                  'Maximum one gradient per stylesheet is allowed by brand guidelines.',
                line: decl.source?.start?.line,
                column: decl.source?.start?.column,
                file: decl.source?.input?.from,
              })
            }
          }

          // Prohibited text effects validation
          if (
            ['text-shadow', 'filter', '-webkit-text-stroke'].includes(
              decl.prop
            ) &&
            decl.value !== 'none' &&
            decl.value !== '0'
          ) {
            errors.push({
              type: 'text-effect',
              message: `Text effect "${decl.prop}" is prohibited by brand guidelines.`,
              line: decl.source?.start?.line,
              column: decl.source?.start?.column,
              file: decl.source?.input?.from,
            })
          }
        })
      })

      // Contrast validation (simplified - checks rules with both color and background-color)
      if (options.enableContrastValidation) {
        root.walkRules(rule => {
          let textColor = null
          let backgroundColor = null

          rule.walkDecls(decl => {
            if (decl.prop === 'color') textColor = decl.value
            if (decl.prop === 'background-color') backgroundColor = decl.value
          })

          if (
            textColor &&
            backgroundColor &&
            textColor.startsWith('#') &&
            backgroundColor.startsWith('#')
          ) {
            if (!meetsWCAGAA(textColor, backgroundColor)) {
              errors.push({
                type: 'contrast',
                message: `Insufficient contrast ratio between "${textColor}" and "${backgroundColor}". Must meet WCAG AA standards (4.5:1 for normal text).`,
                line: rule.source?.start?.line,
                column: rule.source?.start?.column,
                file: rule.source?.input?.from,
              })
            }
          }
        })
      }

      // Report errors
      if (errors.length > 0) {
        errors.forEach(error => {
          const message = `Brand Validation (${error.type.toUpperCase()}): ${error.message}`

          if (options.failOnError) {
            throw new Error(message)
          } else {
            console.warn(message)
            if (error.file && error.line) {
              console.warn(
                `  at ${error.file}:${error.line}:${error.column || 1}`
              )
            }
          }
        })

        // Add summary
        console.warn(
          `\nBrand Validation Summary: ${errors.length} issue(s) found`
        )

        const errorsByType = errors.reduce((acc, error) => {
          acc[error.type] = (acc[error.type] || 0) + 1
          return acc
        }, {})

        Object.entries(errorsByType).forEach(([type, count]) => {
          console.warn(`  ${type}: ${count} issue(s)`)
        })
      }
    },
  }
}

module.exports.postcss = true
