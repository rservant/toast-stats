/**
 * Monitoring Service Initialization
 *
 * This file initializes the brand compliance monitoring system.
 * Import this in your main application file to start monitoring.
 */

import { brandMonitoringService } from '../brandMonitoring'
import { performanceMonitoringService } from '../performanceMonitoring'

// Load monitoring configuration
let monitoringConfig: Record<string, unknown> = {}
try {
  // Use dynamic import instead of require for ES modules
  import('../../config/monitoring.json')
    .then(config => {
      monitoringConfig = config.default || config
    })
    .catch(error => {
      console.warn('Failed to load monitoring config, using defaults:', error)
    })
} catch (error) {
  console.warn('Failed to load monitoring config, using defaults:', error)
}

// Initialize monitoring services
export function initializeMonitoring(): void {
  console.log('🔍 Initializing brand compliance monitoring...')

  // Start monitoring services
  const monitoring = monitoringConfig.monitoring as
    | { enabled?: boolean }
    | undefined
  if (monitoring?.enabled !== false) {
    // Monitoring is initialized automatically via service constructors
    console.log('✅ Brand monitoring service started')
    console.log('✅ Performance monitoring service started')

    // Log initial status
    setTimeout(() => {
      const metrics = brandMonitoringService.trackComplianceMetrics()
      console.log('📊 Initial compliance metrics:', {
        overallScore: Math.round(metrics.overallComplianceScore),
        violations: metrics.totalViolations,
        colorCompliance: Math.round(metrics.colorComplianceRate),
        typographyCompliance: Math.round(metrics.typographyComplianceRate),
        accessibilityScore: Math.round(metrics.accessibilityScore),
      })
    }, 1000)
  } else {
    console.log('⏸️  Monitoring disabled by configuration')
  }
}

// Auto-initialize in production
if (import.meta.env.PROD) {
  initializeMonitoring()
}

export { brandMonitoringService, performanceMonitoringService }
