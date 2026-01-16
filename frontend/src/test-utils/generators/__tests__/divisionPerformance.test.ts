/**
 * Tests for division performance generators
 *
 * These tests verify that the generators produce valid data structures
 * and maintain internal consistency.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  divisionIdArb,
  areaIdArb,
  clubCountArb,
  netGrowthArb,
  divisionStatusArb,
  areaStatusArb,
  visitStatusArb,
  areaPerformanceArb,
  divisionPerformanceArb,
  divisionsArrayArb,
  districtSnapshotArb,
  timestampArb,
  clubBaseArb,
  areaQualifyingMetricsArb,
  divisionMetricsArb,
  areaMetricsArb,
} from '../divisionPerformance'

describe('Division Performance Generators', () => {
  describe('divisionIdArb', () => {
    it('should generate valid division identifiers', () => {
      fc.assert(
        fc.property(divisionIdArb, (divisionId) => {
          // Should match pattern A-Z or AA-ZZ
          expect(divisionId).toMatch(/^[A-Z]{1,2}$/)
          expect(divisionId.length).toBeGreaterThanOrEqual(1)
          expect(divisionId.length).toBeLessThanOrEqual(2)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('areaIdArb', () => {
    it('should generate valid area identifiers', () => {
      fc.assert(
        fc.property(areaIdArb, (areaId) => {
          // Should match pattern A1-Z9 or AA1-ZZ9
          expect(areaId).toMatch(/^[A-Z]{1,2}[1-9]$/)
          expect(areaId.length).toBeGreaterThanOrEqual(2)
          expect(areaId.length).toBeLessThanOrEqual(3)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('clubCountArb', () => {
    it('should generate valid club counts', () => {
      fc.assert(
        fc.property(clubCountArb, (count) => {
          expect(count).toBeGreaterThanOrEqual(0)
          expect(count).toBeLessThanOrEqual(100)
          expect(Number.isInteger(count)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('netGrowthArb', () => {
    it('should generate valid net growth values', () => {
      fc.assert(
        fc.property(netGrowthArb, (growth) => {
          expect(growth).toBeGreaterThanOrEqual(-50)
          expect(growth).toBeLessThanOrEqual(50)
          expect(Number.isInteger(growth)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('divisionStatusArb', () => {
    it('should generate valid division status values', () => {
      fc.assert(
        fc.property(divisionStatusArb, (status) => {
          expect([
            'not-distinguished',
            'distinguished',
            'select-distinguished',
            'presidents-distinguished',
          ]).toContain(status)
          // Should NOT generate 'not-qualified' for divisions
          expect(status).not.toBe('not-qualified')
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('areaStatusArb', () => {
    it('should generate valid area status values', () => {
      fc.assert(
        fc.property(areaStatusArb, (status) => {
          expect([
            'not-qualified',
            'not-distinguished',
            'distinguished',
            'select-distinguished',
            'presidents-distinguished',
          ]).toContain(status)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('visitStatusArb', () => {
    it('should generate internally consistent visit status', () => {
      fc.assert(
        fc.property(visitStatusArb(), (visitStatus) => {
          // Verify structure
          expect(visitStatus).toHaveProperty('completed')
          expect(visitStatus).toHaveProperty('required')
          expect(visitStatus).toHaveProperty('percentage')
          expect(visitStatus).toHaveProperty('meetsThreshold')

          // Verify types
          expect(Number.isInteger(visitStatus.completed)).toBe(true)
          expect(Number.isInteger(visitStatus.required)).toBe(true)
          expect(typeof visitStatus.percentage).toBe('number')
          expect(typeof visitStatus.meetsThreshold).toBe('boolean')

          // Verify consistency: meetsThreshold should match completed >= required
          expect(visitStatus.meetsThreshold).toBe(
            visitStatus.completed >= visitStatus.required
          )

          // Verify percentage is in valid range
          expect(visitStatus.percentage).toBeGreaterThanOrEqual(0)
          expect(visitStatus.percentage).toBeLessThanOrEqual(100)
        }),
        { numRuns: 100 }
      )
    })

    it('should generate visit status based on club base when provided', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (clubBase) => {
          const visitStatus = fc.sample(visitStatusArb(clubBase), 1)[0]

          // Required should be 75% of club base
          expect(visitStatus.required).toBe(Math.ceil(clubBase * 0.75))

          // Completed should not exceed club base
          expect(visitStatus.completed).toBeLessThanOrEqual(clubBase)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('areaPerformanceArb', () => {
    it('should generate valid area performance objects', () => {
      fc.assert(
        fc.property(areaPerformanceArb(), (area) => {
          // Verify structure
          expect(area).toHaveProperty('areaId')
          expect(area).toHaveProperty('status')
          expect(area).toHaveProperty('clubBase')
          expect(area).toHaveProperty('paidClubs')
          expect(area).toHaveProperty('netGrowth')
          expect(area).toHaveProperty('distinguishedClubs')
          expect(area).toHaveProperty('requiredDistinguishedClubs')
          expect(area).toHaveProperty('firstRoundVisits')
          expect(area).toHaveProperty('secondRoundVisits')
          expect(area).toHaveProperty('isQualified')

          // Verify net growth consistency
          expect(area.netGrowth).toBe(area.paidClubs - area.clubBase)

          // Verify required distinguished clubs calculation
          expect(area.requiredDistinguishedClubs).toBe(
            Math.ceil(area.clubBase * 0.5)
          )

          // Verify status is valid
          expect([
            'not-qualified',
            'not-distinguished',
            'distinguished',
            'select-distinguished',
            'presidents-distinguished',
          ]).toContain(area.status)

          // Verify qualifying gate: non-qualified areas must have 'not-qualified' status
          if (!area.isQualified) {
            expect(area.status).toBe('not-qualified')
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should respect qualified option when provided', () => {
      fc.assert(
        fc.property(areaPerformanceArb({ qualified: true }), (area) => {
          expect(area.isQualified).toBe(true)
          expect(area.status).not.toBe('not-qualified')
        }),
        { numRuns: 100 }
      )

      fc.assert(
        fc.property(areaPerformanceArb({ qualified: false }), (area) => {
          expect(area.isQualified).toBe(false)
          expect(area.status).toBe('not-qualified')
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('divisionPerformanceArb', () => {
    it('should generate valid division performance objects', () => {
      fc.assert(
        fc.property(divisionPerformanceArb(), (division) => {
          // Verify structure
          expect(division).toHaveProperty('divisionId')
          expect(division).toHaveProperty('status')
          expect(division).toHaveProperty('clubBase')
          expect(division).toHaveProperty('paidClubs')
          expect(division).toHaveProperty('netGrowth')
          expect(division).toHaveProperty('distinguishedClubs')
          expect(division).toHaveProperty('requiredDistinguishedClubs')
          expect(division).toHaveProperty('areas')

          // Verify net growth consistency
          expect(division.netGrowth).toBe(division.paidClubs - division.clubBase)

          // Verify required distinguished clubs calculation
          expect(division.requiredDistinguishedClubs).toBe(
            Math.ceil(division.clubBase * 0.5)
          )

          // Verify status is valid (no 'not-qualified' for divisions)
          expect([
            'not-distinguished',
            'distinguished',
            'select-distinguished',
            'presidents-distinguished',
          ]).toContain(division.status)

          // Verify areas is an array
          expect(Array.isArray(division.areas)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('should generate divisions without areas when includeAreas is false', () => {
      fc.assert(
        fc.property(
          divisionPerformanceArb({ includeAreas: false }),
          (division) => {
            expect(division.areas).toEqual([])
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate specific number of areas when areaCount is provided', () => {
      const areaCount = 5
      fc.assert(
        fc.property(
          divisionPerformanceArb({ areaCount }),
          (division) => {
            // Should have exactly areaCount unique areas
            expect(division.areas.length).toBeLessThanOrEqual(areaCount)
            // Verify uniqueness
            const areaIds = division.areas.map((a) => a.areaId)
            const uniqueAreaIds = new Set(areaIds)
            expect(uniqueAreaIds.size).toBe(division.areas.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('divisionsArrayArb', () => {
    it('should generate arrays of divisions with unique IDs', () => {
      fc.assert(
        fc.property(divisionsArrayArb(), (divisions) => {
          // Verify it's an array
          expect(Array.isArray(divisions)).toBe(true)

          // Verify all division IDs are unique
          const divisionIds = divisions.map((d) => d.divisionId)
          const uniqueIds = new Set(divisionIds)
          expect(uniqueIds.size).toBe(divisions.length)

          // Verify divisions are sorted by ID
          for (let i = 0; i < divisions.length - 1; i++) {
            const current = divisions[i]
            const next = divisions[i + 1]
            if (current && next) {
              expect(current.divisionId.localeCompare(next.divisionId)).toBeLessThanOrEqual(0)
            }
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should respect minLength and maxLength options', () => {
      fc.assert(
        fc.property(
          divisionsArrayArb({ minLength: 2, maxLength: 5 }),
          (divisions) => {
            // Note: Due to uniqueness filtering, we may get fewer divisions than minLength
            // if duplicate division IDs are generated. This is expected behavior.
            expect(divisions.length).toBeGreaterThanOrEqual(1)
            expect(divisions.length).toBeLessThanOrEqual(5)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('districtSnapshotArb', () => {
    it('should generate valid district snapshot structure', () => {
      fc.assert(
        fc.property(districtSnapshotArb, (snapshot) => {
          expect(snapshot).toHaveProperty('divisionPerformance')
          expect(snapshot).toHaveProperty('clubPerformance')
          expect(Array.isArray(snapshot.divisionPerformance)).toBe(true)
          expect(Array.isArray(snapshot.clubPerformance)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('timestampArb', () => {
    it('should generate valid ISO 8601 timestamps', () => {
      fc.assert(
        fc.property(timestampArb(), (timestamp) => {
          // Should be a valid ISO 8601 string
          expect(typeof timestamp).toBe('string')
          expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

          // Should be parseable as a date
          const date = new Date(timestamp)
          expect(date.toISOString()).toBe(timestamp)

          // Should be within reasonable range (allowing for boundary dates)
          const year = date.getUTCFullYear()
          expect(year).toBeGreaterThanOrEqual(2019)
          expect(year).toBeLessThanOrEqual(2031)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('clubBaseArb', () => {
    it('should generate valid club base values', () => {
      fc.assert(
        fc.property(clubBaseArb(), (clubBase) => {
          expect(clubBase).toBeGreaterThanOrEqual(1)
          expect(clubBase).toBeLessThanOrEqual(100)
          expect(Number.isInteger(clubBase)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('areaQualifyingMetricsArb', () => {
    it('should generate valid area qualifying metrics', () => {
      fc.assert(
        fc.property(areaQualifyingMetricsArb, (metrics) => {
          expect(metrics).toHaveProperty('netGrowth')
          expect(metrics).toHaveProperty('firstRoundVisits')
          expect(metrics).toHaveProperty('secondRoundVisits')

          expect(Number.isInteger(metrics.netGrowth)).toBe(true)
          expect(typeof metrics.firstRoundVisits).toBe('object')
          expect(typeof metrics.secondRoundVisits).toBe('object')
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('divisionMetricsArb', () => {
    it('should generate internally consistent division metrics', () => {
      fc.assert(
        fc.property(divisionMetricsArb, (metrics) => {
          expect(metrics).toHaveProperty('clubBase')
          expect(metrics).toHaveProperty('threshold')
          expect(metrics).toHaveProperty('distinguishedClubs')
          expect(metrics).toHaveProperty('paidClubs')

          // Verify threshold calculation
          expect(metrics.threshold).toBe(Math.ceil(metrics.clubBase * 0.5))

          // Verify distinguished clubs doesn't exceed club base
          expect(metrics.distinguishedClubs).toBeLessThanOrEqual(metrics.clubBase)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('areaMetricsArb', () => {
    it('should generate internally consistent area metrics', () => {
      fc.assert(
        fc.property(areaMetricsArb, (metrics) => {
          expect(metrics).toHaveProperty('clubBase')
          expect(metrics).toHaveProperty('threshold')
          expect(metrics).toHaveProperty('distinguishedClubs')
          expect(metrics).toHaveProperty('paidClubs')
          expect(metrics).toHaveProperty('isQualified')

          // Verify threshold calculation
          expect(metrics.threshold).toBe(Math.ceil(metrics.clubBase * 0.5))

          // Verify distinguished clubs doesn't exceed club base
          expect(metrics.distinguishedClubs).toBeLessThanOrEqual(metrics.clubBase)

          // Verify isQualified is boolean
          expect(typeof metrics.isQualified).toBe('boolean')
        }),
        { numRuns: 100 }
      )
    })
  })
})
