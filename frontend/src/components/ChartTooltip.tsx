import React from 'react'

/**
 * Props for chart tooltip data items
 */
interface TooltipDataItem {
  label: string
  value: string | number
  color?: string
  unit?: string
}

/**
 * Props for the ChartTooltip component
 */
interface ChartTooltipProps {
  /** Whether the tooltip is active/visible */
  active?: boolean
  /** Tooltip payload from chart library */
  payload?: Array<{
    payload?: Record<string, unknown>
    value?: number
    dataKey?: string
    color?: string
    name?: string
  }>
  /** Label for the tooltip (usually x-axis value) */
  label?: string
  /** Custom title for the tooltip */
  title?: string
  /** Custom data items to display */
  data?: TooltipDataItem[]
  /** Optional formatter for values */
  valueFormatter?: (value: number, name?: string) => string
  /** Optional formatter for labels */
  labelFormatter?: (label: string) => string
}

/**
 * Brand-compliant Chart Tooltip Component
 *
 * Provides accessible, brand-compliant tooltips for charts using
 * TM design patterns and typography.
 *
 * Features:
 * - Brand-compliant typography and colors
 * - WCAG AA compliant contrast ratios
 * - Consistent styling across all charts
 * - Flexible data display
 * - Accessible color indicators
 *
 * @component
 * @example
 * ```tsx
 * // Used with Recharts
 * <Tooltip content={<ChartTooltip />} />
 *
 * // Custom usage
 * <ChartTooltip
 *   active={true}
 *   title="January 2024"
 *   data={[
 *     { label: 'Active Clubs', value: 150, color: 'var(--tm-loyal-blue)' },
 *     { label: 'Suspended', value: 12, color: 'var(--tm-true-maroon)' }
 *   ]}
 * />
 * ```
 */
export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  title,
  data,
  valueFormatter,
  labelFormatter,
}) => {
  if (!active) {
    return null
  }

  // Use custom data if provided, otherwise process payload
  const tooltipData: TooltipDataItem[] =
    data ||
    payload?.map(entry => ({
      label: entry.name || entry.dataKey || 'Value',
      value: entry.value || 0,
      color: entry.color,
    })) ||
    []

  // Format the title/label
  const displayTitle =
    title || (labelFormatter ? labelFormatter(label || '') : label)

  // Default value formatter
  const formatValue = (value: number, name?: string): string => {
    if (valueFormatter) {
      return valueFormatter(value, name)
    }

    // Format numbers with appropriate precision
    if (typeof value === 'number') {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`
      } else if (value % 1 !== 0) {
        return value.toFixed(1)
      }
      return value.toString()
    }

    return String(value)
  }

  if (tooltipData.length === 0) {
    return null
  }

  return (
    <div
      className="bg-white border border-tm-cool-gray-20 rounded-lg shadow-lg p-3 max-w-xs"
      style={{
        boxShadow:
          '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* Title/Label */}
      {displayTitle && (
        <div className="font-tm-headline font-semibold text-tm-black mb-2 text-sm">
          {displayTitle}
        </div>
      )}

      {/* Data Items */}
      <div className="space-y-1">
        {tooltipData.map((item, index) => (
          <div key={index} className="flex justify-between items-center gap-4">
            {/* Label with color indicator */}
            <div className="flex items-center gap-2 min-w-0">
              {item.color && (
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
              )}
              <span className="font-tm-body text-tm-cool-gray text-sm truncate">
                {item.label}:
              </span>
            </div>

            {/* Value */}
            <span className="font-tm-body font-semibold text-tm-black text-sm flex-shrink-0">
              {formatValue(Number(item.value), item.label)}
              {item.unit && (
                <span className="text-tm-cool-gray ml-1">{item.unit}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Props for specialized tooltip variants
 */
interface PercentageTooltipProps extends Omit<
  ChartTooltipProps,
  'valueFormatter'
> {
  /** Number of decimal places for percentages */
  precision?: number
}

/**
 * Specialized tooltip for percentage data
 */
const PercentageTooltip: React.FC<PercentageTooltipProps> = ({
  precision = 1,
  ...props
}) => {
  const valueFormatter = (value: number): string => {
    return `${value.toFixed(precision)}%`
  }

  return <ChartTooltip {...props} valueFormatter={valueFormatter} />
}

/**
 * Props for currency tooltip
 */
interface CurrencyTooltipProps extends Omit<
  ChartTooltipProps,
  'valueFormatter'
> {
  /** Currency symbol */
  currency?: string
  /** Number of decimal places */
  precision?: number
}

/**
 * Specialized tooltip for currency data
 */
const CurrencyTooltip: React.FC<CurrencyTooltipProps> = ({
  currency = '$',
  precision = 0,
  ...props
}) => {
  const valueFormatter = (value: number): string => {
    const formatted = value.toFixed(precision)
    return `${currency}${Number(formatted).toLocaleString()}`
  }

  return <ChartTooltip {...props} valueFormatter={valueFormatter} />
}

/**
 * Props for date-based tooltip
 */
interface DateTooltipProps extends Omit<ChartTooltipProps, 'labelFormatter'> {
  /** Date format options */
  dateFormat?: Intl.DateTimeFormatOptions
}

/**
 * Specialized tooltip for date-based charts
 */
const DateTooltip: React.FC<DateTooltipProps> = ({
  dateFormat = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  },
  ...props
}) => {
  const labelFormatter = (label: string): string => {
    try {
      const date = new Date(label)
      return date.toLocaleDateString('en-US', dateFormat)
    } catch {
      return label
    }
  }

  return <ChartTooltip {...props} labelFormatter={labelFormatter} />
}

/**
 * Props for membership tooltip
 */
type MembershipTooltipProps = Omit<ChartTooltipProps, 'valueFormatter'>

/**
 * Specialized tooltip for membership data
 */
const MembershipTooltip: React.FC<MembershipTooltipProps> = props => {
  const valueFormatter = (value: number, name?: string): string => {
    const formatted = Math.round(value).toLocaleString()

    // Add appropriate unit based on the data type
    if (
      name?.toLowerCase().includes('percent') ||
      name?.toLowerCase().includes('%')
    ) {
      return `${value.toFixed(1)}%`
    } else if (name?.toLowerCase().includes('member')) {
      return `${formatted} member${value !== 1 ? 's' : ''}`
    } else if (name?.toLowerCase().includes('club')) {
      return `${formatted} club${value !== 1 ? 's' : ''}`
    }

    return formatted
  }

  return <ChartTooltip {...props} valueFormatter={valueFormatter} />
}

/**
 * Export all tooltip components
 */
export {
  ChartTooltip as default,
  PercentageTooltip,
  CurrencyTooltip,
  DateTooltip,
  MembershipTooltip,
}
