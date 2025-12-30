/**
 * Validation Error Reporting
 *
 * Comprehensive error reporting system with specific error codes and suggestions
 */

import { ValidationError } from './brandValidation'
import { RecoveryResult } from './errorRecovery'

export interface ValidationReport {
  timestamp: string
  totalErrors: number
  errorsByType: Record<string, number>
  errorsByRule: Record<string, number>
  errorsBySeverity: Record<string, number>
  errors: ValidationError[]
  recoveryResults?: RecoveryResult[]
  summary: string
}

export interface ReportingOptions {
  includeStackTrace: boolean
  includeElementInfo: boolean
  includeRecoveryInfo: boolean
  groupByType: boolean
  sortBySeverity: boolean
}

const DEFAULT_REPORTING_OPTIONS: ReportingOptions = {
  includeStackTrace: false,
  includeElementInfo: true,
  includeRecoveryInfo: true,
  groupByType: true,
  sortBySeverity: true,
}

// Error code mappings
export const ERROR_CODES = {
  // Color Validation (CV001-CV004)
  CV001: 'BRAND_COLOR_VIOLATION',
  CV002: 'CONTRAST_RATIO_INSUFFICIENT',
  CV003: 'GRADIENT_LIMIT_EXCEEDED',
  CV004: 'GRADIENT_CONTRAST_VIOLATION',

  // Typography Validation (TV001-TV005)
  TV001: 'HEADLINE_FONT_VIOLATION',
  TV002: 'BODY_FONT_VIOLATION',
  TV003: 'FONT_SIZE_TOO_SMALL',
  TV004: 'LINE_HEIGHT_TOO_SMALL',
  TV005: 'PROHIBITED_TEXT_EFFECTS',

  // Accessibility Validation (AV001-AV004)
  AV001: 'TOUCH_TARGET_TOO_SMALL',
  AV002: 'HEADING_HIERARCHY_VIOLATION',
  AV003: 'FOCUS_INDICATOR_MISSING',
  AV004: 'SEMANTIC_MARKUP_MISSING',

  // Component Validation (CPV001-CPV004)
  CPV001: 'BUTTON_COLOR_VIOLATION',
  CPV002: 'CARD_COLOR_VIOLATION',
  CPV003: 'NAVIGATION_COLOR_VIOLATION',
  CPV004: 'STATUS_COLOR_VIOLATION',
} as const

// Detailed error descriptions
export const ERROR_DESCRIPTIONS = {
  CV001:
    'Element uses a color that is not part of the official Toastmasters brand palette. Only approved brand colors should be used to maintain visual consistency.',
  CV002:
    'Text and background color combination does not meet WCAG AA accessibility standards. Insufficient contrast can make content difficult to read for users with visual impairments.',
  CV003:
    'Multiple gradients detected on the same screen or view. Brand guidelines limit gradient usage to one per screen to avoid visual clutter.',
  CV004:
    'Text overlay on gradient background does not have sufficient contrast. Gradient backgrounds can make text difficult to read without proper contrast validation.',
  TV001:
    'Headline element does not use the required Montserrat font family. Headlines should use Montserrat for brand consistency.',
  TV002:
    'Body text element does not use the required Source Sans 3 font family. Body text should use Source Sans 3 for optimal readability.',
  TV003:
    'Font size is below the minimum 14px requirement for body text. Smaller text can be difficult to read and fails accessibility guidelines.',
  TV004:
    'Line height is below the minimum 1.4 ratio requirement. Insufficient line height reduces text readability and accessibility.',
  TV005:
    'Element uses prohibited text effects such as drop-shadow, outline, or glow. These effects are not allowed by brand guidelines.',
  AV001:
    'Interactive element does not meet the minimum 44px touch target requirement. Smaller touch targets are difficult to use on mobile devices.',
  AV002:
    'Heading hierarchy is not properly structured. Headings should follow a logical order (h1 → h2 → h3) for accessibility.',
  AV003:
    'Interactive element lacks visible focus indicators. Focus indicators are required for keyboard navigation accessibility.',
  AV004:
    'Interactive element lacks proper semantic markup or ARIA roles. Semantic markup is essential for screen reader accessibility.',
  CPV001:
    'Primary button does not use the required TM Loyal Blue background color. Primary buttons should use #004165 for brand consistency.',
  CPV002:
    'Card component does not use approved background colors. Cards should use TM Cool Gray (#A9B2B1) or TM White (#FFFFFF).',
  CPV003:
    'Navigation component does not use the required TM Loyal Blue background with white text. Navigation should use #004165 background with #FFFFFF text.',
  CPV004:
    'Status indicator does not use appropriate brand colors. Status indicators should use colors from the official brand palette.',
} as const

// Actionable suggestions
export const ERROR_SUGGESTIONS = {
  CV001: [
    'Replace custom color with TM Loyal Blue (#004165) for primary elements',
    'Use TM True Maroon (#772432) for emphasis or secondary sections',
    'Use TM Cool Gray (#A9B2B1) for background panels and cards',
    'Use TM Happy Yellow (#F2DF74) for highlights and accents',
    'Use TM Black (#000000) for primary text or TM White (#FFFFFF) for backgrounds',
  ],
  CV002: [
    'Use TM Black (#000000) text on light backgrounds',
    'Use TM White (#FFFFFF) text on dark backgrounds',
    'Test color combinations with a contrast checker tool',
    'Consider using a darker or lighter brand color alternative',
    'Add a semi-transparent overlay to improve contrast',
  ],
  CV003: [
    'Remove additional gradients from the current screen/view',
    'Combine multiple gradient areas into a single design element',
    'Replace gradients with solid brand colors where possible',
    'Move gradient to a different screen or page',
  ],
  CV004: [
    'Add a semi-transparent overlay between gradient and text',
    'Use TM White (#FFFFFF) text on dark gradients',
    'Use TM Black (#000000) text on light gradients',
    'Test text contrast against the darkest gradient color',
  ],
  TV001: [
    'Change font-family to "Montserrat", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
    'Add the tm-headline class to use predefined headline styles',
    'Ensure Montserrat font is loaded via Google Fonts',
  ],
  TV002: [
    'Change font-family to "Source Sans 3", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
    'Add the tm-body class to use predefined body text styles',
    'Ensure Source Sans 3 font is loaded via Google Fonts',
  ],
  TV003: [
    'Increase font-size to minimum 14px',
    'Use relative units (rem/em) based on 14px minimum',
    'Apply the tm-body class for consistent body text sizing',
  ],
  TV004: [
    'Increase line-height to minimum 1.4',
    'Use unitless line-height values for better scaling',
    'Apply CSS custom property --tm-line-height-min: 1.4',
  ],
  TV005: [
    'Remove text-shadow, filter, or -webkit-text-stroke properties',
    'Use brand colors for emphasis instead of text effects',
    'Consider using font-weight or color changes for emphasis',
  ],
  AV001: [
    'Increase width and height to minimum 44px',
    'Add padding to expand the clickable area',
    'Use min-width: 44px and min-height: 44px CSS properties',
    'Apply the tm-touch-target utility class',
  ],
  AV002: [
    'Ensure heading levels follow logical order (h1 → h2 → h3)',
    'Use only one h1 per page',
    'Do not skip heading levels',
    'Consider using ARIA headings for complex layouts',
  ],
  AV003: [
    'Add visible :focus styles with sufficient contrast',
    'Use outline or box-shadow for focus indicators',
    'Ensure focus indicators are not removed with outline: none',
    'Test keyboard navigation thoroughly',
  ],
  AV004: [
    'Use semantic HTML elements (button, a, input) for interactive content',
    'Add appropriate ARIA roles (role="button") when needed',
    'Include ARIA labels for screen reader accessibility',
    'Ensure proper keyboard event handlers',
  ],
  CPV001: [
    'Set background-color to #004165 (TM Loyal Blue)',
    'Use the tm-btn-primary class for consistent styling',
    'Ensure text color provides sufficient contrast',
  ],
  CPV002: [
    'Set background-color to #A9B2B1 (TM Cool Gray) or #FFFFFF (TM White)',
    'Use the tm-card class for consistent card styling',
    'Ensure content has sufficient contrast on the background',
  ],
  CPV003: [
    'Set background-color to #004165 (TM Loyal Blue)',
    'Set text color to #FFFFFF (TM White)',
    'Use the tm-nav class for consistent navigation styling',
  ],
  CPV004: [
    'Use TM True Maroon (#772432) for alerts and warnings',
    'Use TM Happy Yellow (#F2DF74) for success states',
    'Use TM Loyal Blue (#004165) for informational states',
    'Apply appropriate tm-status-* classes',
  ],
} as const

// Generate comprehensive validation report
export function generateValidationReport(
  errors: ValidationError[],
  recoveryResults?: RecoveryResult[],
  options: Partial<ReportingOptions> = {}
): ValidationReport {
  const opts = { ...DEFAULT_REPORTING_OPTIONS, ...options }

  // Sort errors by severity if requested
  const sortedErrors = opts.sortBySeverity
    ? [...errors].sort((a, b) => {
        const severityOrder = { error: 0, warning: 1, info: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      })
    : errors

  // Calculate statistics
  const errorsByType = errors.reduce(
    (acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const errorsByRule = errors.reduce(
    (acc, error) => {
      acc[error.ruleId] = (acc[error.ruleId] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const errorsBySeverity = errors.reduce(
    (acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Generate summary
  const summary = generateSummary(
    errors,
    errorsByType,
    errorsBySeverity,
    recoveryResults
  )

  return {
    timestamp: new Date().toISOString(),
    totalErrors: errors.length,
    errorsByType,
    errorsByRule,
    errorsBySeverity,
    errors: sortedErrors,
    recoveryResults,
    summary,
  }
}

// Generate human-readable summary
function generateSummary(
  errors: ValidationError[],
  errorsByType: Record<string, number>,
  errorsBySeverity: Record<string, number>,
  recoveryResults?: RecoveryResult[]
): string {
  if (errors.length === 0) {
    return 'All brand compliance validations passed successfully.'
  }

  const lines: string[] = []

  lines.push(
    `Found ${errors.length} brand compliance issue${errors.length === 1 ? '' : 's'}:`
  )

  // Severity breakdown
  Object.entries(errorsBySeverity).forEach(([severity, count]) => {
    lines.push(`  ${count} ${severity}${count === 1 ? '' : 's'}`)
  })

  // Type breakdown
  lines.push('\nIssues by category:')
  Object.entries(errorsByType).forEach(([type, count]) => {
    const categoryName =
      {
        color: 'Color compliance',
        typography: 'Typography',
        accessibility: 'Accessibility',
        gradient: 'Gradient usage',
        component: 'Component design',
      }[type] || type

    lines.push(`  ${categoryName}: ${count} issue${count === 1 ? '' : 's'}`)
  })

  // Recovery results
  if (recoveryResults && recoveryResults.length > 0) {
    const successfulRecoveries = recoveryResults.filter(r => r.success).length
    const totalFixes = recoveryResults.reduce(
      (sum, r) => sum + r.appliedFixes.length,
      0
    )

    lines.push(
      `\nError recovery: ${successfulRecoveries}/${recoveryResults.length} successful, ${totalFixes} fixes applied`
    )
  }

  // Top issues
  const topIssues = Object.entries(errorsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  if (topIssues.length > 0) {
    lines.push('\nMost common issues:')
    topIssues.forEach(([type, count]) => {
      lines.push(`  ${type}: ${count} occurrence${count === 1 ? '' : 's'}`)
    })
  }

  return lines.join('\n')
}

// Format error for console output
export function formatErrorForConsole(error: ValidationError): string {
  const errorCode =
    ERROR_CODES[error.ruleId as keyof typeof ERROR_CODES] || error.ruleId
  const description =
    ERROR_DESCRIPTIONS[error.ruleId as keyof typeof ERROR_DESCRIPTIONS] ||
    error.message

  let output = `[${errorCode}] ${description}`

  if (error.element) {
    const elementInfo = getElementInfo(error.element)
    output += `\n  Element: ${elementInfo}`
  }

  const suggestions =
    ERROR_SUGGESTIONS[error.ruleId as keyof typeof ERROR_SUGGESTIONS]
  if (suggestions && suggestions.length > 0) {
    output += '\n  Suggestions:'
    suggestions.forEach(suggestion => {
      output += `\n    • ${suggestion}`
    })
  }

  return output
}

// Get element information for reporting
function getElementInfo(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase()
  const id = element.id ? `#${element.id}` : ''
  const classes = element.className
    ? `.${element.className.split(' ').join('.')}`
    : ''
  const text = element.textContent?.slice(0, 50) || ''

  return `<${tagName}${id}${classes}>${text ? ` "${text}..."` : ''}`
}

// Export validation report to different formats
export function exportReport(
  report: ValidationReport,
  format: 'json' | 'csv' | 'html' = 'json'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(report, null, 2)

    case 'csv':
      return exportToCsv(report)

    case 'html':
      return exportToHtml(report)

    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

function exportToCsv(report: ValidationReport): string {
  const headers = [
    'Rule ID',
    'Error Code',
    'Type',
    'Severity',
    'Message',
    'Element',
    'Suggestion',
  ]
  const rows = report.errors.map(error => [
    error.ruleId,
    ERROR_CODES[error.ruleId as keyof typeof ERROR_CODES] || error.ruleId,
    error.type,
    error.severity,
    error.message,
    error.element ? getElementInfo(error.element) : '',
    error.suggestion || '',
  ])

  return [headers, ...rows]
    .map(row =>
      row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')
}

function exportToHtml(report: ValidationReport): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Brand Compliance Validation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .error { border-left: 4px solid #e74c3c; padding: 10px; margin: 10px 0; background: #fdf2f2; }
    .warning { border-left: 4px solid #f39c12; padding: 10px; margin: 10px 0; background: #fef9e7; }
    .info { border-left: 4px solid #3498db; padding: 10px; margin: 10px 0; background: #ebf3fd; }
    .error-code { font-weight: bold; color: #2c3e50; }
    .suggestions { margin-top: 10px; }
    .suggestions ul { margin: 5px 0; }
  </style>
</head>
<body>
  <h1>Brand Compliance Validation Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <pre>${report.summary}</pre>
    <p><strong>Generated:</strong> ${report.timestamp}</p>
  </div>
  
  <h2>Detailed Issues</h2>
  ${report.errors
    .map(
      error => `
    <div class="${error.severity}">
      <div class="error-code">[${ERROR_CODES[error.ruleId as keyof typeof ERROR_CODES] || error.ruleId}] ${error.message}</div>
      <p>${ERROR_DESCRIPTIONS[error.ruleId as keyof typeof ERROR_DESCRIPTIONS] || error.message}</p>
      ${error.element ? `<p><strong>Element:</strong> ${getElementInfo(error.element)}</p>` : ''}
      ${
        ERROR_SUGGESTIONS[error.ruleId as keyof typeof ERROR_SUGGESTIONS]
          ? `
        <div class="suggestions">
          <strong>Suggestions:</strong>
          <ul>
            ${ERROR_SUGGESTIONS[error.ruleId as keyof typeof ERROR_SUGGESTIONS]!.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }
    </div>
  `
    )
    .join('')}
</body>
</html>
  `.trim()
}
