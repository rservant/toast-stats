import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ReconciliationManagement } from '../ReconciliationManagement';

// Mock fetch globally
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe('ReconciliationManagement Minimal Coverage', () => {
  beforeEach(() => {
    mockFetch.mockClear();
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

  it('should show access denied for non-admin users', () => {
    render(<ReconciliationManagement isAdmin={false} />);
    expect(screen.getByText('Admin access required to manage reconciliations')).toBeInTheDocument();
  });

  it('should load and display interface for admin users', async () => {
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
    });
  });

  it('should handle API errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should display jobs when available', async () => {
    const mockJob = {
      id: 'job-1',
      districtId: 'D1',
      targetMonth: '2024-10',
      status: 'active',
      startDate: new Date('2024-11-01'),
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
    });
  });

  it('should open start reconciliation form', async () => {
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

    expect(screen.getByText('Start New Reconciliation')).toBeInTheDocument();
  });

  it('should handle different job statuses', async () => {
    const jobs = [
      { id: '1', districtId: 'D1', targetMonth: '2024-10', status: 'active', startDate: new Date() },
      { id: '2', districtId: 'D2', targetMonth: '2024-09', status: 'completed', startDate: new Date() },
      { id: '3', districtId: 'D3', targetMonth: '2024-08', status: 'failed', startDate: new Date() },
      { id: '4', districtId: 'D4', targetMonth: '2024-07', status: 'cancelled', startDate: new Date() },
    ];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
      expect(screen.getByText('cancelled')).toBeInTheDocument();
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
      expect(screen.getByText(/Started:/)).toBeInTheDocument();
    });
  });

  it('should handle refresh functionality', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      })
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
      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);
    });

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});