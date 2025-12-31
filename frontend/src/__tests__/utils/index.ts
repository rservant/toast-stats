/**
 * Test Utilities Index
 *
 * Centralized exports for all test utilities to reduce redundancy
 * and improve consistency across the test suite.
 */

// Component testing utilities
export {
  renderWithProviders,
  expectBasicRendering,
  testComponentVariants,
  expectAccessibility,
  testLoadingStates,
  testErrorStates,
} from './componentTestUtils'

// Accessibility testing utilities
export {
  expectWCAGCompliance,
  expectKeyboardNavigation,
  expectColorContrast,
  expectScreenReaderCompatibility,
  expectFocusManagement,
  runAccessibilityTestSuite,
  runQuickAccessibilityCheck,
} from './accessibilityTestUtils'

// Brand compliance testing utilities
export {
  expectBrandColors,
  expectBrandTypography,
  expectTouchTargets,
  expectGradientUsage,
  expectBrandSpacing,
  expectBrandAccessibility,
  runBrandComplianceTestSuite,
  runQuickBrandCheck,
  expectToastmastersPatterns,
} from './brandComplianceTestUtils'

// Enhanced test infrastructure
export {
  testInfrastructure,
  testPerformanceMonitor,
  testMigrationValidator,
  withTestInfrastructure,
  expectOptimizationTargets,
} from './testInfrastructure'

// Performance monitoring utilities
export {
  withPerformanceMonitoring,
  withQueryPerformanceMonitoring,
  withInteractionPerformanceMonitoring,
  expectPerformanceWithinThresholds,
  expectRenderTimeUnder,
  expectMemoryUsageUnder,
} from './performanceMonitor'

// Migration validation utilities
export {
  validateTestMigration,
  expectMigrationSuccess,
} from './migrationValidator'

// TypeScript interfaces and types
export type * from './types'

// Re-export commonly used testing library functions for convenience
export { screen, fireEvent, waitFor, act } from '@testing-library/react'
export { vi } from 'vitest'
