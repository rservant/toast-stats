import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  FormField,
  FormLabel,
  FormInput,
  FormTextarea,
  FormSelect,
  FormCheckbox,
  FormRadio,
  FormHelperText,
  FormErrorMessage,
} from '../index'

describe('Form Components', () => {
  describe('FormField', () => {
    it('renders children correctly', () => {
      render(
        <FormField>
          <div data-testid="child">Test content</div>
        </FormField>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('applies error class when error prop is true', () => {
      const { container } = render(
        <FormField error>
          <div>Content</div>
        </FormField>
      )

      expect(container.firstChild).toHaveClass('tm-form-field--error')
    })
  })

  describe('FormLabel', () => {
    it('renders label text correctly', () => {
      render(<FormLabel>Test Label</FormLabel>)

      expect(screen.getByText('Test Label')).toBeInTheDocument()
    })

    it('shows required indicator when required prop is true', () => {
      render(<FormLabel required>Required Label</FormLabel>)

      expect(screen.getByLabelText('required field')).toBeInTheDocument()
    })
  })

  describe('FormInput', () => {
    it('renders input with correct classes', () => {
      render(<FormInput data-testid="test-input" />)

      const input = screen.getByTestId('test-input')
      expect(input).toHaveClass('tm-form-input', 'tm-body', 'tm-form-input--md')
    })

    it('applies error class when error prop is true', () => {
      render(<FormInput data-testid="test-input" error />)

      const input = screen.getByTestId('test-input')
      expect(input).toHaveClass('tm-form-input--error')
    })

    it('handles value changes', () => {
      const handleChange = vi.fn()
      render(<FormInput data-testid="test-input" onChange={handleChange} />)

      const input = screen.getByTestId('test-input')
      fireEvent.change(input, { target: { value: 'test value' } })

      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('FormTextarea', () => {
    it('renders textarea with correct classes', () => {
      render(<FormTextarea data-testid="test-textarea" />)

      const textarea = screen.getByTestId('test-textarea')
      expect(textarea).toHaveClass('tm-form-textarea', 'tm-body')
    })
  })

  describe('FormSelect', () => {
    it('renders select with options', () => {
      render(
        <FormSelect data-testid="test-select">
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </FormSelect>
      )

      const select = screen.getByTestId('test-select')
      expect(select).toBeInTheDocument()
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
    })

    it('renders placeholder when provided', () => {
      render(
        <FormSelect data-testid="test-select" placeholder="Choose option">
          <option value="1">Option 1</option>
        </FormSelect>
      )

      expect(screen.getByText('Choose option')).toBeInTheDocument()
    })
  })

  describe('FormCheckbox', () => {
    it('renders checkbox with label', () => {
      render(<FormCheckbox label="Test Checkbox" />)

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
      expect(screen.getByText('Test Checkbox')).toBeInTheDocument()
    })

    it('handles checked state changes', () => {
      const handleChange = vi.fn()
      render(<FormCheckbox label="Test Checkbox" onChange={handleChange} />)

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('FormRadio', () => {
    it('renders radio button with label', () => {
      render(<FormRadio label="Test Radio" name="test" />)

      expect(screen.getByRole('radio')).toBeInTheDocument()
      expect(screen.getByText('Test Radio')).toBeInTheDocument()
    })
  })

  describe('FormHelperText', () => {
    it('renders helper text with default variant', () => {
      render(<FormHelperText>Helper text</FormHelperText>)

      const helperText = screen.getByText('Helper text')
      expect(helperText).toBeInTheDocument()
      expect(helperText).toHaveClass('tm-form-helper-text--default')
    })

    it('renders helper text with error variant', () => {
      render(<FormHelperText variant="error">Error text</FormHelperText>)

      const helperText = screen.getByText('Error text')
      expect(helperText).toHaveClass('tm-form-helper-text--error')
    })
  })

  describe('FormErrorMessage', () => {
    it('renders error message with alert role', () => {
      render(<FormErrorMessage>Error message</FormErrorMessage>)

      const errorMessage = screen.getByRole('alert')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveTextContent('Error message')
    })

    it('does not render when children is empty', () => {
      const { container } = render(<FormErrorMessage />)

      expect(container.firstChild).toBeNull()
    })
  })
})
