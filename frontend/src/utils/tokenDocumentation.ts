/**
 * Design Token Documentation Generator
 *
 * This module provides utilities for generating comprehensive documentation
 * for the Toastmasters design token system, including usage examples,
 * best practices, and validation guidelines.
 */

import {
  generateTokenDocumentation,
  generateTokenUsageExamples,
} from './designTokens'

/**
 * Generate comprehensive token documentation with examples
 */
export function generateComprehensiveDocumentation(): string {
  const baseDocumentation = generateTokenDocumentation()
  const usageExamples = generateTokenUsageExamples()

  let documentation = baseDocumentation

  // Add detailed usage examples for each category
  documentation += `\n## Detailed Usage Examples\n\n`

  Object.entries(usageExamples).forEach(([category, examples]) => {
    documentation += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Usage\n\n`
    documentation += '```css\n'
    documentation += examples.join('\n')
    documentation += '\n```\n\n'
  })

  // Add best practices section
  documentation += `## Best Practices\n\n`
  documentation += getBestPracticesDocumentation()

  // Add validation guidelines
  documentation += `\n## Validation Guidelines\n\n`
  documentation += getValidationGuidelines()

  // Add troubleshooting section
  documentation += `\n## Troubleshooting\n\n`
  documentation += getTroubleshootingGuide()

  return documentation
}

/**
 * Generate best practices documentation
 */
function getBestPracticesDocumentation(): string {
  return `### Color Usage
- Always use CSS custom properties instead of hardcoded values
- Maintain WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Use opacity variations for subtle effects
- Test color combinations with color-blind simulation tools

### Typography
- Use semantic font size tokens (h1, h2, body-large, etc.) instead of raw sizes
- Ensure minimum 14px font size for body text
- Maintain minimum 1.4 line height ratio for readability
- Use proper font fallback stacks for performance

### Spacing
- Use semantic spacing tokens (xs, sm, md, lg, xl) for consistency
- Ensure 44px minimum touch targets for interactive elements
- Use component-specific spacing tokens for consistent padding/margins
- Follow the 4px base unit system

### Gradients
- **CRITICAL**: Maximum one gradient per screen/view
- Use only official brand gradients
- Always validate text contrast on gradient backgrounds
- Consider performance impact on mobile devices
- Use overlay gradients for text contrast when needed

### Shadows
- Use shadows sparingly and consistently
- Match shadow intensity to component importance
- Use focus shadows for accessibility
- Avoid excessive shadow effects that impact performance

### General Guidelines
- Validate all token usage with automated tools
- Document any custom token additions
- Test across different screen sizes and devices
- Maintain consistency across all components
- Regular audit for unused or deprecated tokens`
}

/**
 * Generate validation guidelines
 */
function getValidationGuidelines(): string {
  return `### Automated Validation
The design token system includes built-in validation for:

#### Gradient Constraints
\`\`\`typescript
import { validateGradientConstraints } from './designTokens';

const validation = validateGradientConstraints();
if (!validation.isValid) {
  console.error('Gradient violations:', validation.violations);
  console.info('Recommendations:', validation.recommendations);
}
\`\`\`

#### Color Contrast
\`\`\`typescript
import { validateContrastRatio } from './designTokens';

const contrast = validateContrastRatio('var(--tm-loyal-blue)', 'var(--tm-white)');
if (!contrast.wcagAA) {
  console.warn(\`Contrast ratio \${contrast.ratio}:1 does not meet WCAG AA standards\`);
}
\`\`\`

#### Token Validation
\`\`\`typescript
import { isValidDesignToken } from './designTokens';

const isValid = isValidDesignToken('var(--tm-loyal-blue)');
if (!isValid) {
  console.warn('Invalid design token detected');
}
\`\`\`

### Manual Validation Checklist
- [ ] All colors use design tokens
- [ ] Typography follows brand guidelines
- [ ] Touch targets meet 44px minimum
- [ ] Maximum one gradient per screen
- [ ] Text contrast meets WCAG AA standards
- [ ] Spacing follows consistent scale
- [ ] No hardcoded values in CSS
- [ ] Performance impact assessed for gradients
- [ ] Cross-browser compatibility tested
- [ ] Mobile responsiveness verified`
}

/**
 * Generate troubleshooting guide
 */
function getTroubleshootingGuide(): string {
  return `### Common Issues and Solutions

#### "Multiple gradients detected" Error
**Problem**: More than one gradient is being used on a single screen/view.
**Solution**: 
- Remove additional gradients or combine into one
- Use solid brand colors instead of multiple gradients
- Check for gradients in child components

#### "Contrast ratio too low" Warning
**Problem**: Text on colored/gradient backgrounds doesn't meet accessibility standards.
**Solution**:
- Use higher contrast color combinations
- Add semi-transparent overlay for text contrast
- Use white text on dark backgrounds, dark text on light backgrounds

#### "Invalid design token" Error
**Problem**: Using hardcoded values instead of design tokens.
**Solution**:
- Replace hardcoded values with appropriate design tokens
- Check token name spelling and CSS variable syntax
- Ensure token is imported and available

#### "Touch target too small" Warning
**Problem**: Interactive elements don't meet 44px minimum size requirement.
**Solution**:
- Use \`var(--tm-touch-target)\` for minimum dimensions
- Add padding to increase clickable area
- Use \`.tm-touch-target\` utility class

#### Performance Issues with Gradients
**Problem**: Gradients causing performance issues on mobile.
**Solution**:
- Use linear gradients instead of radial when possible
- Reduce gradient complexity (fewer color stops)
- Consider solid colors for large areas
- Test on actual mobile devices

#### Font Loading Issues
**Problem**: Fonts not loading or showing fallbacks.
**Solution**:
- Verify font URLs are accessible
- Use \`font-display: swap\` for better loading experience
- Ensure fallback fonts are properly specified
- Check network connectivity and CDN availability

### Getting Help
- Check the design token documentation
- Validate your implementation with automated tools
- Test with real users and accessibility tools
- Consult the brand guidelines for official requirements
- Use browser developer tools to inspect computed styles`
}

/**
 * Generate token migration guide
 */
export function generateMigrationGuide(): string {
  return `# Design Token Migration Guide

## Overview
This guide helps migrate from hardcoded values to the Toastmasters design token system.

## Migration Steps

### 1. Audit Current Usage
\`\`\`bash
# Search for hardcoded colors
grep -r "#[0-9a-fA-F]\\{6\\}" src/
grep -r "rgb(" src/
grep -r "rgba(" src/

# Search for hardcoded font sizes
grep -r "font-size: [0-9]" src/

# Search for hardcoded spacing
grep -r "margin: [0-9]" src/
grep -r "padding: [0-9]" src/
\`\`\`

### 2. Replace Common Values

#### Colors
\`\`\`css
/* Before */
.button { background-color: #004165; }

/* After */
.button { background-color: var(--tm-loyal-blue); }
\`\`\`

#### Typography
\`\`\`css
/* Before */
.heading { 
  font-family: "Montserrat", sans-serif;
  font-size: 48px;
  line-height: 1.25;
  font-weight: 900;
}

/* After */
.heading {
  font-family: var(--tm-font-headline);
  font-size: var(--tm-h1-font-size);
  line-height: var(--tm-h1-line-height);
  font-weight: var(--tm-h1-font-weight);
}
\`\`\`

#### Spacing
\`\`\`css
/* Before */
.card { 
  padding: 16px;
  margin: 8px;
  border-radius: 8px;
}

/* After */
.card {
  padding: var(--tm-component-padding-md);
  margin: var(--tm-component-margin-xs);
  border-radius: var(--tm-radius-md);
}
\`\`\`

### 3. Validate Migration
- Run automated validation tools
- Test visual consistency
- Verify accessibility compliance
- Check performance impact

### 4. Update Documentation
- Document any custom tokens added
- Update component documentation
- Add usage examples
- Create team guidelines

## Common Migration Patterns

### Color Mappings
| Old Value | New Token |
|-----------|-----------|
| \`#004165\` | \`var(--tm-loyal-blue)\` |
| \`#772432\` | \`var(--tm-true-maroon)\` |
| \`#A9B2B1\` | \`var(--tm-cool-gray)\` |
| \`#F2DF74\` | \`var(--tm-happy-yellow)\` |
| \`#000000\` | \`var(--tm-black)\` |
| \`#FFFFFF\` | \`var(--tm-white)\` |

### Typography Mappings
| Old Value | New Token |
|-----------|-----------|
| \`48px\` (h1) | \`var(--tm-h1-font-size)\` |
| \`36px\` (h2) | \`var(--tm-h2-font-size)\` |
| \`30px\` (h3) | \`var(--tm-h3-font-size)\` |
| \`16px\` (body) | \`var(--tm-body-medium-font-size)\` |
| \`14px\` (small) | \`var(--tm-body-small-font-size)\` |

### Spacing Mappings
| Old Value | New Token |
|-----------|-----------|
| \`4px\` | \`var(--tm-space-xs)\` |
| \`8px\` | \`var(--tm-space-sm)\` |
| \`16px\` | \`var(--tm-space-md)\` |
| \`24px\` | \`var(--tm-space-lg)\` |
| \`32px\` | \`var(--tm-space-xl)\` |
| \`44px\` | \`var(--tm-touch-target)\` |

## Validation Checklist
- [ ] All hardcoded colors replaced
- [ ] Typography uses semantic tokens
- [ ] Spacing follows token system
- [ ] Gradients follow one-per-screen rule
- [ ] Touch targets meet minimum size
- [ ] Contrast ratios validated
- [ ] Performance tested
- [ ] Documentation updated
`
}

/**
 * Generate token reference card
 */
export function generateTokenReferenceCard(): string {
  return `# Design Token Quick Reference

## Colors
\`\`\`css
--tm-loyal-blue: #004165;     /* Primary brand color */
--tm-true-maroon: #772432;    /* Secondary brand color */
--tm-cool-gray: #A9B2B1;      /* Neutral color */
--tm-happy-yellow: #F2DF74;   /* Accent color */
--tm-black: #000000;          /* Text color */
--tm-white: #FFFFFF;          /* Background color */
\`\`\`

## Typography
\`\`\`css
--tm-font-headline: "Montserrat", system-ui, sans-serif;
--tm-font-body: "Source Sans 3", system-ui, sans-serif;
--tm-h1-font-size: 48px;      /* Main headings */
--tm-h2-font-size: 36px;      /* Section headings */
--tm-h3-font-size: 30px;      /* Subsection headings */
--tm-body-medium-font-size: 16px; /* Body text */
--tm-body-small-font-size: 14px;  /* Small text */
\`\`\`

## Spacing
\`\`\`css
--tm-touch-target: 44px;      /* Minimum interactive size */
--tm-space-xs: 4px;           /* Tight spacing */
--tm-space-sm: 8px;           /* Small spacing */
--tm-space-md: 16px;          /* Medium spacing */
--tm-space-lg: 24px;          /* Large spacing */
--tm-space-xl: 32px;          /* Extra large spacing */
\`\`\`

## Gradients (Max 1 per screen)
\`\`\`css
--tm-gradient-loyal-blue: linear-gradient(135deg, #004165 0%, #006094 100%);
--tm-gradient-true-maroon: linear-gradient(135deg, #3B0104 0%, #781327 100%);
--tm-gradient-cool-gray: linear-gradient(135deg, #A9B2B1 0%, #F5F5F5 100%);
\`\`\`

## Shadows
\`\`\`css
--tm-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--tm-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--tm-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--tm-shadow-focus: 0 0 0 3px rgba(0, 65, 101, 0.1);
\`\`\`

## Border Radius
\`\`\`css
--tm-radius-sm: 4px;          /* Small radius */
--tm-radius-md: 8px;          /* Medium radius */
--tm-radius-lg: 12px;         /* Large radius */
\`\`\`

## Usage Examples
\`\`\`css
/* Primary button */
.tm-btn-primary {
  background-color: var(--tm-loyal-blue);
  color: var(--tm-white);
  font-family: var(--tm-font-headline);
  font-size: var(--tm-body-medium-font-size);
  padding: var(--tm-component-padding-sm);
  border-radius: var(--tm-radius-sm);
  min-height: var(--tm-touch-target);
}

/* Card component */
.tm-card {
  background-color: var(--tm-white);
  padding: var(--tm-component-padding-md);
  border-radius: var(--tm-radius-md);
  box-shadow: var(--tm-shadow-md);
}

/* Heading */
.tm-h1 {
  font-family: var(--tm-font-headline);
  font-size: var(--tm-h1-font-size);
  line-height: var(--tm-h1-line-height);
  font-weight: var(--tm-h1-font-weight);
  color: var(--tm-loyal-blue);
}
\`\`\`
`
}
