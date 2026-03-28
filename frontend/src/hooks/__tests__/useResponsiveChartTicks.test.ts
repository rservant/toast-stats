import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import { useResponsiveTickInterval } from '../useResponsiveChartTicks'

describe('useResponsiveTickInterval', () => {
  const originalInnerWidth = window.innerWidth

  afterEach(() => {
    // Restore window.innerWidth to its original value after each test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
    vi.restoreAllMocks()
  })

  const setViewportWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
  }

  it('returns "preserveStartEnd" for desktop viewports (>=768px)', () => {
    setViewportWidth(1024)
    const { result } = renderHook(() => useResponsiveTickInterval(20))
    expect(result.current).toBe('preserveStartEnd')
  })

  it('returns "preserveStartEnd" for small datasets (<10 items) even on mobile', () => {
    setViewportWidth(375)
    // 9 items is below the threshold for thinning
    const { result } = renderHook(() => useResponsiveTickInterval(9))
    expect(result.current).toBe('preserveStartEnd')
  })

  it('thins labels to every 2nd or 3rd on tablet viewports (480px-767px) for large datasets', () => {
    setViewportWidth(600)

    // 15 items should thin by Math.ceil(15/8) = Math.ceil(1.875) = 2
    const { result: res1 } = renderHook(() => useResponsiveTickInterval(15))
    expect(res1.current).toBe(1) // 1-indexed for Recharts (skip 1 = show every 2nd)

    // 30 items should thin by Math.ceil(30/8) = 4
    const { result: res2 } = renderHook(() => useResponsiveTickInterval(30))
    expect(res2.current).toBe(3) // skip 3 = show every 4th
  })

  it('thins labels to every 3rd or 4th on phone viewports (<480px) for large datasets', () => {
    setViewportWidth(375)

    // 12 items should thin by Math.ceil(12/5) = Math.ceil(2.4) = 3
    const { result: res1 } = renderHook(() => useResponsiveTickInterval(12))
    expect(res1.current).toBe(2) // skip 2 = show every 3rd

    // 24 items should thin by Math.ceil(24/5) = Math.ceil(4.8) = 5
    const { result: res2 } = renderHook(() => useResponsiveTickInterval(24))
    expect(res2.current).toBe(4) // skip 4 = show every 5th
  })

  it('handles empty datasets safely', () => {
    setViewportWidth(375)
    const { result } = renderHook(() => useResponsiveTickInterval(0))
    expect(result.current).toBe('preserveStartEnd')
  })
})
