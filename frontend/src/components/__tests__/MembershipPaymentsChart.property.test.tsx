/**
 * MembershipPaymentsChart Property Tests
 *
 * **Feature: membership-payments-chart, Property 1: Trend Line Rendering**
 * **Validates: Requirements 1.3**
 *
 * Property-based tests to verify that for any valid payment trend data array
 * with at least one data point, the MembershipPaymentsChart SHALL render
 * a line chart with the correct number of data points.
 */

import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MembershipPaymentsChart } from '../MembershipPaymentsChart'
import {
  renderWithProviders,
  cleanupAllResources,
} from '../../__tests__/utils/componentTestUtils'
import type { PaymentTrendDataPoint } from '../../utils/paymentTrend'
import type {
  MultiYearPaymentData,
  PaymentStatistics,
} from '../../hooks/usePaymentsTrend'

// Arbitrary generator for payment trend data points
const paymentTrendDataPointArb: fc.Arbitrary<PaymentTrendDataPoint> = fc.record(
  {
    date: fc.integer({ min: 0, max: 2000 }).map(dayOffset => {
      const baseDate = new Date('2020-07-01')
      baseDate.setDate(baseDate.getDate() + dayOffset)
      return baseDate.toISOString().split('T')[0] ?? '2024-01-01'
    }),
    payments: fc.integer({ min: 0, max: 50000 }),
    programYearDay: fc.integer({ min: 0, max: 365 }),
  }
)

// Arbitrary generator for payment trend array (non-empty)
const paymentTrendArrayArb: fc.Arbitrary<PaymentTrendDataPoint[]> = fc
  .array(paymentTrendDataPointArb, { minLength: 1, maxLength: 50 })
  .map(arr => {
    // Ensure unique programYearDays and sort by programYearDay
    const uniqueDays = new Map<number, PaymentTrendDataPoint>()
    arr.forEach(point => {
      if (!uniqueDays.has(point.programYearDay)) {
        uniqueDays.set(point.programYearDay, point)
      }
    })
    return Array.from(uniqueDays.values()).sort(
      (a, b) => a.programYearDay - b.programYearDay
    )
  })

// Arbitrary generator for payment statistics
const paymentStatisticsArb: fc.Arbitrary<PaymentStatistics> = fc.record({
  currentPayments: fc.integer({ min: 0, max: 50000 }),
  paymentBase: fc.option(fc.integer({ min: 0, max: 50000 }), { nil: null }),
  yearOverYearChange: fc.option(fc.integer({ min: -10000, max: 10000 }), {
    nil: null,
  }),
  trendDirection: fc.option(
    fc.constantFrom<'up' | 'down' | 'stable'>('up', 'down', 'stable'),
    { nil: null }
  ),
})

// Arbitrary generator for multi-year payment data
const multiYearPaymentDataArb: fc.Arbitrary<MultiYearPaymentData | null> =
  fc.option(
    fc.record({
      currentYear: fc.record({
        label: fc.constantFrom('2024-2025', '2025-2026', '2023-2024'),
        data: paymentTrendArrayArb,
      }),
      previousYears: fc.array(
        fc.record({
          label: fc.constantFrom('2023-2024', '2022-2023', '2021-2022'),
          data: paymentTrendArrayArb,
        }),
        { minLength: 0, maxLength: 2 }
      ),
    }),
    { nil: null }
  )

describe('MembershipPaymentsChart Property Tests', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('Property 1: Trend Line Rendering', () => {
    /**
     * Property: For any valid payment trend data array with at least one data point,
     * the MembershipPaymentsChart SHALL render a line chart.
     *
     * **Validates: Requirements 1.3**
     */
    it('should render chart when payment trend data has at least one data point', () => {
      fc.assert(
        fc.property(
          fc.record({
            paymentsTrend: paymentTrendArrayArb,
            statistics: paymentStatisticsArb,
          }),
          ({ paymentsTrend, statistics }) => {
            cleanupAllResources()

            renderWithProviders(
              <MembershipPaymentsChart
                paymentsTrend={paymentsTrend}
                statistics={statistics}
                isLoading={false}
              />
            )

            // Chart container should be rendered
            const chartContainer = screen.getByRole('img', {
              name: /line chart showing ytd membership payments/i,
            })
            expect(chartContainer).toBeInTheDocument()

            // Chart title should be visible
            expect(
              screen.getByText('Membership Payments Trend')
            ).toBeInTheDocument()

            cleanupAllResources()
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Property: For any valid payment trend data, the chart SHALL display
     * the current YTD payments statistic.
     *
     * **Validates: Requirements 6.1**
     */
    it('should display current YTD payments statistic', () => {
      fc.assert(
        fc.property(
          fc.record({
            paymentsTrend: paymentTrendArrayArb,
            statistics: paymentStatisticsArb,
          }),
          ({ paymentsTrend, statistics }) => {
            cleanupAllResources()

            renderWithProviders(
              <MembershipPaymentsChart
                paymentsTrend={paymentsTrend}
                statistics={statistics}
                isLoading={false}
              />
            )

            // Current YTD Payments label should be visible
            const currentYTDLabel = screen.getByText('Current YTD Payments')
            expect(currentYTDLabel).toBeInTheDocument()

            // The value should be displayed within the Current YTD Payments section
            const currentYTDSection = currentYTDLabel.closest('div')
            expect(currentYTDSection).toBeInTheDocument()
            expect(
              within(currentYTDSection!).getByText(
                statistics.currentPayments.toLocaleString()
              )
            ).toBeInTheDocument()

            cleanupAllResources()
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Property: When isLoading is true, the chart SHALL display a loading skeleton
     * instead of the chart content.
     *
     * **Validates: Requirements 4.1**
     */
    it('should display loading skeleton when isLoading is true', () => {
      fc.assert(
        fc.property(
          fc.record({
            paymentsTrend: paymentTrendArrayArb,
            statistics: paymentStatisticsArb,
          }),
          ({ paymentsTrend, statistics }) => {
            cleanupAllResources()

            renderWithProviders(
              <MembershipPaymentsChart
                paymentsTrend={paymentsTrend}
                statistics={statistics}
                isLoading={true}
              />
            )

            // Loading skeleton should be visible
            const loadingElement = screen.getByRole('status', {
              name: /loading chart/i,
            })
            expect(loadingElement).toBeInTheDocument()

            // Chart should NOT be visible
            const chartContainer = screen.queryByRole('img', {
              name: /line chart showing ytd membership payments/i,
            })
            expect(chartContainer).not.toBeInTheDocument()

            cleanupAllResources()
          }
        ),
        { numRuns: 10 }
      )
    })

    /**
     * Property: When payment trend data is empty, the chart SHALL display
     * an empty state message.
     *
     * **Validates: Requirements 4.2**
     */
    it('should display empty state when payment trend data is empty', () => {
      fc.assert(
        fc.property(paymentStatisticsArb, statistics => {
          cleanupAllResources()

          renderWithProviders(
            <MembershipPaymentsChart
              paymentsTrend={[]}
              statistics={statistics}
              isLoading={false}
            />
          )

          // Empty state should be visible
          expect(
            screen.getByText('No Payment Data Available')
          ).toBeInTheDocument()

          // Chart should NOT be visible
          const chartContainer = screen.queryByRole('img', {
            name: /line chart showing ytd membership payments/i,
          })
          expect(chartContainer).not.toBeInTheDocument()

          cleanupAllResources()
        }),
        { numRuns: 10 }
      )
    })

    /**
     * Property: When year-over-year change is available, the chart SHALL display
     * the change value with appropriate trend indicator.
     *
     * **Validates: Requirements 6.2, 6.4**
     */
    it('should display year-over-year change when available', () => {
      fc.assert(
        fc.property(
          fc.record({
            paymentsTrend: paymentTrendArrayArb,
            currentPayments: fc.integer({ min: 0, max: 50000 }),
            paymentBase: fc.option(fc.integer({ min: 0, max: 50000 }), {
              nil: null,
            }),
            yearOverYearChange: fc.integer({ min: -10000, max: 10000 }),
          }),
          ({
            paymentsTrend,
            currentPayments,
            paymentBase,
            yearOverYearChange,
          }) => {
            const trendDirection: 'up' | 'down' | 'stable' =
              yearOverYearChange > 0
                ? 'up'
                : yearOverYearChange < 0
                  ? 'down'
                  : 'stable'

            const statistics: PaymentStatistics = {
              currentPayments,
              paymentBase,
              yearOverYearChange,
              trendDirection,
            }

            cleanupAllResources()

            renderWithProviders(
              <MembershipPaymentsChart
                paymentsTrend={paymentsTrend}
                statistics={statistics}
                isLoading={false}
              />
            )

            // Year-over-Year label should be visible
            expect(screen.getByText('Year-over-Year')).toBeInTheDocument()

            // The change value should be displayed with sign (may appear multiple times)
            const expectedText =
              yearOverYearChange >= 0
                ? `+${yearOverYearChange}`
                : `${yearOverYearChange}`
            const changeElements = screen.getAllByText(expectedText)
            expect(changeElements.length).toBeGreaterThan(0)

            cleanupAllResources()
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Property: When payment base is available, the chart SHALL display
     * the payment base value.
     *
     * **Validates: Requirements 6.3**
     */
    it('should display payment base when available', () => {
      fc.assert(
        fc.property(
          fc.record({
            paymentsTrend: paymentTrendArrayArb,
            currentPayments: fc.integer({ min: 0, max: 50000 }),
            paymentBase: fc.integer({ min: 1, max: 50000 }),
            yearOverYearChange: fc.option(
              fc.integer({ min: -10000, max: 10000 }),
              { nil: null }
            ),
            trendDirection: fc.option(
              fc.constantFrom<'up' | 'down' | 'stable'>('up', 'down', 'stable'),
              { nil: null }
            ),
          }),
          ({
            paymentsTrend,
            currentPayments,
            paymentBase,
            yearOverYearChange,
            trendDirection,
          }) => {
            const statistics: PaymentStatistics = {
              currentPayments,
              paymentBase,
              yearOverYearChange,
              trendDirection,
            }

            cleanupAllResources()

            renderWithProviders(
              <MembershipPaymentsChart
                paymentsTrend={paymentsTrend}
                statistics={statistics}
                isLoading={false}
              />
            )

            // Payment Base label should be visible
            expect(screen.getByText('Payment Base')).toBeInTheDocument()

            // The payment base value should be displayed (find within the Payment Base section)
            const paymentBaseSection = screen
              .getByText('Payment Base')
              .closest('div')
            expect(paymentBaseSection).toBeInTheDocument()
            expect(
              within(paymentBaseSection!).getByText(
                paymentBase.toLocaleString()
              )
            ).toBeInTheDocument()

            cleanupAllResources()
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Property: When payment base is null, the chart SHALL display "N/A"
     * for the payment base.
     *
     * **Validates: Requirements 6.3**
     */
    it('should display N/A when payment base is null', () => {
      fc.assert(
        fc.property(
          fc.record({
            paymentsTrend: paymentTrendArrayArb,
            currentPayments: fc.integer({ min: 0, max: 50000 }),
            yearOverYearChange: fc.option(
              fc.integer({ min: -10000, max: 10000 }),
              { nil: null }
            ),
            trendDirection: fc.option(
              fc.constantFrom<'up' | 'down' | 'stable'>('up', 'down', 'stable'),
              { nil: null }
            ),
          }),
          ({
            paymentsTrend,
            currentPayments,
            yearOverYearChange,
            trendDirection,
          }) => {
            const statistics: PaymentStatistics = {
              currentPayments,
              paymentBase: null,
              yearOverYearChange,
              trendDirection,
            }

            cleanupAllResources()

            renderWithProviders(
              <MembershipPaymentsChart
                paymentsTrend={paymentsTrend}
                statistics={statistics}
                isLoading={false}
              />
            )

            // Payment Base label should be visible
            expect(screen.getByText('Payment Base')).toBeInTheDocument()

            // N/A should be displayed for payment base
            // Find the N/A within the Payment Base section
            const paymentBaseSection = screen
              .getByText('Payment Base')
              .closest('div')
            expect(paymentBaseSection).toBeInTheDocument()
            expect(
              within(paymentBaseSection!).getByText('N/A')
            ).toBeInTheDocument()

            cleanupAllResources()
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe('Multi-Year Data Rendering', () => {
    /**
     * Property: When multi-year data is provided, the chart SHALL render
     * the chart container successfully.
     *
     * **Validates: Requirements 2.3, 2.5**
     */
    it('should render chart with multi-year data', () => {
      fc.assert(
        fc.property(
          fc.record({
            paymentsTrend: paymentTrendArrayArb,
            multiYearData: multiYearPaymentDataArb.filter(
              d => d !== null
            ) as fc.Arbitrary<MultiYearPaymentData>,
            statistics: paymentStatisticsArb,
          }),
          ({ paymentsTrend, multiYearData, statistics }) => {
            cleanupAllResources()

            renderWithProviders(
              <MembershipPaymentsChart
                paymentsTrend={paymentsTrend}
                multiYearData={multiYearData}
                statistics={statistics}
                isLoading={false}
              />
            )

            // Chart container should be rendered
            const chartContainer = screen.getByRole('img', {
              name: /line chart showing ytd membership payments/i,
            })
            expect(chartContainer).toBeInTheDocument()

            // Chart title should be visible
            expect(
              screen.getByText('Membership Payments Trend')
            ).toBeInTheDocument()

            cleanupAllResources()
          }
        ),
        { numRuns: 15 }
      )
    })
  })

  describe('Accessibility', () => {
    /**
     * Property: The chart SHALL have appropriate ARIA labels for accessibility.
     *
     * **Validates: Requirements 5.2, 5.3**
     */
    it('should have appropriate ARIA labels', () => {
      fc.assert(
        fc.property(
          fc.record({
            paymentsTrend: paymentTrendArrayArb,
            statistics: paymentStatisticsArb,
          }),
          ({ paymentsTrend, statistics }) => {
            cleanupAllResources()

            renderWithProviders(
              <MembershipPaymentsChart
                paymentsTrend={paymentsTrend}
                statistics={statistics}
                isLoading={false}
              />
            )

            // Main container should have aria-label
            const mainContainer = screen.getByLabelText(
              'Membership payments trend chart'
            )
            expect(mainContainer).toBeInTheDocument()

            // Chart should have role="img" with descriptive aria-label
            const chartImg = screen.getByRole('img')
            expect(chartImg).toHaveAttribute('aria-label')
            expect(chartImg.getAttribute('aria-label')).toMatch(
              /line chart showing ytd membership payments/i
            )

            cleanupAllResources()
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
