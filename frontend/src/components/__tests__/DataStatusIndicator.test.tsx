import { render, screen } from '@testing-library/react';
import { DataStatusIndicator } from '../DataStatusIndicator';
import { DataStatus } from '../../types/reconciliation';

describe('DataStatusIndicator', () => {
  const mockDataStatus: DataStatus = {
    isPreliminary: false,
    isFinal: true,
    dataCollectionDate: '2025-01-15T10:00:00Z',
    lastUpdated: '2025-01-15T12:00:00Z',
  };

  it('renders final status correctly', () => {
    render(<DataStatusIndicator dataStatus={mockDataStatus} />);
    
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByText('Data as of Jan 15, 2025')).toBeInTheDocument();
  });

  it('renders preliminary status correctly', () => {
    const preliminaryStatus: DataStatus = {
      ...mockDataStatus,
      isPreliminary: true,
      isFinal: false,
      reconciliationStatus: {
        phase: 'monitoring',
        daysActive: 5,
        daysStable: 2,
        message: 'Monitoring for changes',
      },
    };

    render(<DataStatusIndicator dataStatus={preliminaryStatus} />);
    
    expect(screen.getByText('Preliminary')).toBeInTheDocument();
    expect(screen.getByText('Monitoring Changes')).toBeInTheDocument();
  });

  it('renders stabilizing phase correctly', () => {
    const stabilizingStatus: DataStatus = {
      ...mockDataStatus,
      isPreliminary: true,
      isFinal: false,
      reconciliationStatus: {
        phase: 'stabilizing',
        daysActive: 8,
        daysStable: 2,
      },
    };

    render(<DataStatusIndicator dataStatus={stabilizingStatus} />);
    
    expect(screen.getByText('Preliminary')).toBeInTheDocument();
    expect(screen.getByText('Stabilizing (2/8 days)')).toBeInTheDocument();
  });

  it('renders finalizing phase correctly', () => {
    const finalizingStatus: DataStatus = {
      ...mockDataStatus,
      isPreliminary: true,
      isFinal: false,
      reconciliationStatus: {
        phase: 'finalizing',
        daysActive: 10,
        daysStable: 3,
      },
    };

    render(<DataStatusIndicator dataStatus={finalizingStatus} />);
    
    expect(screen.getByText('Preliminary')).toBeInTheDocument();
    expect(screen.getByText('Finalizing')).toBeInTheDocument();
  });

  it('renders failed reconciliation correctly', () => {
    const failedStatus: DataStatus = {
      ...mockDataStatus,
      isPreliminary: true,
      isFinal: false,
      reconciliationStatus: {
        phase: 'failed',
        daysActive: 15,
        daysStable: 0,
        message: 'Reconciliation failed due to timeout',
      },
    };

    render(<DataStatusIndicator dataStatus={failedStatus} />);
    
    expect(screen.getByText('Preliminary')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation Failed')).toBeInTheDocument();
  });

  it('hides details when showDetails is false', () => {
    render(<DataStatusIndicator dataStatus={mockDataStatus} showDetails={false} />);
    
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.queryByText('Data as of Jan 15, 2025')).not.toBeInTheDocument();
  });

  it('renders processing status for non-preliminary, non-final data', () => {
    const processingStatus: DataStatus = {
      isPreliminary: false,
      isFinal: false,
      dataCollectionDate: '2025-01-15T10:00:00Z',
      lastUpdated: '2025-01-15T12:00:00Z',
    };

    render(<DataStatusIndicator dataStatus={processingStatus} />);
    
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <DataStatusIndicator dataStatus={mockDataStatus} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('formats dates correctly', () => {
    const statusWithDifferentDate: DataStatus = {
      ...mockDataStatus,
      dataCollectionDate: '2025-12-25T15:30:00Z',
    };

    render(<DataStatusIndicator dataStatus={statusWithDifferentDate} />);
    
    expect(screen.getByText('Data as of Dec 25, 2025')).toBeInTheDocument();
  });
});