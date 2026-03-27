import './ChartSkeleton.css'

interface ChartSkeletonProps {
  height?: number
  className?: string
}

/**
 * Pulsing skeleton placeholder shown while chart libraries load.
 */
export function ChartSkeleton({
  height = 300,
  className = '',
}: ChartSkeletonProps) {
  return (
    <div
      className={`chart-skeleton ${className}`}
      style={{ height }}
      role="status"
      aria-label="Loading chart"
    >
      <div className="chart-skeleton__bars">
        <div className="chart-skeleton__bar" style={{ height: '60%' }} />
        <div className="chart-skeleton__bar" style={{ height: '80%' }} />
        <div className="chart-skeleton__bar" style={{ height: '45%' }} />
        <div className="chart-skeleton__bar" style={{ height: '70%' }} />
        <div className="chart-skeleton__bar" style={{ height: '55%' }} />
        <div className="chart-skeleton__bar" style={{ height: '90%' }} />
        <div className="chart-skeleton__bar" style={{ height: '65%' }} />
      </div>
      <span className="chart-skeleton__label">Loading chart…</span>
    </div>
  )
}
