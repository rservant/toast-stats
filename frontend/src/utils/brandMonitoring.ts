/**
 * Brand Compliance Monitoring System
 *
 * Implements comprehensive monitoring and metrics tracking for Toastmasters brand compliance.
 * Tracks color compliance rate, typography compliance rate, accessibility score, and performance metrics.
 */

import {
  validatePage,
  ValidationError,
  colorValidationRules,
  typographyValidationRules,
  accessibilityValidationRules,
} from './brandValidation'

export interface BrandComplianceMetrics {
  colorComplianceRate: number
  typographyComplianceRate: number
  accessibilityScore: number
  touchTargetCompliance: number
  gradientUsageViolations: number
  overallComplianceScore: number
  totalElements: number
  totalViolations: number
  violationsByCategory: Record<string, number>
  violationsByRule: Record<string, number>
  timestamp: number
}

export interface PerformanceMetrics {
  fontLoadingTime: number
  cssBundleSize: number
  runtimeValidationOverhead: number
  buildTimeImpact: number
  pageLoadTime: number
  renderTime: number
  memoryUsage: number
  timestamp: number
}

export interface ComplianceReport {
  id: string
  timestamp: number
  url: string
  userAgent: string
  viewport: { width: number; height: number }
  brandMetrics: BrandComplianceMetrics
  performanceMetrics: PerformanceMetrics
  violations: ValidationError[]
  recommendations: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface MonitoringConfig {
  enabled: boolean
  reportingInterval: number // milliseconds
  performanceTracking: boolean
  autoReporting: boolean
  alertThresholds: {
    minComplianceScore: number
    maxViolations: number
    maxFontLoadTime: number
    maxBundleSize: number
  }
}

class BrandMonitoringService {
  private config: MonitoringConfig
  private metricsHistory: BrandComplianceMetrics[] = []
  private performanceHistory: PerformanceMetrics[] = []
  private reportHistory: ComplianceReport[] = []
  private observers: MutationObserver[] = []
  private performanceObserver: PerformanceObserver | null = null

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enabled:
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost',
      reportingInterval: 60000, // 1 minute
      performanceTracking: true,
      autoReporting: true,
      alertThresholds: {
        minComplianceScore: 85,
        maxViolations: 10,
        maxFontLoadTime: 3000,
        maxBundleSize: 500000, // 500KB
      },
      ...config,
    }

    if (this.config.enabled) {
      this.initialize()
    }
  }

  private initialize(): void {
    // Set up automatic monitoring
    if (this.config.autoReporting) {
      setInterval(() => {
        this.generateReport()
      }, this.config.reportingInterval)
    }

    // Set up performance monitoring
    if (this.config.performanceTracking && 'PerformanceObserver' in window) {
      this.setupPerformanceMonitoring()
    }

    // Set up DOM mutation monitoring for real-time compliance tracking
    this.setupDOMMonitoring()

    // Initial report generation
    setTimeout(() => {
      this.generateReport()
    }, 1000) // Wait for page to fully load
  }

  private setupPerformanceMonitoring(): void {
    try {
      this.performanceObserver = new PerformanceObserver(list => {
        const entries = list.getEntries()
        this.processPerformanceEntries(entries)
      })

      this.performanceObserver.observe({
        entryTypes: ['navigation', 'resource', 'measure', 'paint'],
      })
    } catch (error) {
      console.warn('Performance monitoring setup failed:', error)
    }
  }

  private setupDOMMonitoring(): void {
    const observer = new MutationObserver(mutations => {
      let shouldRevalidate = false

      mutations.forEach(mutation => {
        if (mutation.type === 'attributes') {
          const attributeName = mutation.attributeName
          if (attributeName === 'class' || attributeName === 'style') {
            shouldRevalidate = true
          }
        } else if (mutation.type === 'childList') {
          shouldRevalidate = true
        }
      })

      if (shouldRevalidate) {
        // Debounce revalidation
        if (this.revalidationTimeout) {
          clearTimeout(this.revalidationTimeout)
        }
        this.revalidationTimeout = setTimeout(() => {
          this.trackComplianceMetrics()
        }, 500)
      }
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      childList: true,
      subtree: true,
    })

    this.observers.push(observer)
  }

  private revalidationTimeout: ReturnType<typeof setTimeout> | null = null

  private processPerformanceEntries(entries: PerformanceEntry[]): void {
    entries.forEach(entry => {
      if (entry.entryType === 'resource' && entry.name.includes('font')) {
        // Track font loading performance
        this.trackFontLoadingTime(entry as PerformanceResourceTiming)
      } else if (entry.entryType === 'navigation') {
        // Track page load performance
        this.trackPageLoadTime(entry as PerformanceNavigationTiming)
      }
    })
  }

  private trackFontLoadingTime(entry: PerformanceResourceTiming): void {
    const fontLoadTime = entry.responseEnd - entry.requestStart

    if (fontLoadTime > this.config.alertThresholds.maxFontLoadTime) {
      this.triggerAlert('font-load-slow', {
        fontUrl: entry.name,
        loadTime: fontLoadTime,
        threshold: this.config.alertThresholds.maxFontLoadTime,
      })
    }
  }

  private trackPageLoadTime(entry: PerformanceNavigationTiming): void {
    const pageLoadTime = entry.loadEventEnd - entry.fetchStart

    // Store performance metrics
    const performanceMetrics: PerformanceMetrics = {
      fontLoadingTime: this.calculateAverageFontLoadTime(),
      cssBundleSize: this.estimateCSBundleSize(),
      runtimeValidationOverhead: this.measureValidationOverhead(),
      buildTimeImpact: 0, // This would be measured during build
      pageLoadTime,
      renderTime: entry.domContentLoadedEventEnd - entry.fetchStart,
      memoryUsage: this.getMemoryUsage(),
      timestamp: Date.now(),
    }

    this.performanceHistory.push(performanceMetrics)

    // Keep only last 100 entries
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100)
    }
  }

  public trackComplianceMetrics(): BrandComplianceMetrics {
    const violations = validatePage()
    const totalElements = document.querySelectorAll('*').length

    const colorViolations = violations.filter(v =>
      colorValidationRules.some(rule => rule.id === v.ruleId)
    )
    const typographyViolations = violations.filter(v =>
      typographyValidationRules.some(rule => rule.id === v.ruleId)
    )
    const accessibilityViolations = violations.filter(v =>
      accessibilityValidationRules.some(rule => rule.id === v.ruleId)
    )

    const touchTargetViolations = violations.filter(v => v.ruleId === 'AV001')
    const gradientViolations = violations.filter(v => v.ruleId === 'CV003')

    const colorElements = this.countElementsWithColors()
    const typographyElements = this.countTextElements()
    const interactiveElements = this.countInteractiveElements()

    const metrics: BrandComplianceMetrics = {
      colorComplianceRate:
        colorElements > 0
          ? Math.max(
              0,
              ((colorElements - colorViolations.length) / colorElements) * 100
            )
          : 100,
      typographyComplianceRate:
        typographyElements > 0
          ? Math.max(
              0,
              ((typographyElements - typographyViolations.length) /
                typographyElements) *
                100
            )
          : 100,
      accessibilityScore:
        interactiveElements > 0
          ? Math.max(
              0,
              ((interactiveElements - accessibilityViolations.length) /
                interactiveElements) *
                100
            )
          : 100,
      touchTargetCompliance:
        interactiveElements > 0
          ? Math.max(
              0,
              ((interactiveElements - touchTargetViolations.length) /
                interactiveElements) *
                100
            )
          : 100,
      gradientUsageViolations: gradientViolations.length,
      overallComplianceScore:
        totalElements > 0
          ? Math.max(
              0,
              ((totalElements - violations.length) / totalElements) * 100
            )
          : 100,
      totalElements,
      totalViolations: violations.length,
      violationsByCategory: this.categorizeViolations(violations),
      violationsByRule: this.countViolationsByRule(violations),
      timestamp: Date.now(),
    }

    this.metricsHistory.push(metrics)

    // Keep only last 100 entries
    if (this.metricsHistory.length > 100) {
      this.metricsHistory = this.metricsHistory.slice(-100)
    }

    // Check for alerts
    this.checkComplianceAlerts(metrics)

    return metrics
  }

  private countElementsWithColors(): number {
    const elements = document.querySelectorAll('*')
    let count = 0

    elements.forEach(element => {
      const computedStyle = window.getComputedStyle(element as HTMLElement)
      const backgroundColor = computedStyle.backgroundColor
      const color = computedStyle.color

      if (
        backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        color !== 'rgba(0, 0, 0, 0)'
      ) {
        count++
      }
    })

    return count
  }

  private countTextElements(): number {
    const textElements = document.querySelectorAll(
      'p, span, div, h1, h2, h3, h4, h5, h6, label, td, th, li, a'
    )
    return textElements.length
  }

  private countInteractiveElements(): number {
    const interactiveElements = document.querySelectorAll(
      'button, a, input, select, textarea, [role="button"], [tabindex]'
    )
    return interactiveElements.length
  }

  private categorizeViolations(
    violations: ValidationError[]
  ): Record<string, number> {
    const categories: Record<string, number> = {
      color: 0,
      typography: 0,
      accessibility: 0,
      component: 0,
      gradient: 0,
      spacing: 0,
    }

    violations.forEach(violation => {
      categories[violation.type] = (categories[violation.type] || 0) + 1
    })

    return categories
  }

  private countViolationsByRule(
    violations: ValidationError[]
  ): Record<string, number> {
    const ruleCount: Record<string, number> = {}

    violations.forEach(violation => {
      ruleCount[violation.ruleId] = (ruleCount[violation.ruleId] || 0) + 1
    })

    return ruleCount
  }

  private calculateAverageFontLoadTime(): number {
    const fontEntries = performance
      .getEntriesByType('resource')
      .filter(entry =>
        entry.name.includes('font')
      ) as PerformanceResourceTiming[]

    if (fontEntries.length === 0) return 0

    const totalTime = fontEntries.reduce(
      (sum, entry) => sum + (entry.responseEnd - entry.requestStart),
      0
    )

    return totalTime / fontEntries.length
  }

  private estimateCSBundleSize(): number {
    const cssEntries = performance
      .getEntriesByType('resource')
      .filter(entry =>
        entry.name.includes('.css')
      ) as PerformanceResourceTiming[]

    return cssEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)
  }

  private measureValidationOverhead(): number {
    const startTime = performance.now()
    validatePage()
    const endTime = performance.now()
    return endTime - startTime
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const perfMemory = performance as unknown as {
        memory?: { usedJSHeapSize?: number }
      }
      return perfMemory.memory?.usedJSHeapSize || 0
    }
    return 0
  }

  private checkComplianceAlerts(metrics: BrandComplianceMetrics): void {
    const { alertThresholds } = this.config

    if (metrics.overallComplianceScore < alertThresholds.minComplianceScore) {
      this.triggerAlert('compliance-low', {
        score: metrics.overallComplianceScore,
        threshold: alertThresholds.minComplianceScore,
        violations: metrics.totalViolations,
      })
    }

    if (metrics.totalViolations > alertThresholds.maxViolations) {
      this.triggerAlert('violations-high', {
        violations: metrics.totalViolations,
        threshold: alertThresholds.maxViolations,
        categories: metrics.violationsByCategory,
      })
    }
  }

  private triggerAlert(type: string, data: Record<string, unknown>): void {
    const alert = {
      type,
      timestamp: Date.now(),
      data,
      severity: this.getAlertSeverity(type, data),
    }

    console.warn(`Brand Compliance Alert [${type}]:`, alert)

    // In production, this would send alerts to monitoring service
    if (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost'
    ) {
      this.sendAlertToMonitoringService(alert)
    }
  }

  private getAlertSeverity(
    type: string,
    data: Record<string, unknown>
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'compliance-low':
        if (typeof data.score === 'number' && data.score < 50) return 'critical'
        if (typeof data.score === 'number' && data.score < 70) return 'high'
        return 'medium'
      case 'violations-high':
        if (typeof data.violations === 'number' && data.violations > 50)
          return 'critical'
        if (typeof data.violations === 'number' && data.violations > 25)
          return 'high'
        return 'medium'
      case 'font-load-slow':
        if (typeof data.loadTime === 'number' && data.loadTime > 5000)
          return 'high'
        return 'medium'
      default:
        return 'low'
    }
  }

  private sendAlertToMonitoringService(alert: {
    type: string
    timestamp: number
    data: Record<string, unknown>
    severity: 'low' | 'medium' | 'high' | 'critical'
  }): void {
    // This would integrate with external monitoring services like DataDog, New Relic, etc.
    // For now, we'll store it locally and could send to an API endpoint

    try {
      fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert),
      }).catch(error => {
        console.warn('Failed to send alert to monitoring service:', error)
      })
    } catch (error) {
      console.warn('Alert sending failed:', error)
    }
  }

  public generateReport(): ComplianceReport {
    const brandMetrics = this.trackComplianceMetrics()
    const performanceMetrics = this.getLatestPerformanceMetrics()
    const violations = validatePage()

    const report: ComplianceReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      brandMetrics,
      performanceMetrics,
      violations,
      recommendations: this.generateRecommendations(violations, brandMetrics),
      severity: this.calculateReportSeverity(brandMetrics, violations),
    }

    this.reportHistory.push(report)

    // Keep only last 50 reports
    if (this.reportHistory.length > 50) {
      this.reportHistory = this.reportHistory.slice(-50)
    }

    // Store report for later retrieval
    this.storeReport(report)

    return report
  }

  private getLatestPerformanceMetrics(): PerformanceMetrics {
    if (this.performanceHistory.length > 0) {
      return this.performanceHistory[this.performanceHistory.length - 1]
    }

    // Generate current performance metrics if none exist
    return {
      fontLoadingTime: this.calculateAverageFontLoadTime(),
      cssBundleSize: this.estimateCSBundleSize(),
      runtimeValidationOverhead: this.measureValidationOverhead(),
      buildTimeImpact: 0,
      pageLoadTime: 0,
      renderTime: 0,
      memoryUsage: this.getMemoryUsage(),
      timestamp: Date.now(),
    }
  }

  private generateRecommendations(
    _violations: ValidationError[],
    metrics: BrandComplianceMetrics
  ): string[] {
    const recommendations: string[] = []

    // Color compliance recommendations
    if (metrics.colorComplianceRate < 90) {
      recommendations.push(
        'Review color usage - ensure all colors match the official Toastmasters brand palette'
      )
    }

    // Typography recommendations
    if (metrics.typographyComplianceRate < 90) {
      recommendations.push(
        'Update typography - use Montserrat for headlines and Source Sans 3 for body text'
      )
    }

    // Accessibility recommendations
    if (metrics.accessibilityScore < 90) {
      recommendations.push(
        'Improve accessibility - ensure proper contrast ratios and touch target sizes'
      )
    }

    // Gradient recommendations
    if (metrics.gradientUsageViolations > 0) {
      recommendations.push(
        'Limit gradient usage - maximum one gradient per screen/view'
      )
    }

    // Performance recommendations
    const latestPerf = this.getLatestPerformanceMetrics()
    if (latestPerf.fontLoadingTime > 2000) {
      recommendations.push(
        'Optimize font loading - consider font preloading and display: swap'
      )
    }

    if (latestPerf.cssBundleSize > 300000) {
      recommendations.push(
        'Reduce CSS bundle size - remove unused styles and optimize CSS'
      )
    }

    // Specific rule recommendations
    const ruleViolations = metrics.violationsByRule
    Object.entries(ruleViolations).forEach(([ruleId, count]) => {
      if (count > 5) {
        recommendations.push(
          `Address ${ruleId} violations (${count} instances) - see validation rules documentation`
        )
      }
    })

    return recommendations
  }

  private calculateReportSeverity(
    metrics: BrandComplianceMetrics,
    violations: ValidationError[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const criticalViolations = violations.filter(
      v => v.severity === 'error'
    ).length
    const overallScore = metrics.overallComplianceScore

    if (criticalViolations > 20 || overallScore < 50) return 'critical'
    if (criticalViolations > 10 || overallScore < 70) return 'high'
    if (criticalViolations > 5 || overallScore < 85) return 'medium'
    return 'low'
  }

  private storeReport(report: ComplianceReport): void {
    try {
      // Store in localStorage for development
      const reports = this.getStoredReports()
      reports.push(report)

      // Keep only last 20 reports in storage
      const recentReports = reports.slice(-20)
      localStorage.setItem(
        'brandComplianceReports',
        JSON.stringify(recentReports)
      )

      // In production, send to monitoring API
      if (
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost'
      ) {
        this.sendReportToAPI(report)
      }
    } catch (error) {
      console.warn('Failed to store compliance report:', error)
    }
  }

  private sendReportToAPI(report: ComplianceReport): void {
    fetch('/api/monitoring/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
    }).catch(error => {
      console.warn('Failed to send report to API:', error)
    })
  }

  public getStoredReports(): ComplianceReport[] {
    try {
      const stored = localStorage.getItem('brandComplianceReports')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.warn('Failed to retrieve stored reports:', error)
      return []
    }
  }

  public getMetricsHistory(): BrandComplianceMetrics[] {
    return [...this.metricsHistory]
  }

  public getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory]
  }

  public getReportHistory(): ComplianceReport[] {
    return [...this.reportHistory]
  }

  public generateWeeklyReport(): {
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
  } {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const weeklyReports = this.reportHistory.filter(
      report => report.timestamp >= oneWeekAgo
    )

    if (weeklyReports.length === 0) {
      return {
        period: 'weekly',
        startDate: new Date(oneWeekAgo).toISOString(),
        endDate: new Date().toISOString(),
        summary: 'No reports available for this period',
        reports: [],
      }
    }

    const avgCompliance =
      weeklyReports.reduce(
        (sum, report) => sum + report.brandMetrics.overallComplianceScore,
        0
      ) / weeklyReports.length

    const totalViolations = weeklyReports.reduce(
      (sum, report) => sum + report.brandMetrics.totalViolations,
      0
    )

    return {
      period: 'weekly',
      startDate: new Date(oneWeekAgo).toISOString(),
      endDate: new Date().toISOString(),
      summary: {
        averageComplianceScore: Math.round(avgCompliance * 100) / 100,
        totalViolations,
        reportCount: weeklyReports.length,
        trend: this.calculateTrend(weeklyReports),
      },
      reports: weeklyReports,
      recommendations: this.generateWeeklyRecommendations(weeklyReports),
    }
  }

  public generateMonthlyReport(): {
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
  } {
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const monthlyReports = this.reportHistory.filter(
      report => report.timestamp >= oneMonthAgo
    )

    if (monthlyReports.length === 0) {
      return {
        period: 'monthly',
        startDate: new Date(oneMonthAgo).toISOString(),
        endDate: new Date().toISOString(),
        summary: 'No reports available for this period',
        reports: [],
      }
    }

    const avgCompliance =
      monthlyReports.reduce(
        (sum, report) => sum + report.brandMetrics.overallComplianceScore,
        0
      ) / monthlyReports.length

    const totalViolations = monthlyReports.reduce(
      (sum, report) => sum + report.brandMetrics.totalViolations,
      0
    )

    return {
      period: 'monthly',
      startDate: new Date(oneMonthAgo).toISOString(),
      endDate: new Date().toISOString(),
      summary: {
        averageComplianceScore: Math.round(avgCompliance * 100) / 100,
        totalViolations,
        reportCount: monthlyReports.length,
        trend: this.calculateTrend(monthlyReports),
      },
      reports: monthlyReports,
      recommendations: this.generateMonthlyRecommendations(monthlyReports),
    }
  }

  private calculateTrend(
    reports: ComplianceReport[]
  ): 'improving' | 'declining' | 'stable' {
    if (reports.length < 2) return 'stable'

    const sortedReports = reports.sort((a, b) => a.timestamp - b.timestamp)
    const firstHalf = sortedReports.slice(
      0,
      Math.floor(sortedReports.length / 2)
    )
    const secondHalf = sortedReports.slice(Math.floor(sortedReports.length / 2))

    const firstHalfAvg =
      firstHalf.reduce(
        (sum, report) => sum + report.brandMetrics.overallComplianceScore,
        0
      ) / firstHalf.length

    const secondHalfAvg =
      secondHalf.reduce(
        (sum, report) => sum + report.brandMetrics.overallComplianceScore,
        0
      ) / secondHalf.length

    const difference = secondHalfAvg - firstHalfAvg

    if (difference > 2) return 'improving'
    if (difference < -2) return 'declining'
    return 'stable'
  }

  private generateWeeklyRecommendations(reports: ComplianceReport[]): string[] {
    const recommendations: string[] = []

    // Analyze common issues across the week
    const allViolations = reports.flatMap(report => report.violations)
    const violationCounts = this.countViolationsByRule(allViolations)

    // Find most common violations
    const sortedViolations = Object.entries(violationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)

    sortedViolations.forEach(([ruleId, count]) => {
      recommendations.push(
        `Focus on ${ruleId} violations (${count} instances this week)`
      )
    })

    return recommendations
  }

  private generateMonthlyRecommendations(
    reports: ComplianceReport[]
  ): string[] {
    const recommendations: string[] = []

    // Analyze trends and patterns over the month
    const trend = this.calculateTrend(reports)

    if (trend === 'declining') {
      recommendations.push(
        'Brand compliance is declining - review recent changes and implement corrective measures'
      )
    } else if (trend === 'improving') {
      recommendations.push(
        'Brand compliance is improving - continue current practices and consider expanding successful strategies'
      )
    }

    // Performance recommendations
    const avgPerformance =
      reports.reduce(
        (sum, report) => sum + report.performanceMetrics.fontLoadingTime,
        0
      ) / reports.length

    if (avgPerformance > 2000) {
      recommendations.push(
        'Font loading performance needs improvement - consider implementing font optimization strategies'
      )
    }

    return recommendations
  }

  public destroy(): void {
    // Clean up observers and intervals
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []

    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = null
    }

    if (this.revalidationTimeout) {
      clearTimeout(this.revalidationTimeout)
      this.revalidationTimeout = null
    }
  }
}

// Global monitoring service instance
export const brandMonitoringService = new BrandMonitoringService()

// Export monitoring functions for use in components
export function trackBrandCompliance(): BrandComplianceMetrics {
  return brandMonitoringService.trackComplianceMetrics()
}

export function generateComplianceReport(): ComplianceReport {
  return brandMonitoringService.generateReport()
}

export function getComplianceHistory(): BrandComplianceMetrics[] {
  return brandMonitoringService.getMetricsHistory()
}

export function getPerformanceHistory(): PerformanceMetrics[] {
  return brandMonitoringService.getPerformanceHistory()
}

export function generateWeeklyReport(): {
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
} {
  return brandMonitoringService.generateWeeklyReport()
}

export function generateMonthlyReport(): {
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
} {
  return brandMonitoringService.generateMonthlyReport()
}

// React hook for monitoring
export function useBrandMonitoring() {
  return {
    trackCompliance: trackBrandCompliance,
    generateReport: generateComplianceReport,
    getHistory: getComplianceHistory,
    getPerformanceHistory,
    generateWeeklyReport,
    generateMonthlyReport,
  }
}
