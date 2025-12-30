/**
 * Monitoring Service Initialization
 *
 * This file initializes the brand compliance monitoring system.
 * Import this in your main application file to start monitoring.
 */

import { brandMonitoringService } from '../brandMonitoring'
import { performanceMonitoringService } from '../performanceMonitoring'

// Load monitoring configuration
let monitoringConfig: any = {}
try {
  monitoringConfig = require('../../config/monitoring.json')
} catch (error) {
  console.warn('Failed to load monitoring config, using defaults:', error)
}

// Initialize monitoring services
export function initializeMonitoring(): void {
  console.log('🔍 Initializing brand compliance monitoring...')

  // Start monitoring services
  if (monitoringConfig.monitoring?.enabled !== false) {
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
if (process.env.NODE_ENV === 'production') {
  initializeMonitoring()
}

export { brandMonitoringService, performanceMonitoringService }
