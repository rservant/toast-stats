import '@testing-library/jest-dom'
import 'jest-axe/extend-expect'

// Import brand CSS to make design tokens available in tests
import '../styles/brand.css'

// Mock ResizeObserver for Recharts components
global.ResizeObserver = class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
