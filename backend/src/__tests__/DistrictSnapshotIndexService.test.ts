/**
 * Tests for DistrictSnapshotIndexService
 *
 * Verifies that the service reads a pre-computed district-snapshot index
 * from storage, caches it in memory, and returns filtered dates per district.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DistrictSnapshotIndexService,
  type IndexStorageReader,
  type DistrictSnapshotIndex,
} from '../services/DistrictSnapshotIndexService.js'

describe('DistrictSnapshotIndexService', () => {
  let mockReader: IndexStorageReader
  let service: DistrictSnapshotIndexService

  const sampleIndex: DistrictSnapshotIndex = {
    generatedAt: '2026-02-21T12:00:00Z',
    districts: {
      '109': ['2025-07-23', '2025-07-24', '2025-07-25'],
      '86': ['2025-07-23', '2025-07-24'],
      '20': ['2017-01-31', '2017-02-09'],
    },
  }

  beforeEach(() => {
    mockReader = {
      readIndex: vi.fn(),
    }
    service = new DistrictSnapshotIndexService(mockReader)
  })

  describe('getDatesForDistrict', () => {
    it('returns sorted dates when index contains the district', async () => {
      vi.mocked(mockReader.readIndex).mockResolvedValue(sampleIndex)

      const dates = await service.getDatesForDistrict('109')

      expect(dates).toEqual(['2025-07-23', '2025-07-24', '2025-07-25'])
    })

    it('returns empty array when district is not in the index', async () => {
      vi.mocked(mockReader.readIndex).mockResolvedValue(sampleIndex)

      const dates = await service.getDatesForDistrict('999')

      expect(dates).toEqual([])
    })

    it('returns null when index is missing (reader returns null)', async () => {
      vi.mocked(mockReader.readIndex).mockResolvedValue(null)

      const dates = await service.getDatesForDistrict('109')

      expect(dates).toBeNull()
    })

    it('returns null when reader throws an error', async () => {
      vi.mocked(mockReader.readIndex).mockRejectedValue(
        new Error('GCS read failed')
      )

      const dates = await service.getDatesForDistrict('109')

      expect(dates).toBeNull()
    })
  })

  describe('caching', () => {
    it('caches the index and does not re-read within TTL', async () => {
      vi.mocked(mockReader.readIndex).mockResolvedValue(sampleIndex)

      await service.getDatesForDistrict('109')
      await service.getDatesForDistrict('86')
      await service.getDatesForDistrict('20')

      expect(mockReader.readIndex).toHaveBeenCalledTimes(1)
    })

    it('re-reads the index after TTL expires', async () => {
      // Use a very short TTL for testing
      service = new DistrictSnapshotIndexService(mockReader, { ttlMs: 10 })
      vi.mocked(mockReader.readIndex).mockResolvedValue(sampleIndex)

      await service.getDatesForDistrict('109')
      expect(mockReader.readIndex).toHaveBeenCalledTimes(1)

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 20))

      await service.getDatesForDistrict('109')
      expect(mockReader.readIndex).toHaveBeenCalledTimes(2)
    })

    it('does not cache null responses (retries on next call)', async () => {
      vi.mocked(mockReader.readIndex)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sampleIndex)

      const first = await service.getDatesForDistrict('109')
      expect(first).toBeNull()

      const second = await service.getDatesForDistrict('109')
      expect(second).toEqual(['2025-07-23', '2025-07-24', '2025-07-25'])
      expect(mockReader.readIndex).toHaveBeenCalledTimes(2)
    })
  })

  describe('index validation', () => {
    it('returns null for index missing districts field', async () => {
      vi.mocked(mockReader.readIndex).mockResolvedValue({
        generatedAt: '2026-02-21T12:00:00Z',
      } as unknown as DistrictSnapshotIndex)

      const dates = await service.getDatesForDistrict('109')

      expect(dates).toBeNull()
    })

    it('returns null for index with non-object districts', async () => {
      vi.mocked(mockReader.readIndex).mockResolvedValue({
        generatedAt: '2026-02-21T12:00:00Z',
        districts: 'not-an-object',
      } as unknown as DistrictSnapshotIndex)

      const dates = await service.getDatesForDistrict('109')

      expect(dates).toBeNull()
    })
  })
})
