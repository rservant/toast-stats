import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataFreshnessIndicator } from '../DataFreshnessIndicator'
import { HealthDataStatus } from '../filters/types'

describe('DataFreshnessIndicator', () => {
  const mockHealthDataStatus: HealthDataStatus = {
    isLoading: false,
    isError: false,
    isStale: true,
    isOutdated: false,
    lastUpdated: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
  }

  it('should not render when data is fresh', () => {
    const freshStatus: HealthDataStatus = {
      ...mockHealthDataStatus,
      isStale: false,
      lastUpdated: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    }

    const { container } = render(
      <DataFreshnessIndicator healthDataStatus={freshStatus} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('should render stale data warning', () => {
    render(<DataFreshnessIndicator healthDataStatus={mockHealthDataStatus} />)

    expect(screen.getByText('Stale Health Data')).toBeInTheDocument()
    expect(
      screen.getByText(/Health classifications are more than 24 hours old/)
    ).toBeInTheDocument()
  })

  it('should render outdated data warning', () => {
    const outdatedStatus: HealthDataStatus = {
      ...mockHealthDataStatus,
      isOutdated: true,
      lastUpdated: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
    }

    render(<DataFreshnessIndicator healthDataStatus={outdatedStatus} />)

    expect(screen.getByText('Outdated Health Data')).toBeInTheDocument()
    expect(
      screen.getByText(/Health classifications are more than 14 days old/)
    ).toBeInTheDocument()
  })

  it('should show refresh button for outdated data', () => {
    const mockRefresh = vi.fn()
    const outdatedStatus: HealthDataStatus = {
      ...mockHealthDataStatus,
      isOutdated: true,
      lastUpdated: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
    }

    render(
      <DataFreshnessIndicator
        healthDataStatus={outdatedStatus}
        onRefresh={mockRefresh}
      />
    )

    const refreshButton = screen.getByText('Refresh Health Data')
    expect(refreshButton).toBeInTheDocument()

    fireEvent.click(refreshButton)
    expect(mockRefresh).toHaveBeenCalledOnce()
  })

  it('should show loading state during refresh', () => {
    const outdatedStatus: HealthDataStatus = {
      ...mockHealthDataStatus,
      isOutdated: true,
      lastUpdated: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
    }

    render(
      <DataFreshnessIndicator
        healthDataStatus={outdatedStatus}
        isRefreshing={true}
      />
    )

    expect(screen.getByText('Refreshing health data...')).toBeInTheDocument()
  })

  it('should display formatted last updated time', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const statusWithTime: HealthDataStatus = {
      ...mockHealthDataStatus,
      lastUpdated: twoDaysAgo.toISOString(),
    }

    render(<DataFreshnessIndicator healthDataStatus={statusWithTime} />)

    expect(screen.getByText(/Last updated: 2 days ago/)).toBeInTheDocument()
  })

  it('should show freshness badge with correct styling', () => {
    render(<DataFreshnessIndicator healthDataStatus={mockHealthDataStatus} />)

    const badge = screen.getByText('Recent')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('text-yellow-600')
  })
})
