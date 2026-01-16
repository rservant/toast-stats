import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AreaPerformanceTable } from '../AreaPerformanceTable'
import { AreaPerformance } from '../../utils/divisionStatus'

/**
 * Unit tests for AreaPerformanceTable component
 *
 * Tests verify:
 * - Requirement 6.1: Display one row for each area
 * - Requirement 6.8: Order areas by area identifier
 * - Requirement 8.6: Ensure accessibility (table semantics, headers)
 * - Requirement 8.7: Apply responsive table styling
 * - Requirement 9.3: Maintain table accessibility
 */
describe('AreaPerformanceTable', () => {
  const mockArea1: AreaPerformance = {
    areaId: 'A1',
    status: 'distinguished',
    clubBase: 10,
    paidClubs: 11,
    netGrowth: 1,
    distinguishedClubs: 6,
    requiredDistinguishedClubs: 5,
    firstRoundVisits: {
      completed: 8,
      required: 8,
      percentage: 80,
      meetsThreshold: true,
    },
    secondRoundVisits: {
      completed: 8,
      required: 8,
      percentage: 80,
      meetsThreshold: true,
    },
    isQualified: true,
  }

  const mockArea2: AreaPerformance = {
    areaId: 'A2',
    status: 'not-qualified',
    clubBase: 8,
    paidClubs: 7,
    netGrowth: -1,
    distinguishedClubs: 3,
    requiredDistinguishedClubs: 4,
    firstRoundVisits: {
      completed: 5,
      required: 6,
      percentage: 62.5,
      meetsThreshold: false,
    },
    secondRoundVisits: {
      completed: 5,
      required: 6,
      percentage: 62.5,
      meetsThreshold: false,
    },
    isQualified: false,
  }

  const mockArea3: AreaPerformance = {
    areaId: 'B1',
    status: 'presidents-distinguished',
    clubBase: 12,
    paidClubs: 14,
    netGrowth: 2,
    distinguishedClubs: 8,
    requiredDistinguishedClubs: 6,
    firstRoundVisits: {
      completed: 10,
      required: 9,
      percentage: 83.3,
      meetsThreshold: true,
    },
    secondRoundVisits: {
      completed: 10,
      required: 9,
      percentage: 83.3,
      meetsThreshold: true,
    },
    isQualified: true,
  }

  describe('Requirement 6.1: Display one row for each area', () => {
    it('should render one row for each area in the areas array', () => {
      const areas = [mockArea1, mockArea2, mockArea3]
      render(<AreaPerformanceTable areas={areas} />)

      // Verify all area identifiers are present
      expect(screen.getByText('A1')).toBeInTheDocument()
      expect(screen.getByText('A2')).toBeInTheDocument()
      expect(screen.getByText('B1')).toBeInTheDocument()
    })

    it('should render empty tbody when areas array is empty', () => {
      const { container } = render(<AreaPerformanceTable areas={[]} />)

      const tbody = container.querySelector('tbody')
      expect(tbody).toBeInTheDocument()
      expect(tbody?.children.length).toBe(0)
    })

    it('should render exactly one row per area', () => {
      const areas = [mockArea1, mockArea2]
      const { container } = render(<AreaPerformanceTable areas={areas} />)

      const tbody = container.querySelector('tbody')
      expect(tbody?.children.length).toBe(2)
    })
  })

  describe('Requirement 6.8: Order areas by area identifier', () => {
    it('should display areas in ascending order by area identifier', () => {
      // Provide areas in non-alphabetical order
      const areas = [mockArea3, mockArea1, mockArea2] // B1, A1, A2
      const { container } = render(<AreaPerformanceTable areas={areas} />)

      const tbody = container.querySelector('tbody')
      const rows = tbody?.querySelectorAll('tr')

      // Verify order: A1, A2, B1
      expect(rows?.[0].textContent).toContain('A1')
      expect(rows?.[1].textContent).toContain('A2')
      expect(rows?.[2].textContent).toContain('B1')
    })

    it('should maintain alphabetical order with numeric area identifiers', () => {
      const area10: AreaPerformance = {
        ...mockArea1,
        areaId: 'A10',
      }
      const area2: AreaPerformance = {
        ...mockArea2,
        areaId: 'A2',
      }
      const area3: AreaPerformance = {
        ...mockArea3,
        areaId: 'A3',
      }

      const areas = [area10, area2, area3]
      const { container } = render(<AreaPerformanceTable areas={areas} />)

      const tbody = container.querySelector('tbody')
      const rows = tbody?.querySelectorAll('tr')

      // Verify alphabetical order (A10, A2, A3)
      expect(rows?.[0].textContent).toContain('A10')
      expect(rows?.[1].textContent).toContain('A2')
      expect(rows?.[2].textContent).toContain('A3')
    })
  })

  describe('Requirement 8.6: Ensure accessibility (table semantics, headers)', () => {
    it('should render a semantic table element', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      const table = container.querySelector('table')
      expect(table).toBeInTheDocument()
    })

    it('should render table headers with proper scope attributes', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      const headers = container.querySelectorAll('th[scope="col"]')
      expect(headers.length).toBe(6) // Area, Paid Clubs, Distinguished Clubs, First Round, Second Round, Status
    })

    it('should render all required column headers', () => {
      render(<AreaPerformanceTable areas={[mockArea1]} />)

      expect(screen.getByText('Area')).toBeInTheDocument()
      expect(screen.getByText('Paid Clubs')).toBeInTheDocument()
      expect(screen.getByText('Distinguished Clubs')).toBeInTheDocument()
      expect(screen.getByText('First Round Visits')).toBeInTheDocument()
      expect(screen.getByText('Second Round Visits')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should use thead and tbody elements for proper table structure', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      expect(container.querySelector('thead')).toBeInTheDocument()
      expect(container.querySelector('tbody')).toBeInTheDocument()
    })
  })

  describe('Requirement 8.7: Apply responsive table styling', () => {
    it('should wrap table in overflow-x-auto container for horizontal scrolling', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      const wrapper = container.querySelector('.overflow-x-auto')
      expect(wrapper).toBeInTheDocument()
    })

    it('should apply table-auto class for responsive column sizing', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      const table = container.querySelector('table')
      expect(table?.classList.contains('table-auto')).toBe(true)
    })

    it('should apply w-full class for full width table', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      const table = container.querySelector('table')
      expect(table?.classList.contains('w-full')).toBe(true)
    })
  })

  describe('Requirement 9.3: Maintain table accessibility', () => {
    it('should enable horizontal scrolling on mobile through overflow-x-auto', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      const wrapper = container.querySelector('.overflow-x-auto')
      expect(wrapper).toBeInTheDocument()

      // Verify the wrapper contains the table
      const table = wrapper?.querySelector('table')
      expect(table).toBeInTheDocument()
    })

    it('should maintain table structure for screen readers', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      // Verify proper table structure
      const table = container.querySelector('table')
      const thead = table?.querySelector('thead')
      const tbody = table?.querySelector('tbody')

      expect(table).toBeInTheDocument()
      expect(thead).toBeInTheDocument()
      expect(tbody).toBeInTheDocument()
    })
  })

  describe('Integration with AreaPerformanceRow', () => {
    it('should render AreaPerformanceRow components for each area', () => {
      const areas = [mockArea1, mockArea2]
      render(<AreaPerformanceTable areas={areas} />)

      // Verify that area data is rendered (AreaPerformanceRow responsibility)
      expect(screen.getByText('A1')).toBeInTheDocument()
      expect(screen.getByText('A2')).toBeInTheDocument()
    })

    it('should pass correct area data to each AreaPerformanceRow', () => {
      const areas = [mockArea1]
      render(<AreaPerformanceTable areas={areas} />)

      // Verify area identifier is displayed
      expect(screen.getByText('A1')).toBeInTheDocument()

      // Verify paid clubs data is displayed (format: current/base)
      expect(screen.getByText(/11\/10/)).toBeInTheDocument()

      // Verify distinguished clubs data is displayed (format: current/required)
      expect(screen.getByText(/6\/5/)).toBeInTheDocument()
    })
  })

  describe('Brand compliance', () => {
    it('should use Toastmasters brand colors for header', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      const thead = container.querySelector('thead')
      expect(thead?.classList.contains('bg-tm-cool-gray-10')).toBe(true)
      expect(thead?.classList.contains('border-tm-loyal-blue')).toBe(true)
    })

    it('should use Montserrat font for column headers', () => {
      const { container } = render(<AreaPerformanceTable areas={[mockArea1]} />)

      const headers = container.querySelectorAll('th')
      headers.forEach(header => {
        expect(header.classList.contains('font-tm-headline')).toBe(true)
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle single area', () => {
      const areas = [mockArea1]
      const { container } = render(<AreaPerformanceTable areas={areas} />)

      const tbody = container.querySelector('tbody')
      expect(tbody?.children.length).toBe(1)
    })

    it('should handle many areas', () => {
      const manyAreas: AreaPerformance[] = Array.from({ length: 20 }, (_, i) => ({
        ...mockArea1,
        areaId: `A${i + 1}`,
      }))

      const { container } = render(<AreaPerformanceTable areas={manyAreas} />)

      const tbody = container.querySelector('tbody')
      expect(tbody?.children.length).toBe(20)
    })

    it('should not mutate the original areas array', () => {
      const areas = [mockArea3, mockArea1, mockArea2]
      const originalOrder = [...areas]

      render(<AreaPerformanceTable areas={areas} />)

      // Verify original array is unchanged
      expect(areas).toEqual(originalOrder)
    })
  })
})
