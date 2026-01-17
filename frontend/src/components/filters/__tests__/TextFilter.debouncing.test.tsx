/**
 * Unit tests for TextFilter debouncing behavior
 *
 * These tests verify that the TextFilter component properly debounces text input
 * with a 300ms delay while applying operator changes immediately.
 *
 * Converted from property-based tests to example-based unit tests per
 * property-testing-guidance.md - debouncing behavior is better tested with
 * specific timing scenarios than random generation.
 *
 * **Validates: Requirements 2.1, 2.4, 2.7**
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

describe('TextFilter Debouncing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('text input debouncing', () => {
    it('should not call onChange during rapid typing within 300ms', () => {
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

      // Type "rapid" character by character with 50ms between each
      act(() => {
        fireEvent.change(input, { target: { value: 'r' } })
      })
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(mockOnChange).not.toHaveBeenCalled()

      act(() => {
        fireEvent.change(input, { target: { value: 'ra' } })
      })
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(mockOnChange).not.toHaveBeenCalled()

      act(() => {
        fireEvent.change(input, { target: { value: 'rap' } })
      })
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(mockOnChange).not.toHaveBeenCalled()

      act(() => {
        fireEvent.change(input, { target: { value: 'rapi' } })
      })
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(mockOnChange).not.toHaveBeenCalled()

      act(() => {
        fireEvent.change(input, { target: { value: 'rapid' } })
      })
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(mockOnChange).not.toHaveBeenCalled()

      // After 300ms from last keystroke, onChange should be called
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith('rapid', 'contains')
    })

    it('should reset debounce timer on each keystroke', () => {
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

      // Advance 250ms (less than 300ms debounce)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(mockOnChange).not.toHaveBeenCalled()

      // Type second character (resets timer)
      act(() => {
        fireEvent.change(input, { target: { value: 'ab' } })
      })

      // Advance another 250ms (total 500ms, but timer was reset)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(mockOnChange).not.toHaveBeenCalled()

      // Advance remaining 50ms to complete 300ms from last keystroke
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith('ab', 'contains')
    })

    it('should call onChange exactly once after 300ms delay', () => {
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

      act(() => {
        fireEvent.change(input, { target: { value: 'test' } })
      })

      // Wait for debounce
      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith('test', 'contains')

      // Advance more time - should not call again
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('operator changes', () => {
    it('should apply operator changes immediately without debouncing', () => {
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

      // Click "Starts with" operator button
      const startsWithButton = screen.getByText('Starts with')
      act(() => {
        fireEvent.click(startsWithButton)
      })

      // Should be called immediately
      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith('test', 'startsWith')

      // Advance timers - should not trigger additional calls
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    it('should maintain debouncing after operator change', () => {
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

      // Type with new operator - should still debounce
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

  describe('clear operations', () => {
    it('should not debounce clear operations', () => {
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

      // Click clear button
      const clearButton = screen.getByText('Clear Filter')
      act(() => {
        fireEvent.click(clearButton)
      })

      // Should be called immediately
      expect(mockOnClear).toHaveBeenCalledTimes(1)

      // Advance timers - should not trigger additional calls
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(mockOnClear).toHaveBeenCalledTimes(1)
    })
  })

  describe('multiple input sequences', () => {
    it('should handle multiple rapid input sequences correctly', () => {
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

      // Pause between sequences
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // Second rapid sequence
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
  })
})
