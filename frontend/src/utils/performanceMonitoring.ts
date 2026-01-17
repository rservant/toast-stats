/**
 * Performance Monitoring Utilities
 *
 * Specialized monitoring for font loading, CSS bundle size, and brand-related performance metrics.
 */

export interface FontLoadingMetrics {
  fontFamily: string
  loadTime: number
  size: number
  status: 'loading' | 'loaded' | 'error' | 'timeout'
  timestamp: number
}

export interface CSSBundleMetrics {
  totalSize: number
  brandRelatedSize: number
  compressionRatio: number
  loadTime: number
  cacheHitRate: number
  timestamp: number
}

export interface ValidationPerformanceMetrics {
  totalValidationTime: number
  rulesExecuted: number
  elementsValidated: number
  averageTimePerElement: number
  averageTimePerRule: number
  timestamp: number
}

export interface PerformanceAlert {
  type:
    | 'font-load-slow'
    | 'bundle-size-large'
    | 'validation-slow'
    | 'memory-high'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  data:
    | FontLoadingMetrics
    | CSSBundleMetrics
    | ValidationPerformanceMetrics
    | Record<string, unknown>
  timestamp: number
}

class PerformanceMonitoringService {
  private fontMetrics: FontLoadingMetrics[] = []
  private cssMetrics: CSSBundleMetrics[] = []
  private validationMetrics: ValidationPerformanceMetrics[] = []
  private alerts: PerformanceAlert[] = []
  private observers: PerformanceObserver[] = []

  constructor() {
    this.initialize()
  }

  private initialize(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.setupFontLoadingMonitoring()
      this.setupResourceMonitoring()
      this.setupMemoryMonitoring()
    }
  }

  private setupFontLoadingMonitoring(): void {
    try {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          if (entry.entryType === 'resource' && entry.name.includes('font')) {
            this.processFontLoadingEntry(entry as PerformanceResourceTiming)
          }
        })
      })

      observer.observe({ entryTypes: ['resource'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Font loading monitoring setup failed:', error)
    }
  }

  private setupResourceMonitoring(): void {
    try {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          if (entry.entryType === 'resource' && entry.name.includes('.css')) {
            this.processCSSLoadingEntry(entry as PerformanceResourceTiming)
          }
        })
      })

      observer.observe({ entryTypes: ['resource'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Resource monitoring setup failed:', error)
    }
  }

  private setupMemoryMonitoring(): void {
    if ('memory' in performance) {
      setInterval(() => {
        this.checkMemoryUsage()
      }, 30000) // Check every 30 seconds
    }
  }

  private processFontLoadingEntry(entry: PerformanceResourceTiming): void {
    const fontFamily = this.extractFontFamily(entry.name)
    const loadTime = entry.responseEnd - entry.requestStart
    const size = entry.transferSize || entry.encodedBodySize || 0

    const metrics: FontLoadingMetrics = {
      fontFamily,
      loadTime,
      size,
      status: entry.responseEnd > 0 ? 'loaded' : 'error',
      timestamp: Date.now(),
    }

    this.fontMetrics.push(metrics)

    // Keep only last 50 entries
    if (this.fontMetrics.length > 50) {
      this.fontMetrics = this.fontMetrics.slice(-50)
    }

    // Check for performance alerts
    this.checkFontLoadingAlerts(metrics)
  }

  private processCSSLoadingEntry(entry: PerformanceResourceTiming): void {
    const loadTime = entry.responseEnd - entry.requestStart
    const size = entry.transferSize || entry.encodedBodySize || 0
    const compressionRatio =
      entry.encodedBodySize > 0
        ? (entry.decodedBodySize || entry.encodedBodySize) /
          entry.encodedBodySize
        : 1

    const metrics: CSSBundleMetrics = {
      totalSize: size,
      brandRelatedSize: this.estimateBrandRelatedSize(entry.name, size),
      compressionRatio,
      loadTime,
      cacheHitRate: this.calculateCacheHitRate(entry),
      timestamp: Date.now(),
    }

    this.cssMetrics.push(metrics)

    // Keep only last 20 entries
    if (this.cssMetrics.length > 20) {
      this.cssMetrics = this.cssMetrics.slice(-20)
    }

    // Check for performance alerts
    this.checkCSSBundleAlerts(metrics)
  }

  private extractFontFamily(url: string): string {
    // Extract font family from Google Fonts URL or file name
    // Use URL parsing to properly validate the hostname (security: avoid substring bypass attacks)
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.hostname === 'fonts.googleapis.com') {
        const match = url.match(/family=([^&:]+)/)
        return match && match[1]
          ? decodeURIComponent(match[1].replace(/\+/g, ' '))
          : 'Unknown'
      }
    } catch {
      // URL parsing failed, fall through to file name extraction
    }

    // Extract from file name
    const fileName = url.split('/').pop() || ''
    if (fileName.toLowerCase().includes('montserrat')) return 'Montserrat'
    if (fileName.toLowerCase().includes('source')) return 'Source Sans 3'

    return 'Unknown'
  }

  private estimateBrandRelatedSize(url: string, totalSize: number): number {
    // Estimate what portion of CSS is brand-related
    if (url.includes('brand') || url.includes('theme')) {
      return totalSize
    }

    // For main CSS bundles, estimate 20-30% is brand-related
    return Math.round(totalSize * 0.25)
  }

  private calculateCacheHitRate(entry: PerformanceResourceTiming): number {
    // If transfer size is 0 but encoded size > 0, it's likely a cache hit
    if (entry.transferSize === 0 && (entry.encodedBodySize || 0) > 0) {
      return 1.0 // 100% cache hit
    }

    // If transfer size is much smaller than encoded size, partial cache hit
    const encodedSize = entry.encodedBodySize || entry.transferSize || 0
    if (encodedSize > 0 && entry.transferSize < encodedSize * 0.1) {
      return 0.9 // 90% cache hit
    }

    return 0 // No cache hit
  }

  private checkFontLoadingAlerts(metrics: FontLoadingMetrics): void {
    const thresholds = {
      slow: 2000, // 2 seconds
      verySlow: 5000, // 5 seconds
      large: 100000, // 100KB
      veryLarge: 500000, // 500KB
    }

    if (metrics.loadTime > thresholds.verySlow) {
      this.createAlert(
        'font-load-slow',
        'critical',
        `Font ${metrics.fontFamily} took ${Math.round(metrics.loadTime)}ms to load`,
        metrics
      )
    } else if (metrics.loadTime > thresholds.slow) {
      this.createAlert(
        'font-load-slow',
        'high',
        `Font ${metrics.fontFamily} took ${Math.round(metrics.loadTime)}ms to load`,
        metrics
      )
    }

    if (metrics.size > thresholds.veryLarge) {
      this.createAlert(
        'font-load-slow',
        'high',
        `Font ${metrics.fontFamily} is ${Math.round(metrics.size / 1024)}KB`,
        metrics
      )
    }
  }

  private checkCSSBundleAlerts(metrics: CSSBundleMetrics): void {
    const thresholds = {
      large: 300000, // 300KB
      veryLarge: 500000, // 500KB
      slowLoad: 3000, // 3 seconds
    }

    if (metrics.totalSize > thresholds.veryLarge) {
      this.createAlert(
        'bundle-size-large',
        'critical',
        `CSS bundle is ${Math.round(metrics.totalSize / 1024)}KB`,
        metrics
      )
    } else if (metrics.totalSize > thresholds.large) {
      this.createAlert(
        'bundle-size-large',
        'high',
        `CSS bundle is ${Math.round(metrics.totalSize / 1024)}KB`,
        metrics
      )
    }

    if (metrics.loadTime > thresholds.slowLoad) {
      this.createAlert(
        'bundle-size-large',
        'medium',
        `CSS bundle took ${Math.round(metrics.loadTime)}ms to load`,
        metrics
      )
    }
  }

  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const perfMemory = performance as unknown as {
        memory?: {
          usedJSHeapSize?: number
          jsHeapSizeLimit?: number
        }
      }
      const memory = perfMemory.memory
      if (!memory) return

      const usedMB = (memory.usedJSHeapSize || 0) / 1024 / 1024
      const limitMB = (memory.jsHeapSizeLimit || 0) / 1024 / 1024

      const usagePercent = limitMB > 0 ? (usedMB / limitMB) * 100 : 0

      if (usagePercent > 90) {
        this.createAlert(
          'memory-high',
          'critical',
          `Memory usage is ${Math.round(usagePercent)}% (${Math.round(usedMB)}MB)`,
          { usedMB, limitMB, usagePercent }
        )
      } else if (usagePercent > 75) {
        this.createAlert(
          'memory-high',
          'high',
          `Memory usage is ${Math.round(usagePercent)}% (${Math.round(usedMB)}MB)`,
          { usedMB, limitMB, usagePercent }
        )
      }
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    data:
      | FontLoadingMetrics
      | CSSBundleMetrics
      | ValidationPerformanceMetrics
      | Record<string, unknown>
  ): void {
    const alert: PerformanceAlert = {
      type,
      severity,
      message,
      data,
      timestamp: Date.now(),
    }

    this.alerts.push(alert)

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    // Log alert
    console.warn(`Performance Alert [${severity}]:`, message, data)

    // In production, send to monitoring service
    if (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost'
    ) {
      this.sendAlertToMonitoringService(alert)
    }
  }

  private sendAlertToMonitoringService(alert: PerformanceAlert): void {
    fetch('/api/monitoring/performance-alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alert),
    }).catch(error => {
      console.warn('Failed to send performance alert:', error)
    })
  }

  public measureValidationPerformance<T>(validationFn: () => T): T {
    const startTime = performance.now()
    const result = validationFn()
    const endTime = performance.now()

    const metrics: ValidationPerformanceMetrics = {
      totalValidationTime: endTime - startTime,
      rulesExecuted: 0, // Would be set by validation function
      elementsValidated: 0, // Would be set by validation function
      averageTimePerElement: 0,
      averageTimePerRule: 0,
      timestamp: Date.now(),
    }

    this.validationMetrics.push(metrics)

    // Keep only last 50 entries
    if (this.validationMetrics.length > 50) {
      this.validationMetrics = this.validationMetrics.slice(-50)
    }

    // Check for validation performance alerts
    if (metrics.totalValidationTime > 100) {
      // 100ms threshold
      this.createAlert(
        'validation-slow',
        'medium',
        `Validation took ${Math.round(metrics.totalValidationTime)}ms`,
        metrics
      )
    }

    return result
  }

  public getFontLoadingMetrics(): FontLoadingMetrics[] {
    return [...this.fontMetrics]
  }

  public getCSSBundleMetrics(): CSSBundleMetrics[] {
    return [...this.cssMetrics]
  }

  public getValidationMetrics(): ValidationPerformanceMetrics[] {
    return [...this.validationMetrics]
  }

  public getPerformanceAlerts(): PerformanceAlert[] {
    return [...this.alerts]
  }

  public getRecentAlerts(minutes: number = 60): PerformanceAlert[] {
    const cutoff = Date.now() - minutes * 60 * 1000
    return this.alerts.filter(alert => alert.timestamp >= cutoff)
  }

  public getPerformanceSummary(): {
    fonts: { averageLoadTime: number; totalSize: number; count: number }
    css: { averageLoadTime: number; totalSize: number; count: number }
    validation: { averageTime: number; count: number }
    alerts: {
      total: number
      byType: Record<string, number>
      bySeverity: Record<string, number>
    }
  } {
    const fontSummary = this.fontMetrics.reduce(
      (acc, metric) => ({
        totalLoadTime: acc.totalLoadTime + metric.loadTime,
        totalSize: acc.totalSize + metric.size,
        count: acc.count + 1,
      }),
      { totalLoadTime: 0, totalSize: 0, count: 0 }
    )

    const cssSummary = this.cssMetrics.reduce(
      (acc, metric) => ({
        totalLoadTime: acc.totalLoadTime + metric.loadTime,
        totalSize: acc.totalSize + metric.totalSize,
        count: acc.count + 1,
      }),
      { totalLoadTime: 0, totalSize: 0, count: 0 }
    )

    const validationSummary = this.validationMetrics.reduce(
      (acc, metric) => ({
        totalTime: acc.totalTime + metric.totalValidationTime,
        count: acc.count + 1,
      }),
      { totalTime: 0, count: 0 }
    )

    const alertsByType: Record<string, number> = {}
    const alertsBySeverity: Record<string, number> = {}

    this.alerts.forEach(alert => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1
      alertsBySeverity[alert.severity] =
        (alertsBySeverity[alert.severity] || 0) + 1
    })

    return {
      fonts: {
        averageLoadTime:
          fontSummary.count > 0
            ? fontSummary.totalLoadTime / fontSummary.count
            : 0,
        totalSize: fontSummary.totalSize,
        count: fontSummary.count,
      },
      css: {
        averageLoadTime:
          cssSummary.count > 0
            ? cssSummary.totalLoadTime / cssSummary.count
            : 0,
        totalSize: cssSummary.totalSize,
        count: cssSummary.count,
      },
      validation: {
        averageTime:
          validationSummary.count > 0
            ? validationSummary.totalTime / validationSummary.count
            : 0,
        count: validationSummary.count,
      },
      alerts: {
        total: this.alerts.length,
        byType: alertsByType,
        bySeverity: alertsBySeverity,
      },
    }
  }

  public clearMetrics(): void {
    this.fontMetrics = []
    this.cssMetrics = []
    this.validationMetrics = []
    this.alerts = []
  }

  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.clearMetrics()
  }
}

// Global performance monitoring service
export const performanceMonitoringService = new PerformanceMonitoringService()

// Export convenience functions
export function measureValidationPerformance<T>(validationFn: () => T): T {
  return performanceMonitoringService.measureValidationPerformance(validationFn)
}

export function getFontLoadingMetrics(): FontLoadingMetrics[] {
  return performanceMonitoringService.getFontLoadingMetrics()
}

export function getCSSBundleMetrics(): CSSBundleMetrics[] {
  return performanceMonitoringService.getCSSBundleMetrics()
}

export function getValidationMetrics(): ValidationPerformanceMetrics[] {
  return performanceMonitoringService.getValidationMetrics()
}

export function getPerformanceAlerts(): PerformanceAlert[] {
  return performanceMonitoringService.getPerformanceAlerts()
}

export function getPerformanceSummary() {
  return performanceMonitoringService.getPerformanceSummary()
}
