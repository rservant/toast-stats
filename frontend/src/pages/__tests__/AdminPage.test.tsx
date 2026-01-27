import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import AdminPage from '../AdminPage'
import { renderWithProviders } from '../../__tests__/test-utils'

describe('AdminPage', () => {
  // Clean up sessionStorage after each test
  afterEach(() => {
    sessionStorage.clear()
  })

  describe('Authorization', () => {
    // Note: Authentication was removed per production-maintenance steering document
    // This is a trusted small-group application, so the admin page is accessible without login
    it('should render admin page regardless of authentication state', () => {
      renderWithProviders(<AdminPage />, {
        isAuthenticated: false,
        initialEntries: ['/admin'],
      })

      // Admin page should be visible without authentication
      // per production-maintenance steering document
      expect(screen.getByText('Admin Panel')).toBeInTheDocument()
    })

    it('should render admin page when user is authenticated', () => {
      renderWithProviders(<AdminPage />, { isAuthenticated: true })

      expect(screen.getByText('Admin Panel')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Manage snapshots, analytics, and monitor system health'
        )
      ).toBeInTheDocument()
    })
  })

  describe('Page Structure', () => {
    beforeEach(() => {
      sessionStorage.setItem('auth_token', 'test-token')
    })

    it('should render the admin page with correct title', () => {
      renderWithProviders(<AdminPage />)

      expect(screen.getByText('Admin Panel')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Manage snapshots, analytics, and monitor system health'
        )
      ).toBeInTheDocument()
    })

    it('should render all three main sections', () => {
      renderWithProviders(<AdminPage />)

      // Check for section headings
      expect(screen.getByText('Snapshots')).toBeInTheDocument()
      expect(screen.getByText('Unified Backfill')).toBeInTheDocument()
      expect(screen.getByText('System Health')).toBeInTheDocument()
    })

    it('should render section descriptions', () => {
      renderWithProviders(<AdminPage />)

      expect(
        screen.getByText(
          'Manage data snapshots - view, delete, and regenerate snapshot data'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Manage backfill operations - data collection and analytics generation'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Monitor system performance - cache hit rates, response times, and pending operations'
        )
      ).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    beforeEach(() => {
      sessionStorage.setItem('auth_token', 'test-token')
    })

    it('should render back to home link', () => {
      renderWithProviders(<AdminPage />)

      const backLink = screen.getByText('← Back to Home')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/')
    })

    it('should render quick links section', () => {
      renderWithProviders(<AdminPage />)

      expect(screen.getByText('Quick Links')).toBeInTheDocument()
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
      expect(screen.getByText('District Configuration')).toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
    })

    it('should have correct href for quick links', () => {
      renderWithProviders(<AdminPage />)

      // Find links by their text and check href
      const adminDashboardLink = screen
        .getByText('Admin Dashboard')
        .closest('a')
      const districtConfigLink = screen
        .getByText('District Configuration')
        .closest('a')
      const homeLink = screen.getByText('Home').closest('a')

      expect(adminDashboardLink).toHaveAttribute('href', '/admin/dashboard')
      expect(districtConfigLink).toHaveAttribute('href', '/admin/districts')
      expect(homeLink).toHaveAttribute('href', '/')
    })
  })

  describe('Snapshots Section', () => {
    beforeEach(() => {
      sessionStorage.setItem('auth_token', 'test-token')
    })

    it('should render snapshot summary stats', () => {
      renderWithProviders(<AdminPage />)

      // The updated UI shows summary stats instead of action buttons
      // Use getAllByText since these appear in multiple sections
      expect(screen.getAllByText('Total Snapshots').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Successful').length).toBeGreaterThan(0)
      expect(screen.getByText('Pre-computed')).toBeInTheDocument()
    })

    it('should render snapshot action buttons', () => {
      renderWithProviders(<AdminPage />)

      expect(screen.getByText('Refresh List')).toBeInTheDocument()
      expect(screen.getByText(/Delete Selected/)).toBeInTheDocument()
      expect(screen.getByText('Delete Range')).toBeInTheDocument()
      expect(screen.getByText('Delete All')).toBeInTheDocument()
    })
  })

  describe('Unified Backfill Section', () => {
    beforeEach(() => {
      sessionStorage.setItem('auth_token', 'test-token')
    })

    it('should render backfill configuration controls', () => {
      renderWithProviders(<AdminPage />)

      expect(screen.getByText('Backfill Configuration')).toBeInTheDocument()
      expect(screen.getByText('Job Type')).toBeInTheDocument()
      expect(screen.getByText('Start Backfill')).toBeInTheDocument()
      expect(screen.getByText('Preview')).toBeInTheDocument()
    })

    it('should render job type selector with options', () => {
      renderWithProviders(<AdminPage />)

      const jobTypeSelect = screen.getByLabelText('Job Type')
      expect(jobTypeSelect).toBeInTheDocument()
      expect(jobTypeSelect).toHaveValue('data-collection')
    })

    it('should render snapshot summary stats', () => {
      renderWithProviders(<AdminPage />)

      // The updated UI shows summary stats - use getAllByText since these appear in multiple sections
      expect(screen.getAllByText('Total Snapshots').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Successful').length).toBeGreaterThan(0)
      expect(screen.getByText('Last Completed')).toBeInTheDocument()
    })
  })

  describe('System Health Section', () => {
    beforeEach(() => {
      sessionStorage.setItem('auth_token', 'test-token')
    })

    it('should render system health metrics', () => {
      renderWithProviders(<AdminPage />)

      expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Response Time')).toBeInTheDocument()
      expect(screen.getByText('Pending Operations')).toBeInTheDocument()
      // Use getAllByText since "Total Snapshots" appears in multiple sections
      expect(screen.getAllByText('Total Snapshots').length).toBeGreaterThan(0)
    })

    it('should have refresh metrics button', () => {
      renderWithProviders(<AdminPage />)

      expect(screen.getByText('Refresh Metrics')).toBeInTheDocument()
    })

    it('should have view detailed metrics link', () => {
      renderWithProviders(<AdminPage />)

      // There are multiple "View Detailed Metrics" links
      const viewMetricsLinks = screen.getAllByText('View Detailed Metrics')
      expect(viewMetricsLinks.length).toBeGreaterThan(0)
      expect(viewMetricsLinks[0].closest('a')).toHaveAttribute(
        'href',
        '/admin/dashboard'
      )
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      sessionStorage.setItem('auth_token', 'test-token')
    })

    it('should have proper section aria labels', () => {
      renderWithProviders(<AdminPage />)

      // Check that sections have proper aria-labelledby attributes
      const snapshotsSection = screen.getByText('Snapshots').closest('section')
      const backfillSection = screen
        .getByText('Unified Backfill')
        .closest('section')
      const healthSection = screen.getByText('System Health').closest('section')

      expect(snapshotsSection).toHaveAttribute(
        'aria-labelledby',
        'section-snapshots'
      )
      expect(backfillSection).toHaveAttribute(
        'aria-labelledby',
        'section-unified-backfill'
      )
      expect(healthSection).toHaveAttribute(
        'aria-labelledby',
        'section-system-health'
      )
    })

    it('should have main content landmark', () => {
      renderWithProviders(<AdminPage />)

      const mainContent = document.getElementById('main-content')
      expect(mainContent).toBeInTheDocument()
    })
  })
})
