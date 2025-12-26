import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoadingSkeleton, Spinner } from '../LoadingSkeleton'
import { ErrorDisplay, EmptyState } from '../ErrorDisplay'

describe('LoadingSkeleton', () => {
  it('should render card skeleton with loading state', () => {
    render(<LoadingSkeleton variant="card" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading content...')).toBeInTheDocument()
  })

  it('should render table skeleton', () => {
    render(<LoadingSkeleton variant="table" count={3} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading table data...')).toBeInTheDocument()
  })

  it('should render chart skeleton', () => {
    render(<LoadingSkeleton variant="chart" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading chart data...')).toBeInTheDocument()
  })

  it('should render stat skeleton', () => {
    render(<LoadingSkeleton variant="stat" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading statistics...')).toBeInTheDocument()
  })
})

describe('Spinner', () => {
  it('should render spinner with default size', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should render small spinner', () => {
    const { container } = render(<Spinner size="sm" />)
    const spinner = container.querySelector('.h-4.w-4')
    expect(spinner).toBeInTheDocument()
  })

  it('should render large spinner', () => {
    const { container } = render(<Spinner size="lg" />)
    const spinner = container.querySelector('.h-12.w-12')
    expect(spinner).toBeInTheDocument()
  })
})

describe('ErrorDisplay', () => {
  it('should render error message', () => {
    const error = new Error('Test error message')
    render(<ErrorDisplay error={error} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Test error message/i)).toBeInTheDocument()
  })

  it('should render error with retry button', () => {
    const onRetry = vi.fn()
    const error = new Error('Network error')
    render(<ErrorDisplay error={error} onRetry={onRetry} />)

    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('should detect network errors', () => {
    const error = new Error('Network connection failed')
    render(<ErrorDisplay error={error} />)

    expect(
      screen.getByText(/unable to connect to the server/i)
    ).toBeInTheDocument()
  })

  it('should detect not found errors', () => {
    const error = new Error('404 not found')
    render(<ErrorDisplay error={error} />)

    expect(screen.getByText(/could not be found/i)).toBeInTheDocument()
  })

  it('should render inline variant', () => {
    const error = new Error('Inline error')
    const { container } = render(
      <ErrorDisplay error={error} variant="inline" />
    )

    expect(container.querySelector('.text-red-600')).toBeInTheDocument()
  })

  it('should show technical details when requested', () => {
    const error = new Error('Detailed error message')
    render(<ErrorDisplay error={error} showDetails={true} />)

    const details = screen.getByText('Technical Details')
    expect(details).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('should render empty state message', () => {
    render(<EmptyState title="No Data" message="No data available" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('No Data')).toBeInTheDocument()
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('should render action button', () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="No Data"
        message="No data available"
        action={{ label: 'Load Data', onClick }}
      />
    )

    const button = screen.getByRole('button', { name: /load data/i })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('should render search icon', () => {
    const { container } = render(
      <EmptyState
        title="No Results"
        message="Try another search"
        icon="search"
      />
    )

    // Check that an SVG icon is rendered
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should render backfill icon', () => {
    const { container } = render(
      <EmptyState title="No Data" message="Start backfill" icon="backfill" />
    )

    // Check that an SVG icon is rendered
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
