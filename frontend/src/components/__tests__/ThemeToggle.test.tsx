/**
 * ThemeToggle Component Tests (#120)
 *
 * Tests for the dark mode toggle button component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { DarkModeProvider } from '../../contexts/DarkModeContext'
import ThemeToggle from '../ThemeToggle'

function renderWithProvider() {
  return render(
    <DarkModeProvider>
      <ThemeToggle />
    </DarkModeProvider>
  )
}

describe('ThemeToggle (#120)', () => {
  let mockStorage: Record<string, string>

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')

    // Stub localStorage since jsdom may not provide it
    mockStorage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key in mockStorage ? mockStorage[key] : null),
      setItem: (key: string, value: string) => {
        mockStorage[key] = String(value)
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      },
      clear: () => {
        mockStorage = {}
      },
      get length() {
        return Object.keys(mockStorage).length
      },
      key: (i: number) => Object.keys(mockStorage)[i] ?? null,
    })

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    )
  })

  it('should render a button with accessible label', () => {
    renderWithProvider()
    const button = screen.getByRole('button', { name: /switch to dark mode/i })
    expect(button).toBeInTheDocument()
  })

  it('should toggle theme on click', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    const button = screen.getByRole('button', { name: /switch to dark mode/i })
    await user.click(button)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // After toggling to dark, the label should now say "switch to light mode"
    const lightButton = screen.getByRole('button', {
      name: /switch to light mode/i,
    })
    expect(lightButton).toBeInTheDocument()
  })

  it('should show moon icon in light mode and sun icon in dark mode', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    // In light mode, should show moon icon (indicating what clicking will do)
    expect(screen.getByTestId('moon-icon')).toBeInTheDocument()

    await user.click(screen.getByRole('button'))

    // In dark mode, should show sun icon
    expect(screen.getByTestId('sun-icon')).toBeInTheDocument()
  })

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup()
    renderWithProvider()

    const button = screen.getByRole('button')
    button.focus()
    await user.keyboard('{Enter}')

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
