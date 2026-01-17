/**
 * Property-Based Tests for DivisionSummary Component
 *
 * Uses fast-check to verify universal properties hold across randomized inputs.
 * Tests that the component correctly renders all required data elements
 * regardless of the specific values provided.
 *
 * Validates Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import DivisionSummary from '../DivisionSummary'
import type { DistinguishedStatus } from '../../utils/divisionStatus'

// Suppress unused variable warning - container is used for rendering context
const _suppressUnusedWarning = (value: unknown) => void value

/**
 * Generator for division distinguished status (excludes 'not-qualified')
 */
const divisionStatusArb = fc.constantFrom<
  Exclude<DistinguishedStatus, 'not-qualified'>
>(
  'not-distinguished',
  'distinguished',
  'select-distinguished',
  'presidents-distinguished'
)

/**
 * Generator for division identifiers (A-Z)
 */
const divisionIdArb = fc.stringMatching(/^[A-Z]$/)

/**
 * Generator for club counts (0-100)
 */
const clubCountArb = fc.integer({ min: 0, max: 100 })

/**
 * Generator for net growth (-50 to +50)
 */
const netGrowthArb = fc.integer({ min: -50, max: 50 })

describe('DivisionSummary Property-Based Tests', () => {
  /**
   * Property 9: Division Summary Data Completeness
   *
   * For any division, the rendered summary section should contain all required
   * data elements: division identifier, status level, paid clubs in "current/base"
   * format, net growth indicator, and distinguished clubs in "current/required" format.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  it('Property 9: should render all required data elements for any division', () => {
    fc.assert(
      fc.property(
        divisionIdArb,
        divisionStatusArb,
        clubCountArb,
        clubCountArb,
        netGrowthArb,
        clubCountArb,
        clubCountArb,
        (
          divisionId,
          status,
          paidClubs,
          clubBase,
          netGrowth,
          distinguishedClubs,
          requiredDistinguishedClubs
        ) => {
          // Clean up any previous renders
          cleanup()

          const { container } = render(
            <DivisionSummary
              divisionId={divisionId}
              status={status}
              paidClubs={paidClubs}
              clubBase={clubBase}
              netGrowth={netGrowth}
              distinguishedClubs={distinguishedClubs}
              requiredDistinguishedClubs={requiredDistinguishedClubs}
            />
          )
          _suppressUnusedWarning(container)

          // Requirement 3.1: Division identifier must be present
          const divisionHeading = screen.getByText(
            new RegExp(`Division ${divisionId}`)
          )
          if (!divisionHeading) {
            throw new Error(`Division identifier "${divisionId}" not found`)
          }

          // Requirement 3.2: Status level must be present
          const statusBadge = screen.getByRole('status', {
            name: /Division status:/i,
          })
          if (!statusBadge) {
            throw new Error('Status badge not found')
          }

          // Requirement 3.3: Paid clubs in "current/base" format must be present
          const paidClubsLabel = screen.getByText('Paid Clubs')
          if (!paidClubsLabel) {
            throw new Error('Paid Clubs label not found')
          }

          // Find paid clubs text within the paid clubs section
          const paidClubsSection = paidClubsLabel.closest('div')?.parentElement
          if (!paidClubsSection) {
            throw new Error('Paid clubs section not found')
          }

          const paidClubsPattern = new RegExp(
            `${paidClubs}\\s*/\\s*${clubBase}`
          )
          if (!paidClubsSection.textContent?.match(paidClubsPattern)) {
            throw new Error(
              `Paid clubs "${paidClubs} / ${clubBase}" not found in paid clubs section`
            )
          }

          // Requirement 3.3: Net growth indicator must be present
          const netGrowthIndicator = screen.getByLabelText(/Net growth:/i)
          if (!netGrowthIndicator) {
            throw new Error('Net growth indicator not found')
          }

          // Requirement 3.4: Distinguished clubs in "current/required" format must be present
          const distinguishedClubsLabel = screen.getByText(
            'Distinguished Clubs'
          )
          if (!distinguishedClubsLabel) {
            throw new Error('Distinguished Clubs label not found')
          }

          // Find distinguished clubs text within the distinguished clubs section
          const distinguishedClubsSection =
            distinguishedClubsLabel.closest('div')?.parentElement
          if (!distinguishedClubsSection) {
            throw new Error('Distinguished clubs section not found')
          }

          const distinguishedClubsPattern = new RegExp(
            `${distinguishedClubs}\\s*/\\s*${requiredDistinguishedClubs}`
          )
          if (
            !distinguishedClubsSection.textContent?.match(
              distinguishedClubsPattern
            )
          ) {
            throw new Error(
              `Distinguished clubs "${distinguishedClubs} / ${requiredDistinguishedClubs}" not found in distinguished clubs section`
            )
          }

          // All required elements are present
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Status Badge Visual Indicators
   *
   * For any division status, the status badge should have appropriate CSS classes
   * that provide visual indicators for at-a-glance status assessment.
   *
   * **Validates: Requirements 3.2, 3.5**
   */
  it('should apply appropriate visual styling to status badge for any status', () => {
    fc.assert(
      fc.property(
        divisionIdArb,
        divisionStatusArb,
        clubCountArb,
        clubCountArb,
        netGrowthArb,
        clubCountArb,
        clubCountArb,
        (
          divisionId,
          status,
          paidClubs,
          clubBase,
          netGrowth,
          distinguishedClubs,
          requiredDistinguishedClubs
        ) => {
          // Clean up any previous renders
          cleanup()

          render(
            <DivisionSummary
              divisionId={divisionId}
              status={status}
              paidClubs={paidClubs}
              clubBase={clubBase}
              netGrowth={netGrowth}
              distinguishedClubs={distinguishedClubs}
              requiredDistinguishedClubs={requiredDistinguishedClubs}
            />
          )

          const statusBadge = screen.getByRole('status', {
            name: /Division status:/i,
          })

          // Status badge should have base styling classes
          const hasBaseClasses =
            statusBadge.className.includes('inline-flex') &&
            statusBadge.className.includes('items-center') &&
            statusBadge.className.includes('px-3') &&
            statusBadge.className.includes('py-1.5')

          if (!hasBaseClasses) {
            throw new Error('Status badge missing base styling classes')
          }

          // Status badge should have status-specific background color
          const hasStatusColor =
            statusBadge.className.includes('tm-bg-loyal-blue') ||
            statusBadge.className.includes('tm-bg-cool-gray')

          if (!hasStatusColor) {
            throw new Error('Status badge missing status-specific color class')
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Net Growth Visual Indicators
   *
   * For any net growth value, the component should display appropriate visual
   * indicators (color and icon) based on whether growth is positive, negative, or zero.
   *
   * **Validates: Requirements 3.3, 3.5**
   */
  it('should apply appropriate visual indicators for net growth', () => {
    fc.assert(
      fc.property(
        divisionIdArb,
        divisionStatusArb,
        clubCountArb,
        clubCountArb,
        netGrowthArb,
        clubCountArb,
        clubCountArb,
        (
          divisionId,
          status,
          paidClubs,
          clubBase,
          netGrowth,
          distinguishedClubs,
          requiredDistinguishedClubs
        ) => {
          // Clean up any previous renders
          cleanup()

          render(
            <DivisionSummary
              divisionId={divisionId}
              status={status}
              paidClubs={paidClubs}
              clubBase={clubBase}
              netGrowth={netGrowth}
              distinguishedClubs={distinguishedClubs}
              requiredDistinguishedClubs={requiredDistinguishedClubs}
            />
          )

          const netGrowthElement = screen.getByLabelText(/Net growth:/i)

          // Check that appropriate color class is applied
          if (netGrowth > 0) {
            if (!netGrowthElement.className.includes('tm-text-loyal-blue')) {
              throw new Error(
                'Positive net growth should use tm-text-loyal-blue'
              )
            }
            if (!netGrowthElement.textContent?.includes('↑')) {
              throw new Error('Positive net growth should display up arrow')
            }
            if (!netGrowthElement.textContent?.includes('+')) {
              throw new Error('Positive net growth should display plus sign')
            }
          } else if (netGrowth < 0) {
            if (!netGrowthElement.className.includes('tm-text-true-maroon')) {
              throw new Error(
                'Negative net growth should use tm-text-true-maroon'
              )
            }
            if (!netGrowthElement.textContent?.includes('↓')) {
              throw new Error('Negative net growth should display down arrow')
            }
          } else {
            if (!netGrowthElement.className.includes('tm-text-cool-gray')) {
              throw new Error('Zero net growth should use tm-text-cool-gray')
            }
            if (!netGrowthElement.textContent?.includes('→')) {
              throw new Error('Zero net growth should display neutral arrow')
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Distinguished Clubs Threshold Indicator
   *
   * For any division, when distinguished clubs meet or exceed the required threshold,
   * a checkmark indicator should be displayed. When below threshold, no checkmark
   * should be present.
   *
   * **Validates: Requirements 3.4, 3.5**
   */
  it('should display checkmark only when distinguished clubs meet threshold', () => {
    fc.assert(
      fc.property(
        divisionIdArb,
        divisionStatusArb,
        clubCountArb,
        clubCountArb,
        netGrowthArb,
        clubCountArb,
        clubCountArb,
        (
          divisionId,
          status,
          paidClubs,
          clubBase,
          netGrowth,
          distinguishedClubs,
          requiredDistinguishedClubs
        ) => {
          // Clean up any previous renders
          cleanup()

          render(
            <DivisionSummary
              divisionId={divisionId}
              status={status}
              paidClubs={paidClubs}
              clubBase={clubBase}
              netGrowth={netGrowth}
              distinguishedClubs={distinguishedClubs}
              requiredDistinguishedClubs={requiredDistinguishedClubs}
            />
          )

          const checkmark = screen.queryByLabelText('Threshold met')

          if (distinguishedClubs >= requiredDistinguishedClubs) {
            // Threshold met: checkmark should be present
            if (!checkmark) {
              throw new Error(
                `Checkmark should be present when distinguished clubs (${distinguishedClubs}) >= required (${requiredDistinguishedClubs})`
              )
            }
            if (!checkmark.textContent?.includes('✓')) {
              throw new Error('Checkmark element should contain ✓ character')
            }
          } else {
            // Threshold not met: checkmark should not be present
            if (checkmark) {
              throw new Error(
                `Checkmark should not be present when distinguished clubs (${distinguishedClubs}) < required (${requiredDistinguishedClubs})`
              )
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Brand Compliance
   *
   * For any division, the component should use TM Loyal Blue for the division
   * heading and Montserrat font (tm-h2 class) for headings.
   *
   * **Validates: Requirements 8.1, 8.3**
   */
  it('should apply brand-compliant styling to all divisions', () => {
    fc.assert(
      fc.property(
        divisionIdArb,
        divisionStatusArb,
        clubCountArb,
        clubCountArb,
        netGrowthArb,
        clubCountArb,
        clubCountArb,
        (
          divisionId,
          status,
          paidClubs,
          clubBase,
          netGrowth,
          distinguishedClubs,
          requiredDistinguishedClubs
        ) => {
          // Clean up any previous renders
          cleanup()

          render(
            <DivisionSummary
              divisionId={divisionId}
              status={status}
              paidClubs={paidClubs}
              clubBase={clubBase}
              netGrowth={netGrowth}
              distinguishedClubs={distinguishedClubs}
              requiredDistinguishedClubs={requiredDistinguishedClubs}
            />
          )

          const heading = screen.getByText(new RegExp(`Division ${divisionId}`))

          // Requirement 8.1: Use TM Loyal Blue for primary elements
          if (!heading.className.includes('tm-text-loyal-blue')) {
            throw new Error('Division heading should use tm-text-loyal-blue')
          }

          // Requirement 8.3: Use Montserrat font for headings (tm-h2 class)
          if (!heading.className.includes('tm-h2')) {
            throw new Error('Division heading should use tm-h2 class')
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
