/**
 * Vitest setup file - runs before all tests
 * This ensures environment variables are set before any modules are loaded
 */

// Force mock data for all tests
process.env.USE_MOCK_DATA = 'true'

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test'
