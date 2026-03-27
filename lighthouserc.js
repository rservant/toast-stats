/**
 * Lighthouse CI Configuration (#222)
 *
 * Performance budgets enforced on every PR:
 * - LCP < 2.5s, FID < 100ms, CLS < 0.1
 * - Bundle size budget: < 500KB gzipped (main bundle)
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview --prefix frontend',
      startServerReadyPattern: 'ready',
      startServerReadyTimeout: 30000,
      url: ['http://localhost:4173/'],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
      },
    },
    assert: {
      assertions: {
        // Core Web Vitals
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'max-potential-fid': ['error', { maxNumericValue: 100 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // Performance score
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],

        // Resource budgets
        'resource-summary:script:size': ['error', { maxNumericValue: 512000 }], // 500KB gzipped
        'resource-summary:total:size': ['warn', { maxNumericValue: 2048000 }], // 2MB total
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
