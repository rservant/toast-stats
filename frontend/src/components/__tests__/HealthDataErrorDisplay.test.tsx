import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HealthDataErrorDisplay } from '../HealthDataErrorDisplay'
import { HealthDataStatus } from '../filters/types'

describe('HealthDataErrorDisplay', () => {
  const mockHealthDataStatus: HealthDataStatus = {
    isLoading: false,
    isError: true,
    isStale: false,
    isOutdated: false,
    errorMessage: 'Network error occurred',
  }

  it('should not render when there is no error', () => {
    const noErrorStatus: HealthDataStatus = {
      ...mockHealthDataStatus,
      isError: false,
    }

    const { container } = render(
      <HealthDataErrorDisplay healthDataStatus={noErrorStatus} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('should render error message when there is an error', () => {
    render(<HealthDataErrorDisplay healthDataStatus={mockHealthDataStatus} />)

    expect(screen.getByText('Connection Error')).toBeInTheDocument()
    expect(
      screen.getByText(/Unable to connect to the health data service/)
    ).toBeInTheDocument()
  })

  it('should show retry button when retry is available', () => {
    const mockRetry = vi.fn()

    render(
      <HealthDataErrorDisplay
        healthDataStatus={mockHealthDataStatus}
        onRetryHealth={mockRetry}
        canRetryHealth={true}
      />
    )

    const retryButton = screen.getByText('Retry Health Data')
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(mockRetry).toHaveBeenCalledOnce()
  })

  it('should show loading state during refresh', () => {
    render(
      <HealthDataErrorDisplay
        healthDataStatus={mockHealthDataStatus}
        isRefreshing={true}
      />
    )

    expect(screen.getByText('Refreshing health data...')).toBeInTheDocument()
  })

  it('should show graceful degradation message', () => {
    render(<HealthDataErrorDisplay healthDataStatus={mockHealthDataStatus} />)

    expect(
      screen.getByText(/The club table will continue to function/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Health status and trajectory columns will show "Unknown"/
      )
    ).toBeInTheDocument()
  })

  it('should handle different error types correctly', () => {
    const serverErrorStatus: HealthDataStatus = {
      ...mockHealthDataStatus,
      errorMessage: '500 Internal Server Error',
    }

    render(<HealthDataErrorDisplay healthDataStatus={serverErrorStatus} />)

    expect(screen.getByText('Server Error')).toBeInTheDocument()
    expect(
      screen.getByText(/The health data service is temporarily unavailable/)
    ).toBeInTheDocument()
  })

  it('should show technical details when expanded', () => {
    render(<HealthDataErrorDisplay healthDataStatus={mockHealthDataStatus} />)

    const detailsToggle = screen.getByText('Technical Details')
    fireEvent.click(detailsToggle)

    expect(screen.getByText('Network error occurred')).toBeInTheDocument()
  })
})
