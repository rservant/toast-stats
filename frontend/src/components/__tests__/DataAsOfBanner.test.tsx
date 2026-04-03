/**
 * Tests for DataAsOfBanner (#214, #277)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, render, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import DataAsOfBanner from '../DataAsOfBanner'

// Mock date formatting
vi.mock('../../utils/dateFormatting', () => ({
  formatDisplayDate: vi.fn((date: string) => date),
}))

const LATEST_DATE = '2026-03-25'

function renderBanner(
  selectedDate: string | null | undefined,
  latestAvailableDate: string | null | undefined = LATEST_DATE
) {
  return render(
    <DataAsOfBanner
      selectedDate={selectedDate}
      latestAvailableDate={latestAvailableDate}
    />
  )
}

describe('DataAsOfBanner (#214, #277)', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders nothing when selectedDate is null', () => {
    renderBanner(null)
    expect(screen.queryByTestId('data-as-of-banner')).not.toBeInTheDocument()
  })

  it('renders nothing when selectedDate is undefined', () => {
    renderBanner(undefined)
    expect(screen.queryByTestId('data-as-of-banner')).not.toBeInTheDocument()
  })

  it('renders nothing when latestAvailableDate is null', () => {
    renderBanner('2026-03-25', null)
    expect(screen.queryByTestId('data-as-of-banner')).not.toBeInTheDocument()
  })

  it('renders "Latest data" when selectedDate matches latest', () => {
    renderBanner('2026-03-25')
    const banner = screen.getByTestId('data-as-of-banner')
    expect(banner).toBeInTheDocument()
    expect(banner.textContent).toContain('Latest data')
  })

  it('renders "Latest data" when selectedDate is newer than latestAvailableDate (#277)', () => {
    renderBanner('2026-03-26', '2026-03-25')
    const banner = screen.getByTestId('data-as-of-banner')
    expect(banner).toBeInTheDocument()
    expect(banner.textContent).toContain('Latest data')
  })

  it('renders historical warning when selectedDate is older than latest', () => {
    renderBanner('2026-01-15')
    const banner = screen.getByTestId('data-as-of-banner')
    expect(banner).toBeInTheDocument()
    expect(banner.textContent).toContain('Viewing historical data')
    expect(banner.textContent).toContain('2026-01-15')
  })

  it('can be dismissed', () => {
    renderBanner('2026-03-25')
    const banner = screen.getByTestId('data-as-of-banner')
    expect(banner).toBeInTheDocument()

    const dismissButton = screen.getByLabelText('Dismiss banner')
    fireEvent.click(dismissButton)

    expect(screen.queryByTestId('data-as-of-banner')).not.toBeInTheDocument()
  })
})
