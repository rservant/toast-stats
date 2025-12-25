import { render, screen, cleanup } from '@testing-library/react';
import { ReconciliationStatus } from '../ReconciliationStatus';
import { ReconciliationStatus as ReconciliationStatusType } from '../../types/reconciliation';

describe('ReconciliationStatus', () => {
  afterEach(() => {
    cleanup();
  });

  const baseStatus: ReconciliationStatusType = {
    phase: 'monitoring',
    daysActive: 5,
    daysStable: 0,
    lastChangeDate: new Date('2024-11-01T10:30:00Z'),
    nextCheckDate: new Date('2024-11-02T10:30:00Z'),
    message: 'Monitoring for data changes',
  };

  it('renders status component correctly', () => {
    render(<ReconciliationStatus status={baseStatus} targetMonth="2024-10" />);
    
    expect(screen.getByText('Reconciliation Status')).toBeInTheDocument();
    expect(screen.getByText('Monitoring Changes')).toBeInTheDocument();
  });

  it('displays correct phase information for monitoring', () => {
    render(<ReconciliationStatus status={baseStatus} targetMonth="2024-10" />);
    
    expect(screen.getByText('Monitoring Changes')).toBeInTheDocument();
    expect(screen.getByText('Target Month:')).toBeInTheDocument();
    expect(screen.getByText('2024-10')).toBeInTheDocument();
    expect(screen.getByText('Days Active:')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays correct phase information for stabilizing', () => {
    const stabilizingStatus: ReconciliationStatusType = {
      ...baseStatus,
      phase: 'stabilizing',
      daysStable: 2,
    };

    render(<ReconciliationStatus status={stabilizingStatus} targetMonth="2024-10" />);
    
    expect(screen.getByText('Stabilizing')).toBeInTheDocument();
    expect(screen.getByText('Stability Period:')).toBeInTheDocument();
    expect(screen.getByText('2 days without changes')).toBeInTheDocument();
  });

  it('displays correct phase information for completed', () => {
    const completedStatus: ReconciliationStatusType = {
      ...baseStatus,
      phase: 'completed',
      daysStable: 3,
    };

    render(<ReconciliationStatus status={completedStatus} targetMonth="2024-10" />);
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // Progress bar should not be shown for completed status
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('displays correct phase information for failed', () => {
    const failedStatus: ReconciliationStatusType = {
      ...baseStatus,
      phase: 'failed',
      message: 'Connection timeout occurred',
    };

    render(<ReconciliationStatus status={failedStatus} targetMonth="2024-10" />);
    
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout occurred')).toBeInTheDocument();
    // Progress bar should not be shown for failed status
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows progress bar for active phases', () => {
    render(<ReconciliationStatus status={baseStatus} targetMonth="2024-10" />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-label', expect.stringContaining('Reconciliation progress'));
  });

  it('hides progress bar for completed and failed phases', () => {
    const completedStatus: ReconciliationStatusType = {
      ...baseStatus,
      phase: 'completed',
    };

    render(<ReconciliationStatus status={completedStatus} targetMonth="2024-10" />);
    
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('displays dates correctly when provided', () => {
    render(<ReconciliationStatus status={baseStatus} targetMonth="2024-10" />);
    
    expect(screen.getByText('Last Change:')).toBeInTheDocument();
    expect(screen.getByText('Next Check:')).toBeInTheDocument();
  });

  it('handles missing optional dates gracefully', () => {
    const statusWithoutDates: ReconciliationStatusType = {
      phase: 'monitoring',
      daysActive: 1,
      daysStable: 0,
    };

    expect(() => {
      render(<ReconciliationStatus status={statusWithoutDates} targetMonth="2024-10" />);
    }).not.toThrow();

    expect(screen.queryByText('Last Change:')).not.toBeInTheDocument();
    expect(screen.queryByText('Next Check:')).not.toBeInTheDocument();
  });

  it('shows details when showDetails is true', () => {
    render(<ReconciliationStatus status={baseStatus} targetMonth="2024-10" showDetails={true} />);
    
    expect(screen.getByText('Target Month:')).toBeInTheDocument();
    expect(screen.getByText('Days Active:')).toBeInTheDocument();
    expect(screen.getByText('Status Message:')).toBeInTheDocument();
  });

  it('hides details when showDetails is false', () => {
    render(<ReconciliationStatus status={baseStatus} targetMonth="2024-10" showDetails={false} />);
    
    expect(screen.queryByText('Target Month:')).not.toBeInTheDocument();
    expect(screen.queryByText('Days Active:')).not.toBeInTheDocument();
    expect(screen.queryByText('Status Message:')).not.toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <ReconciliationStatus 
        status={baseStatus} 
        targetMonth="2024-10" 
        className="custom-class" 
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('displays stability period correctly', () => {
    const statusWithStability: ReconciliationStatusType = {
      ...baseStatus,
      daysStable: 1,
    };

    render(<ReconciliationStatus status={statusWithStability} targetMonth="2024-10" />);
    
    expect(screen.getByText('Stability Period:')).toBeInTheDocument();
    expect(screen.getByText('1 day without changes')).toBeInTheDocument();
  });

  it('handles plural days correctly', () => {
    const statusWithMultipleDays: ReconciliationStatusType = {
      ...baseStatus,
      daysStable: 3,
    };

    render(<ReconciliationStatus status={statusWithMultipleDays} targetMonth="2024-10" />);
    
    expect(screen.getByText('3 days without changes')).toBeInTheDocument();
  });

  it('maintains accessibility standards', () => {
    render(<ReconciliationStatus status={baseStatus} targetMonth="2024-10" />);
    
    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Reconciliation Status');
    
    // Check progress bar accessibility
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('calculates progress percentage correctly for different phases', () => {
    const monitoringStatus: ReconciliationStatusType = {
      ...baseStatus,
      phase: 'monitoring',
      daysActive: 4,
    };

    render(<ReconciliationStatus status={monitoringStatus} targetMonth="2024-10" />);
    
    const progressBar = screen.getByRole('progressbar');
    const progressValue = parseInt(progressBar.getAttribute('aria-valuenow') || '0');
    expect(progressValue).toBeGreaterThan(0);
    expect(progressValue).toBeLessThan(100);
  });

  it('does not show next check date for completed status', () => {
    const completedStatus: ReconciliationStatusType = {
      ...baseStatus,
      phase: 'completed',
      nextCheckDate: new Date('2024-11-02T10:30:00Z'),
    };

    render(<ReconciliationStatus status={completedStatus} targetMonth="2024-10" />);
    
    expect(screen.queryByText('Next Check:')).not.toBeInTheDocument();
  });
});