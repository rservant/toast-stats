import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ReconciliationManagement } from '../ReconciliationManagement';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

// Mock window.confirm
const mockConfirm = vi.fn();
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true,
});

describe('ReconciliationManagement Basic Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockWindowOpen.mockClear();
    mockConfirm.mockClear();
  });

  const mockConfig = {
    maxReconciliationDays: 15,
    stabilityPeriodDays: 3,
    checkFrequencyHours: 24,
    significantChangeThresholds: {
      membershipPercent: 1,
      clubCountAbsolute: 1,
      distinguishedPercent: 2,
    },
    autoExtensionEnabled: true,
    maxExtensionDays: 5,
  };

  it('should show access denied when user is not admin', () => {
    render(<ReconciliationManagement isAdmin={false} />);
    
    expect(screen.getByText('Admin access required to manage reconciliations')).toBeInTheDocument();
    expect(screen.queryByText('Reconciliation Management')).not.toBeInTheDocument();
  });

  it('should load and display management interface for admin users', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    render(<ReconciliationManagement isAdmin={true} />);
    
    await waitFor(() => {
      expect(screen.getByText('Reconciliation Management')).toBeInTheDocument();
      expect(screen.getByText('Start Reconciliation')).toBeInTheDocument();
      expect(screen.getByText('Configure')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/jobs?status=active');
    expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/config');
  });

  it('should show empty state when no jobs are active', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('No active reconciliation jobs')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should open and close start reconciliation form', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('Start Reconciliation')).toBeInTheDocument();
    });

    // Open form
    const startButton = screen.getByText('Start Reconciliation');
    fireEvent.click(startButton);

    expect(screen.getByText('Start New Reconciliation')).toBeInTheDocument();
    expect(screen.getByLabelText('District ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Target Month')).toBeInTheDocument();

    // Close form
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(screen.queryByText('Start New Reconciliation')).not.toBeInTheDocument();
  });

  it('should validate start reconciliation form', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      const startButton = screen.getByText('Start Reconciliation');
      fireEvent.click(startButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Start New Reconciliation')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /Start Reconciliation/i });
    expect(submitButton).toBeDisabled();

    // Fill in district ID only
    const districtInput = screen.getByLabelText('District ID');
    fireEvent.change(districtInput, { target: { value: 'D1' } });
    expect(submitButton).toBeDisabled();

    // Fill in target month
    const monthInput = screen.getByLabelText('Target Month');
    fireEvent.change(monthInput, { target: { value: '2024-10' } });
    
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should refresh data when refresh button is clicked', async () => {
    // Initial load
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      })
      // Refresh load
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial load + refresh
    });
  });

  it('should format dates correctly', async () => {
    const mockJob = {
      id: 'job-1',
      districtId: 'D1',
      targetMonth: '2024-10',
      status: 'active',
      startDate: new Date('2024-11-01T10:30:00Z'),
      currentDataDate: '2024-10-31',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [mockJob] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('District D1 - 2024-10')).toBeInTheDocument();
      expect(screen.getByText(/Started:/)).toBeInTheDocument();
    });
  });

  it('should display different status colors', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-10',
        status: 'active',
        startDate: new Date('2024-11-01'),
        currentDataDate: '2024-10-31',
      },
      {
        id: 'job-2',
        districtId: 'D2',
        targetMonth: '2024-09',
        status: 'completed',
        startDate: new Date('2024-10-01'),
        currentDataDate: '2024-09-30',
      },
    ];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: mockJobs }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });
});