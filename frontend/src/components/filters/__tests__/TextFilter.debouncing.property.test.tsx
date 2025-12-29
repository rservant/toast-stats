/**
 * Property-based tests for text filter debouncing
 * Feature: clubs-table-column-filtering, Property 11: Text filter debouncing
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockedFunction,
} from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TextFilter } from '../TextFilter'
import React, { useCallback } from 'react'

// Wrapper component to provide stable mock functions
const TestWrapper: React.FC<{
  value: string
  onChangeMock: MockedFunction<
    (value: string, operator: 'contains' | 'startsWith') => void
  >
  onClearMock: MockedFunction<() => void>
  placeholder?: string
}> = ({ value, onChangeMock, onClearMock, placeholder }) => {
  const handleChange = useCallback(
    (newValue: string, operator: 'contains' | 'startsWith') => {
      onChangeMock(newValue, operator)
    },
    [onChangeMock]
  )

  const handleClear = useCallback(() => {
    onClearMock()
  }, [onClearMock])

  return (
    <TextFilter
      value={value}
      onChange={handleChange}
      onClear={handleClear}
      placeholder={placeholder}
    />
  )
}

describe('Text Filter Debouncing Properties', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  /**
   * Property 11: Text filter debouncing
   * For any text filter input, rapid typing should be debounced with a 300ms delay
   * before filtering occurs
   *
   * **Validates: Requirements 5.2**
   */
  it('should debounce text input with 300ms delay', async () => {
    const mockOnChange = vi.fn()
    const mockOnClear = vi.fn()

    render(
      <TestWrapper
        value=""
        onChangeMock={mockOnChange}
        onClearMock={mockOnClear}
        placeholder="Test filter"
      />
    )

    const input = screen.getByRole('textbox')

    // Simulate rapid typing - multiple characters typed quickly
    const testString = 'rapid'

    // Type each character with minimal delay (simulating fast typing)
    for (let i = 0; i < testString.length; i++) {
      const partialString = testString.substring(0, i + 1)

      act(() => {
        fireEvent.change(input, { target: { value: partialString } })
      })

      // Advance time by a small amount (less than debounce delay)
      act(() => {
        vi.advanceTimersByTime(50)
      })

      // onChange should not be called yet during rapid typing
      expect(mockOnChange).not.toHaveBeenCalled()
    }

    // Now advance time by the full debounce delay (300ms)
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // onChange should now be called exactly once with the final value
    expect(mockOnChange).toHaveBeenCalledTimes(1)
    expect(mockOnChange).toHaveBeenCalledWith('rapid', 'contains')
  })

  it('should reset debounce timer on each keystroke', async () => {
    const mockOnChange = vi.fn()
    const mockOnClear = vi.fn()

    render(
      <TestWrapper
        value=""
        onChangeMock={mockOnChange}
        onClearMock={mockOnClear}
        placeholder="Test filter"
      />
    )

    const input = screen.getByRole('textbox')

    // Type first character
    act(() => {
      fireEvent.change(input, { target: { value: 'a' } })
    })

    // Advance time by 250ms (less than 300ms debounce)
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(mockOnChange).not.toHaveBeenCalled()

    // Type second character (should reset the timer)
    act(() => {
      fireEvent.change(input, { target: { value: 'ab' } })
    })

    // Advance time by another 250ms (total 500ms, but timer was reset)
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(mockOnChange).not.toHaveBeenCalled()

    // Now advance by the remaining 50ms to complete the 300ms from the last keystroke
    act(() => {
      vi.advanceTimersByTime(50)
    })

    // onChange should now be called with the final value
    expect(mockOnChange).toHaveBeenCalledTimes(1)
    expect(mockOnChange).toHaveBeenCalledWith('ab', 'contains')
  })

  it('should apply operator changes immediately without debouncing', async () => {
    const mockOnChange = vi.fn()
    const mockOnClear = vi.fn()

    render(
      <TestWrapper
        value="test"
        onChangeMock={mockOnChange}
        onClearMock={mockOnClear}
        placeholder="Test filter"
      />
    )

    // Click the "Starts with" operator button
    const startsWithButton = screen.getByText('Starts with')
    act(() => {
      fireEvent.click(startsWithButton)
    })

    // Operator change should be applied immediately (no debouncing)
    expect(mockOnChange).toHaveBeenCalledTimes(1)
    expect(mockOnChange).toHaveBeenCalledWith('test', 'startsWith')

    // Advance timers to ensure no additional calls are made
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(mockOnChange).toHaveBeenCalledTimes(1)
  })

  it('should not debounce clear operations', async () => {
    const mockOnChange = vi.fn()
    const mockOnClear = vi.fn()

    render(
      <TestWrapper
        value="test"
        onChangeMock={mockOnChange}
        onClearMock={mockOnClear}
        placeholder="Test filter"
      />
    )

    // Click the clear button
    const clearButton = screen.getByText('Clear Filter')
    act(() => {
      fireEvent.click(clearButton)
    })

    // Clear should be called immediately
    expect(mockOnClear).toHaveBeenCalledTimes(1)

    // Advance timers to ensure no additional calls are made
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(mockOnClear).toHaveBeenCalledTimes(1)
  })

  it('should handle multiple rapid input sequences correctly', async () => {
    const mockOnChange = vi.fn()
    const mockOnClear = vi.fn()

    render(
      <TestWrapper
        value=""
        onChangeMock={mockOnChange}
        onClearMock={mockOnClear}
        placeholder="Test filter"
      />
    )

    const input = screen.getByRole('textbox')

    // First rapid sequence
    act(() => {
      fireEvent.change(input, { target: { value: 'first' } })
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    act(() => {
      fireEvent.change(input, { target: { value: 'first sequence' } })
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(mockOnChange).toHaveBeenCalledTimes(1)
    expect(mockOnChange).toHaveBeenCalledWith('first sequence', 'contains')

    mockOnChange.mockClear()

    // Second rapid sequence after a pause
    act(() => {
      vi.advanceTimersByTime(500) // Pause
    })
    act(() => {
      fireEvent.change(input, { target: { value: 'second' } })
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    act(() => {
      fireEvent.change(input, { target: { value: 'second sequence' } })
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(mockOnChange).toHaveBeenCalledTimes(1)
    expect(mockOnChange).toHaveBeenCalledWith('second sequence', 'contains')
  })

  it('should maintain debouncing behavior with different operators', async () => {
    const mockOnChange = vi.fn()
    const mockOnClear = vi.fn()

    render(
      <TestWrapper
        value=""
        onChangeMock={mockOnChange}
        onClearMock={mockOnClear}
        placeholder="Test filter"
      />
    )

    const input = screen.getByRole('textbox')
    const startsWithButton = screen.getByText('Starts with')

    // Change operator first
    act(() => {
      fireEvent.click(startsWithButton)
    })
    expect(mockOnChange).toHaveBeenCalledWith('', 'startsWith')
    mockOnChange.mockClear()

    // Now type with the new operator - should still debounce
    act(() => {
      fireEvent.change(input, { target: { value: 'test' } })
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(mockOnChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(mockOnChange).toHaveBeenCalledTimes(1)
    expect(mockOnChange).toHaveBeenCalledWith('test', 'startsWith')
  })
})
