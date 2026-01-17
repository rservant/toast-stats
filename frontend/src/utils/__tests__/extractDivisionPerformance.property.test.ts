/**
 * Property-Based Tests for Division and Area Performance Data Extraction
 *
 * These tests verify universal correctness properties across randomized inputs
 * using fast-check property-based testing library.
 *
 * Feature: division-area-performance-cards
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  extractVisitData,
  extractDivisionPerformance,
} from '../extractDivisionPerformance.js'

describe('extractDivisionPerformance - Property-Based Tests', () => {
  /**
   * Property 11: Visit Data Extraction
   *
   * For any district snapshot containing area visit data, the extraction function
   * should correctly retrieve first round visits from "Nov Visit award" field and
   * second round visits from "May visit award" field.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  describe('Property 11: Visit Data Extraction', () => {
    it('should extract first round visits from "Nov Visit award" field', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // novVisits
          fc.integer({ min: 1, max: 20 }), // clubBase
          (novVisits, clubBase) => {
            // Arrange: Create area data with Nov Visit award
            const areaData = {
              'Nov Visit award': novVisits.toString(),
              'May visit award': '0',
            }

            // Act: Extract visit data
            const result = extractVisitData(areaData, clubBase)

            // Assert: First round should match Nov Visit award
            expect(result.firstRound.completed).toBe(novVisits)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should extract second round visits from "May visit award" field', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // mayVisits
          fc.integer({ min: 1, max: 20 }), // clubBase
          (mayVisits, clubBase) => {
            // Arrange: Create area data with May Visit award
            const areaData = {
              'Nov Visit award': '0',
              'May visit award': mayVisits.toString(),
            }

            // Act: Extract visit data
            const result = extractVisitData(areaData, clubBase)

            // Assert: Second round should match May Visit award
            expect(result.secondRound.completed).toBe(mayVisits)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should extract both visit rounds correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // novVisits
          fc.integer({ min: 0, max: 100 }), // mayVisits
          fc.integer({ min: 1, max: 20 }), // clubBase
          (novVisits, mayVisits, clubBase) => {
            // Arrange: Create area data with both visit awards
            const areaData = {
              'Nov Visit award': novVisits.toString(),
              'May visit award': mayVisits.toString(),
            }

            // Act: Extract visit data
            const result = extractVisitData(areaData, clubBase)

            // Assert: Both rounds should match their respective fields
            expect(result.firstRound.completed).toBe(novVisits)
            expect(result.secondRound.completed).toBe(mayVisits)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle numeric visit values (not just strings)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // novVisits
          fc.integer({ min: 0, max: 100 }), // mayVisits
          fc.integer({ min: 1, max: 20 }), // clubBase
          (novVisits, mayVisits, clubBase) => {
            // Arrange: Create area data with numeric visit values
            const areaData = {
              'Nov Visit award': novVisits, // numeric, not string
              'May visit award': mayVisits, // numeric, not string
            }

            // Act: Extract visit data
            const result = extractVisitData(areaData, clubBase)

            // Assert: Should handle numeric values correctly
            expect(result.firstRound.completed).toBe(novVisits)
            expect(result.secondRound.completed).toBe(mayVisits)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should calculate visit status correctly for extracted values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // novVisits
          fc.integer({ min: 0, max: 100 }), // mayVisits
          fc.integer({ min: 1, max: 20 }), // clubBase
          (novVisits, mayVisits, clubBase) => {
            // Arrange: Create area data
            const areaData = {
              'Nov Visit award': novVisits.toString(),
              'May visit award': mayVisits.toString(),
            }

            // Act: Extract visit data
            const result = extractVisitData(areaData, clubBase)

            // Assert: Visit status should be properly calculated
            const requiredVisits = Math.ceil(clubBase * 0.75)
            expect(result.firstRound.required).toBe(requiredVisits)
            expect(result.secondRound.required).toBe(requiredVisits)
            expect(result.firstRound.meetsThreshold).toBe(
              novVisits >= requiredVisits
            )
            expect(result.secondRound.meetsThreshold).toBe(
              mayVisits >= requiredVisits
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle missing visit data gracefully', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // clubBase
          clubBase => {
            // Arrange: Create area data without visit fields
            const areaData = {
              someOtherField: 'value',
            }

            // Act: Extract visit data
            const result = extractVisitData(areaData, clubBase)

            // Assert: Should default to zero visits
            expect(result.firstRound.completed).toBe(0)
            expect(result.secondRound.completed).toBe(0)
            expect(result.firstRound.meetsThreshold).toBe(false)
            expect(result.secondRound.meetsThreshold).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle null or undefined area data', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // clubBase
          fc.constantFrom(null, undefined, {}), // invalid data
          (clubBase, invalidData) => {
            // Act: Extract visit data with invalid input
            const result = extractVisitData(invalidData, clubBase)

            // Assert: Should default to zero visits
            expect(result.firstRound.completed).toBe(0)
            expect(result.secondRound.completed).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle invalid visit values gracefully', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // clubBase
          fc.constantFrom('invalid', 'NaN', '', null, undefined), // invalid values
          (clubBase, invalidValue) => {
            // Arrange: Create area data with invalid visit values
            const areaData = {
              'Nov Visit award': invalidValue,
              'May visit award': invalidValue,
            }

            // Act: Extract visit data
            const result = extractVisitData(areaData, clubBase)

            // Assert: Should default to zero visits for invalid values
            expect(result.firstRound.completed).toBe(0)
            expect(result.secondRound.completed).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 12: Data Extraction Completeness
   *
   * For any valid district snapshot, the extraction function should produce
   * division performance data that includes all divisions and all areas within
   * each division present in the snapshot.
   *
   * **Validates: Requirements 1.4**
   */
  describe('Property 12: Data Extraction Completeness', () => {
    it('should extract all divisions present in the snapshot', () => {
      fc.assert(
        fc.property(
          fc
            .array(
              fc.record({
                divisionId: fc.constantFrom('A', 'B', 'C', 'D'),
                clubBase: fc.integer({ min: 1, max: 20 }),
                paidClubs: fc.integer({ min: 0, max: 25 }),
                distinguishedClubs: fc.integer({ min: 0, max: 20 }),
              }),
              { minLength: 1, maxLength: 10 }
            )
            .map(divisions => {
              // Ensure unique division IDs by keeping only the first occurrence
              const seen = new Set<string>()
              return divisions.filter(d => {
                if (seen.has(d.divisionId)) {
                  return false
                }
                seen.add(d.divisionId)
                return true
              })
            }),
          divisions => {
            // Arrange: Create snapshot with divisions
            const snapshot = {
              divisionPerformance: divisions.map(d => ({
                Division: d.divisionId,
                'Club Base': d.clubBase.toString(),
                'Paid Clubs': d.paidClubs.toString(),
                'Distinguished Clubs': d.distinguishedClubs.toString(),
              })),
              clubPerformance: [],
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Should extract all unique divisions
            expect(result.length).toBe(divisions.length)

            // All division IDs should be present
            const resultDivisionIds = result.map(d => d.divisionId)
            for (const division of divisions) {
              expect(resultDivisionIds).toContain(division.divisionId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should extract all areas within each division', () => {
      fc.assert(
        fc.property(
          fc.record({
            divisionId: fc.constantFrom('A', 'B', 'C'),
            areas: fc.array(
              fc.record({
                areaId: fc.string({ minLength: 1, maxLength: 2 }),
                clubCount: fc.integer({ min: 1, max: 5 }),
              }),
              { minLength: 1, maxLength: 8 }
            ),
          }),
          divisionData => {
            // Arrange: Create snapshot with division and areas
            const clubPerformance = divisionData.areas.flatMap(area =>
              Array.from({ length: area.clubCount }, (_, i) => ({
                Division: divisionData.divisionId,
                Area: area.areaId,
                Status: 'Active',
                'Club Distinguished Status': 'Distinguished',
              }))
            )

            const snapshot = {
              divisionPerformance: [
                {
                  Division: divisionData.divisionId,
                  'Club Base': clubPerformance.length.toString(),
                  'Paid Clubs': clubPerformance.length.toString(),
                  'Distinguished Clubs': clubPerformance.length.toString(),
                },
              ],
              clubPerformance,
            }

            // Get unique area IDs
            const uniqueAreaIds = [
              ...new Set(divisionData.areas.map(a => a.areaId)),
            ]

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Should extract the division
            expect(result.length).toBe(1)
            expect(result[0].divisionId).toBe(divisionData.divisionId)

            // Should extract all unique areas
            expect(result[0].areas.length).toBe(uniqueAreaIds.length)

            // All area IDs should be present
            const resultAreaIds = result[0].areas.map(a => a.areaId)
            for (const areaId of uniqueAreaIds) {
              expect(resultAreaIds).toContain(areaId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve division count across extraction', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // number of divisions
          divisionCount => {
            // Arrange: Create snapshot with N divisions
            const snapshot = {
              divisionPerformance: Array.from(
                { length: divisionCount },
                (_, i) => ({
                  Division: String.fromCharCode(65 + i), // A, B, C, ...
                  'Club Base': '10',
                  'Paid Clubs': '10',
                  'Distinguished Clubs': '5',
                })
              ),
              clubPerformance: [],
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Should extract exactly N divisions
            expect(result.length).toBe(divisionCount)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve area count within divisions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 8 }), // number of areas
          areaCount => {
            // Arrange: Create snapshot with one division and N areas
            const clubPerformance = Array.from({ length: areaCount }, (_, i) =>
              Array.from({ length: 2 }, () => ({
                Division: 'A',
                Area: `A${i + 1}`,
                Status: 'Active',
                'Club Distinguished Status': 'Distinguished',
              }))
            ).flat()

            const snapshot = {
              divisionPerformance: [
                {
                  Division: 'A',
                  'Club Base': clubPerformance.length.toString(),
                  'Paid Clubs': clubPerformance.length.toString(),
                  'Distinguished Clubs': clubPerformance.length.toString(),
                },
              ],
              clubPerformance,
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Should extract exactly N areas
            expect(result.length).toBe(1)
            expect(result[0].areas.length).toBe(areaCount)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle divisions with no areas', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // number of divisions
          divisionCount => {
            // Arrange: Create snapshot with divisions but no club performance
            const snapshot = {
              divisionPerformance: Array.from(
                { length: divisionCount },
                (_, i) => ({
                  Division: String.fromCharCode(65 + i),
                  'Club Base': '0',
                  'Paid Clubs': '0',
                  'Distinguished Clubs': '0',
                })
              ),
              clubPerformance: [],
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Should extract all divisions with empty areas arrays
            expect(result.length).toBe(divisionCount)
            for (const division of result) {
              expect(division.areas).toEqual([])
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not lose data during extraction', () => {
      fc.assert(
        fc.property(
          fc
            .array(
              fc.record({
                divisionId: fc.constantFrom('A', 'B', 'C', 'D', 'E'),
                clubBase: fc.integer({ min: 5, max: 15 }),
                paidClubs: fc.integer({ min: 5, max: 15 }),
                distinguishedClubs: fc.integer({ min: 0, max: 10 }),
              }),
              { minLength: 1, maxLength: 5 }
            )
            .map(divisions => {
              // Ensure unique division IDs by keeping only the first occurrence
              const seen = new Set<string>()
              return divisions.filter(d => {
                if (seen.has(d.divisionId)) {
                  return false
                }
                seen.add(d.divisionId)
                return true
              })
            }),
          divisions => {
            // Arrange: Create snapshot
            const snapshot = {
              divisionPerformance: divisions.map(d => ({
                Division: d.divisionId,
                'Club Base': d.clubBase.toString(),
                'Paid Clubs': d.paidClubs.toString(),
                'Distinguished Clubs': d.distinguishedClubs.toString(),
              })),
              clubPerformance: [],
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: All division data should be preserved
            expect(result.length).toBe(divisions.length)
            for (const division of divisions) {
              const extracted = result.find(
                d => d.divisionId === division.divisionId
              )
              expect(extracted).toBeDefined()
              if (extracted) {
                expect(extracted.clubBase).toBe(division.clubBase)
                expect(extracted.paidClubs).toBe(division.paidClubs)
                expect(extracted.distinguishedClubs).toBe(
                  division.distinguishedClubs
                )
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 15: Division Uniqueness After Extraction
   *
   * For any district snapshot containing duplicate division entries, the extraction
   * function should deduplicate divisions by division identifier and return each
   * division exactly once.
   *
   * **Validates: Requirements 11.1, 11.3**
   */
  describe('Property 15: Division Uniqueness After Extraction', () => {
    it('should return unique divisions even with duplicates in snapshot', () => {
      fc.assert(
        fc.property(
          fc
            .array(
              fc.record({
                divisionId: fc.constantFrom('A', 'B', 'C', 'D'),
                clubBase: fc.integer({ min: 1, max: 20 }),
                paidClubs: fc.integer({ min: 0, max: 25 }),
                distinguishedClubs: fc.integer({ min: 0, max: 20 }),
              }),
              { minLength: 2, maxLength: 15 }
            )
            .filter(divisions => {
              // Ensure we have at least one duplicate
              const ids = divisions.map(d => d.divisionId)
              const uniqueIds = new Set(ids)
              return uniqueIds.size < ids.length
            }),
          divisions => {
            // Arrange: Create snapshot with duplicate divisions
            const snapshot = {
              divisionPerformance: divisions.map(d => ({
                Division: d.divisionId,
                'Club Base': d.clubBase.toString(),
                'Paid Clubs': d.paidClubs.toString(),
                'Distinguished Clubs': d.distinguishedClubs.toString(),
              })),
              clubPerformance: [],
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Result should contain only unique divisions
            const resultDivisionIds = result.map(d => d.divisionId)
            const uniqueResultIds = new Set(resultDivisionIds)
            expect(resultDivisionIds.length).toBe(uniqueResultIds.size)

            // Assert: Each division ID should appear exactly once
            for (const divisionId of uniqueResultIds) {
              const count = resultDivisionIds.filter(
                id => id === divisionId
              ).length
              expect(count).toBe(1)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should retain first occurrence when duplicates exist', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('A', 'B', 'C'), // divisionId
          fc.integer({ min: 5, max: 15 }), // first clubBase
          fc.integer({ min: 5, max: 15 }), // second clubBase (different)
          fc.integer({ min: 2, max: 5 }), // number of duplicates
          (divisionId, firstClubBase, secondClubBase, duplicateCount) => {
            // Ensure first and second are different
            if (firstClubBase === secondClubBase) {
              secondClubBase = firstClubBase + 1
            }

            // Arrange: Create snapshot with first occurrence and duplicates
            const divisions = [
              {
                Division: divisionId,
                'Club Base': firstClubBase.toString(),
                'Paid Clubs': firstClubBase.toString(),
                'Distinguished Clubs': Math.floor(firstClubBase / 2).toString(),
              },
              ...Array.from({ length: duplicateCount }, () => ({
                Division: divisionId,
                'Club Base': secondClubBase.toString(),
                'Paid Clubs': secondClubBase.toString(),
                'Distinguished Clubs': Math.floor(
                  secondClubBase / 2
                ).toString(),
              })),
            ]

            const snapshot = {
              divisionPerformance: divisions,
              clubPerformance: [],
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Should have exactly one division
            expect(result.length).toBe(1)
            expect(result[0].divisionId).toBe(divisionId)

            // Assert: Should retain first occurrence values
            expect(result[0].clubBase).toBe(firstClubBase)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should deduplicate multiple different divisions', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              divisionId: fc.constantFrom('A', 'B', 'C'),
              occurrences: fc.integer({ min: 1, max: 4 }),
              clubBase: fc.integer({ min: 5, max: 15 }),
            }),
            { minLength: 2, maxLength: 3 }
          ),
          divisionSpecs => {
            // Arrange: Create snapshot with multiple divisions, each appearing multiple times
            const divisionPerformance = divisionSpecs.flatMap(spec =>
              Array.from({ length: spec.occurrences }, (_, i) => ({
                Division: spec.divisionId,
                'Club Base': (spec.clubBase + i).toString(), // Vary values
                'Paid Clubs': (spec.clubBase + i).toString(),
                'Distinguished Clubs': Math.floor(
                  (spec.clubBase + i) / 2
                ).toString(),
              }))
            )

            const snapshot = {
              divisionPerformance,
              clubPerformance: [],
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Should have exactly as many divisions as unique IDs
            const uniqueDivisionIds = new Set(
              divisionSpecs.map(s => s.divisionId)
            )
            expect(result.length).toBe(uniqueDivisionIds.size)

            // Assert: Each division should appear exactly once
            const resultIds = result.map(d => d.divisionId)
            for (const divisionId of uniqueDivisionIds) {
              const count = resultIds.filter(id => id === divisionId).length
              expect(count).toBe(1)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle snapshot with all duplicate divisions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('A', 'B', 'C'), // single divisionId
          fc.integer({ min: 2, max: 10 }), // number of duplicates
          fc.integer({ min: 5, max: 15 }), // clubBase
          (divisionId, duplicateCount, clubBase) => {
            // Arrange: Create snapshot with all same division
            const snapshot = {
              divisionPerformance: Array.from(
                { length: duplicateCount },
                (_, i) => ({
                  Division: divisionId,
                  'Club Base': (clubBase + i).toString(),
                  'Paid Clubs': (clubBase + i).toString(),
                  'Distinguished Clubs': Math.floor(
                    (clubBase + i) / 2
                  ).toString(),
                })
              ),
              clubPerformance: [],
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Should have exactly one division
            expect(result.length).toBe(1)
            expect(result[0].divisionId).toBe(divisionId)

            // Assert: Should use first occurrence values
            expect(result[0].clubBase).toBe(clubBase)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain uniqueness invariant across all inputs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              divisionId: fc.constantFrom('A', 'B', 'C', 'D', 'E'),
              clubBase: fc.integer({ min: 1, max: 20 }),
              paidClubs: fc.integer({ min: 0, max: 25 }),
              distinguishedClubs: fc.integer({ min: 0, max: 20 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          divisions => {
            // Arrange: Create snapshot (may or may not have duplicates)
            const snapshot = {
              divisionPerformance: divisions.map(d => ({
                Division: d.divisionId,
                'Club Base': d.clubBase.toString(),
                'Paid Clubs': d.paidClubs.toString(),
                'Distinguished Clubs': d.distinguishedClubs.toString(),
              })),
              clubPerformance: [],
            }

            // Act: Extract division performance
            const result = extractDivisionPerformance(snapshot)

            // Assert: Result must always have unique division IDs
            const resultDivisionIds = result.map(d => d.divisionId)
            const uniqueResultIds = new Set(resultDivisionIds)
            expect(resultDivisionIds.length).toBe(uniqueResultIds.size)

            // Assert: Result count should not exceed input unique count
            const inputUniqueIds = new Set(divisions.map(d => d.divisionId))
            expect(result.length).toBeLessThanOrEqual(inputUniqueIds.size)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
