/**
 * Tests for useUrlProgramYear hook (#272)
 *
 * Syncs program year and date selection to URL search params,
 * enabling deep links like /district/61?py=2025&date=2026-04-01.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

// Mock the ProgramYearContext
const mockSetSelectedProgramYear = vi.fn()
const mockSetSelectedDate = vi.fn()

vi.mock('../../contexts/ProgramYearContext', () => ({
  useProgramYear: () => ({
    selectedProgramYear: {
      year: 2025,
      startDate: '2025-07-01',
      endDate: '2026-06-30',
      label: '2025-2026',
    },
    setSelectedProgramYear: mockSetSelectedProgramYear,
    selectedDate: undefined,
    setSelectedDate: mockSetSelectedDate,
  }),
}))

// Must import after mock
import { useUrlProgramYear } from '../useUrlProgramYear'

function createWrapper(initialEntries: string[] = ['/']) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(MemoryRouter, { initialEntries }, children)
}

describe('useUrlProgramYear (#272)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('program year', () => {
    it('should return current program year when no ?py= param', () => {
      const { result } = renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(),
      })

      expect(result.current.selectedProgramYear.year).toBe(2025)
      expect(result.current.selectedProgramYear.label).toBe('2025-2026')
    })

    it('should read program year from ?py= URL param', () => {
      const { result } = renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(['/?py=2024']),
      })

      expect(result.current.selectedProgramYear.year).toBe(2024)
      expect(result.current.selectedProgramYear.label).toBe('2024-2025')
    })

    it('should update URL when program year changes', () => {
      const { result } = renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setSelectedProgramYear({
          year: 2023,
          startDate: '2023-07-01',
          endDate: '2024-06-30',
          label: '2023-2024',
        })
      })

      expect(result.current.selectedProgramYear.year).toBe(2023)
    })

    it('should sync to context when URL has a different year', () => {
      renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(['/?py=2024']),
      })

      expect(mockSetSelectedProgramYear).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2024 })
      )
    })

    it('should not sync to context when URL matches context year', () => {
      renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(['/?py=2025']),
      })

      // Context already has 2025, so no sync needed
      expect(mockSetSelectedProgramYear).not.toHaveBeenCalled()
    })
  })

  describe('date', () => {
    it('should return undefined when no ?date= param', () => {
      const { result } = renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(),
      })

      expect(result.current.selectedDate).toBeUndefined()
    })

    it('should read date from ?date= URL param', () => {
      const { result } = renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(['/?date=2026-04-01']),
      })

      expect(result.current.selectedDate).toBe('2026-04-01')
    })

    it('should update URL when date changes', () => {
      const { result } = renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setSelectedDate('2026-03-15')
      })

      expect(result.current.selectedDate).toBe('2026-03-15')
    })

    it('should clear date from URL when set to undefined', () => {
      const { result } = renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(['/?date=2026-04-01']),
      })

      act(() => {
        result.current.setSelectedDate(undefined)
      })

      expect(result.current.selectedDate).toBeUndefined()
    })

    it('should sync date to context', () => {
      renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(['/?date=2026-04-01']),
      })

      expect(mockSetSelectedDate).toHaveBeenCalledWith('2026-04-01')
    })
  })

  describe('combined params', () => {
    it('should read both py and date from URL', () => {
      const { result } = renderHook(() => useUrlProgramYear(), {
        wrapper: createWrapper(['/?py=2024&date=2025-01-15']),
      })

      expect(result.current.selectedProgramYear.year).toBe(2024)
      expect(result.current.selectedDate).toBe('2025-01-15')
    })
  })
})
