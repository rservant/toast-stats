import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { EnhancedExportButton, ExportMetadata } from '../EnhancedExportButton';
import { DataStatus } from '../../types/reconciliation';

describe('EnhancedExportButton', () => {
  const mockOnExport = vi.fn();

  beforeEach(() => {
    mockOnExport.mockClear();
  });

  it('renders with default label', () => {
    render(<EnhancedExportButton onExport={mockOnExport} />);
    
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<EnhancedExportButton onExport={mockOnExport} label="Export Analytics" />);
    
    expect(screen.getByText('Export Analytics')).toBeInTheDocument();
  });

  it('calls onExport without metadata when no dataStatus provided', async () => {
    render(<EnhancedExportButton onExport={mockOnExport} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith();
    });
  });

  it('calls onExport with final data metadata', async () => {
    const dataStatus: DataStatus = {
      isPreliminary: false,
      isFinal: true,
      dataCollectionDate: '2025-01-15T10:00:00Z',
      lastUpdated: '2025-01-15T12:00:00Z',
    };

    render(<EnhancedExportButton onExport={mockOnExport} dataStatus={dataStatus} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.objectContaining({
          reconciliationStatus: 'Final',
          dataCollectionDate: '2025-01-15T10:00:00Z',
          isPreliminary: false,
          isFinal: true,
          reconciliationPhase: undefined,
        })
      );
    });
  });

  it('calls onExport with preliminary data metadata', async () => {
    const dataStatus: DataStatus = {
      isPreliminary: true,
      isFinal: false,
      dataCollectionDate: '2025-01-15T10:00:00Z',
      reconciliationStatus: {
        phase: 'monitoring',
        daysActive: 5,
        daysStable: 2,
      },
      lastUpdated: '2025-01-15T12:00:00Z',
    };

    render(<EnhancedExportButton onExport={mockOnExport} dataStatus={dataStatus} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.objectContaining({
          reconciliationStatus: 'Preliminary',
          dataCollectionDate: '2025-01-15T10:00:00Z',
          isPreliminary: true,
          isFinal: false,
          reconciliationPhase: 'monitoring',
        })
      );
    });
  });

  it('calls onExport with current data metadata', async () => {
    const dataStatus: DataStatus = {
      isPreliminary: false,
      isFinal: false,
      dataCollectionDate: '2025-01-15T10:00:00Z',
      lastUpdated: '2025-01-15T12:00:00Z',
    };

    render(<EnhancedExportButton onExport={mockOnExport} dataStatus={dataStatus} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.objectContaining({
          reconciliationStatus: 'Current',
          dataCollectionDate: '2025-01-15T10:00:00Z',
          isPreliminary: false,
          isFinal: false,
          reconciliationPhase: undefined,
        })
      );
    });
  });

  it('includes exportTimestamp in metadata', async () => {
    const dataStatus: DataStatus = {
      isPreliminary: false,
      isFinal: true,
      dataCollectionDate: '2025-01-15T10:00:00Z',
      lastUpdated: '2025-01-15T12:00:00Z',
    };

    const beforeExport = Date.now();
    
    render(<EnhancedExportButton onExport={mockOnExport} dataStatus={dataStatus} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    const afterExport = Date.now();
    
    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith(
        expect.objectContaining({
          exportTimestamp: expect.any(String),
        })
      );
      
      const call = mockOnExport.mock.calls[0][0] as ExportMetadata;
      const exportTime = new Date(call.exportTimestamp).getTime();
      expect(exportTime).toBeGreaterThanOrEqual(beforeExport);
      expect(exportTime).toBeLessThanOrEqual(afterExport);
    });
  });

  it('handles async onExport function', async () => {
    const asyncOnExport = vi.fn().mockResolvedValue(undefined);
    
    render(<EnhancedExportButton onExport={asyncOnExport} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(asyncOnExport).toHaveBeenCalled();
    });
  });

  it('is disabled when disabled prop is true', () => {
    render(<EnhancedExportButton onExport={mockOnExport} disabled={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<EnhancedExportButton onExport={mockOnExport} className="custom-class" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });
});