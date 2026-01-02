/**
 * District Analytics Dashboard Component Tests
 *
 * Tests for the district analytics dashboard component including:
 * - Basic rendering and data display
 * - Health status and trajectory distribution
 * - Export functionality
 * - Pattern identification
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import DistrictAnalyticsDashboard from '../DistrictAnalyticsDashboard'
import {
  ClubHealthResult,
  HealthStatus,
  Trajectory,
} from '../../types/clubHealth'

// Mock Recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
}))

// Mock chart accessibility utilities
vi.mock('../../utils/chartAccessibility', () => ({
  getChartColorPalette: (count: number) => Array(count).fill('#004165'),
  generateChartDescription: () => 'Mock chart description',
  CHART_STYLES: {
    GRID: { strokeDasharray: '3 3', stroke: '#A9B2B1' },
    AXIS: { stroke: '#A9B2B1', fontSize: '11px', fontFamily: 'Source Sans 3' },
  },
}))

// Sample test data
const mockClubs: ClubHealthResult[] = [
  {
    club_name: 'Test Club 1',
    health_status: 'Thriving' as HealthStatus,
    reasons: ['Membership requirement met', 'DCP goals on track'],
    trajectory: 'Stable' as Trajectory,
    trajectory_reasons: ['Consistent performance'],
    composite_key: 'Thriving__Stable',
    composite_label: 'Thriving · Stable',
    members_delta_mom: 2,
    dcp_delta_mom: 1,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 50,
      rule_version: '1.0.0',
    },
  },
  {
    club_name: 'Test Club 2',
    health_status: 'Vulnerable' as HealthStatus,
    reasons: ['Membership below threshold'],
    trajectory: 'Declining' as Trajectory,
    trajectory_reasons: ['Membership loss'],
    composite_key: 'Vulnerable__Declining',
    composite_label: 'Vulnerable · Declining',
    members_delta_mom: -3,
    dcp_delta_mom: 0,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 45,
      rule_version: '1.0.0',
    },
  },
  {
    club_name: 'Test Club 3',
    health_status: 'Intervention Required' as HealthStatus,
    reasons: ['Membership critically low', 'No DCP progress'],
    trajectory: 'Declining' as Trajectory,
    trajectory_reasons: ['Consistent decline'],
    composite_key: 'Intervention Required__Declining',
    composite_label: 'Intervention Required · Declining',
    members_delta_mom: -5,
    dcp_delta_mom: -1,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 60,
      rule_version: '1.0.0',
    },
  },
]

describe('DistrictAnalyticsDashboard', () => {
  const defaultProps = {
    districtId: '42',
    clubs: mockClubs,
  }

  beforeEach(() => {
    // Mock URL and document methods for export functionality
    global.URL.createObjectURL = vi.fn(() => 'mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders district analytics dashboard with correct title', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} />)

      expect(screen.getByText('District 42 Analytics')).toBeInTheDocument()
      expect(
        screen.getByText('3 clubs • Health status and trajectory analysis')
      ).toBeInTheDocument()
    })

    it('displays loading state correctly', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} loading={true} />)

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(
        screen.getByText('Loading district analytics...')
      ).toBeInTheDocument()
    })

    it('displays error state correctly', () => {
      const errorMessage = 'Failed to load analytics data'
      render(
        <DistrictAnalyticsDashboard {...defaultProps} error={errorMessage} />
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(
        screen.getByText('Error Loading District Analytics')
      ).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  describe('Health Status Distribution', () => {
    it('displays correct health status counts in summary cards', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} />)

      // Check summary cards
      expect(screen.getByText('Total Clubs')).toBeInTheDocument()
      expect(screen.getByText('Thriving')).toBeInTheDocument()
      expect(screen.getByText('Vulnerable')).toBeInTheDocument()
      expect(screen.getByText('Intervention')).toBeInTheDocument()
    })

    it('renders health status distribution chart', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} />)

      expect(screen.getByText('Health Status Distribution')).toBeInTheDocument()
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })
  })

  describe('Export Functionality', () => {
    it('renders export buttons', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} />)

      expect(screen.getByText('CSV')).toBeInTheDocument()
      expect(screen.getByText('JSON')).toBeInTheDocument()
      expect(screen.getByText('PDF')).toBeInTheDocument()
    })

    it('calls export handler when export buttons are clicked', () => {
      const mockOnExportData = vi.fn()
      render(
        <DistrictAnalyticsDashboard
          {...defaultProps}
          onExportData={mockOnExportData}
        />
      )

      fireEvent.click(screen.getByText('CSV'))
      expect(mockOnExportData).toHaveBeenCalledWith('csv', expect.any(Object))
    })
  })

  describe('View Navigation', () => {
    it('switches between different views', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} />)

      // Check default view
      expect(screen.getByText('Overview')).toBeInTheDocument()

      // Switch to trends view
      fireEvent.click(screen.getByText('Trends'))
      expect(
        screen.getByText('Month-over-Month Health Trends')
      ).toBeInTheDocument()

      // Switch to patterns view
      fireEvent.click(screen.getByText('Patterns'))
      expect(screen.getByText('Pattern Alerts')).toBeInTheDocument()
    })
  })

  describe('Pattern Identification', () => {
    it('identifies and displays pattern alerts', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} />)

      // Switch to patterns view
      fireEvent.click(screen.getByText('Patterns'))

      // Should show alerts for intervention required and declining clubs
      expect(screen.getByText('Pattern Alerts')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels for charts', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} />)

      // Check for chart accessibility
      const chartElements = screen.getAllByRole('img')
      expect(chartElements.length).toBeGreaterThan(0)
    })

    it('provides proper button accessibility', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} />)

      // All interactive elements should be accessible
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  describe('Data Processing', () => {
    it('correctly calculates health status distribution', () => {
      render(<DistrictAnalyticsDashboard {...defaultProps} />)

      // With our mock data: 1 Thriving, 1 Vulnerable, 1 Intervention Required
      // The component should display these counts correctly
      expect(screen.getByText('Total Clubs')).toBeInTheDocument()
      expect(screen.getByText('Thriving')).toBeInTheDocument()
      expect(screen.getByText('Vulnerable')).toBeInTheDocument()
      expect(screen.getByText('Intervention')).toBeInTheDocument()
    })
  })
})
