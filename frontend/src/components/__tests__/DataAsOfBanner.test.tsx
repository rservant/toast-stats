/**
 * Tests for DataAsOfBanner (#214)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, render, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import DataAsOfBanner from '../DataAsOfBanner'

// Mock CDN manifest
vi.mock('../../services/cdn', () => ({
  fetchCdnManifest: vi.fn(() =>
    Promise.resolve({
      latestSnapshotDate: '2026-03-25',
      generatedAt: '2026-03-25T12:00:00Z',
    })
  ),
}))

// Mock date formatting
vi.mock('../../utils/dateFormatting', () => ({
  formatDisplayDate: vi.fn((date: string) => date),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderBanner(selectedDate: string | null | undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <DataAsOfBanner selectedDate={selectedDate} />
    </QueryClientProvider>
  )
}

describe('DataAsOfBanner (#214)', () => {
  afterEach(() => {
    cleanup()
    queryClient.clear()
  })

  it('renders nothing when selectedDate is null', () => {
    renderBanner(null)
    expect(screen.queryByTestId('data-as-of-banner')).not.toBeInTheDocument()
  })

  it('renders nothing when selectedDate is undefined', () => {
    renderBanner(undefined)
    expect(screen.queryByTestId('data-as-of-banner')).not.toBeInTheDocument()
  })

  it('renders "Latest data" when selectedDate matches latest', async () => {
    renderBanner('2026-03-25')
    const banner = await screen.findByTestId('data-as-of-banner')
    expect(banner).toBeInTheDocument()
    expect(banner.textContent).toContain('Latest data')
  })

  it('renders historical warning when selectedDate differs from latest', async () => {
    renderBanner('2026-01-15')
    const banner = await screen.findByTestId('data-as-of-banner')
    expect(banner).toBeInTheDocument()
    expect(banner.textContent).toContain('Viewing historical data')
    expect(banner.textContent).toContain('2026-01-15')
  })

  it('can be dismissed', async () => {
    renderBanner('2026-03-25')
    const banner = await screen.findByTestId('data-as-of-banner')
    expect(banner).toBeInTheDocument()

    const dismissButton = screen.getByLabelText('Dismiss banner')
    fireEvent.click(dismissButton)

    expect(screen.queryByTestId('data-as-of-banner')).not.toBeInTheDocument()
  })
})
