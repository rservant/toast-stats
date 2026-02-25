/**
 * Unit Tests for CachePaths (#126)
 *
 * Validates the shared path-building, date formatting,
 * and program year calculation utilities.
 */

import { describe, it, expect } from 'vitest'
import { CSVType } from '../../types/collector.js'
import {
  toYYYYMMDD,
  calculateProgramYear,
  buildCsvPath,
  buildMetadataPath,
  buildChecksumKey,
  REPORT_TYPE_TO_CSV,
  buildCsvPathFromReport,
} from '../CachePaths.js'

describe('CachePaths (#126)', () => {
  describe('toYYYYMMDD', () => {
    it('formats a date correctly', () => {
      expect(toYYYYMMDD(new Date(2025, 6, 1))).toBe('2025-07-01')
    })

    it('pads single-digit month and day', () => {
      expect(toYYYYMMDD(new Date(2025, 0, 5))).toBe('2025-01-05')
    })
  })

  describe('calculateProgramYear', () => {
    it('returns current year label for July+', () => {
      expect(calculateProgramYear('2025-07-01')).toBe('2025-2026')
      expect(calculateProgramYear('2025-12-31')).toBe('2025-2026')
    })

    it('returns prior year label for Jan-Jun', () => {
      expect(calculateProgramYear('2026-01-15')).toBe('2025-2026')
      expect(calculateProgramYear('2026-06-30')).toBe('2025-2026')
    })

    it('accepts Date objects', () => {
      expect(calculateProgramYear(new Date(2025, 6, 1))).toBe('2025-2026')
      expect(calculateProgramYear(new Date(2026, 0, 15))).toBe('2025-2026')
    })
  })

  describe('buildCsvPath', () => {
    const prefix = '/data/cache'

    it('builds all-districts path', () => {
      expect(buildCsvPath(prefix, '2025-07-01', CSVType.ALL_DISTRICTS)).toBe(
        '/data/cache/raw-csv/2025-07-01/all-districts.csv'
      )
    })

    it('builds district-specific path', () => {
      expect(
        buildCsvPath(prefix, '2025-07-01', CSVType.CLUB_PERFORMANCE, '109')
      ).toBe('/data/cache/raw-csv/2025-07-01/district-109/club-performance.csv')
    })

    it('throws when districtId missing for per-district type', () => {
      expect(() =>
        buildCsvPath(prefix, '2025-07-01', CSVType.CLUB_PERFORMANCE)
      ).toThrow('districtId is required')
    })

    it('accepts Date objects', () => {
      expect(
        buildCsvPath(prefix, new Date(2025, 6, 1), CSVType.ALL_DISTRICTS)
      ).toBe('/data/cache/raw-csv/2025-07-01/all-districts.csv')
    })
  })

  describe('buildMetadataPath', () => {
    it('builds metadata path for a date', () => {
      expect(buildMetadataPath('/data', '2025-07-01')).toBe(
        '/data/raw-csv/2025-07-01/metadata.json'
      )
    })

    it('accepts Date objects', () => {
      expect(buildMetadataPath('/data', new Date(2025, 6, 1))).toBe(
        '/data/raw-csv/2025-07-01/metadata.json'
      )
    })
  })

  describe('buildChecksumKey', () => {
    it('returns filename for all-districts', () => {
      expect(buildChecksumKey(CSVType.ALL_DISTRICTS)).toBe('all-districts.csv')
    })

    it('returns district-prefixed key', () => {
      expect(buildChecksumKey(CSVType.CLUB_PERFORMANCE, '109')).toBe(
        'district-109/club-performance.csv'
      )
    })
  })

  describe('REPORT_TYPE_TO_CSV', () => {
    it('maps all report types to CSVType values', () => {
      expect(REPORT_TYPE_TO_CSV.districtsummary).toBe(CSVType.ALL_DISTRICTS)
      expect(REPORT_TYPE_TO_CSV.clubperformance).toBe(CSVType.CLUB_PERFORMANCE)
      expect(REPORT_TYPE_TO_CSV.divisionperformance).toBe(
        CSVType.DIVISION_PERFORMANCE
      )
      expect(REPORT_TYPE_TO_CSV.districtperformance).toBe(
        CSVType.DISTRICT_PERFORMANCE
      )
    })
  })

  describe('buildCsvPathFromReport', () => {
    it('builds path from report type', () => {
      expect(
        buildCsvPathFromReport('/data', new Date(2025, 6, 1), 'districtsummary')
      ).toBe('/data/raw-csv/2025-07-01/all-districts.csv')
    })

    it('builds per-district path from report type', () => {
      expect(
        buildCsvPathFromReport(
          '/data',
          new Date(2025, 6, 1),
          'clubperformance',
          '109'
        )
      ).toBe('/data/raw-csv/2025-07-01/district-109/club-performance.csv')
    })
  })
})
