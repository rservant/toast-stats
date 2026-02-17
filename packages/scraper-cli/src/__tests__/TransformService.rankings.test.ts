/**
 * TransformService Rankings Tests
 *
 * Tests for the all-districts rankings calculation functionality
 * that was ported from the backend.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { TransformService } from '../services/TransformService.js'

/**
 * Helper to create a minimal district directory with club performance CSV
 */
async function createDistrictDir(
  rawCsvDir: string,
  districtId: string
): Promise<void> {
  const districtDir = path.join(rawCsvDir, `district-${districtId}`)
  await fs.mkdir(districtDir, { recursive: true })
  await fs.writeFile(
    path.join(districtDir, 'club-performance.csv'),
    'Club Number,Club Name,Division,Area,Active Members,Goals Met\n1234,Test Club,A,1,20,5'
  )
}

describe('TransformService - All Districts Rankings', () => {
  let tempDir: string
  let transformService: TransformService

  beforeEach(async () => {
    // Create unique temp directory for test isolation
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'transform-rankings-test-')
    )
    transformService = new TransformService({ cacheDir: tempDir })
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('District ID Validation', () => {
    it('should reject empty district IDs', async () => {
      const date = '2024-01-15'
      const rawCsvDir = path.join(tempDir, 'raw-csv', date)
      await fs.mkdir(rawCsvDir, { recursive: true })

      // CSV with empty district ID
      const csvContent = `DISTRICT,REGION,Paid Clubs,Paid Club Base,% Club Growth,Total YTD Payments,Payment Base,% Payment Growth,Active Clubs,Total Distinguished Clubs,Select Distinguished Clubs,Presidents Distinguished Clubs
,Region 1,100,95,5.26%,1000,950,5.26%,100,10,5,2
42,Region 2,200,190,5.26%,2000,1900,5.26%,200,20,10,5`

      await fs.writeFile(path.join(rawCsvDir, 'all-districts.csv'), csvContent)
      await createDistrictDir(rawCsvDir, '42')

      const result = await transformService.transform({
        date,
        force: true,
      })

      // Check that rankings file was created with only valid district
      const rankingsPath = path.join(
        tempDir,
        'snapshots',
        date,
        'all-districts-rankings.json'
      )
      const rankingsContent = await fs.readFile(rankingsPath, 'utf-8')
      const rankings = JSON.parse(rankingsContent)

      expect(rankings.rankings).toHaveLength(1)
      expect(rankings.rankings[0].districtId).toBe('42')
    })

    it('should reject date pattern district IDs (CSV footer rows)', async () => {
      const date = '2024-01-15'
      const rawCsvDir = path.join(tempDir, 'raw-csv', date)
      await fs.mkdir(rawCsvDir, { recursive: true })

      // CSV with date pattern in district ID (common footer issue)
      const csvContent = `DISTRICT,REGION,Paid Clubs,Paid Club Base,% Club Growth,Total YTD Payments,Payment Base,% Payment Growth,Active Clubs,Total Distinguished Clubs,Select Distinguished Clubs,Presidents Distinguished Clubs
42,Region 2,200,190,5.26%,2000,1900,5.26%,200,20,10,5
As of 1/15/2024,,,,,,,,,,,`

      await fs.writeFile(path.join(rawCsvDir, 'all-districts.csv'), csvContent)
      await createDistrictDir(rawCsvDir, '42')

      const result = await transformService.transform({
        date,
        force: true,
      })

      const rankingsPath = path.join(
        tempDir,
        'snapshots',
        date,
        'all-districts-rankings.json'
      )
      const rankingsContent = await fs.readFile(rankingsPath, 'utf-8')
      const rankings = JSON.parse(rankingsContent)

      // Should only have the valid district, not the date pattern
      expect(rankings.rankings).toHaveLength(1)
      expect(rankings.rankings[0].districtId).toBe('42')
    })

    it('should reject district IDs with invalid characters', async () => {
      const date = '2024-01-15'
      const rawCsvDir = path.join(tempDir, 'raw-csv', date)
      await fs.mkdir(rawCsvDir, { recursive: true })

      // CSV with invalid characters in district ID
      const csvContent = `DISTRICT,REGION,Paid Clubs,Paid Club Base,% Club Growth,Total YTD Payments,Payment Base,% Payment Growth,Active Clubs,Total Distinguished Clubs,Select Distinguished Clubs,Presidents Distinguished Clubs
42,Region 2,200,190,5.26%,2000,1900,5.26%,200,20,10,5
district-99,Region 3,150,140,7.14%,1500,1400,7.14%,150,15,8,3`

      await fs.writeFile(path.join(rawCsvDir, 'all-districts.csv'), csvContent)
      await createDistrictDir(rawCsvDir, '42')

      const result = await transformService.transform({
        date,
        force: true,
      })

      const rankingsPath = path.join(
        tempDir,
        'snapshots',
        date,
        'all-districts-rankings.json'
      )
      const rankingsContent = await fs.readFile(rankingsPath, 'utf-8')
      const rankings = JSON.parse(rankingsContent)

      // Should only have the valid district
      expect(rankings.rankings).toHaveLength(1)
      expect(rankings.rankings[0].districtId).toBe('42')
    })

    it('should accept alphanumeric district IDs like "U"', async () => {
      const date = '2024-01-15'
      const rawCsvDir = path.join(tempDir, 'raw-csv', date)
      await fs.mkdir(rawCsvDir, { recursive: true })

      // CSV with special district code "U"
      const csvContent = `DISTRICT,REGION,Paid Clubs,Paid Club Base,% Club Growth,Total YTD Payments,Payment Base,% Payment Growth,Active Clubs,Total Distinguished Clubs,Select Distinguished Clubs,Presidents Distinguished Clubs
42,Region 2,200,190,5.26%,2000,1900,5.26%,200,20,10,5
U,Undistricted,50,45,11.11%,500,450,11.11%,50,5,2,1`

      await fs.writeFile(path.join(rawCsvDir, 'all-districts.csv'), csvContent)
      await createDistrictDir(rawCsvDir, '42')

      const result = await transformService.transform({
        date,
        force: true,
      })

      const rankingsPath = path.join(
        tempDir,
        'snapshots',
        date,
        'all-districts-rankings.json'
      )
      const rankingsContent = await fs.readFile(rankingsPath, 'utf-8')
      const rankings = JSON.parse(rankingsContent)

      // Should have both valid districts
      expect(rankings.rankings).toHaveLength(2)
      const districtIds = rankings.rankings.map(
        (r: { districtId: string }) => r.districtId
      )
      expect(districtIds).toContain('42')
      expect(districtIds).toContain('U')
    })
  })

  describe('Borda Count Ranking Calculation', () => {
    it('should calculate correct Borda count rankings', async () => {
      const date = '2024-01-15'
      const rawCsvDir = path.join(tempDir, 'raw-csv', date)
      await fs.mkdir(rawCsvDir, { recursive: true })

      // CSV with 3 districts for ranking
      const csvContent = `DISTRICT,REGION,Paid Clubs,Paid Club Base,% Club Growth,Total YTD Payments,Payment Base,% Payment Growth,Active Clubs,Total Distinguished Clubs,Select Distinguished Clubs,Presidents Distinguished Clubs
1,Region 1,100,90,11.11%,1000,900,11.11%,100,30,15,10
2,Region 2,200,195,2.56%,2000,1950,2.56%,200,20,10,5
3,Region 3,150,145,3.45%,1500,1450,3.45%,150,40,20,15`

      await fs.writeFile(path.join(rawCsvDir, 'all-districts.csv'), csvContent)
      await createDistrictDir(rawCsvDir, '1')

      const result = await transformService.transform({
        date,
        force: true,
      })

      const rankingsPath = path.join(
        tempDir,
        'snapshots',
        date,
        'all-districts-rankings.json'
      )
      const rankingsContent = await fs.readFile(rankingsPath, 'utf-8')
      const rankings = JSON.parse(rankingsContent)

      expect(rankings.rankings).toHaveLength(3)

      // District 1 has highest club growth (11.11%) - rank 1
      // District 3 has second highest (3.45%) - rank 2
      // District 2 has lowest (2.56%) - rank 3
      const district1 = rankings.rankings.find(
        (r: { districtId: string }) => r.districtId === '1'
      )
      const district2 = rankings.rankings.find(
        (r: { districtId: string }) => r.districtId === '2'
      )
      const district3 = rankings.rankings.find(
        (r: { districtId: string }) => r.districtId === '3'
      )

      expect(district1.clubsRank).toBe(1)
      expect(district3.clubsRank).toBe(2)
      expect(district2.clubsRank).toBe(3)

      // Distinguished percent: D3 (26.67%) > D1 (30%) > D2 (10%)
      // D3: 40/150 = 26.67%, D1: 30/100 = 30%, D2: 20/200 = 10%
      expect(district1.distinguishedRank).toBe(1) // 30%
      expect(district3.distinguishedRank).toBe(2) // 26.67%
      expect(district2.distinguishedRank).toBe(3) // 10%

      // Borda points: 3 districts, so rank 1 = 3 points, rank 2 = 2 points, rank 3 = 1 point
      // Aggregate = clubs + payments + distinguished
      // D1: clubs=1(3pts) + payments=1(3pts) + distinguished=1(3pts) = 9
      // D3: clubs=2(2pts) + payments=2(2pts) + distinguished=2(2pts) = 6
      // D2: clubs=3(1pt) + payments=3(1pt) + distinguished=3(1pt) = 3
      expect(district1.aggregateScore).toBe(9)
      expect(district3.aggregateScore).toBe(6)
      expect(district2.aggregateScore).toBe(3)
    })

    it('should handle ties correctly', async () => {
      const date = '2024-01-15'
      const rawCsvDir = path.join(tempDir, 'raw-csv', date)
      await fs.mkdir(rawCsvDir, { recursive: true })

      // CSV with tied values
      const csvContent = `DISTRICT,REGION,Paid Clubs,Paid Club Base,% Club Growth,Total YTD Payments,Payment Base,% Payment Growth,Active Clubs,Total Distinguished Clubs,Select Distinguished Clubs,Presidents Distinguished Clubs
1,Region 1,100,95,5.26%,1000,950,5.26%,100,10,5,2
2,Region 2,200,190,5.26%,2000,1900,5.26%,200,20,10,5`

      await fs.writeFile(path.join(rawCsvDir, 'all-districts.csv'), csvContent)
      await createDistrictDir(rawCsvDir, '1')

      const result = await transformService.transform({
        date,
        force: true,
      })

      const rankingsPath = path.join(
        tempDir,
        'snapshots',
        date,
        'all-districts-rankings.json'
      )
      const rankingsContent = await fs.readFile(rankingsPath, 'utf-8')
      const rankings = JSON.parse(rankingsContent)

      // Both districts have same club growth and payment growth
      // They should have the same rank for those categories
      const district1 = rankings.rankings.find(
        (r: { districtId: string }) => r.districtId === '1'
      )
      const district2 = rankings.rankings.find(
        (r: { districtId: string }) => r.districtId === '2'
      )

      expect(district1.clubsRank).toBe(district2.clubsRank)
      expect(district1.paymentsRank).toBe(district2.paymentsRank)
    })
  })

  describe('Rankings File Output', () => {
    it('should write rankings file with correct metadata', async () => {
      const date = '2024-01-15'
      const rawCsvDir = path.join(tempDir, 'raw-csv', date)
      await fs.mkdir(rawCsvDir, { recursive: true })

      const csvContent = `DISTRICT,REGION,Paid Clubs,Paid Club Base,% Club Growth,Total YTD Payments,Payment Base,% Payment Growth,Active Clubs,Total Distinguished Clubs,Select Distinguished Clubs,Presidents Distinguished Clubs
42,Region 2,200,190,5.26%,2000,1900,5.26%,200,20,10,5`

      await fs.writeFile(path.join(rawCsvDir, 'all-districts.csv'), csvContent)
      await createDistrictDir(rawCsvDir, '42')

      await transformService.transform({
        date,
        force: true,
      })

      const rankingsPath = path.join(
        tempDir,
        'snapshots',
        date,
        'all-districts-rankings.json'
      )
      const rankingsContent = await fs.readFile(rankingsPath, 'utf-8')
      const rankings = JSON.parse(rankingsContent)

      // Check metadata
      expect(rankings.metadata.snapshotId).toBe(date)
      expect(rankings.metadata.totalDistricts).toBe(1)
      expect(rankings.metadata.rankingVersion).toBe('2.0')
      expect(rankings.metadata.calculatedAt).toBeDefined()
      expect(rankings.metadata.schemaVersion).toBeDefined()
    })

    it('should include rankings file in snapshot locations', async () => {
      const date = '2024-01-15'
      const rawCsvDir = path.join(tempDir, 'raw-csv', date)
      await fs.mkdir(rawCsvDir, { recursive: true })

      const csvContent = `DISTRICT,REGION,Paid Clubs,Paid Club Base,% Club Growth,Total YTD Payments,Payment Base,% Payment Growth,Active Clubs,Total Distinguished Clubs,Select Distinguished Clubs,Presidents Distinguished Clubs
42,Region 2,200,190,5.26%,2000,1900,5.26%,200,20,10,5`

      await fs.writeFile(path.join(rawCsvDir, 'all-districts.csv'), csvContent)
      await createDistrictDir(rawCsvDir, '42')

      const result = await transformService.transform({
        date,
        force: true,
      })

      // Check that rankings file is in snapshot locations
      const rankingsPath = path.join(
        tempDir,
        'snapshots',
        date,
        'all-districts-rankings.json'
      )
      expect(result.snapshotLocations).toContain(rankingsPath)
    })
  })
})
