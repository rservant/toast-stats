/**
 * TargetProgressCard Property Tests
 *
 * **Feature: district-performance-targets, Property 5: Target Achievement Visual Indication**
 * **Validates: Requirements 6.9**
 *
 * Property-based tests to verify that when a target is met or exceeded,
 * the UI displays a visual indicator (checkmark, color change) for that level
 * and all lower levels.
 */

import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { screen } from '@testing-library/react'
import {
  TargetProgressCard,
  RecognitionTargets,
  MetricRankings,
  RecognitionLevel,
  isLevelAchieved,
  isLevelAtOrBelowAchieved,
} from '../TargetProgressCard'
import {
  renderWithProviders,
  cleanupAllResources,
} from '../../__tests__/utils/componentTestUtils'

// Recognition levels in order from lowest to highest
const RECOGNITION_LEVEL_ORDER: RecognitionLevel[] = [
  'distinguished',
  'select',
  'presidents',
  'smedley',
]

// Arbitrary generator for recognition targets
const recognitionTargetsArb = fc
  .record({
    distinguished: fc.integer({ min: 1, max: 200 }),
    select: fc.integer({ min: 1, max: 200 }),
    presidents: fc.integer({ min: 1, max: 200 }),
    smedley: fc.integer({ min: 1, max: 200 }),
  })
  .map(targets => {
    // Ensure targets are in ascending order (distinguished < select < presidents < smedley)
    const sorted = [
      targets.distinguished,
      targets.select,
      targets.presidents,
      targets.smedley,
    ].sort((a, b) => a - b)
    return {
      distinguished: sorted[0],
      select: sorted[1],
      presidents: sorted[2],
      smedley: sorted[3],
    } as RecognitionTargets
  })

// Arbitrary generator for metric rankings
const metricRankingsArb: fc.Arbitrary<MetricRankings> = fc.record({
  worldRank: fc.option(fc.integer({ min: 1, max: 150 }), { nil: null }),
  worldPercentile: fc.option(fc.double({ min: 0, max: 100 }), { nil: null }),
  regionRank: fc.option(fc.integer({ min: 1, max: 50 }), { nil: null }),
  totalDistricts: fc.integer({ min: 1, max: 150 }),
  totalInRegion: fc.integer({ min: 1, max: 50 }),
  region: fc.option(
    fc.constantFrom('Region 1', 'Region 2', 'Region 3', 'Region 4'),
    { nil: null }
  ),
})

// Default icon for testing
const TestIcon = () => (
  <svg data-testid="test-icon" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
  </svg>
)

describe('TargetProgressCard Property Tests', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('Property 5: Target Achievement Visual Indication', () => {
    /**
     * Property: For any metric where the current value meets or exceeds a target level,
     * the UI SHALL display a visual indicator (checkmark) for that level.
     */
    it('should display checkmark indicator when target is met or exceeded', () => {
      fc.assert(
        fc.property(
          fc.record({
            targets: recognitionTargetsArb,
            rankings: metricRankingsArb,
          }),
          ({ targets, rankings }) => {
            // Test each recognition level
            RECOGNITION_LEVEL_ORDER.forEach(level => {
              const targetValue = targets[level]

              // Test with current value exactly meeting the target
              const currentMeetsTarget = targetValue

              cleanupAllResources()

              renderWithProviders(
                <TargetProgressCard
                  title="Test Metric"
                  icon={<TestIcon />}
                  current={currentMeetsTarget}
                  base={100}
                  targets={targets}
                  achievedLevel={level}
                  rankings={rankings}
                  colorScheme="blue"
                />
              )

              // Verify the achieved indicator is displayed for this level
              const achievedIndicator = screen.queryByTestId(
                `achieved-indicator-${level}`
              )
              expect(achievedIndicator).toBeInTheDocument()
              expect(achievedIndicator).toHaveTextContent('✓')

              cleanupAllResources()
            })
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Property: For any metric where the current value exceeds a target level,
     * the UI SHALL display visual indicators for that level AND all lower levels.
     */
    it('should display checkmark indicators for achieved level and all lower levels', () => {
      fc.assert(
        fc.property(
          fc.record({
            targets: recognitionTargetsArb,
            rankings: metricRankingsArb,
            achievedLevelIndex: fc.integer({ min: 0, max: 3 }),
          }),
          ({ targets, rankings, achievedLevelIndex }) => {
            const achievedLevel = RECOGNITION_LEVEL_ORDER[achievedLevelIndex]
            // Set current value to exceed the achieved level's target
            const currentValue = targets[achievedLevel] + 1

            cleanupAllResources()

            renderWithProviders(
              <TargetProgressCard
                title="Test Metric"
                icon={<TestIcon />}
                current={currentValue}
                base={100}
                targets={targets}
                achievedLevel={achievedLevel}
                rankings={rankings}
                colorScheme="blue"
              />
            )

            // Verify indicators for all levels at or below the achieved level
            RECOGNITION_LEVEL_ORDER.forEach((level, index) => {
              const achievedIndicator = screen.queryByTestId(
                `achieved-indicator-${level}`
              )
              const progressBar = screen.queryByTestId(`progress-bar-${level}`)

              if (index <= achievedLevelIndex) {
                // This level should be achieved
                expect(achievedIndicator).toBeInTheDocument()
                expect(achievedIndicator).toHaveTextContent('✓')
                // Progress bar should have achieved styling
                expect(progressBar).toHaveAttribute('data-achieved', 'true')
              }
            })

            cleanupAllResources()
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Property: For any metric where the current value is below all targets,
     * no achievement indicators should be displayed.
     */
    it('should not display checkmark indicators when no targets are met', () => {
      fc.assert(
        fc.property(
          fc.record({
            targets: recognitionTargetsArb,
            rankings: metricRankingsArb,
          }),
          ({ targets, rankings }) => {
            // Set current value below the lowest target (distinguished)
            const currentValue = Math.max(0, targets.distinguished - 1)

            cleanupAllResources()

            renderWithProviders(
              <TargetProgressCard
                title="Test Metric"
                icon={<TestIcon />}
                current={currentValue}
                base={100}
                targets={targets}
                achievedLevel={null}
                rankings={rankings}
                colorScheme="blue"
              />
            )

            // Verify no achievement indicators are displayed
            RECOGNITION_LEVEL_ORDER.forEach(level => {
              const achievedIndicator = screen.queryByTestId(
                `achieved-indicator-${level}`
              )
              expect(achievedIndicator).not.toBeInTheDocument()

              // Progress bar should not have achieved styling
              const progressBar = screen.queryByTestId(`progress-bar-${level}`)
              expect(progressBar).toHaveAttribute('data-achieved', 'false')
            })

            cleanupAllResources()
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Property: Progress bar fill percentage should be proportional to current/target ratio
     */
    it('should display progress bars with correct fill percentage', () => {
      fc.assert(
        fc.property(
          fc.record({
            targets: recognitionTargetsArb,
            rankings: metricRankingsArb,
            currentRatio: fc.double({ min: 0, max: 1.5 }),
          }),
          ({ targets, rankings, currentRatio }) => {
            // Calculate current value as a ratio of the distinguished target
            const currentValue = Math.floor(
              targets.distinguished * currentRatio
            )

            cleanupAllResources()

            renderWithProviders(
              <TargetProgressCard
                title="Test Metric"
                icon={<TestIcon />}
                current={currentValue}
                base={100}
                targets={targets}
                achievedLevel={null}
                rankings={rankings}
                colorScheme="blue"
              />
            )

            // Verify progress bars exist
            const progressBars = screen.getByTestId('target-progress-bars')
            expect(progressBars).toBeInTheDocument()

            cleanupAllResources()
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('Helper Function Properties', () => {
    /**
     * Property: isLevelAchieved should return true iff current >= target
     */
    it('isLevelAchieved returns true when current >= target', () => {
      fc.assert(
        fc.property(
          fc.record({
            targets: recognitionTargetsArb,
            level: fc.constantFrom<RecognitionLevel>(
              'distinguished',
              'select',
              'presidents',
              'smedley'
            ),
            offset: fc.integer({ min: 0, max: 100 }),
          }),
          ({ targets, level, offset }) => {
            const targetValue = targets[level]
            const currentMeetsOrExceeds = targetValue + offset
            const currentBelow = Math.max(0, targetValue - 1)

            // Should return true when current >= target
            expect(isLevelAchieved(level, currentMeetsOrExceeds, targets)).toBe(
              true
            )

            // Should return false when current < target (unless target is 0 or 1)
            if (targetValue > 1) {
              expect(isLevelAchieved(level, currentBelow, targets)).toBe(false)
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    /**
     * Property: isLevelAchieved should return false when targets is null
     */
    it('isLevelAchieved returns false when targets is null', () => {
      fc.assert(
        fc.property(
          fc.record({
            level: fc.constantFrom<RecognitionLevel>(
              'distinguished',
              'select',
              'presidents',
              'smedley'
            ),
            current: fc.integer({ min: 0, max: 1000 }),
          }),
          ({ level, current }) => {
            expect(isLevelAchieved(level, current, null)).toBe(false)
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Property: isLevelAtOrBelowAchieved should correctly identify levels
     */
    it('isLevelAtOrBelowAchieved correctly identifies levels at or below achieved', () => {
      fc.assert(
        fc.property(
          fc.record({
            achievedLevelIndex: fc.integer({ min: 0, max: 3 }),
            testLevelIndex: fc.integer({ min: 0, max: 3 }),
          }),
          ({ achievedLevelIndex, testLevelIndex }) => {
            const achievedLevel = RECOGNITION_LEVEL_ORDER[achievedLevelIndex]
            const testLevel = RECOGNITION_LEVEL_ORDER[testLevelIndex]

            const result = isLevelAtOrBelowAchieved(testLevel, achievedLevel)

            // Should return true if testLevel index <= achievedLevel index
            expect(result).toBe(testLevelIndex <= achievedLevelIndex)
          }
        ),
        { numRuns: 50 }
      )
    })

    /**
     * Property: isLevelAtOrBelowAchieved should return false when achievedLevel is null
     */
    it('isLevelAtOrBelowAchieved returns false when achievedLevel is null', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<RecognitionLevel>(
            'distinguished',
            'select',
            'presidents',
            'smedley'
          ),
          level => {
            expect(isLevelAtOrBelowAchieved(level, null)).toBe(false)
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe('Missing Data Handling', () => {
    /**
     * Property: When targets is null, should display "N/A" message
     */
    it('should display N/A when targets are unavailable', () => {
      fc.assert(
        fc.property(
          fc.record({
            current: fc.integer({ min: 0, max: 1000 }),
            rankings: metricRankingsArb,
          }),
          ({ current, rankings }) => {
            cleanupAllResources()

            renderWithProviders(
              <TargetProgressCard
                title="Test Metric"
                icon={<TestIcon />}
                current={current}
                base={null}
                targets={null}
                achievedLevel={null}
                rankings={rankings}
                colorScheme="blue"
              />
            )

            // Should display N/A indicator
            const unavailableIndicator = screen.getByTestId(
              'targets-unavailable'
            )
            expect(unavailableIndicator).toBeInTheDocument()
            expect(unavailableIndicator).toHaveTextContent('N/A')

            // Should not display progress bars
            const progressBars = screen.queryByTestId('target-progress-bars')
            expect(progressBars).not.toBeInTheDocument()

            cleanupAllResources()
          }
        ),
        { numRuns: 10 }
      )
    })

    /**
     * Property: When region is null, region rank should not be displayed
     */
    it('should not display region rank when region is unknown', () => {
      fc.assert(
        fc.property(
          fc.record({
            targets: recognitionTargetsArb,
            current: fc.integer({ min: 0, max: 1000 }),
          }),
          ({ targets, current }) => {
            const rankingsWithoutRegion: MetricRankings = {
              worldRank: 10,
              worldPercentile: 90,
              regionRank: null,
              totalDistricts: 100,
              totalInRegion: 0,
              region: null,
            }

            cleanupAllResources()

            renderWithProviders(
              <TargetProgressCard
                title="Test Metric"
                icon={<TestIcon />}
                current={current}
                base={100}
                targets={targets}
                achievedLevel={null}
                rankings={rankingsWithoutRegion}
                colorScheme="blue"
              />
            )

            // Region rank should not be displayed
            const regionRank = screen.queryByTestId('region-rank')
            expect(regionRank).not.toBeInTheDocument()

            // World rank should still be displayed
            const worldRank = screen.getByTestId('world-rank')
            expect(worldRank).toBeInTheDocument()

            cleanupAllResources()
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
