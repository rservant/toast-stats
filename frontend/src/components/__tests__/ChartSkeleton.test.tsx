import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChartSkeleton } from '../ChartSkeleton'

describe('ChartSkeleton (#223)', () => {
  it('should render with loading status role', () => {
    render(<ChartSkeleton />)
    expect(screen.getByRole('status')).toBeDefined()
  })

  it('should display loading text', () => {
    render(<ChartSkeleton />)
    expect(screen.getByText('Loading chart…')).toBeDefined()
  })

  it('should accept custom height', () => {
    render(<ChartSkeleton height={500} />)
    const el = screen.getByRole('status')
    expect(el.style.height).toBe('500px')
  })

  it('should render placeholder bars', () => {
    const { container } = render(<ChartSkeleton />)
    const bars = container.querySelectorAll('.chart-skeleton__bar')
    expect(bars.length).toBe(7)
  })
})
