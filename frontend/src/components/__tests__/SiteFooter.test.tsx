import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteFooter from '../SiteFooter'
import { DarkModeProvider } from '../../contexts/DarkModeContext'

function renderFooter() {
  return render(
    <DarkModeProvider>
      <SiteFooter />
    </DarkModeProvider>
  )
}

describe('SiteFooter', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    const mockStorage: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key in mockStorage ? mockStorage[key] : null),
      setItem: (key: string, value: string) => {
        mockStorage[key] = String(value)
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      },
      clear: () => {
        for (const k of Object.keys(mockStorage)) delete mockStorage[k]
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

  it('renders a footer with contentinfo role', () => {
    renderFooter()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('contains the unofficial disclaimer text', () => {
    renderFooter()
    expect(screen.getByText(/unofficial tool/i)).toBeInTheDocument()
    expect(
      screen.getByText(/not affiliated with toastmasters international/i)
    ).toBeInTheDocument()
  })

  it('contains a link to the GitHub repository', () => {
    renderFooter()
    const repoLink = screen.getByRole('link', { name: /source code/i })
    expect(repoLink).toHaveAttribute(
      'href',
      'https://github.com/rservant/toast-stats'
    )
    expect(repoLink).toHaveAttribute('target', '_blank')
    expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('contains a link to file issues / feedback', () => {
    renderFooter()
    const feedbackLink = screen.getByRole('link', { name: /feedback/i })
    expect(feedbackLink).toHaveAttribute(
      'href',
      'https://github.com/rservant/toast-stats/issues'
    )
    expect(feedbackLink).toHaveAttribute('target', '_blank')
    expect(feedbackLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('contains attribution text', () => {
    renderFooter()
    expect(screen.getByText(/built by/i)).toBeInTheDocument()
  })

  it('displays the app version', () => {
    renderFooter()
    const versionEl = screen.getByTestId('app-version')
    expect(versionEl).toBeInTheDocument()
    // In test environment, __APP_VERSION__ is 'dev' (Vite define fallback)
    expect(versionEl.textContent).toBeTruthy()
  })
})
