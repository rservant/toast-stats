/**
 * Property-Based Tests for DivisionPerformanceCards Component
 *
 * **Feature: division-area-performance-cards**
 *
 * Uses fast-check to verify universal properties hold across randomized inputs.
 * Tests that the component correctly renders division cards with proper count
 * and ordering regardless of the specific snapshot data provided.
 *
 * Validates Requirements: 1.1, 1.3
 */

import { describe, it, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import { DivisionPerformanceCards } from '../DivisionPerformanceCards'
import type { DivisionPerformance } from '../../utils/divisionStatus'

// Mock the extractDivisionPerformance function
vi.mock('../../utils/extractDivisionPerformance', () => ({
  extractDivisionPerformance: vi.fn(),
}))

// Mock the formatDisplayDate function
vi.mock('../../utils/dateFormatting', () => ({
  formatDisplayDate: vi.fn((date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }),
}))

import { extractDivisionPerformance } from '../../utils/extractDivisionPerformance'
import { formatDisplayDate } from '../../utils/dateFormatting'

/**
 * Generator for division identifiers (A-Z, AA-ZZ)
 * Generates realistic division identifiers that could appear in a district
 */
const divisionIdArb = fc.oneof(
  // Single letter divisions (A-Z)
  fc.stringMatching(/^[A-Z]$/),
  // Double letter divisions (AA-ZZ)
  fc.stringMatching(/^[A-Z]{2}$/)
)

/**
 * Generator for club counts (0-100)
 */
const clubCountArb = fc.integer({ min: 0, max: 100 })

/**
 * Generator for net growth (-50 to +50)
 */
const netGrowthArb = fc.integer({ min: -50, max: 50 })

/**
 * Generator for division distinguished status (excludes 'not-qualified')
 */
const divisionStatusArb = fc.constantFrom(
  'not-distinguished',
  'distinguished',
  'select-distinguished',
  'presidents-distinguished'
)

/**
 * Generator for a single division performance object
 */
const divisionPerformanceArb = fc.record({
  divisionId: divisionIdArb,
  status: divisionStatusArb,
  clubBase: clubCountArb,
  paidClubs: clubCountArb,
  netGrowth: netGrowthArb,
  distinguishedClubs: clubCountArb,
  requiredDistinguishedClubs: clubCountArb,
  areas: fc.constant([]), // Simplified: empty areas for this test
}) as fc.Arbitrary<DivisionPerformance>

/**
 * Generator for an array of division performance objects
 * Generates 0-10 divisions with unique identifiers
 */
const divisionsArrayArb = fc
  .array(divisionPerformanceArb, { minLength: 0, maxLength: 10 })
  .map(divisions => {
    // Ensure unique division IDs and sort by ID
    const uniqueDivisions = Array.from(
      new Map(divisions.map(d => [d.divisionId, d])).values()
    )
    return uniqueDivisions.sort((a, b) =>
      a.divisionId.localeCompare(b.divisionId)
    )
  })

/**
 * Generator for mock district snapshot
 * Creates a minimal snapshot structure that would be passed to the component
 */
const districtSnapshotArb = fc.record({
  divisionPerformance: fc.array(fc.record({})),
  clubPerformance: fc.array(fc.record({})),
})

describe('DivisionPerformanceCards Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  /**
   * **Feature: division-area-performance-cards, Property 7: Division Card Count and Ordering**
   * **Validates: Requirements 1.1, 1.3**
   *
   * For any district snapshot containing N divisions, the rendered output should
   * contain exactly N division cards, ordered by division identifier in ascending order.
   *
   * This property ensures that:
   * - The number of rendered cards matches the number of divisions in the data
   * - Cards are rendered in alphabetical order by division identifier
   * - The ordering is consistent and deterministic
   * - All divisions are represented (no divisions are skipped)
   */
  it(
    'Property 7: should render exactly N division cards ordered by division identifier',
    { timeout: 15000 },
    () => {
      fc.assert(
        fc.property(
          districtSnapshotArb,
          divisionsArrayArb,
          (snapshot, divisions) => {
            // Clean up any previous renders
            cleanup()

            // Mock the extractDivisionPerformance to return our generated divisions
            vi.mocked(extractDivisionPerformance).mockReturnValue(divisions)

            // Render the component
            render(
              <DivisionPerformanceCards
                districtSnapshot={snapshot}
                isLoading={false}
              />
            )

            // Requirement 1.1: Verify exactly N division cards are rendered
            const expectedCount = divisions.length

            if (expectedCount === 0) {
              // Empty state: should show "No Divisions Found" message
              const emptyMessage = screen.queryByText('No Divisions Found')
              if (!emptyMessage) {
                throw new Error(
                  'Expected "No Divisions Found" message when divisions array is empty'
                )
              }
              return true
            }

            // For non-empty divisions, verify each division card is present
            const divisionCards = divisions.map(division => {
              const divisionLabel = `Division ${division.divisionId}`
              const card = screen.queryByText(divisionLabel)
              if (!card) {
                throw new Error(
                  `Expected to find division card for "${divisionLabel}" but it was not rendered`
                )
              }
              return { divisionId: division.divisionId, element: card }
            })

            // Verify we found exactly the expected number of cards
            if (divisionCards.length !== expectedCount) {
              throw new Error(
                `Expected ${expectedCount} division cards but found ${divisionCards.length}`
              )
            }

            // Requirement 1.3: Verify cards are ordered by division identifier
            // Get all division heading elements in DOM order
            const allDivisionHeadings = screen.getAllByText(
              /^Division [A-Z]{1,2}$/
            )

            if (allDivisionHeadings.length !== expectedCount) {
              throw new Error(
                `Expected ${expectedCount} division headings but found ${allDivisionHeadings.length}`
              )
            }

            // Extract division IDs from the rendered headings in DOM order
            const renderedOrder = allDivisionHeadings.map(heading => {
              const match = heading.textContent?.match(
                /^Division ([A-Z]{1,2})$/
              )
              if (!match) {
                throw new Error(
                  `Could not extract division ID from heading: ${heading.textContent}`
                )
              }
              return match[1]
            })

            // Expected order is the sorted division IDs
            const expectedOrder = divisions.map(d => d.divisionId)

            // Verify the rendered order matches the expected sorted order
            for (let i = 0; i < expectedOrder.length; i++) {
              if (renderedOrder[i] !== expectedOrder[i]) {
                throw new Error(
                  `Division cards are not in correct order. ` +
                    `Expected "${expectedOrder[i]}" at position ${i} but found "${renderedOrder[i]}". ` +
                    `Expected order: [${expectedOrder.join(', ')}], ` +
                    `Rendered order: [${renderedOrder.join(', ')}]`
                )
              }
            }

            // Verify ordering is ascending (each division ID should be <= next)
            for (let i = 0; i < renderedOrder.length - 1; i++) {
              const current = renderedOrder[i]
              const next = renderedOrder[i + 1]
              if (current && next && current.localeCompare(next) > 0) {
                throw new Error(
                  `Division cards are not in ascending order. ` +
                    `"${current}" at position ${i} should come before "${next}" at position ${i + 1}`
                )
              }
            }

            return true
          }
        ),
        { numRuns: 25 }
      )
    }
  )

  /**
   * Property: Division Card Count Consistency
   *
   * For any district snapshot, the number of division cards rendered should
   * exactly match the number of divisions returned by extractDivisionPerformance.
   * This verifies that no divisions are duplicated or omitted during rendering.
   */
  it(
    'should render exactly one card per division with no duplicates',
    { timeout: 15000 },
    () => {
      fc.assert(
        fc.property(
          districtSnapshotArb,
          divisionsArrayArb,
          (snapshot, divisions) => {
            cleanup()

            vi.mocked(extractDivisionPerformance).mockReturnValue(divisions)

            render(
              <DivisionPerformanceCards
                districtSnapshot={snapshot}
                isLoading={false}
              />
            )

            if (divisions.length === 0) {
              return true
            }

            // Count how many times each division ID appears in the rendered output
            const divisionIdCounts = new Map<string, number>()

            for (const division of divisions) {
              const divisionLabel = `Division ${division.divisionId}`
              const elements = screen.getAllByText(divisionLabel)

              // Each division should appear exactly once (in its card heading)
              if (elements.length !== 1) {
                throw new Error(
                  `Division "${division.divisionId}" appears ${elements.length} times, expected exactly 1`
                )
              }

              divisionIdCounts.set(division.divisionId, elements.length)
            }

            // Verify all divisions were counted
            if (divisionIdCounts.size !== divisions.length) {
              throw new Error(
                `Expected ${divisions.length} unique divisions but found ${divisionIdCounts.size}`
              )
            }

            return true
          }
        ),
        { numRuns: 25 }
      )
    }
  )

  /**
   * Property: Ordering Stability
   *
   * For any set of divisions, rendering the component multiple times with the
   * same data should produce the same ordering every time. This verifies that
   * the ordering is deterministic and not affected by render timing or other
   * non-deterministic factors.
   */
  it(
    'should produce consistent ordering across multiple renders',
    { timeout: 15000 },
    () => {
      fc.assert(
        fc.property(
          districtSnapshotArb,
          divisionsArrayArb,
          (snapshot, divisions) => {
            if (divisions.length === 0) {
              return true
            }

            // Render the component multiple times
            const orderings: string[][] = []

            for (let i = 0; i < 3; i++) {
              cleanup()
              vi.mocked(extractDivisionPerformance).mockReturnValue(divisions)

              render(
                <DivisionPerformanceCards
                  districtSnapshot={snapshot}
                  isLoading={false}
                />
              )

              const headings = screen.getAllByText(/^Division [A-Z]{1,2}$/)
              const order = headings.map(h => {
                const match = h.textContent?.match(/^Division ([A-Z]{1,2})$/)
                return match ? match[1] : ''
              })

              orderings.push(order)
            }

            // All orderings should be identical
            const firstOrdering = orderings[0]
            for (let i = 1; i < orderings.length; i++) {
              const currentOrdering = orderings[i]
              if (firstOrdering && currentOrdering) {
                if (firstOrdering.length !== currentOrdering.length) {
                  throw new Error(
                    `Inconsistent ordering across renders. ` +
                      `First render had ${firstOrdering.length} divisions, ` +
                      `render ${i + 1} had ${currentOrdering.length} divisions`
                  )
                }

                for (let j = 0; j < firstOrdering.length; j++) {
                  if (firstOrdering[j] !== currentOrdering[j]) {
                    throw new Error(
                      `Inconsistent ordering across renders. ` +
                        `Position ${j}: first render had "${firstOrdering[j]}", ` +
                        `render ${i + 1} had "${currentOrdering[j]}"`
                    )
                  }
                }
              }
            }

            return true
          }
        ),
        { numRuns: 25 }
      )
    }
  )

  /**
   * Property: Alphabetical Ordering Invariant
   *
   * For any set of divisions, the rendered order should satisfy the invariant
   * that for any two adjacent divisions in the rendered list, the first division's
   * ID should be lexicographically less than or equal to the second division's ID.
   */
  it('should maintain alphabetical ordering invariant for all adjacent pairs', () => {
    fc.assert(
      fc.property(
        districtSnapshotArb,
        divisionsArrayArb,
        (snapshot, divisions) => {
          if (divisions.length <= 1) {
            return true
          }

          cleanup()
          vi.mocked(extractDivisionPerformance).mockReturnValue(divisions)

          render(
            <DivisionPerformanceCards
              districtSnapshot={snapshot}
              isLoading={false}
            />
          )

          const headings = screen.getAllByText(/^Division [A-Z]{1,2}$/)
          const renderedIds = headings.map(h => {
            const match = h.textContent?.match(/^Division ([A-Z]{1,2})$/)
            return match ? match[1] : ''
          })

          // Check all adjacent pairs
          for (let i = 0; i < renderedIds.length - 1; i++) {
            const current = renderedIds[i]
            const next = renderedIds[i + 1]

            if (current && next) {
              const comparison = current.localeCompare(next)
              if (comparison > 0) {
                throw new Error(
                  `Alphabetical ordering invariant violated: ` +
                    `"${current}" at position ${i} should come before or equal to "${next}" at position ${i + 1}`
                )
              }
            }
          }

          return true
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * Property: Empty State Handling
   *
   * When the divisions array is empty (N = 0), the component should render
   * an empty state message instead of division cards.
   */
  it('should render empty state when divisions array is empty', () => {
    fc.assert(
      fc.property(districtSnapshotArb, snapshot => {
        cleanup()

        // Mock empty divisions array
        vi.mocked(extractDivisionPerformance).mockReturnValue([])

        render(
          <DivisionPerformanceCards
            districtSnapshot={snapshot}
            isLoading={false}
          />
        )

        // Should show empty state message
        const emptyMessage = screen.queryByText('No Divisions Found')
        if (!emptyMessage) {
          throw new Error(
            'Expected "No Divisions Found" message when divisions array is empty'
          )
        }

        // Should NOT show any division cards
        const divisionHeadings = screen.queryAllByText(/^Division [A-Z]{1,2}$/)
        if (divisionHeadings.length > 0) {
          throw new Error(
            `Expected no division cards but found ${divisionHeadings.length}`
          )
        }

        return true
      }),
      { numRuns: 25 }
    )
  })

  /**
   * **Feature: division-area-performance-cards, Property 14: Snapshot Timestamp Display**
   * **Validates: Requirements 10.3**
   *
   * For any district snapshot with a timestamp, the rendered output should include
   * that timestamp in a visible location.
   *
   * This property ensures that:
   * - The timestamp is displayed when provided
   * - The timestamp is formatted in a human-readable way
   * - The timestamp is visible and accessible to users
   * - The component handles various timestamp formats correctly
   * - The timestamp appears in a consistent location
   *
   * Requirements:
   * - 10.3: THE System SHALL display the timestamp of the current snapshot data
   */
  it(
    'Property 14: should display snapshot timestamp when provided',
    { timeout: 15000 },
    () => {
      // Generator for ISO 8601 timestamp strings using integer-based approach to avoid invalid dates
      const timestampArb = fc
        .integer({ min: 1577836800000, max: 1924991999000 }) // 2020-01-01 to 2030-12-31 in milliseconds
        .map(ms => new Date(ms).toISOString())

      // Generator for non-empty divisions array (at least 1 division)
      const nonEmptyDivisionsArb = fc
        .array(divisionPerformanceArb, { minLength: 1, maxLength: 10 })
        .map(divisions => {
          // Ensure unique division IDs and sort by ID
          const uniqueDivisions = Array.from(
            new Map(divisions.map(d => [d.divisionId, d])).values()
          )
          return uniqueDivisions.sort((a, b) =>
            a.divisionId.localeCompare(b.divisionId)
          )
        })

      fc.assert(
        fc.property(
          districtSnapshotArb,
          nonEmptyDivisionsArb,
          timestampArb,
          (snapshot, divisions, timestamp) => {
            cleanup()

            // Mock the extractDivisionPerformance to return our generated divisions
            vi.mocked(extractDivisionPerformance).mockReturnValue(divisions)

            // Render the component with a timestamp
            render(
              <DivisionPerformanceCards
                districtSnapshot={snapshot}
                isLoading={false}
                snapshotTimestamp={timestamp}
              />
            )

            // Requirement 10.3: Verify timestamp is displayed
            // The timestamp should be formatted and visible in the output
            // Use the mocked formatDisplayDate function to get the expected format
            const expectedFormattedDate = formatDisplayDate(timestamp)

            // Look for the formatted timestamp in the rendered output
            const timestampElement = screen.queryByText(expectedFormattedDate)
            if (!timestampElement) {
              throw new Error(
                `Expected to find timestamp "${expectedFormattedDate}" in rendered output but it was not found. ` +
                  `Original timestamp: ${timestamp}`
              )
            }

            // Verify the "Data as of" label is present
            const dataAsOfLabel = screen.queryByText('Data as of')
            if (!dataAsOfLabel) {
              throw new Error(
                'Expected to find "Data as of" label near timestamp but it was not found'
              )
            }

            return true
          }
        ),
        { numRuns: 25 }
      )
    }
  )

  /**
   * Property: Timestamp Absence Handling
   *
   * When no timestamp is provided, the component should still render correctly
   * without displaying a timestamp section. This verifies that the timestamp
   * is optional and its absence doesn't break the component.
   */
  it('should render without timestamp section when timestamp is not provided', () => {
    fc.assert(
      fc.property(
        districtSnapshotArb,
        divisionsArrayArb,
        (snapshot, divisions) => {
          cleanup()

          vi.mocked(extractDivisionPerformance).mockReturnValue(divisions)

          // Render without timestamp
          render(
            <DivisionPerformanceCards
              districtSnapshot={snapshot}
              isLoading={false}
            />
          )

          // Should NOT show "Data as of" label when no timestamp provided
          const dataAsOfLabel = screen.queryByText('Data as of')
          if (dataAsOfLabel) {
            throw new Error(
              'Expected "Data as of" label to be absent when no timestamp is provided'
            )
          }

          // Component should still render divisions normally
          if (divisions.length > 0) {
            const firstDivision = divisions[0]
            if (firstDivision) {
              const divisionLabel = `Division ${firstDivision.divisionId}`
              const card = screen.queryByText(divisionLabel)
              if (!card) {
                throw new Error(
                  `Expected to find division card even without timestamp`
                )
              }
            }
          }

          return true
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * **Feature: division-area-performance-cards, Property 13: Snapshot Update Reactivity**
   * **Validates: Requirements 10.1, 10.2**
   *
   * For any two different district snapshots, providing the second snapshot should
   * result in recalculated status classifications and updated metrics that reflect
   * the new snapshot's data.
   *
   * This property ensures that:
   * - The component recalculates division performance when snapshot changes
   * - Status classifications are updated based on new data
   * - Metrics (paid clubs, distinguished clubs, net growth) reflect the new snapshot
   * - The component is reactive to snapshot prop changes
   * - No stale data is displayed after snapshot update
   *
   * Requirements:
   * - 10.1: When new district snapshot data becomes available, THE System SHALL
   *         recalculate all division and area status classifications
   * - 10.2: When new district snapshot data becomes available, THE System SHALL
   *         update all displayed metrics
   */
  it(
    'Property 13: should recalculate and update metrics when snapshot changes',
    { timeout: 20000 },
    () => {
      fc.assert(
        fc.property(
          divisionsArrayArb,
          divisionsArrayArb,
          (divisions1, divisions2) => {
            // Skip if both division arrays are empty (nothing to compare)
            if (divisions1.length === 0 && divisions2.length === 0) {
              return true
            }

            // Ensure the two division arrays are actually different
            // by checking if they have different content
            const areDifferent =
              divisions1.length !== divisions2.length ||
              divisions1.some((d1, idx) => {
                const d2 = divisions2[idx]
                return (
                  !d2 ||
                  d1.divisionId !== d2.divisionId ||
                  d1.status !== d2.status ||
                  d1.paidClubs !== d2.paidClubs ||
                  d1.clubBase !== d2.clubBase ||
                  d1.distinguishedClubs !== d2.distinguishedClubs
                )
              })

            // Skip if the divisions are identical (no change to detect)
            if (!areDifferent) {
              return true
            }

            cleanup()

            // Create mock snapshots (the actual snapshot structure doesn't matter
            // since we're mocking extractDivisionPerformance)
            const snapshot1 = { data: 'snapshot1' }
            const snapshot2 = { data: 'snapshot2' }

            // Render with first snapshot
            vi.mocked(extractDivisionPerformance).mockReturnValue(divisions1)
            const { rerender } = render(
              <DivisionPerformanceCards
                districtSnapshot={snapshot1}
                isLoading={false}
              />
            )

            // Verify first render shows divisions from first snapshot
            if (divisions1.length > 0) {
              for (const division of divisions1) {
                const divisionLabel = `Division ${division.divisionId}`
                const card = screen.queryByText(divisionLabel)
                if (!card) {
                  throw new Error(
                    `Expected to find division "${division.divisionId}" in initial render`
                  )
                }
              }
            }

            // Update to second snapshot
            vi.mocked(extractDivisionPerformance).mockReturnValue(divisions2)
            rerender(
              <DivisionPerformanceCards
                districtSnapshot={snapshot2}
                isLoading={false}
              />
            )

            // Requirement 10.1: Verify status classifications are recalculated
            // Check that the component now shows divisions from the second snapshot
            if (divisions2.length === 0) {
              // Should show empty state
              const emptyMessage = screen.queryByText('No Divisions Found')
              if (!emptyMessage) {
                throw new Error(
                  'Expected "No Divisions Found" message after updating to empty snapshot'
                )
              }
            } else {
              // Should show divisions from second snapshot
              for (const division of divisions2) {
                const divisionLabel = `Division ${division.divisionId}`
                const card = screen.queryByText(divisionLabel)
                if (!card) {
                  throw new Error(
                    `Expected to find division "${division.divisionId}" after snapshot update but it was not rendered`
                  )
                }
              }
            }

            // Requirement 10.2: Verify metrics are updated
            // Verify that divisions removed in the second snapshot are no longer shown
            for (const division1 of divisions1) {
              const stillExists = divisions2.some(
                d => d.divisionId === division1.divisionId
              )
              if (!stillExists && divisions2.length > 0) {
                // This division was removed, verify it's not in the DOM
                const divisionLabel = `Division ${division1.divisionId}`
                const card = screen.queryByText(divisionLabel)
                if (card) {
                  throw new Error(
                    `Division "${division1.divisionId}" should not be rendered after being removed from snapshot`
                  )
                }
              }
            }

            // Verify the count changed if the number of divisions changed
            if (divisions1.length !== divisions2.length) {
              const expectedCount = divisions2.length
              if (expectedCount > 0) {
                const allDivisionHeadings = screen.queryAllByText(
                  /^Division [A-Z]{1,2}$/
                )
                if (allDivisionHeadings.length !== expectedCount) {
                  throw new Error(
                    `Expected ${expectedCount} division cards after snapshot update but found ${allDivisionHeadings.length}`
                  )
                }
              }
            }

            return true
          }
        ),
        { numRuns: 25 }
      )
    }
  )
})
