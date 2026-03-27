/**
 * Lazy Chart Components (#223)
 *
 * Code-split versions of chart components that import Recharts.
 * Uses React.lazy + Suspense with ChartSkeleton fallback.
 *
 * Usage:
 *   import { LazyMembershipTrendChart } from './LazyCharts'
 *   // renders ChartSkeleton while Recharts loads
 */

import React, { Suspense, ComponentProps } from 'react'
import { ChartSkeleton } from './ChartSkeleton'

const MembershipTrendChartLazy = React.lazy(() =>
  import('./MembershipTrendChart').then(m => ({
    default: m.MembershipTrendChart,
  }))
)

const MembershipPaymentsChartLazy = React.lazy(() =>
  import('./MembershipPaymentsChart').then(m => ({
    default: m.MembershipPaymentsChart,
  }))
)

const YearOverYearComparisonLazy = React.lazy(() =>
  import('./YearOverYearComparison').then(m => ({
    default: m.YearOverYearComparison,
  }))
)

const HistoricalRankChartLazy = React.lazy(
  () => import('./HistoricalRankChart')
)

const FullYearRankingChartLazy = React.lazy(
  () => import('./FullYearRankingChart')
)

const ClubStatusChartLazy = React.lazy(() => import('./ClubStatusChart'))

const EducationalAwardsChartLazy = React.lazy(
  () => import('./EducationalAwardsChart')
)

const ComparisonPanelLazy = React.lazy(() => import('./ComparisonPanel'))

/**
 * HOC that wraps a lazy component in Suspense with ChartSkeleton fallback.
 */
function withChartSuspense<P extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>,
  height = 300
) {
  const Wrapped = (props: P) => (
    <Suspense fallback={<ChartSkeleton height={height} />}>
      <LazyComponent {...props} />
    </Suspense>
  )
  return Wrapped
}

// Export lazy-wrapped chart components
export const LazyMembershipTrendChart = withChartSuspense(
  MembershipTrendChartLazy
)
export const LazyMembershipPaymentsChart = withChartSuspense(
  MembershipPaymentsChartLazy
)
export const LazyYearOverYearComparison = withChartSuspense(
  YearOverYearComparisonLazy,
  250
)
export const LazyHistoricalRankChart = withChartSuspense(
  HistoricalRankChartLazy
)
export const LazyFullYearRankingChart = withChartSuspense(
  FullYearRankingChartLazy
)
export const LazyClubStatusChart = withChartSuspense(ClubStatusChartLazy)
export const LazyEducationalAwardsChart = withChartSuspense(
  EducationalAwardsChartLazy,
  250
)
export const LazyComparisonPanel = withChartSuspense(ComparisonPanelLazy, 400)

// Re-export prop types for convenience
export type LazyMembershipTrendChartProps = ComponentProps<
  typeof LazyMembershipTrendChart
>
export type LazyMembershipPaymentsChartProps = ComponentProps<
  typeof LazyMembershipPaymentsChart
>
