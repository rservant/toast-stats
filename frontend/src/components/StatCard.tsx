import React from 'react'
import { Card } from './ui/Card'

export interface StatCardProps {
  name: string | React.ReactNode
  value: string | number
  change?: number
  changePercent?: number
  trend?: 'positive' | 'negative' | 'neutral'
  isLoading?: boolean
  footer?: React.ReactNode
}

const StatCard: React.FC<StatCardProps> = ({
  name,
  value,
  change,
  changePercent,
  trend = 'neutral',
  isLoading = false,
  footer,
}) => {
  // Determine trend color using brand colors
  const getTrendColor = () => {
    if (trend === 'positive') return 'tm-text-loyal-blue'
    if (trend === 'negative') return 'tm-text-true-maroon'
    return 'tm-text-cool-gray'
  }

  const getTrendBgColor = () => {
    if (trend === 'positive') return 'tm-bg-loyal-blue-10'
    if (trend === 'negative') return 'tm-bg-true-maroon-10'
    return 'tm-bg-cool-gray-20'
  }

  const getTrendIcon = () => {
    if (trend === 'positive') return '↑'
    if (trend === 'negative') return '↓'
    return '→'
  }

  if (isLoading) {
    return (
      <Card
        className="animate-pulse"
        aria-busy="true"
        aria-label="Loading statistics"
      >
        <div className="h-4 tm-bg-cool-gray tm-rounded-sm w-1/2 mb-4"></div>
        <div className="h-8 tm-bg-cool-gray tm-rounded-sm w-3/4 mb-3"></div>
        <div className="h-4 tm-bg-cool-gray tm-rounded-sm w-1/3"></div>
      </Card>
    )
  }

  const trendDescription =
    trend === 'positive'
      ? 'increasing'
      : trend === 'negative'
        ? 'decreasing'
        : 'stable'

  const nameText = typeof name === 'string' ? name : 'Statistic'

  return (
    <Card
      className="hover:shadow-lg transition-shadow duration-200"
      aria-label={`${nameText}: ${value}${changePercent !== undefined ? `, ${trendDescription} by ${Math.abs(changePercent).toFixed(1)}%` : ''}`}
    >
      <h3 className="tm-body-small font-medium tm-text-cool-gray mb-2">
        {name}
      </h3>
      <p className="tm-h2 tm-text-black mb-2 break-words" aria-live="polite">
        {value}
      </p>

      {(change !== undefined || changePercent !== undefined) && (
        <div
          className={`inline-flex items-center px-2.5 py-0.5 tm-rounded-lg tm-body-small font-medium ${getTrendBgColor()} ${getTrendColor()}`}
          role="status"
          aria-label={`Trend: ${trendDescription}${change !== undefined ? ` by ${Math.abs(change)} units` : ''}${changePercent !== undefined ? ` (${Math.abs(changePercent).toFixed(1)}%)` : ''}`}
        >
          <span className="mr-1" aria-hidden="true">
            {getTrendIcon()}
          </span>
          <span>
            {change !== undefined && (
              <span className="mr-1">
                {change > 0 ? '+' : ''}
                {change}
              </span>
            )}
            {changePercent !== undefined && (
              <span>
                ({changePercent > 0 ? '+' : ''}
                {changePercent.toFixed(1)}%)
              </span>
            )}
          </span>
        </div>
      )}

      {footer && <div className="mt-3">{footer}</div>}
    </Card>
  )
}

export default StatCard
