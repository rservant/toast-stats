/**
 * Brand Monitoring Dashboard Component
 *
 * Provides a comprehensive dashboard for monitoring brand compliance metrics,
 * performance data, and generating reports.
 */

import React, { useState, useEffect } from 'react'
import {
  BrandComplianceMetrics,
  PerformanceMetrics,
  ComplianceReport,
  trackBrandCompliance,
  generateComplianceReport,
  getComplianceHistory,
  getPerformanceHistory,
  generateWeeklyReport,
  generateMonthlyReport,
} from '../../utils/brandMonitoring'

interface BrandMonitoringDashboardProps {
  className?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export const BrandMonitoringDashboard: React.FC<
  BrandMonitoringDashboardProps
> = ({
  className = '',
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
}) => {
  const [currentMetrics, setCurrentMetrics] =
    useState<BrandComplianceMetrics | null>(null)
  const [performanceMetrics, setPerformanceMetrics] =
    useState<PerformanceMetrics | null>(null)
  const [complianceHistory, setComplianceHistory] = useState<
    BrandComplianceMetrics[]
  >([])
  const [performanceHistory, setPerformanceHistory] = useState<
    PerformanceMetrics[]
  >([])
  const [latestReport, setLatestReport] = useState<ComplianceReport | null>(
    null
  )
  const [weeklyReport, setWeeklyReport] = useState<{
    period: string
    startDate: string
    endDate: string
    summary:
      | string
      | {
          averageComplianceScore: number
          totalViolations: number
          reportCount: number
          trend: string
        }
    reports: ComplianceReport[]
    recommendations?: string[]
  } | null>(null)
  const [monthlyReport, setMonthlyReport] = useState<{
    period: string
    startDate: string
    endDate: string
    summary:
      | string
      | {
          averageComplianceScore: number
          totalViolations: number
          reportCount: number
          trend: string
        }
    reports: ComplianceReport[]
    recommendations?: string[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<
    'overview' | 'performance' | 'reports'
  >('overview')

  useEffect(() => {
    loadData()

    if (autoRefresh) {
      const interval = setInterval(loadData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const loadData = async () => {
    try {
      setIsLoading(true)

      // Load current metrics
      const metrics = trackBrandCompliance()
      setCurrentMetrics(metrics)

      // Load history
      const complianceHist = getComplianceHistory()
      const perfHist = getPerformanceHistory()
      setComplianceHistory(complianceHist)
      setPerformanceHistory(perfHist)

      // Get latest performance metrics
      if (perfHist.length > 0) {
        setPerformanceMetrics(perfHist[perfHist.length - 1])
      }

      // Generate reports
      const report = generateComplianceReport()
      setLatestReport(report)

      const weekly = generateWeeklyReport()
      setWeeklyReport(weekly)

      const monthly = generateMonthlyReport()
      setMonthlyReport(monthly)
    } catch (error) {
      console.error('Failed to load monitoring data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600'
    if (score >= 75) return 'text-yellow-600'
    if (score >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50'
      case 'high':
        return 'text-orange-600 bg-orange-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      case 'low':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (isLoading) {
    return (
      <div className={`brand-monitoring-dashboard ${className}`}>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tm-loyal-blue"></div>
          <span className="ml-2 text-tm-black">Loading monitoring data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`brand-monitoring-dashboard ${className}`}>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-tm-black font-tm-headline">
            Brand Compliance Monitoring
          </h2>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-tm-loyal-blue text-white rounded-md hover:bg-opacity-90 transition-colors"
          >
            Refresh Data
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'performance', label: 'Performance' },
            { key: 'reports', label: 'Reports' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() =>
                setActiveTab(tab.key as 'overview' | 'performance' | 'reports')
              }
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-tm-loyal-blue border-b-2 border-tm-loyal-blue'
                  : 'text-gray-600 hover:text-tm-loyal-blue'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && currentMetrics && (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Overall Compliance
                </h3>
                <div
                  className={`text-2xl font-bold ${getScoreColor(currentMetrics.overallComplianceScore)}`}
                >
                  {Math.round(currentMetrics.overallComplianceScore)}%
                </div>
              </div>

              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Color Compliance
                </h3>
                <div
                  className={`text-2xl font-bold ${getScoreColor(currentMetrics.colorComplianceRate)}`}
                >
                  {Math.round(currentMetrics.colorComplianceRate)}%
                </div>
              </div>

              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Typography Compliance
                </h3>
                <div
                  className={`text-2xl font-bold ${getScoreColor(currentMetrics.typographyComplianceRate)}`}
                >
                  {Math.round(currentMetrics.typographyComplianceRate)}%
                </div>
              </div>

              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Accessibility Score
                </h3>
                <div
                  className={`text-2xl font-bold ${getScoreColor(currentMetrics.accessibilityScore)}`}
                >
                  {Math.round(currentMetrics.accessibilityScore)}%
                </div>
              </div>
            </div>

            {/* Violations Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-tm-black mb-4">
                Current Violations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">
                    Total Violations: {currentMetrics.totalViolations}
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(currentMetrics.violationsByCategory).map(
                      ([category, count]) => (
                        <div
                          key={category}
                          className="flex justify-between text-sm"
                        >
                          <span className="capitalize">{category}:</span>
                          <span
                            className={
                              count > 0 ? 'text-red-600' : 'text-green-600'
                            }
                          >
                            {count}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">
                    Top Violation Rules
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(currentMetrics.violationsByRule)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .slice(0, 5)
                      .map(([rule, count]) => (
                        <div
                          key={rule}
                          className="flex justify-between text-sm"
                        >
                          <span>{rule}:</span>
                          <span className="text-red-600">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance Trend */}
            {complianceHistory.length > 1 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-tm-black mb-4">
                  Compliance Trend
                </h3>
                <div className="h-32 flex items-end space-x-2">
                  {complianceHistory.slice(-10).map((metrics, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-tm-loyal-blue rounded-t"
                      style={{ height: `${metrics.overallComplianceScore}%` }}
                      title={`${Math.round(metrics.overallComplianceScore)}% - ${new Date(metrics.timestamp).toLocaleString()}`}
                    />
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Last 10 measurements (hover for details)
                </div>
              </div>
            )}
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && performanceMetrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Font Loading Time
                </h3>
                <div className="text-2xl font-bold text-tm-black">
                  {Math.round(performanceMetrics.fontLoadingTime)}ms
                </div>
              </div>

              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  CSS Bundle Size
                </h3>
                <div className="text-2xl font-bold text-tm-black">
                  {Math.round(performanceMetrics.cssBundleSize / 1024)}KB
                </div>
              </div>

              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Validation Overhead
                </h3>
                <div className="text-2xl font-bold text-tm-black">
                  {Math.round(performanceMetrics.runtimeValidationOverhead)}ms
                </div>
              </div>

              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Page Load Time
                </h3>
                <div className="text-2xl font-bold text-tm-black">
                  {Math.round(performanceMetrics.pageLoadTime)}ms
                </div>
              </div>

              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Render Time
                </h3>
                <div className="text-2xl font-bold text-tm-black">
                  {Math.round(performanceMetrics.renderTime)}ms
                </div>
              </div>

              <div className="bg-tm-cool-gray bg-opacity-20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Memory Usage
                </h3>
                <div className="text-2xl font-bold text-tm-black">
                  {Math.round(performanceMetrics.memoryUsage / 1024 / 1024)}MB
                </div>
              </div>
            </div>

            {/* Performance History */}
            {performanceHistory.length > 1 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-tm-black mb-4">
                  Performance Trend
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      Font Loading Time (ms)
                    </h4>
                    <div className="h-16 flex items-end space-x-1">
                      {performanceHistory.slice(-20).map((perf, index) => (
                        <div
                          key={index}
                          className="flex-1 bg-tm-true-maroon rounded-t"
                          style={{
                            height: `${Math.min(perf.fontLoadingTime / 50, 100)}%`,
                          }}
                          title={`${Math.round(perf.fontLoadingTime)}ms`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      CSS Bundle Size (KB)
                    </h4>
                    <div className="h-16 flex items-end space-x-1">
                      {performanceHistory.slice(-20).map((perf, index) => (
                        <div
                          key={index}
                          className="flex-1 bg-tm-happy-yellow rounded-t"
                          style={{
                            height: `${Math.min(perf.cssBundleSize / 1024 / 10, 100)}%`,
                          }}
                          title={`${Math.round(perf.cssBundleSize / 1024)}KB`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Latest Report */}
            {latestReport && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-tm-black">
                    Latest Report
                  </h3>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(latestReport.severity)}`}
                  >
                    {latestReport.severity.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p>
                      <strong>Generated:</strong>{' '}
                      {new Date(latestReport.timestamp).toLocaleString()}
                    </p>
                    <p>
                      <strong>URL:</strong> {latestReport.url}
                    </p>
                    <p>
                      <strong>Viewport:</strong> {latestReport.viewport.width}x
                      {latestReport.viewport.height}
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>Violations:</strong>{' '}
                      {latestReport.violations.length}
                    </p>
                    <p>
                      <strong>Compliance Score:</strong>{' '}
                      {Math.round(
                        latestReport.brandMetrics.overallComplianceScore
                      )}
                      %
                    </p>
                  </div>
                </div>
                {latestReport.recommendations.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-700 mb-2">
                      Recommendations:
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                      {latestReport.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Weekly Report */}
            {weeklyReport && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-tm-black mb-4">
                  Weekly Summary
                </h3>
                {weeklyReport.summary &&
                typeof weeklyReport.summary === 'object' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p>
                        <strong>Average Compliance:</strong>{' '}
                        {weeklyReport.summary.averageComplianceScore}%
                      </p>
                      <p>
                        <strong>Total Violations:</strong>{' '}
                        {weeklyReport.summary.totalViolations}
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Reports Generated:</strong>{' '}
                        {weeklyReport.summary.reportCount}
                      </p>
                      <p>
                        <strong>Trend:</strong>
                        <span
                          className={`ml-1 ${
                            weeklyReport.summary.trend === 'improving'
                              ? 'text-green-600'
                              : weeklyReport.summary.trend === 'declining'
                                ? 'text-red-600'
                                : 'text-gray-600'
                          }`}
                        >
                          {weeklyReport.summary.trend}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Period:</strong>
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(weeklyReport.startDate).toLocaleDateString()}{' '}
                        - {new Date(weeklyReport.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">{weeklyReport.summary}</p>
                )}
              </div>
            )}

            {/* Monthly Report */}
            {monthlyReport && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-tm-black mb-4">
                  Monthly Summary
                </h3>
                {monthlyReport.summary &&
                typeof monthlyReport.summary === 'object' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p>
                        <strong>Average Compliance:</strong>{' '}
                        {monthlyReport.summary.averageComplianceScore}%
                      </p>
                      <p>
                        <strong>Total Violations:</strong>{' '}
                        {monthlyReport.summary.totalViolations}
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Reports Generated:</strong>{' '}
                        {monthlyReport.summary.reportCount}
                      </p>
                      <p>
                        <strong>Trend:</strong>
                        <span
                          className={`ml-1 ${
                            monthlyReport.summary.trend === 'improving'
                              ? 'text-green-600'
                              : monthlyReport.summary.trend === 'declining'
                                ? 'text-red-600'
                                : 'text-gray-600'
                          }`}
                        >
                          {monthlyReport.summary.trend}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Period:</strong>
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(monthlyReport.startDate).toLocaleDateString()}{' '}
                        - {new Date(monthlyReport.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">{monthlyReport.summary}</p>
                )}
                {monthlyReport.recommendations &&
                  monthlyReport.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-700 mb-2">
                        Monthly Recommendations:
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                        {monthlyReport.recommendations.map(
                          (rec: string, index: number) => (
                            <li key={index}>{rec}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BrandMonitoringDashboard
