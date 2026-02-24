/**
 * Unit Tests for HttpCsvDownloader (#123)
 *
 * Tests URL construction for all 4 report types and rate limiter behavior.
 */

import { describe, it, expect } from 'vitest'
import {
  HttpCsvDownloader,
  buildExportUrl,
  type BackfillDateSpec,
} from '../services/HttpCsvDownloader.js'

describe('HttpCsvDownloader URL Construction (#123)', () => {
  describe('buildExportUrl', () => {
    it('should construct districtsummary URL correctly', () => {
      const url = buildExportUrl({
        programYear: '2024-2025',
        reportType: 'districtsummary',
        date: new Date(2025, 5, 30), // June 30, 2025
      })

      expect(url).toBe(
        'https://dashboards.toastmasters.org/2024-2025/export.aspx?type=CSV&report=districtsummary~6/30/2025~~2024-2025'
      )
    })

    it('should construct districtperformance URL with district ID', () => {
      const url = buildExportUrl({
        programYear: '2024-2025',
        reportType: 'districtperformance',
        districtId: '109',
        date: new Date(2025, 5, 30),
      })

      expect(url).toBe(
        'https://dashboards.toastmasters.org/2024-2025/export.aspx?type=CSV&report=districtperformance~109~6/30/2025~~2024-2025'
      )
    })

    it('should construct divisionperformance URL with district ID', () => {
      const url = buildExportUrl({
        programYear: '2024-2025',
        reportType: 'divisionperformance',
        districtId: '109',
        date: new Date(2025, 5, 30),
      })

      expect(url).toBe(
        'https://dashboards.toastmasters.org/2024-2025/export.aspx?type=CSV&report=divisionperformance~109~6/30/2025~~2024-2025'
      )
    })

    it('should construct clubperformance URL with district ID', () => {
      const url = buildExportUrl({
        programYear: '2024-2025',
        reportType: 'clubperformance',
        districtId: '109',
        date: new Date(2025, 5, 30),
      })

      expect(url).toBe(
        'https://dashboards.toastmasters.org/2024-2025/export.aspx?type=CSV&report=clubperformance~109~6/30/2025~~2024-2025'
      )
    })

    it('should format date as M/D/YYYY (no zero padding)', () => {
      const url = buildExportUrl({
        programYear: '2017-2018',
        reportType: 'districtsummary',
        date: new Date(2018, 0, 5), // January 5, 2018
      })

      expect(url).toContain('report=districtsummary~1/5/2018~~2017-2018')
    })

    it('should use older program year for older dates', () => {
      const url = buildExportUrl({
        programYear: '2017-2018',
        reportType: 'districtperformance',
        districtId: '61',
        date: new Date(2017, 11, 15), // December 15, 2017
      })

      expect(url).toBe(
        'https://dashboards.toastmasters.org/2017-2018/export.aspx?type=CSV&report=districtperformance~61~12/15/2017~~2017-2018'
      )
    })
  })

  describe('generateDateGrid', () => {
    it('should generate biweekly dates across a full program year', () => {
      const downloader = new HttpCsvDownloader({ ratePerSecond: 1 })
      const dates = downloader.generateDateGrid('2024-2025', 'biweekly')

      // July 1, 2024 to June 30, 2025 = ~365 days, biweekly = ~26 dates
      expect(dates.length).toBeGreaterThanOrEqual(24)
      expect(dates.length).toBeLessThanOrEqual(28)

      // First date should be in July 2024
      expect(dates[0]!.getMonth()).toBe(6) // July (0-indexed)
      expect(dates[0]!.getFullYear()).toBe(2024)

      // Last date should always be June 30
      const lastDate = dates[dates.length - 1]!
      expect(lastDate.getMonth()).toBe(5) // June
      expect(lastDate.getDate()).toBe(30)
      expect(lastDate.getFullYear()).toBe(2025)
    })

    it('should generate weekly dates', () => {
      const downloader = new HttpCsvDownloader({ ratePerSecond: 1 })
      const dates = downloader.generateDateGrid('2024-2025', 'weekly')

      expect(dates.length).toBeGreaterThanOrEqual(50)
      expect(dates.length).toBeLessThanOrEqual(54)
    })

    it('should generate monthly dates', () => {
      const downloader = new HttpCsvDownloader({ ratePerSecond: 1 })
      const dates = downloader.generateDateGrid('2024-2025', 'monthly')

      // 12 months (~30-day intervals) + year-end date
      expect(dates.length).toBeGreaterThanOrEqual(12)
      expect(dates.length).toBeLessThanOrEqual(15)
    })
  })

  describe('programYearRange', () => {
    it('should generate program year strings for a range', () => {
      const downloader = new HttpCsvDownloader({ ratePerSecond: 1 })
      const years = downloader.getProgramYearRange(2017, 2024)

      expect(years).toEqual([
        '2017-2018',
        '2018-2019',
        '2019-2020',
        '2020-2021',
        '2021-2022',
        '2022-2023',
        '2023-2024',
        '2024-2025',
      ])
    })

    it('should handle single year', () => {
      const downloader = new HttpCsvDownloader({ ratePerSecond: 1 })
      const years = downloader.getProgramYearRange(2024, 2024)

      expect(years).toEqual(['2024-2025'])
    })
  })

  describe('parseDistrictsFromSummary', () => {
    it('should extract district IDs from summary CSV', () => {
      const csv = `"REGION","DISTRICT","DSP","Training"
"01","02","Y","Y"
"01","09","Y","Y"
"02","F","Y","Y"
"03","42","Y","Y"
`
      const downloader = new HttpCsvDownloader({ ratePerSecond: 1 })
      const districts = downloader.parseDistrictsFromSummary(csv)

      // Numeric IDs sort first, then alphabetic
      expect(districts).toEqual(['02', '09', '42', 'F'])
    })

    it('should return empty array for empty CSV', () => {
      const downloader = new HttpCsvDownloader({ ratePerSecond: 1 })
      const districts = downloader.parseDistrictsFromSummary('')

      expect(districts).toEqual([])
    })
  })
})
