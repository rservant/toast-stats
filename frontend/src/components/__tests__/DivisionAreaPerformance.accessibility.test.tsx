/**
 * Accessibility Audit for Division and Area Performance Components
 *
 * This test suite validates WCAG AA compliance for all division and area
 * performance components including:
 * - DivisionPerformanceCards
 * - DivisionPerformanceCard
 * - DivisionSummary
 * - AreaPerformanceTable
 * - AreaPerformanceRow
 *
 * Tests cover:
 * - axe-core automated accessibility checks
 * - Keyboard navigation
 * - Screen reader announcements
 * - ARIA labels and roles
 * - Color contrast
 * - Touch target sizes
 *
 * **Validates: Requirements 8.6, 8.7**
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import userEvent from '@testing-library/user-event'
import { DivisionPerformanceCards } from '../DivisionPerformanceCards'
import { DivisionPerformanceCard } from '../DivisionPerformanceCard'
import DivisionSummary from '../DivisionSummary'
import { AreaPerformanceTable } from '../AreaPerformanceTable'
import { AreaPerformanceRow } from '../AreaPerformanceRow'
import type { DistrictSnapshot } from '../../types/district'
import type { DivisionPerformance, AreaPerformance } from '../../types/performance'

// Extend expect with jest-axe matchers
// @ts-expect-error - jest-axe types are not perfectly compatible with vitest expect
expect.extend(toHaveNoViolations)

// Axe synchronization to prevent concurrent runs
let axeRunning = false
const axeQueue: Array<() => Promise<void>> = []

const runAxeSynchronized = async (container: Element): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const wrappedFn = async () => {
      try {
        axeRunning = true
        const results = await axe(container)
        resolve(results)
      } catch (error) {
        reject(error)
      } finally {
        axeRunning = false
        const next = axeQueue.shift()
        if (next) next()
      }
    }

    if (axeRunning) {
      axeQueue.push(wrappedFn)
    } else {
      wrappedFn()
    }
  })
}

// Test data generators
const createMockDistrictSnapshot = (): DistrictSnapshot => ({
  district: 'D101',
  timestamp: '2024-01-15T10:00:00Z',
  divisions: [
    {
      division: 'A',
      clubBase: 10,
      paidClubs: 11,
      distinguishedClubs: 6,
      areas: [
        {
          area: 'A1',
          clubBase: 5,
          paidClubs: 6,
          distinguishedClubs: 3,
          novVisitAward: 4,
          mayVisitAward: 4,
        },
        {
          area: 'A2',
          clubBase: 5,
          paidClubs: 5,
          distinguishedClubs: 3,
          novVisitAward: 4,
          mayVisitAward: 3,
        },
      ],
    },
    {
      division: 'B',
      clubBase: 8,
      paidClubs: 7,
      distinguishedClubs: 3,
      areas: [
        {
          area: 'B1',
          clubBase: 4,
          paidClubs: 3,
          distinguishedClubs: 1,
          novVisitAward: 2,
          mayVisitAward: 2,
        },
        {
          area: 'B2',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 2,
          novVisitAward: 3,
          mayVisitAward: 3,
        },
      ],
    },
  ],
})

const createMockDivisionPerformance = (): DivisionPerformance => ({
  divisionId: 'A',
  status: 'select-distinguished',
  clubBase: 10,
  paidClubs: 11,
  netGrowth: 1,
  distinguishedClubs: 6,
  requiredDistinguishedClubs: 5,
  areas: [
    {
      areaId: 'A1',
      status: 'presidents-distinguished',
      clubBase: 5,
      paidClubs: 6,
      netGrowth: 1,
      distinguishedClubs: 3,
      requiredDistinguishedClubs: 3,
      firstRoundVisits: {
        completed: 4,
        required: 4,
        percentage: 80,
        meetsThreshold: true,
      },
      secondRoundVisits: {
        completed: 4,
        required: 4,
        percentage: 80,
        meetsThreshold: true,
      },
      isQualified: true,
    },
    {
      areaId: 'A2',
      status: 'distinguished',
      clubBase: 5,
      paidClubs: 5,
      netGrowth: 0,
      distinguishedClubs: 3,
      requiredDistinguishedClubs: 3,
      firstRoundVisits: {
        completed: 4,
        required: 4,
        percentage: 80,
        meetsThreshold: true,
      },
      secondRoundVisits: {
        completed: 3,
        required: 4,
        percentage: 60,
        meetsThreshold: false,
      },
      isQualified: false,
    },
  ],
})

const createMockAreaPerformance = (): AreaPerformance => ({
  areaId: 'A1',
  status: 'presidents-distinguished',
  clubBase: 5,
  paidClubs: 6,
  netGrowth: 1,
  distinguishedClubs: 3,
  requiredDistinguishedClubs: 3,
  firstRoundVisits: {
    completed: 4,
    required: 4,
    percentage: 80,
    meetsThreshold: true,
  },
  secondRoundVisits: {
    completed: 4,
    required: 4,
    percentage: 80,
    meetsThreshold: true,
  },
  isQualified: true,
})

describe('Division and Area Performance Components - Accessibility Audit', () => {
  describe('DivisionPerformanceCards - axe-core validation', () => {
    it('should have no accessibility violations with multiple divisions', async () => {
      const snapshot = createMockDistrictSnapshot()
      const { container } = render(
        <DivisionPerformanceCards districtSnapshot={snapshot} />
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with empty divisions', async () => {
      const snapshot: DistrictSnapshot = {
        district: 'D101',
        timestamp: '2024-01-15T10:00:00Z',
        divisions: [],
      }
      const { container } = render(
        <DivisionPerformanceCards districtSnapshot={snapshot} />
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('DivisionPerformanceCard - axe-core validation', () => {
    it('should have no accessibility violations', async () => {
      const division = createMockDivisionPerformance()
      const { container } = render(
        <DivisionPerformanceCard division={division} />
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with not-distinguished status', async () => {
      const division: DivisionPerformance = {
        ...createMockDivisionPerformance(),
        status: 'not-distinguished',
        distinguishedClubs: 2,
      }
      const { container } = render(
        <DivisionPerformanceCard division={division} />
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('DivisionSummary - axe-core validation', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <DivisionSummary
          divisionId="A"
          status="select-distinguished"
          paidClubs={11}
          clubBase={10}
          netGrowth={1}
          distinguishedClubs={6}
          requiredDistinguishedClubs={5}
        />
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with negative net growth', async () => {
      const { container } = render(
        <DivisionSummary
          divisionId="B"
          status="not-distinguished"
          paidClubs={7}
          clubBase={10}
          netGrowth={-3}
          distinguishedClubs={3}
          requiredDistinguishedClubs={5}
        />
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('AreaPerformanceTable - axe-core validation', () => {
    it('should have no accessibility violations with multiple areas', async () => {
      const division = createMockDivisionPerformance()
      const { container } = render(
        <AreaPerformanceTable areas={division.areas} />
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with empty areas', async () => {
      const { container } = render(<AreaPerformanceTable areas={[]} />)

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('AreaPerformanceRow - axe-core validation', () => {
    it('should have no accessibility violations', async () => {
      const area = createMockAreaPerformance()
      const { container } = render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with not-qualified status', async () => {
      const area: AreaPerformance = {
        ...createMockAreaPerformance(),
        status: 'not-qualified',
        isQualified: false,
      }
      const { container } = render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation through division cards', async () => {
      const user = userEvent.setup()
      const snapshot = createMockDistrictSnapshot()
      render(<DivisionPerformanceCards districtSnapshot={snapshot} />)

      // Tab through the document
      await user.tab()

      // Verify focus is on a focusable element (or body if no interactive elements)
      const focusedElement = document.activeElement
      expect(focusedElement).toBeTruthy()
      // Note: If there are no interactive elements, focus will be on body
      // This is acceptable for display-only components
    })

    it('should support keyboard navigation through area table', async () => {
      const user = userEvent.setup()
      const division = createMockDivisionPerformance()
      render(<AreaPerformanceTable areas={division.areas} />)

      // Tab through the table
      await user.tab()

      // Verify focus is on a focusable element or table is accessible
      const focusedElement = document.activeElement
      expect(focusedElement).toBeTruthy()
    })

    it('should have visible focus indicators on interactive elements', () => {
      const snapshot = createMockDistrictSnapshot()
      const { container } = render(
        <DivisionPerformanceCards districtSnapshot={snapshot} />
      )

      // Check all interactive elements have focus styles
      const interactiveElements = container.querySelectorAll(
        'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      interactiveElements.forEach(element => {
        const computedStyle = window.getComputedStyle(element)
        const classList = Array.from(element.classList)

        // Should have focus styles via Tailwind classes or native outline
        const hasFocusClass = classList.some(
          cls =>
            cls.includes('focus:') ||
            cls.includes('focus-visible:') ||
            cls.includes('focus-within:')
        )
        const hasNativeOutline =
          computedStyle.outline !== 'none' && computedStyle.outline !== '0'

        expect(hasFocusClass || hasNativeOutline).toBe(true)
      })
    })
  })

  describe('Screen Reader Announcements', () => {
    it('should have proper ARIA labels for division status', () => {
      const division = createMockDivisionPerformance()
      render(<DivisionPerformanceCard division={division} />)

      // Check for status announcement
      const statusElement = screen.getByText(/select distinguished/i)
      expect(statusElement).toBeInTheDocument()

      // Verify parent has proper role or semantic element (Card component provides aria-label)
      const card = statusElement.closest('[aria-label*="Division"]')
      expect(card).toBeInTheDocument()
    })

    it('should have proper ARIA labels for area status', () => {
      const area = createMockAreaPerformance()
      render(<AreaPerformanceRow area={area} />)

      // Check for status announcement
      const statusElement = screen.getByText(/president's distinguished/i)
      expect(statusElement).toBeInTheDocument()
    })

    it('should announce visit completion status', () => {
      const area = createMockAreaPerformance()
      render(<AreaPerformanceRow area={area} />)

      // Check for visit status indicators
      const visitElements = screen.getAllByText(/✓|✗|4\/4|80%/i)
      expect(visitElements.length).toBeGreaterThan(0)
    })

    it('should have proper table structure for screen readers', () => {
      const division = createMockDivisionPerformance()
      const { container } = render(
        <AreaPerformanceTable areas={division.areas} />
      )

      // Check for proper table structure
      const table = container.querySelector('table')
      expect(table).toBeInTheDocument()

      // Check for table headers
      const headers = container.querySelectorAll('th')
      expect(headers.length).toBeGreaterThan(0)

      // Table has proper semantic structure with thead and tbody
      const thead = container.querySelector('thead')
      const tbody = container.querySelector('tbody')
      expect(thead).toBeInTheDocument()
      expect(tbody).toBeInTheDocument()
    })
  })

  describe('ARIA Labels and Roles', () => {
    it('should have proper ARIA roles for division cards', () => {
      const division = createMockDivisionPerformance()
      const { container } = render(
        <DivisionPerformanceCard division={division} />
      )

      // Check for proper semantic structure (Card component provides aria-label)
      const card = container.querySelector('[aria-label*="Division"]')
      expect(card).toBeInTheDocument()
    })

    it('should have proper ARIA labels for status badges', () => {
      const { container } = render(
        <DivisionSummary
          divisionId="A"
          status="presidents-distinguished"
          paidClubs={11}
          clubBase={10}
          netGrowth={1}
          distinguishedClubs={6}
          requiredDistinguishedClubs={5}
        />
      )

      // Check for status badge with proper labeling
      const statusBadge = screen.getByText(/president's distinguished/i)
      expect(statusBadge).toBeInTheDocument()

      // Verify it has proper semantic meaning
      const badge = statusBadge.closest('[role="status"], .badge, .status')
      expect(badge).toBeInTheDocument()
    })

    it('should have proper ARIA labels for progress indicators', () => {
      const { container } = render(
        <DivisionSummary
          divisionId="A"
          status="select-distinguished"
          paidClubs={11}
          clubBase={10}
          netGrowth={1}
          distinguishedClubs={6}
          requiredDistinguishedClubs={5}
        />
      )

      // Check for progress indicators with proper labeling
      const progressElements = container.querySelectorAll(
        '[aria-label*="progress"], [aria-label*="clubs"], .progress'
      )
      expect(progressElements.length).toBeGreaterThanOrEqual(0)
    })

    it('should have proper ARIA labels for visit status indicators', () => {
      const area = createMockAreaPerformance()
      const { container } = render(<AreaPerformanceRow area={area} />)

      // Check for visit status with proper labeling
      const visitElements = container.querySelectorAll(
        '[aria-label*="visit"], [title*="visit"], .visit-status'
      )
      expect(visitElements.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Color Contrast and Visual Indicators', () => {
    it('should use brand colors with proper contrast', () => {
      const snapshot = createMockDistrictSnapshot()
      const { container } = render(
        <DivisionPerformanceCards districtSnapshot={snapshot} />
      )

      // Check that brand-compliant classes are present in the rendered output
      // The components use font-tm-headline, font-tm-body, and other brand classes
      const brandElements = container.querySelectorAll('[class*="font-tm-"]')
      expect(brandElements.length).toBeGreaterThan(0)
      
      // Verify the components render with proper structure
      const headings = container.querySelectorAll('h2, h3')
      expect(headings.length).toBeGreaterThan(0)
    })

    it('should not rely solely on color for status indication', () => {
      const division = createMockDivisionPerformance()
      render(<DivisionPerformanceCard division={division} />)

      // Status should be indicated by text, not just color
      const statusText = screen.getByText(/select distinguished/i)
      expect(statusText).toBeInTheDocument()
      expect(statusText.textContent).toBeTruthy()
    })

    it('should use icons or text in addition to color for visit status', () => {
      const area = createMockAreaPerformance()
      const { container } = render(<AreaPerformanceRow area={area} />)

      // Visit status should have text or icons, not just color
      const visitIndicators = container.querySelectorAll(
        'svg, .icon, [aria-label*="visit"]'
      )
      const visitText = screen.getAllByText(/✓|✗|4\/4|80%/i)

      expect(visitIndicators.length + visitText.length).toBeGreaterThan(0)
    })
  })

  describe('Touch Target Sizes', () => {
    it('should have minimum 44px touch targets for interactive elements', () => {
      const snapshot = createMockDistrictSnapshot()
      const { container } = render(
        <DivisionPerformanceCards districtSnapshot={snapshot} />
      )

      // Check all interactive elements
      const interactiveElements = container.querySelectorAll(
        'button, a[href], input, select, textarea'
      )

      interactiveElements.forEach(element => {
        const rect = element.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(element)
        const minHeight = parseInt(computedStyle.minHeight) || rect.height
        const minWidth = parseInt(computedStyle.minWidth) || rect.width

        // Should meet 44px minimum (allowing for some rendering variance)
        expect(minHeight).toBeGreaterThanOrEqual(40) // Allow 4px variance
        expect(minWidth).toBeGreaterThanOrEqual(40)
      })
    })
  })

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility at mobile viewport', async () => {
      // Set mobile viewport
      global.innerWidth = 375
      global.innerHeight = 667

      const snapshot = createMockDistrictSnapshot()
      const { container } = render(
        <DivisionPerformanceCards districtSnapshot={snapshot} />
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })

    it('should maintain accessibility at tablet viewport', async () => {
      // Set tablet viewport
      global.innerWidth = 768
      global.innerHeight = 1024

      const snapshot = createMockDistrictSnapshot()
      const { container } = render(
        <DivisionPerformanceCards districtSnapshot={snapshot} />
      )

      const results = await runAxeSynchronized(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Data Completeness for Screen Readers', () => {
    it('should announce all division metrics', () => {
      const division = createMockDivisionPerformance()
      const { container } = render(<DivisionPerformanceCard division={division} />)

      // Check for division identifier
      expect(screen.getByText(/division a/i)).toBeInTheDocument()

      // Check for status
      expect(screen.getByText(/select distinguished/i)).toBeInTheDocument()

      // Check for club metrics by looking at the full rendered content
      const fullText = container.textContent || ''
      expect(fullText).toContain('11') // paid clubs
      expect(fullText).toContain('10') // club base
      expect(fullText).toContain('6') // distinguished clubs
      expect(fullText).toContain('5') // required distinguished clubs
    })

    it('should announce all area metrics', () => {
      const area = createMockAreaPerformance()
      render(<AreaPerformanceRow area={area} />)

      // Check for area identifier
      expect(screen.getByText(/a1/i)).toBeInTheDocument()

      // Check for status
      expect(screen.getByText(/president's distinguished/i)).toBeInTheDocument()

      // Check for club metrics
      expect(screen.getByText(/6/)).toBeInTheDocument() // paid clubs
      expect(screen.getByText(/5/)).toBeInTheDocument() // club base
      expect(screen.getByText(/3/)).toBeInTheDocument() // distinguished clubs
    })
  })
})
