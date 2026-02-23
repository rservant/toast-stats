/**
 * Tests for DistrictSnapshotIndexWriter
 *
 * Verifies that the writer correctly creates and updates the
 * district-snapshot index file in GCS.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DistrictSnapshotIndexWriter,
  type IndexStorage,
} from '../services/DistrictSnapshotIndexWriter.js'

describe('DistrictSnapshotIndexWriter', () => {
  let mockStorage: IndexStorage
  let writer: DistrictSnapshotIndexWriter

  beforeEach(() => {
    mockStorage = {
      readIndex: vi.fn(),
      writeIndex: vi.fn(),
    }
    writer = new DistrictSnapshotIndexWriter(mockStorage)
  })

  describe('updateIndex', () => {
    it('creates a new index when none exists', async () => {
      vi.mocked(mockStorage.readIndex).mockResolvedValue(null)
      vi.mocked(mockStorage.writeIndex).mockResolvedValue()

      await writer.updateIndex('2025-07-25', ['109', '86'])

      expect(mockStorage.writeIndex).toHaveBeenCalledWith(
        expect.objectContaining({
          districts: {
            '109': ['2025-07-25'],
            '86': ['2025-07-25'],
          },
        })
      )
    })

    it('merges new dates into existing index', async () => {
      vi.mocked(mockStorage.readIndex).mockResolvedValue({
        generatedAt: '2026-02-20T12:00:00Z',
        districts: {
          '109': ['2025-07-23', '2025-07-24'],
          '86': ['2025-07-23'],
        },
      })
      vi.mocked(mockStorage.writeIndex).mockResolvedValue()

      await writer.updateIndex('2025-07-25', ['109', '86'])

      const written = vi.mocked(mockStorage.writeIndex).mock.calls[0]![0]
      expect(written.districts['109']).toEqual([
        '2025-07-23',
        '2025-07-24',
        '2025-07-25',
      ])
      expect(written.districts['86']).toEqual(['2025-07-23', '2025-07-25'])
    })

    it('deduplicates dates when date already exists', async () => {
      vi.mocked(mockStorage.readIndex).mockResolvedValue({
        generatedAt: '2026-02-20T12:00:00Z',
        districts: {
          '109': ['2025-07-23', '2025-07-24'],
        },
      })
      vi.mocked(mockStorage.writeIndex).mockResolvedValue()

      await writer.updateIndex('2025-07-24', ['109'])

      const written = vi.mocked(mockStorage.writeIndex).mock.calls[0]![0]
      expect(written.districts['109']).toEqual(['2025-07-23', '2025-07-24'])
    })

    it('adds new districts that did not exist in the index', async () => {
      vi.mocked(mockStorage.readIndex).mockResolvedValue({
        generatedAt: '2026-02-20T12:00:00Z',
        districts: {
          '109': ['2025-07-23'],
        },
      })
      vi.mocked(mockStorage.writeIndex).mockResolvedValue()

      await writer.updateIndex('2025-07-25', ['109', '42'])

      const written = vi.mocked(mockStorage.writeIndex).mock.calls[0]![0]
      expect(written.districts['109']).toEqual(['2025-07-23', '2025-07-25'])
      expect(written.districts['42']).toEqual(['2025-07-25'])
    })

    it('preserves existing districts not in the update', async () => {
      vi.mocked(mockStorage.readIndex).mockResolvedValue({
        generatedAt: '2026-02-20T12:00:00Z',
        districts: {
          '109': ['2025-07-23'],
          '20': ['2017-01-31'],
        },
      })
      vi.mocked(mockStorage.writeIndex).mockResolvedValue()

      await writer.updateIndex('2025-07-25', ['109'])

      const written = vi.mocked(mockStorage.writeIndex).mock.calls[0]![0]
      expect(written.districts['20']).toEqual(['2017-01-31'])
      expect(written.districts['109']).toEqual(['2025-07-23', '2025-07-25'])
    })

    it('sorts dates in ascending order', async () => {
      vi.mocked(mockStorage.readIndex).mockResolvedValue({
        generatedAt: '2026-02-20T12:00:00Z',
        districts: {
          '109': ['2025-07-25', '2025-07-23'],
        },
      })
      vi.mocked(mockStorage.writeIndex).mockResolvedValue()

      await writer.updateIndex('2025-07-24', ['109'])

      const written = vi.mocked(mockStorage.writeIndex).mock.calls[0]![0]
      expect(written.districts['109']).toEqual([
        '2025-07-23',
        '2025-07-24',
        '2025-07-25',
      ])
    })

    it('sets generatedAt to current time', async () => {
      vi.mocked(mockStorage.readIndex).mockResolvedValue(null)
      vi.mocked(mockStorage.writeIndex).mockResolvedValue()

      const before = new Date().toISOString()
      await writer.updateIndex('2025-07-25', ['109'])
      const after = new Date().toISOString()

      const written = vi.mocked(mockStorage.writeIndex).mock.calls[0]![0]
      expect(written.generatedAt >= before).toBe(true)
      expect(written.generatedAt <= after).toBe(true)
    })

    it('handles empty district list gracefully', async () => {
      vi.mocked(mockStorage.readIndex).mockResolvedValue({
        generatedAt: '2026-02-20T12:00:00Z',
        districts: { '109': ['2025-07-23'] },
      })
      vi.mocked(mockStorage.writeIndex).mockResolvedValue()

      await writer.updateIndex('2025-07-25', [])

      const written = vi.mocked(mockStorage.writeIndex).mock.calls[0]![0]
      // No new districts added, existing preserved
      expect(written.districts['109']).toEqual(['2025-07-23'])
    })
  })
})
