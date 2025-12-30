/**
 * ESLint Plugin for Toastmasters Brand Compliance
 *
 * Development-time ESLint rules to catch brand compliance violations
 */

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

module.exports = {
  rules: {
    'no-custom-colors': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow custom colors outside brand palette',
          category: 'Brand Compliance',
          recommended: true,
        },
        fixable: 'code',
        schema: [],
      },
      create(context) {
        return {
          Property(node) {
            if (
              node.key &&
              node.key.name &&
              ['color', 'backgroundColor', 'borderColor'].includes(
                node.key.name
              )
            ) {
              if (
                node.value &&
                node.value.type === 'Literal' &&
                typeof node.value.value === 'string'
              ) {
                const colorValue = node.value.value

                // Check for hex colors
                if (
                  colorValue.startsWith('#') &&
                  !isValidBrandColor(colorValue)
                ) {
                  context.report({
                    node: node.value,
                    message: `Custom color "${colorValue}" is not allowed. Use brand palette colors only.`,
                    fix(fixer) {
                      // Suggest nearest brand color (simplified)
                      return fixer.replaceText(
                        node.value,
                        `"${BRAND_COLORS.coolGray}"`
                      )
                    },
                  })
                }
              }
            }
          },

          TemplateLiteral(node) {
            // Check for colors in template literals (styled-components, etc.)
            if (node.quasis) {
              node.quasis.forEach(quasi => {
                const text = quasi.value.raw
                const hexColorRegex = /#[0-9a-fA-F]{6}/g
                let match

                while ((match = hexColorRegex.exec(text)) !== null) {
                  const color = match[0]
                  if (!isValidBrandColor(color)) {
                    context.report({
                      node: quasi,
                      message: `Custom color "${color}" is not allowed. Use brand palette colors only.`,
                    })
                  }
                }
              })
            }
          },
        }
      },
    },

    'no-custom-fonts': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow custom fonts outside brand typography system',
          category: 'Brand Compliance',
          recommended: true,
        },
        schema: [],
      },
      create(context) {
        return {
          Property(node) {
            if (node.key && node.key.name === 'fontFamily') {
              if (
                node.value &&
                node.value.type === 'Literal' &&
                typeof node.value.value === 'string'
              ) {
                const fontValue = node.value.value

                if (!isValidBrandFont(fontValue)) {
                  context.report({
                    node: node.value,
                    message: `Custom font "${fontValue}" is not allowed. Use Montserrat for headlines or Source Sans 3 for body text.`,
                  })
                }
              }
            }
          },
        }
      },
    },

    'require-min-font-size': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require minimum 14px font size for body text',
          category: 'Brand Compliance',
          recommended: true,
        },
        schema: [],
      },
      create(context) {
        return {
          Property(node) {
            if (node.key && node.key.name === 'fontSize') {
              if (node.value && node.value.type === 'Literal') {
                const fontSize = node.value.value

                if (typeof fontSize === 'string') {
                  const numericValue = parseFloat(fontSize)
                  const unit = fontSize.replace(numericValue.toString(), '')

                  if (unit === 'px' && numericValue < 14) {
                    context.report({
                      node: node.value,
                      message: `Font size ${fontSize} is below minimum 14px requirement.`,
                    })
                  }
                } else if (typeof fontSize === 'number' && fontSize < 14) {
                  context.report({
                    node: node.value,
                    message: `Font size ${fontSize} is below minimum 14px requirement.`,
                  })
                }
              }
            }
          },
        }
      },
    },

    'require-min-touch-target': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Require minimum 44px touch targets for interactive elements',
          category: 'Brand Compliance',
          recommended: true,
        },
        schema: [],
      },
      create(context) {
        return {
          Property(node) {
            if (
              node.key &&
              node.key.name &&
              ['width', 'height', 'minWidth', 'minHeight'].includes(
                node.key.name
              )
            ) {
              if (node.value && node.value.type === 'Literal') {
                const size = node.value.value

                if (typeof size === 'string') {
                  const numericValue = parseFloat(size)
                  const unit = size.replace(numericValue.toString(), '')

                  if (unit === 'px' && numericValue < 44) {
                    // Check if this is likely an interactive element
                    const parent = node.parent
                    if (parent && parent.type === 'ObjectExpression') {
                      const hasInteractiveProps = parent.properties.some(
                        prop =>
                          prop.key &&
                          prop.key.name &&
                          ['onClick', 'onPress', 'onTap', 'href'].includes(
                            prop.key.name
                          )
                      )

                      if (hasInteractiveProps) {
                        context.report({
                          node: node.value,
                          message: `Interactive element ${node.key.name} ${size} is below minimum 44px touch target requirement.`,
                        })
                      }
                    }
                  }
                }
              }
            }
          },
        }
      },
    },

    'no-prohibited-text-effects': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow prohibited text effects like drop-shadow, outline, glow',
          category: 'Brand Compliance',
          recommended: true,
        },
        schema: [],
      },
      create(context) {
        const prohibitedEffects = [
          'textShadow',
          'filter',
          'webkitTextStroke',
          'textStroke',
        ]

        return {
          Property(node) {
            if (
              node.key &&
              node.key.name &&
              prohibitedEffects.includes(node.key.name)
            ) {
              if (
                node.value &&
                node.value.type === 'Literal' &&
                node.value.value !== 'none' &&
                node.value.value !== '0'
              ) {
                context.report({
                  node: node.value,
                  message: `Text effect "${node.key.name}" is prohibited by brand guidelines.`,
                })
              }
            }
          },
        }
      },
    },

    'max-one-gradient': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Limit to maximum one gradient per component/screen',
          category: 'Brand Compliance',
          recommended: true,
        },
        schema: [],
      },
      create(context) {
        let gradientCount = 0

        return {
          Program() {
            gradientCount = 0
          },

          Property(node) {
            if (
              node.key &&
              node.key.name &&
              ['background', 'backgroundImage'].includes(node.key.name)
            ) {
              if (
                node.value &&
                node.value.type === 'Literal' &&
                typeof node.value.value === 'string' &&
                node.value.value.includes('gradient')
              ) {
                gradientCount++

                if (gradientCount > 1) {
                  context.report({
                    node: node.value,
                    message:
                      'Maximum one gradient per component/screen is allowed by brand guidelines.',
                  })
                }
              }
            }
          },

          TemplateLiteral(node) {
            if (node.quasis) {
              node.quasis.forEach(quasi => {
                const text = quasi.value.raw
                if (text.includes('gradient')) {
                  gradientCount++

                  if (gradientCount > 1) {
                    context.report({
                      node: quasi,
                      message:
                        'Maximum one gradient per component/screen is allowed by brand guidelines.',
                    })
                  }
                }
              })
            }
          },
        }
      },
    },
  },

  configs: {
    recommended: {
      plugins: ['brand-compliance'],
      rules: {
        'brand-compliance/no-custom-colors': 'error',
        'brand-compliance/no-custom-fonts': 'error',
        'brand-compliance/require-min-font-size': 'error',
        'brand-compliance/require-min-touch-target': 'warn',
        'brand-compliance/no-prohibited-text-effects': 'error',
        'brand-compliance/max-one-gradient': 'error',
      },
    },
  },
}
