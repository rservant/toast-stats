/**
 * AreaPerformanceRow Property-Based Tests
 *
 * **Feature: division-area-performance-cards**
 *
 * Property-based tests to verify the correctness of area row rendering
 * across many randomized inputs.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import { AreaPerformanceRow } from '../AreaPerformanceRow'
import {
  AreaPerformance,
  DistinguishedStatus,
} from '../../utils/divisionStatus'

/**
 * **Feature: division-area-performance-cards, Property 10: Area Row Data Completeness**
 * **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
 *
 * For any area, the rendered row SHALL contain all required data elements:
 * - Area identifier (Requirement 6.2)
 * - Paid clubs with net growth (Requirement 6.3)
 * - Distinguished clubs progress (Requirement 6.4)
 * - First round visit status (Requirement 6.5)
 * - Second round visit status (Requirement 6.6)
 * - Current status level (Requirement 6.7)
 *
 * This property ensures that:
 * - All required data elements are present in the rendered output
 * - The component handles any valid AreaPerformance data
 * - Data is displayed in the correct format
 * - The component is robust across all valid input combinations
 */
describe('Property 10: Area Row Data Completeness', () => {
  // Generator for distinguished status
  const distinguishedStatusArb = fc.constantFrom<DistinguishedStatus>(
    'not-distinguished',
    'distinguished',
    'select-distinguished',
    'presidents-distinguished',
    'not-qualified'
  )

  // Generator for visit status
  const visitStatusArb = fc.record({
    completed: fc.integer({ min: 0, max: 100 }),
    required: fc.integer({ min: 1, max: 100 }),
    percentage: fc.float({ min: 0, max: 100, noNaN: true }),
    meetsThreshold: fc.boolean(),
  })

  // Generator for area performance data
  const areaPerformanceArb = fc.record({
    areaId: fc
      .string({ minLength: 1, maxLength: 10 })
      .filter(s => s.trim().length > 0),
    status: distinguishedStatusArb,
    clubBase: fc.integer({ min: 0, max: 100 }),
    paidClubs: fc.integer({ min: 0, max: 150 }),
    netGrowth: fc.integer({ min: -100, max: 100 }),
    distinguishedClubs: fc.integer({ min: 0, max: 100 }),
    requiredDistinguishedClubs: fc.integer({ min: 0, max: 100 }),
    firstRoundVisits: visitStatusArb,
    secondRoundVisits: visitStatusArb,
    isQualified: fc.boolean(),
  })

  it('should render all required data elements for any valid area', () => {
    fc.assert(
      fc.property(areaPerformanceArb, (area: AreaPerformance) => {
        // Render the component
        const { container } = render(
          <table>
            <tbody>
              <AreaPerformanceRow area={area} />
            </tbody>
          </table>
        )

        // Get the rendered row
        const row = container.querySelector('tr')
        expect(row).not.toBeNull()

        // Get all cells in the row
        const cells = row!.querySelectorAll('td')

        // Requirement 6.2: Area identifier must be present
        // Should be in the first cell
        expect(cells.length).toBeGreaterThanOrEqual(6)
        const areaIdCell = cells[0]
        expect(areaIdCell.textContent).toContain(area.areaId)

        // Requirement 6.3: Paid clubs with net growth must be present
        // Should be in the second cell in format "paidClubs/clubBase (netGrowth)"
        const paidClubsCell = cells[1]
        expect(paidClubsCell.textContent).toContain(
          `${area.paidClubs}/${area.clubBase}`
        )

        // Net growth should be formatted with +/- sign
        const expectedNetGrowth =
          area.netGrowth > 0 ? `+${area.netGrowth}` : `${area.netGrowth}`
        expect(paidClubsCell.textContent).toContain(`(${expectedNetGrowth})`)

        // Requirement 6.4: Distinguished clubs progress must be present
        // Should be in the third cell in format "distinguishedClubs/requiredDistinguishedClubs"
        const distinguishedClubsCell = cells[2]
        expect(distinguishedClubsCell.textContent).toContain(
          `${area.distinguishedClubs}/${area.requiredDistinguishedClubs}`
        )

        // Requirement 6.5: First round visit status must be present
        // Should be in the fourth cell in format "completed/required ✓" or "completed/required ✗"
        const firstRoundCell = cells[3]
        expect(firstRoundCell.textContent).toContain(
          `${area.firstRoundVisits.completed}/${area.firstRoundVisits.required}`
        )
        const firstRoundIndicator = area.firstRoundVisits.meetsThreshold
          ? '✓'
          : '✗'
        expect(firstRoundCell.textContent).toContain(firstRoundIndicator)

        // Requirement 6.6: Second round visit status must be present
        // Should be in the fifth cell in format "completed/required ✓" or "completed/required ✗"
        const secondRoundCell = cells[4]
        expect(secondRoundCell.textContent).toContain(
          `${area.secondRoundVisits.completed}/${area.secondRoundVisits.required}`
        )
        const secondRoundIndicator = area.secondRoundVisits.meetsThreshold
          ? '✓'
          : '✗'
        expect(secondRoundCell.textContent).toContain(secondRoundIndicator)

        // Requirement 6.7: Current status level must be present
        // Should be in the sixth cell
        const statusCell = cells[5]

        // Map status to expected display text
        const statusLabels: Record<DistinguishedStatus, string> = {
          'presidents-distinguished': "President's Distinguished",
          'select-distinguished': 'Select Distinguished',
          distinguished: 'Distinguished',
          'not-qualified': 'Not Qualified',
          'not-distinguished': 'Not Distinguished',
        }

        const expectedStatusLabel = statusLabels[area.status]
        expect(statusCell.textContent).toContain(expectedStatusLabel)
      }),
      { numRuns: 100 }
    )
  })

  it('should produce consistent output for the same area data', () => {
    fc.assert(
      fc.property(areaPerformanceArb, (area: AreaPerformance) => {
        // Render the component multiple times with the same data
        const { container: container1 } = render(
          <table>
            <tbody>
              <AreaPerformanceRow area={area} />
            </tbody>
          </table>
        )

        const { container: container2 } = render(
          <table>
            <tbody>
              <AreaPerformanceRow area={area} />
            </tbody>
          </table>
        )

        // Get the text content from both renders
        const text1 = container1.textContent
        const text2 = container2.textContent

        // Both renders should produce identical output
        expect(text1).toBe(text2)
      }),
      { numRuns: 100 }
    )
  })

  it('should render exactly 6 table cells for any area', () => {
    fc.assert(
      fc.property(areaPerformanceArb, (area: AreaPerformance) => {
        const { container } = render(
          <table>
            <tbody>
              <AreaPerformanceRow area={area} />
            </tbody>
          </table>
        )

        const row = container.querySelector('tr')
        const cells = row!.querySelectorAll('td')

        // Must have exactly 6 cells (one for each required data element)
        expect(cells.length).toBe(6)
      }),
      { numRuns: 100 }
    )
  })

  it('should handle edge case of zero values correctly', () => {
    fc.assert(
      fc.property(
        distinguishedStatusArb,
        visitStatusArb,
        visitStatusArb,
        (status, firstRound, secondRound) => {
          const area: AreaPerformance = {
            areaId: 'A0',
            status,
            clubBase: 0,
            paidClubs: 0,
            netGrowth: 0,
            distinguishedClubs: 0,
            requiredDistinguishedClubs: 0,
            firstRoundVisits: firstRound,
            secondRoundVisits: secondRound,
            isQualified: false,
          }

          const { container } = render(
            <table>
              <tbody>
                <AreaPerformanceRow area={area} />
              </tbody>
            </table>
          )

          const cells = container.querySelectorAll('td')

          // All zero values should be displayed correctly
          expect(cells[1].textContent).toContain('0/0')
          expect(cells[1].textContent).toContain('(0)')
          expect(cells[2].textContent).toContain('0/0')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle positive and negative net growth correctly', () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), netGrowth => {
        const clubBase = 10
        const paidClubs = clubBase + netGrowth

        const area: AreaPerformance = {
          areaId: 'A1',
          status: 'distinguished',
          clubBase,
          paidClubs: Math.max(0, paidClubs), // Ensure non-negative
          netGrowth,
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
        }

        const { container } = render(
          <table>
            <tbody>
              <AreaPerformanceRow area={area} />
            </tbody>
          </table>
        )

        const cells = container.querySelectorAll('td')
        const paidClubsCell = cells[1]

        // Net growth should be formatted with appropriate sign
        if (netGrowth > 0) {
          expect(paidClubsCell.textContent).toContain(`(+${netGrowth})`)
        } else {
          expect(paidClubsCell.textContent).toContain(`(${netGrowth})`)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('should display correct visit indicators based on threshold status', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (firstMeetsThreshold, secondMeetsThreshold) => {
          const area: AreaPerformance = {
            areaId: 'A1',
            status: 'distinguished',
            clubBase: 10,
            paidClubs: 10,
            netGrowth: 0,
            distinguishedClubs: 5,
            requiredDistinguishedClubs: 5,
            firstRoundVisits: {
              completed: firstMeetsThreshold ? 8 : 5,
              required: 8,
              percentage: firstMeetsThreshold ? 80 : 62.5,
              meetsThreshold: firstMeetsThreshold,
            },
            secondRoundVisits: {
              completed: secondMeetsThreshold ? 8 : 5,
              required: 8,
              percentage: secondMeetsThreshold ? 80 : 62.5,
              meetsThreshold: secondMeetsThreshold,
            },
            isQualified: true,
          }

          const { container } = render(
            <table>
              <tbody>
                <AreaPerformanceRow area={area} />
              </tbody>
            </table>
          )

          const cells = container.querySelectorAll('td')

          // First round should have correct indicator
          const firstRoundCell = cells[3]
          const expectedFirstIndicator = firstMeetsThreshold ? '✓' : '✗'
          expect(firstRoundCell.textContent).toContain(expectedFirstIndicator)

          // Second round should have correct indicator
          const secondRoundCell = cells[4]
          const expectedSecondIndicator = secondMeetsThreshold ? '✓' : '✗'
          expect(secondRoundCell.textContent).toContain(expectedSecondIndicator)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should display all five distinguished status types correctly', () => {
    const statusTypes: DistinguishedStatus[] = [
      'presidents-distinguished',
      'select-distinguished',
      'distinguished',
      'not-qualified',
      'not-distinguished',
    ]

    const statusLabels: Record<DistinguishedStatus, string> = {
      'presidents-distinguished': "President's Distinguished",
      'select-distinguished': 'Select Distinguished',
      distinguished: 'Distinguished',
      'not-qualified': 'Not Qualified',
      'not-distinguished': 'Not Distinguished',
    }

    statusTypes.forEach(status => {
      fc.assert(
        fc.property(fc.constant(status), statusValue => {
          const area: AreaPerformance = {
            areaId: 'A1',
            status: statusValue,
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
          }

          const { container } = render(
            <table>
              <tbody>
                <AreaPerformanceRow area={area} />
              </tbody>
            </table>
          )

          const cells = container.querySelectorAll('td')
          const statusCell = cells[5]

          // Status label should match expected text
          expect(statusCell.textContent).toContain(statusLabels[statusValue])
        }),
        { numRuns: 20 }
      )
    })
  })

  it('should maintain data integrity: rendered values match input values', () => {
    fc.assert(
      fc.property(areaPerformanceArb, (area: AreaPerformance) => {
        const { container } = render(
          <table>
            <tbody>
              <AreaPerformanceRow area={area} />
            </tbody>
          </table>
        )

        const text = container.textContent || ''

        // Verify that all input values appear in the output
        expect(text).toContain(area.areaId)
        expect(text).toContain(String(area.paidClubs))
        expect(text).toContain(String(area.clubBase))
        expect(text).toContain(String(area.distinguishedClubs))
        expect(text).toContain(String(area.requiredDistinguishedClubs))
        expect(text).toContain(String(area.firstRoundVisits.completed))
        expect(text).toContain(String(area.firstRoundVisits.required))
        expect(text).toContain(String(area.secondRoundVisits.completed))
        expect(text).toContain(String(area.secondRoundVisits.required))
      }),
      { numRuns: 100 }
    )
  })

  it('should verify specific known examples', () => {
    // Test specific examples to ensure correctness
    const testCases: AreaPerformance[] = [
      {
        areaId: 'A1',
        status: 'presidents-distinguished',
        clubBase: 10,
        paidClubs: 12,
        netGrowth: 2,
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
      },
      {
        areaId: 'B2',
        status: 'not-qualified',
        clubBase: 10,
        paidClubs: 8,
        netGrowth: -2,
        distinguishedClubs: 4,
        requiredDistinguishedClubs: 5,
        firstRoundVisits: {
          completed: 5,
          required: 8,
          percentage: 62.5,
          meetsThreshold: false,
        },
        secondRoundVisits: {
          completed: 6,
          required: 8,
          percentage: 75,
          meetsThreshold: false,
        },
        isQualified: false,
      },
      {
        areaId: 'C3',
        status: 'distinguished',
        clubBase: 20,
        paidClubs: 20,
        netGrowth: 0,
        distinguishedClubs: 10,
        requiredDistinguishedClubs: 10,
        firstRoundVisits: {
          completed: 15,
          required: 15,
          percentage: 75,
          meetsThreshold: true,
        },
        secondRoundVisits: {
          completed: 15,
          required: 15,
          percentage: 75,
          meetsThreshold: true,
        },
        isQualified: true,
      },
    ]

    testCases.forEach(area => {
      const { container } = render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      const cells = container.querySelectorAll('td')

      // Verify all data elements are present
      expect(cells[0].textContent).toContain(area.areaId)
      expect(cells[1].textContent).toContain(
        `${area.paidClubs}/${area.clubBase}`
      )
      expect(cells[2].textContent).toContain(
        `${area.distinguishedClubs}/${area.requiredDistinguishedClubs}`
      )
      expect(cells[3].textContent).toContain(
        `${area.firstRoundVisits.completed}/${area.firstRoundVisits.required}`
      )
      expect(cells[4].textContent).toContain(
        `${area.secondRoundVisits.completed}/${area.secondRoundVisits.required}`
      )
      expect(cells.length).toBe(6)
    })
  })
})
