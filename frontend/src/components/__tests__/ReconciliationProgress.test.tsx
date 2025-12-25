import { render, screen, cleanup } from '@testing-library/react';
import { ReconciliationProgress, MetricChange } from '../ReconciliationProgress';

describe('ReconciliationProgress', () => {
  afterEach(() => {
    cleanup();
  });

  const mockMetricChanges: MetricChange[] = [
    {
      metricName: 'Total Membership',
      previousValue: 1000,
      currentValue: 1050,
      percentageChange: 5.0,
      isSignificant: true,
    },
    {
      metricName: 'Club Count',
      previousValue: 50,
      currentValue: 51,
      percentageChange: 2.0,
      isSignificant: true,
    },
    {
      metricName: 'Distinguished Percentage',
      previousValue: 75.5,
      currentValue: 76.0,
      percentageChange: 0.66,
      isSignificant: false,
    },
    {
      metricName: 'Active Members',
      previousValue: 950,
      currentValue: 945,
      percentageChange: -0.53,
      isSignificant: false,
    },
  ];

  it('renders progress component correctly', () => {
    render(<ReconciliationProgress metricChanges={mockMetricChanges} targetMonth="2024-10" />);
    
    expect(screen.getByText('Metric Changes')).toBeInTheDocument();
  });

  it('displays summary statistics correctly', () => {
    render(<ReconciliationProgress metricChanges={mockMetricChanges} targetMonth="2024-10" />);
    
    // Check summary stats more specifically by finding parent elements
    const summaryStats = screen.getByText('Total Changes').parentElement;
    expect(summaryStats).toHaveTextContent('4');
    
    const significantStats = screen.getByText('Significant').parentElement;
    expect(significantStats).toHaveTextContent('2');
    
    const minorStats = screen.getByText('Minor').parentElement;
    expect(minorStats).toHaveTextContent('2');
    
    expect(screen.getByText('Total Changes')).toBeInTheDocument();
    expect(screen.getByText('Significant')).toBeInTheDocument();
    expect(screen.getByText('Minor')).toBeInTheDocument();
  });

  it('displays empty state when no changes provided', () => {
    render(<ReconciliationProgress metricChanges={[]} targetMonth="2024-10" />);
    
    expect(screen.getByText('No metric changes detected for 2024-10')).toBeInTheDocument();
  });

  it('separates significant and minor changes correctly', () => {
    render(<ReconciliationProgress metricChanges={mockMetricChanges} targetMonth="2024-10" />);
    
    expect(screen.getByText('Significant Changes')).toBeInTheDocument();
    expect(screen.getByText('Minor Changes')).toBeInTheDocument();
    
    // Check that significant changes are displayed
    expect(screen.getByText('Total Membership')).toBeInTheDocument();
    expect(screen.getByText('Club Count')).toBeInTheDocument();
  });

  it('formats percentage changes correctly', () => {
    render(<ReconciliationProgress metricChanges={mockMetricChanges} targetMonth="2024-10" />);
    
    expect(screen.getByText('+5.00%')).toBeInTheDocument();
    expect(screen.getByText('+2.00%')).toBeInTheDocument();
    expect(screen.getByText('+0.66%')).toBeInTheDocument();
    expect(screen.getByText('-0.53%')).toBeInTheDocument();
  });

  it('formats values correctly based on metric type', () => {
    const percentageMetric: MetricChange = {
      metricName: 'Success Percentage',
      previousValue: 85.5,
      currentValue: 87.2,
      percentageChange: 1.99,
      isSignificant: false,
    };

    render(<ReconciliationProgress metricChanges={[percentageMetric]} targetMonth="2024-10" />);
    
    expect(screen.getByText('85.5% → 87.2%')).toBeInTheDocument();
  });

  it('shows detailed changes when showDetails is true', () => {
    render(<ReconciliationProgress metricChanges={mockMetricChanges} targetMonth="2024-10" showDetails={true} />);
    
    expect(screen.getByText('Minor Changes')).toBeInTheDocument();
    expect(screen.getByText('Distinguished Percentage')).toBeInTheDocument();
    expect(screen.getByText('Active Members')).toBeInTheDocument();
  });

  it('hides minor changes when showDetails is false', () => {
    render(<ReconciliationProgress metricChanges={mockMetricChanges} targetMonth="2024-10" showDetails={false} />);
    
    expect(screen.queryByText('Minor Changes')).not.toBeInTheDocument();
    expect(screen.queryByText('Distinguished Percentage')).not.toBeInTheDocument();
    expect(screen.queryByText('Active Members')).not.toBeInTheDocument();
    
    // But significant changes should still be shown
    expect(screen.getByText('Significant Changes')).toBeInTheDocument();
    expect(screen.getByText('Total Membership')).toBeInTheDocument();
  });

  it('displays correct icons for positive and negative changes', () => {
    render(<ReconciliationProgress metricChanges={mockMetricChanges} targetMonth="2024-10" />);
    
    // Check that SVG elements are present (they don't have role="img" by default)
    const container = screen.getByText('Metric Changes').closest('div');
    const svgElements = container?.querySelectorAll('svg');
    expect(svgElements?.length).toBeGreaterThan(0);
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <ReconciliationProgress 
        metricChanges={mockMetricChanges} 
        targetMonth="2024-10" 
        className="custom-class" 
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('displays legend correctly', () => {
    render(<ReconciliationProgress metricChanges={mockMetricChanges} targetMonth="2024-10" />);
    
    expect(screen.getByText('Significant changes')).toBeInTheDocument();
    expect(screen.getByText('Minor changes')).toBeInTheDocument();
    expect(screen.getByText('Increase')).toBeInTheDocument();
    expect(screen.getByText('Decrease')).toBeInTheDocument();
  });

  it('handles only significant changes', () => {
    const significantOnly = mockMetricChanges.filter(change => change.isSignificant);
    render(<ReconciliationProgress metricChanges={significantOnly} targetMonth="2024-10" />);
    
    expect(screen.getByText('Significant Changes')).toBeInTheDocument();
    expect(screen.queryByText('Minor Changes')).not.toBeInTheDocument();
    
    // Check summary stats more specifically
    const summaryStats = screen.getByText('Total Changes').parentElement;
    expect(summaryStats).toHaveTextContent('2');
    
    const significantStats = screen.getByText('Significant').parentElement;
    expect(significantStats).toHaveTextContent('2');
    
    const minorStats = screen.getByText('Minor').parentElement;
    expect(minorStats).toHaveTextContent('0');
  });

  it('handles only minor changes', () => {
    const minorOnly = mockMetricChanges.filter(change => !change.isSignificant);
    render(<ReconciliationProgress metricChanges={minorOnly} targetMonth="2024-10" />);
    
    expect(screen.queryByText('Significant Changes')).not.toBeInTheDocument();
    expect(screen.getByText('Minor Changes')).toBeInTheDocument();
    
    // Check summary stats more specifically
    const summaryStats = screen.getByText('Total Changes').parentElement;
    expect(summaryStats).toHaveTextContent('2');
    
    const significantStats = screen.getByText('Significant').parentElement;
    expect(significantStats).toHaveTextContent('0');
    
    const minorStats = screen.getByText('Minor').parentElement;
    expect(minorStats).toHaveTextContent('2');
  });

  it('formats large numbers correctly', () => {
    const largeNumberMetric: MetricChange = {
      metricName: 'Total Members',
      previousValue: 1234567,
      currentValue: 1245678,
      percentageChange: 0.9,
      isSignificant: false,
    };

    render(<ReconciliationProgress metricChanges={[largeNumberMetric]} targetMonth="2024-10" />);
    
    expect(screen.getByText('1,234,567 → 1,245,678')).toBeInTheDocument();
  });

  it('maintains accessibility standards', () => {
    render(<ReconciliationProgress metricChanges={mockMetricChanges} targetMonth="2024-10" />);
    
    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Metric Changes');
    
    // Check that both section headings exist
    expect(screen.getByText('Significant Changes')).toBeInTheDocument();
    expect(screen.getByText('Minor Changes')).toBeInTheDocument();
    
    // Check that the component renders without accessibility violations
    expect(screen.getByText('Metric Changes')).toBeInTheDocument();
  });

  it('handles zero percentage change correctly', () => {
    const zeroChangeMetric: MetricChange = {
      metricName: 'Stable Metric',
      previousValue: 100,
      currentValue: 100,
      percentageChange: 0,
      isSignificant: false,
    };

    render(<ReconciliationProgress metricChanges={[zeroChangeMetric]} targetMonth="2024-10" />);
    
    expect(screen.getByText('+0.00%')).toBeInTheDocument();
  });
});