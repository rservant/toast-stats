import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrajectoryCell } from '../TrajectoryCell'
import { Trajectory } from '../../types/clubHealth'

/**
 * Unit tests for TrajectoryCell component
 * **Feature: club-health-table-integration**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 6.2, 6.4, 10.2**
 */
describe('TrajectoryCell', () => {
  describe('Trajectory Display', () => {
    it('should display Recovering trajectory with upward arrow and brand styling', () => {
      render(<TrajectoryCell trajectory="Recovering" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveTextContent('↗')
      expect(badge).toHaveTextContent('Recovering')
      expect(badge).toHaveClass(
        'bg-tm-loyal-blue-10',
        'text-tm-loyal-blue',
        'border-tm-loyal-blue-30'
      )
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club is recovering - showing positive improvement trends'
      )
    })

    it('should display Stable trajectory with horizontal arrow and brand styling', () => {
      render(<TrajectoryCell trajectory="Stable" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveTextContent('→')
      expect(badge).toHaveTextContent('Stable')
      expect(badge).toHaveClass(
        'bg-tm-cool-gray-20',
        'text-tm-black',
        'border-tm-cool-gray-50'
      )
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club is stable - maintaining consistent performance levels'
      )
    })

    it('should display Declining trajectory with downward arrow and brand styling', () => {
      render(<TrajectoryCell trajectory="Declining" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveTextContent('↘')
      expect(badge).toHaveTextContent('Declining')
      expect(badge).toHaveClass(
        'bg-tm-true-maroon-10',
        'text-tm-true-maroon',
        'border-tm-true-maroon-30'
      )
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club is declining - showing concerning downward trends'
      )
    })

    it('should display Unknown trajectory when trajectory is undefined', () => {
      render(<TrajectoryCell />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveTextContent('?')
      expect(badge).toHaveTextContent('Unknown')
      expect(badge).toHaveClass(
        'bg-tm-cool-gray-20',
        'text-tm-black',
        'border-tm-cool-gray-50'
      )
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club trajectory unknown - trend data not available'
      )
    })
  })

  describe('Icon Display', () => {
    it('should display directional arrows with proper aria-hidden attribute', () => {
      render(<TrajectoryCell trajectory="Recovering" />)

      const icon = screen.getByText('↗')
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveClass('text-sm', 'font-bold')
    })

    it('should display question mark for unknown trajectory', () => {
      render(<TrajectoryCell trajectory={undefined} />)

      const icon = screen.getByText('?')
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Tooltip Functionality', () => {
    it('should display tooltip with trajectory and reasons', () => {
      const reasons = ['Membership increasing', 'DCP goals improving']
      render(<TrajectoryCell trajectory="Recovering" reasons={reasons} />)

      const badge = screen.getByRole('status')
      const tooltip = badge.getAttribute('title')
      expect(tooltip).toContain('Trajectory: Recovering')
      expect(tooltip).toContain(
        'This club is showing positive improvement trends:'
      )
      expect(tooltip).toContain('Trajectory Factors:')
      expect(tooltip).toContain('• Membership increasing')
      expect(tooltip).toContain('• DCP goals improving')
    })

    it('should display tooltip with data age information', () => {
      render(<TrajectoryCell trajectory="Stable" dataAge={24} />)

      const badge = screen.getByRole('status')
      expect(badge.getAttribute('title')).toContain(
        'Data Age: 24 hours (Fresh)'
      )
    })

    it('should display tooltip with all information when provided', () => {
      const reasons = ['Declining membership', 'Missing DCP goals']
      render(
        <TrajectoryCell trajectory="Declining" reasons={reasons} dataAge={96} />
      )

      const badge = screen.getByRole('status')
      const tooltip = badge.getAttribute('title')
      expect(tooltip).toContain('Trajectory: Declining')
      expect(tooltip).toContain('Factors:')
      expect(tooltip).toContain('• Declining membership')
      expect(tooltip).toContain('• Missing DCP goals')
      expect(tooltip).toContain('Data Age: 96 hours (Recent)')
    })
  })

  describe('Data Freshness Indicators', () => {
    it('should show fresh indicator for data <= 24 hours', () => {
      render(<TrajectoryCell trajectory="Recovering" dataAge={18} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-green-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Fresh. Last updated 18 hours ago'
      )
    })

    it('should show recent indicator for data <= 7 days', () => {
      render(<TrajectoryCell trajectory="Recovering" dataAge={120} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-yellow-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Recent. Last updated 120 hours ago'
      )
    })

    it('should show stale indicator for data <= 14 days', () => {
      render(<TrajectoryCell trajectory="Recovering" dataAge={300} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-orange-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Stale. Last updated 300 hours ago'
      )
    })

    it('should show outdated indicator for data > 14 days', () => {
      render(<TrajectoryCell trajectory="Recovering" dataAge={500} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-red-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Outdated. Last updated 500 hours ago'
      )
    })

    it('should not show freshness indicator when dataAge is undefined', () => {
      render(<TrajectoryCell trajectory="Recovering" />)

      expect(screen.queryByText('●')).not.toBeInTheDocument()
    })

    it('should include freshness in aria-label when present', () => {
      render(<TrajectoryCell trajectory="Recovering" dataAge={6} />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club is recovering - showing positive improvement trends. Data is fresh'
      )
    })
  })

  describe('Accessibility Features', () => {
    it('should have proper ARIA role and labels', () => {
      render(<TrajectoryCell trajectory="Stable" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveAttribute('aria-label')
      expect(badge).toHaveAttribute('role', 'status')
    })

    it('should meet minimum touch target size requirements', () => {
      render(<TrajectoryCell trajectory="Recovering" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    })

    it('should use Toastmasters brand font family', () => {
      render(<TrajectoryCell trajectory="Recovering" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveClass('font-tm-body')
    })

    it('should be keyboard accessible with cursor-help', () => {
      render(<TrajectoryCell trajectory="Recovering" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveClass('cursor-help')
    })
  })

  describe('Custom Styling', () => {
    it('should apply custom className when provided', () => {
      render(
        <TrajectoryCell trajectory="Recovering" className="custom-class" />
      )

      const container = screen.getByRole('status').parentElement
      expect(container).toHaveClass('custom-class')
    })

    it('should handle empty reasons array gracefully', () => {
      render(<TrajectoryCell trajectory="Recovering" reasons={[]} />)

      const badge = screen.getByRole('status')
      const tooltip = badge.getAttribute('title')
      expect(tooltip).toContain('Trajectory: Recovering')
      expect(tooltip).toContain(
        'This club is showing positive improvement trends:'
      )
      expect(tooltip).toContain('Positive indicators may include:')
    })
  })

  describe('Edge Cases', () => {
    it('should handle all trajectory values correctly', () => {
      const trajectories: (Trajectory | undefined)[] = [
        'Recovering',
        'Stable',
        'Declining',
        undefined,
      ]

      trajectories.forEach(trajectory => {
        const { unmount } = render(<TrajectoryCell trajectory={trajectory} />)
        const badge = screen.getByRole('status')
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveTextContent(trajectory || 'Unknown')
        unmount()
      })
    })

    it('should handle zero dataAge correctly', () => {
      render(<TrajectoryCell trajectory="Recovering" dataAge={0} />)

      const badge = screen.getByRole('status')
      expect(badge.getAttribute('title')).toContain('Data Age: 0 hours (Fresh)')
    })

    it('should handle very large dataAge values', () => {
      render(<TrajectoryCell trajectory="Recovering" dataAge={2000} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-red-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Outdated. Last updated 2000 hours ago'
      )
    })

    it('should properly space icon and text', () => {
      render(<TrajectoryCell trajectory="Recovering" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveClass('gap-1')

      const textSpan = screen.getByText('Recovering')
      expect(textSpan).toHaveClass('ml-1')
    })
  })
})
