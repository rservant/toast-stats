/**
 * AreaPerformanceTable Property-Based Tests
 *
 * **Feature: division-area-performance-cards**
 *
 * Property-based tests to verify the correctness of area table rendering
 * across many randomized inputs.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import { AreaPerformanceTable } from '../AreaPerformanceTable'
import { AreaPerformance, DistinguishedStatus } from '../../utils/divisionStatus'

/**
 * Generator for DistinguishedStatus values
 */
const distinguishedStatusArb: fc.Arbitrary<DistinguishedStatus> = fc.oneof(
  fc.constant('not-distinguished' as const),
  fc.constant('distinguished' as const),
  fc.constant('select-distinguished' as const),
  fc.constant('presidents-distinguished' as const),
  fc.constant('not-qualified' as const)
)

/**
 * Generator for AreaPerformance data
 */
const areaPerformanceArb: fc.Arbitrary<AreaPerformance> = fc.record({
  areaId: fc.oneof(
    // Generate area IDs like A1, A2, B1, B2, etc.
    fc.tuple(
      fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G'),
      fc.integer({ min: 1, max: 20 })
    ).map(([letter, num]) => `${letter}${num}`),
    // Also generate some numeric-only IDs
    fc.integer({ min: 1, max: 100 }).map(n => `${n}`)
  ),
  status: distinguishedStatusArb,
  clubBase: fc.integer({ min: 1, max: 50 }),
  paidClubs: fc.integer({ min: 0, max: 60 }),
  netGrowth: fc.integer({ min: -20, max: 20 }),
  distinguishedClubs: fc.integer({ min: 0, max: 50 }),
  requiredDistinguishedClubs: fc.integer({ min: 1, max: 25 }),
  firstRoundVisits: fc.record({
    completed: fc.integer({ min: 0, max: 50 }),
    required: fc.integer({ min: 1, max: 50 }),
    percentage: fc.float({ min: 0, max: 100 }),
    meetsThreshold: fc.boolean(),
  }),
  secondRoundVisits: fc.record({
    completed: fc.integer({ min: 0, max: 50 }),
    required: fc.integer({ min: 1, max: 50 }),
    percentage: fc.float({ min: 0, max: 100 }),
    meetsThreshold: fc.boolean(),
  }),
  isQualified: fc.boolean(),
})

/**
 * Generator for arrays of AreaPerformance data
 */
const areasArrayArb: fc.Arbitrary<AreaPerformance[]> = fc.array(
  areaPerformanceArb,
  { minLength: 0, maxLength: 20 }
)

/**
 * **Feature: division-area-performance-cards, Property 8: Area Row Count and Ordering**
 * **Validates: Requirements 6.1, 6.8**
 *
 * For any division containing N areas, the rendered area table should contain
 * exactly N rows, ordered by area identifier in ascending order.
 *
 * This property ensures that:
 * - The table renders exactly one row per area
 * - Areas are sorted by area identifier in ascending order
 * - The sorting is stable and deterministic
 * - Empty area arrays are handled correctly
 * - The component does not mutate the input array
 */
describe('Property 8: Area Row Count and Ordering', () => {
  it('should render exactly N rows for N areas', () => {
    fc.assert(
      fc.property(areasArrayArb, (areas: AreaPerformance[]) => {
        const { container } = render(<AreaPerformanceTable areas={areas} />)

        const tbody = container.querySelector('tbody')
        const rows = tbody?.querySelectorAll('tr')

        // The number of rows must equal the number of areas
        expect(rows?.length).toBe(areas.length)

        // Additional invariant: tbody must exist
        expect(tbody).toBeInTheDocument()
      }),
      { numRuns: 100 }
    )
  })

  it('should order areas by area identifier in ascending order', () => {
    fc.assert(
      fc.property(areasArrayArb, (areas: AreaPerformance[]) => {
        // Skip test if areas array is empty
        if (areas.length === 0) {
          return true
        }

        const { container } = render(<AreaPerformanceTable areas={areas} />)

        const tbody = container.querySelector('tbody')
        const rows = tbody?.querySelectorAll('tr')

        // Extract area IDs from rendered rows
        const renderedAreaIds: string[] = []
        rows?.forEach(row => {
          // The first cell in each row contains the area ID
          const firstCell = row.querySelector('td')
          if (firstCell?.textContent) {
            renderedAreaIds.push(firstCell.textContent.trim())
          }
        })

        // Calculate expected order (sorted by area identifier)
        const expectedAreaIds = [...areas]
          .sort((a, b) => a.areaId.localeCompare(b.areaId))
          .map(area => area.areaId)

        // Verify rendered order matches expected order
        expect(renderedAreaIds).toEqual(expectedAreaIds)

        // Additional invariant: verify ordering is ascending
        for (let i = 1; i < renderedAreaIds.length; i++) {
          const prev = renderedAreaIds[i - 1]
          const curr = renderedAreaIds[i]
          expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('should produce consistent results for the same input', () => {
    fc.assert(
      fc.property(areasArrayArb, (areas: AreaPerformance[]) => {
        // Render the component multiple times with the same input
        const { container: container1 } = render(
          <AreaPerformanceTable areas={areas} />
        )
        const { container: container2 } = render(
          <AreaPerformanceTable areas={areas} />
        )
        const { container: container3 } = render(
          <AreaPerformanceTable areas={areas} />
        )

        // Extract row counts
        const rowCount1 = container1.querySelector('tbody')?.children.length
        const rowCount2 = container2.querySelector('tbody')?.children.length
        const rowCount3 = container3.querySelector('tbody')?.children.length

        // All renders must produce the same row count
        expect(rowCount1).toBe(rowCount2)
        expect(rowCount2).toBe(rowCount3)
        expect(rowCount1).toBe(areas.length)

        // Extract area IDs from all renders
        const getAreaIds = (container: HTMLElement): string[] => {
          const rows = container.querySelectorAll('tbody tr')
          const ids: string[] = []
          rows.forEach(row => {
            const firstCell = row.querySelector('td')
            if (firstCell?.textContent) {
              ids.push(firstCell.textContent.trim())
            }
          })
          return ids
        }

        const areaIds1 = getAreaIds(container1)
        const areaIds2 = getAreaIds(container2)
        const areaIds3 = getAreaIds(container3)

        // All renders must produce the same order
        expect(areaIds1).toEqual(areaIds2)
        expect(areaIds2).toEqual(areaIds3)
      }),
      { numRuns: 100 }
    )
  })

  it('should not mutate the input areas array', () => {
    fc.assert(
      fc.property(areasArrayArb, (areas: AreaPerformance[]) => {
        // Create a deep copy of the original array for comparison
        const originalAreas = JSON.parse(JSON.stringify(areas))

        // Render the component
        render(<AreaPerformanceTable areas={areas} />)

        // Verify the input array is unchanged
        expect(areas).toEqual(originalAreas)

        // Verify array length is unchanged
        expect(areas.length).toBe(originalAreas.length)

        // Verify each area object is unchanged
        areas.forEach((area, index) => {
          expect(area).toEqual(originalAreas[index])
        })
      }),
      { numRuns: 100 }
    )
  })

  it('should handle empty areas array correctly', () => {
    fc.assert(
      fc.property(fc.constant([]), (areas: AreaPerformance[]) => {
        const { container } = render(<AreaPerformanceTable areas={areas} />)

        const tbody = container.querySelector('tbody')
        const rows = tbody?.querySelectorAll('tr')

        // Empty array should produce zero rows
        expect(rows?.length).toBe(0)
        expect(tbody).toBeInTheDocument()
      }),
      { numRuns: 100 }
    )
  })

  it('should handle single area correctly', () => {
    fc.assert(
      fc.property(areaPerformanceArb, (area: AreaPerformance) => {
        const areas = [area]
        const { container } = render(<AreaPerformanceTable areas={areas} />)

        const tbody = container.querySelector('tbody')
        const rows = tbody?.querySelectorAll('tr')

        // Single area should produce exactly one row
        expect(rows?.length).toBe(1)

        // Verify the area ID is rendered
        const firstCell = rows?.[0].querySelector('td')
        expect(firstCell?.textContent?.trim()).toBe(area.areaId)
      }),
      { numRuns: 100 }
    )
  })

  it('should maintain ordering invariant: for any two areas, if areaId1 < areaId2, then row1 appears before row2', () => {
    fc.assert(
      fc.property(
        fc.array(areaPerformanceArb, { minLength: 2, maxLength: 20 }),
        (areas: AreaPerformance[]) => {
          const { container } = render(<AreaPerformanceTable areas={areas} />)

          const tbody = container.querySelector('tbody')
          const rows = tbody?.querySelectorAll('tr')

          // Extract area IDs from rendered rows
          const renderedAreaIds: string[] = []
          rows?.forEach(row => {
            const firstCell = row.querySelector('td')
            if (firstCell?.textContent) {
              renderedAreaIds.push(firstCell.textContent.trim())
            }
          })

          // For any two consecutive areas in the rendered list,
          // the first must be <= the second in lexicographic order
          for (let i = 0; i < renderedAreaIds.length - 1; i++) {
            const current = renderedAreaIds[i]
            const next = renderedAreaIds[i + 1]
            expect(current.localeCompare(next)).toBeLessThanOrEqual(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle duplicate area IDs correctly', () => {
    fc.assert(
      fc.property(
        areaPerformanceArb,
        fc.integer({ min: 2, max: 5 }),
        (area: AreaPerformance, count: number) => {
          // Create multiple areas with the same ID
          const areas = Array.from({ length: count }, () => ({ ...area }))

          const { container } = render(<AreaPerformanceTable areas={areas} />)

          const tbody = container.querySelector('tbody')
          const rows = tbody?.querySelectorAll('tr')

          // Should render one row per area, even with duplicate IDs
          expect(rows?.length).toBe(count)

          // All rendered area IDs should be the same
          rows?.forEach(row => {
            const firstCell = row.querySelector('td')
            expect(firstCell?.textContent?.trim()).toBe(area.areaId)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should verify specific known examples', () => {
    // Test specific examples to ensure correctness
    const testCases: Array<{
      description: string
      areas: AreaPerformance[]
      expectedCount: number
      expectedOrder: string[]
    }> = [
      {
        description: 'Empty array',
        areas: [],
        expectedCount: 0,
        expectedOrder: [],
      },
      {
        description: 'Single area',
        areas: [
          {
            areaId: 'A1',
            status: 'distinguished',
            clubBase: 10,
            paidClubs: 10,
            netGrowth: 0,
            distinguishedClubs: 5,
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
          },
        ],
        expectedCount: 1,
        expectedOrder: ['A1'],
      },
      {
        description: 'Multiple areas in order',
        areas: [
          {
            areaId: 'A1',
            status: 'distinguished',
            clubBase: 10,
            paidClubs: 10,
            netGrowth: 0,
            distinguishedClubs: 5,
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
          },
          {
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
          },
        ],
        expectedCount: 2,
        expectedOrder: ['A1', 'A2'],
      },
      {
        description: 'Multiple areas out of order',
        areas: [
          {
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
          },
          {
            areaId: 'A1',
            status: 'distinguished',
            clubBase: 10,
            paidClubs: 10,
            netGrowth: 0,
            distinguishedClubs: 5,
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
          },
          {
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
          },
        ],
        expectedCount: 3,
        expectedOrder: ['A1', 'A2', 'B1'],
      },
      {
        description: 'Areas with numeric IDs',
        areas: [
          {
            areaId: 'A10',
            status: 'distinguished',
            clubBase: 10,
            paidClubs: 10,
            netGrowth: 0,
            distinguishedClubs: 5,
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
          },
          {
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
          },
          {
            areaId: 'A3',
            status: 'distinguished',
            clubBase: 10,
            paidClubs: 10,
            netGrowth: 0,
            distinguishedClubs: 5,
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
          },
        ],
        expectedCount: 3,
        expectedOrder: ['A10', 'A2', 'A3'], // Lexicographic order
      },
    ]

    testCases.forEach(({ description, areas, expectedCount, expectedOrder }) => {
      const { container } = render(<AreaPerformanceTable areas={areas} />)

      const tbody = container.querySelector('tbody')
      const rows = tbody?.querySelectorAll('tr')

      // Verify row count
      expect(rows?.length).toBe(expectedCount)

      // Verify order
      const renderedAreaIds: string[] = []
      rows?.forEach(row => {
        const firstCell = row.querySelector('td')
        if (firstCell?.textContent) {
          renderedAreaIds.push(firstCell.textContent.trim())
        }
      })

      expect(renderedAreaIds).toEqual(expectedOrder)
    })
  })

  it('should maintain invariant: row count equals input array length', () => {
    fc.assert(
      fc.property(areasArrayArb, (areas: AreaPerformance[]) => {
        const { container } = render(<AreaPerformanceTable areas={areas} />)

        const tbody = container.querySelector('tbody')
        const rows = tbody?.querySelectorAll('tr')

        // This is the core invariant: N areas → N rows
        expect(rows?.length).toBe(areas.length)
      }),
      { numRuns: 100 }
    )
  })

  it('should maintain invariant: rendered area IDs are a sorted permutation of input area IDs', () => {
    fc.assert(
      fc.property(areasArrayArb, (areas: AreaPerformance[]) => {
        // Skip test if areas array is empty
        if (areas.length === 0) {
          return true
        }

        const { container } = render(<AreaPerformanceTable areas={areas} />)

        const tbody = container.querySelector('tbody')
        const rows = tbody?.querySelectorAll('tr')

        // Extract area IDs from rendered rows
        const renderedAreaIds: string[] = []
        rows?.forEach(row => {
          const firstCell = row.querySelector('td')
          if (firstCell?.textContent) {
            renderedAreaIds.push(firstCell.textContent.trim())
          }
        })

        // Extract area IDs from input and sort them
        const inputAreaIds = areas.map(area => area.areaId)
        const sortedInputAreaIds = [...inputAreaIds].sort((a, b) =>
          a.localeCompare(b)
        )

        // Rendered IDs must be a sorted permutation of input IDs
        expect(renderedAreaIds).toEqual(sortedInputAreaIds)
      }),
      { numRuns: 100 }
    )
  })
})
