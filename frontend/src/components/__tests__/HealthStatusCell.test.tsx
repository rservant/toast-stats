import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthStatusCell } from '../HealthStatusCell'
import { HealthStatus } from '../../types/clubHealth'

/**
 * Unit tests for HealthStatusCell component
 * **Feature: club-health-table-integration**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.3, 10.1**
 */
describe('HealthStatusCell', () => {
  describe('Health Status Display', () => {
    it('should display Thriving status with Toastmasters brand styling', () => {
      render(<HealthStatusCell healthStatus="Thriving" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveTextContent('Thriving')
      expect(badge).toHaveClass(
        'bg-tm-loyal-blue-10',
        'text-tm-loyal-blue',
        'border-tm-loyal-blue-30'
      )
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club is thriving - performing well across all metrics'
      )
    })

    it('should display Vulnerable status with Toastmasters brand styling', () => {
      render(<HealthStatusCell healthStatus="Vulnerable" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveTextContent('Vulnerable')
      expect(badge).toHaveClass(
        'bg-tm-happy-yellow-20',
        'text-tm-black',
        'border-tm-happy-yellow-60'
      )
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club is vulnerable - showing warning signs that need attention'
      )
    })

    it('should display Intervention Required status with Toastmasters brand styling', () => {
      render(<HealthStatusCell healthStatus="Intervention Required" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveTextContent('Intervention Required')
      expect(badge).toHaveClass(
        'bg-tm-true-maroon-10',
        'text-tm-true-maroon',
        'border-tm-true-maroon-30'
      )
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club requires immediate intervention - critical issues need addressing'
      )
    })

    it('should display Unknown status when healthStatus is undefined', () => {
      render(<HealthStatusCell />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveTextContent('Unknown')
      expect(badge).toHaveClass(
        'bg-tm-cool-gray-20',
        'text-tm-black',
        'border-tm-cool-gray-50'
      )
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club health status unknown - data not available'
      )
    })
  })

  describe('Tooltip Functionality', () => {
    it('should display tooltip with health status and reasons', () => {
      const reasons = ['Good membership growth', 'Meeting DCP goals']
      render(<HealthStatusCell healthStatus="Thriving" reasons={reasons} />)

      const badge = screen.getByRole('status')
      const tooltip = badge.getAttribute('title')
      expect(tooltip).toContain('Health Status: Thriving')
      expect(tooltip).toContain(
        'This club is performing well across all key metrics:'
      )
      expect(tooltip).toContain('Classification Factors:')
      expect(tooltip).toContain('• Good membership growth')
      expect(tooltip).toContain('• Meeting DCP goals')
    })

    it('should display tooltip with data age information', () => {
      render(<HealthStatusCell healthStatus="Vulnerable" dataAge={12} />)

      const badge = screen.getByRole('status')
      expect(badge.getAttribute('title')).toContain(
        'Data Age: 12 hours (Fresh)'
      )
    })

    it('should display tooltip with all information when provided', () => {
      const reasons = ['Declining membership']
      render(
        <HealthStatusCell
          healthStatus="Intervention Required"
          reasons={reasons}
          dataAge={48}
        />
      )

      const badge = screen.getByRole('status')
      const tooltip = badge.getAttribute('title')
      expect(tooltip).toContain('Health Status: Intervention Required')
      expect(tooltip).toContain('Classification Factors:')
      expect(tooltip).toContain('• Declining membership')
      expect(tooltip).toContain('Data Age: 48 hours (Recent)')
    })
  })

  describe('Data Freshness Indicators', () => {
    it('should show fresh indicator for data <= 24 hours', () => {
      render(<HealthStatusCell healthStatus="Thriving" dataAge={12} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-green-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Fresh. Last updated 12 hours ago'
      )
    })

    it('should show recent indicator for data <= 7 days', () => {
      render(<HealthStatusCell healthStatus="Thriving" dataAge={72} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-yellow-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Recent. Last updated 72 hours ago'
      )
    })

    it('should show stale indicator for data <= 14 days', () => {
      render(<HealthStatusCell healthStatus="Thriving" dataAge={240} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-orange-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Stale. Last updated 240 hours ago'
      )
    })

    it('should show outdated indicator for data > 14 days', () => {
      render(<HealthStatusCell healthStatus="Thriving" dataAge={400} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-red-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Outdated. Last updated 400 hours ago'
      )
    })

    it('should not show freshness indicator when dataAge is undefined', () => {
      render(<HealthStatusCell healthStatus="Thriving" />)

      expect(screen.queryByText('●')).not.toBeInTheDocument()
    })

    it('should include freshness in aria-label when present', () => {
      render(<HealthStatusCell healthStatus="Thriving" dataAge={12} />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveAttribute(
        'aria-label',
        'Club is thriving - performing well across all metrics. Data is fresh'
      )
    })
  })

  describe('Accessibility Features', () => {
    it('should have proper ARIA role and labels', () => {
      render(<HealthStatusCell healthStatus="Vulnerable" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveAttribute('aria-label')
      expect(badge).toHaveAttribute('role', 'status')
    })

    it('should meet minimum touch target size requirements', () => {
      render(<HealthStatusCell healthStatus="Thriving" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    })

    it('should use Toastmasters brand font family', () => {
      render(<HealthStatusCell healthStatus="Thriving" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveClass('font-tm-body')
    })

    it('should be keyboard accessible with cursor-help', () => {
      render(<HealthStatusCell healthStatus="Thriving" />)

      const badge = screen.getByRole('status')
      expect(badge).toHaveClass('cursor-help')
    })
  })

  describe('Custom Styling', () => {
    it('should apply custom className when provided', () => {
      render(
        <HealthStatusCell healthStatus="Thriving" className="custom-class" />
      )

      const container = screen.getByRole('status').parentElement
      expect(container).toHaveClass('custom-class')
    })

    it('should handle empty reasons array gracefully', () => {
      render(<HealthStatusCell healthStatus="Thriving" reasons={[]} />)

      const badge = screen.getByRole('status')
      const tooltip = badge.getAttribute('title')
      expect(tooltip).toContain('Health Status: Thriving')
      expect(tooltip).toContain(
        'This club is performing well across all key metrics:'
      )
      expect(tooltip).toContain('Typical indicators:')
    })
  })

  describe('Edge Cases', () => {
    it('should handle all health status values correctly', () => {
      const statuses: (HealthStatus | undefined)[] = [
        'Thriving',
        'Vulnerable',
        'Intervention Required',
        undefined,
      ]

      statuses.forEach(status => {
        const { unmount } = render(<HealthStatusCell healthStatus={status} />)
        const badge = screen.getByRole('status')
        expect(badge).toBeInTheDocument()
        expect(badge).toHaveTextContent(status || 'Unknown')
        unmount()
      })
    })

    it('should handle zero dataAge correctly', () => {
      render(<HealthStatusCell healthStatus="Thriving" dataAge={0} />)

      const badge = screen.getByRole('status')
      expect(badge.getAttribute('title')).toContain('Data Age: 0 hours (Fresh)')
    })

    it('should handle very large dataAge values', () => {
      render(<HealthStatusCell healthStatus="Thriving" dataAge={1000} />)

      const freshness = screen.getByText('●')
      expect(freshness).toHaveClass('text-red-600')
      expect(freshness).toHaveAttribute(
        'aria-label',
        'Data freshness: Outdated. Last updated 1000 hours ago'
      )
    })
  })
})
