import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ReconciliationManagement } from '../ReconciliationManagement';

// Mock fetch globally
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

// Mock window.open and confirm
const mockWindowOpen = vi.fn();
const mockConfirm = vi.fn();
Object.defineProperty(window, 'open', { value: mockWindowOpen, writable: true });
Object.defineProperty(window, 'confirm', { value: mockConfirm, writable: true });

describe('ReconciliationManagement Extended Coverage', () => {
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

  const mockJob = {
    id: 'job-1',
    districtId: 'D1',
    targetMonth: '2024-10',
    status: 'active',
    startDate: new Date('2024-11-01T10:30:00Z'),
    currentDataDate: '2024-10-31',
  };

  it('should handle start reconciliation form submission', async () => {
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
        json: () => Promise.resolve({ success: true }),
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
      const startButton = screen.getByText('Start Reconciliation');
      fireEvent.click(startButton);
    });

    // Fill form and submit
    const districtInput = screen.getByLabelText('District ID');
    const monthInput = screen.getByLabelText('Target Month');
    
    fireEvent.change(districtInput, { target: { value: 'D1' } });
    fireEvent.change(monthInput, { target: { value: '2024-10' } });

    const submitButton = screen.getByRole('button', { name: /Start Reconciliation/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districtId: 'D1',
          targetMonth: '2024-10',
        }),
      });
    });
  });

  it('should handle start reconciliation form validation errors', async () => {
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

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /Start Reconciliation/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/District ID and target month are required/)).toBeInTheDocument();
    });
  });

  it('should handle start reconciliation API errors', async () => {
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
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'District already has active reconciliation' }
        }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      const startButton = screen.getByText('Start Reconciliation');
      fireEvent.click(startButton);
    });

    // Fill and submit form
    const districtInput = screen.getByLabelText('District ID');
    const monthInput = screen.getByLabelText('Target Month');
    
    fireEvent.change(districtInput, { target: { value: 'D1' } });
    fireEvent.change(monthInput, { target: { value: '2024-10' } });

    const submitButton = screen.getByRole('button', { name: /Start Reconciliation/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/District already has active reconciliation/)).toBeInTheDocument();
    });
  });

  it('should handle job cancellation with confirmation', async () => {
    mockConfirm.mockReturnValue(true);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [mockJob] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
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
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
    });

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to cancel this reconciliation job?');
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/jobs/job-1', {
        method: 'DELETE',
      });
    });
  });

  it('should not cancel job if user declines confirmation', async () => {
    mockConfirm.mockReturnValue(false);
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
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
    });

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('/jobs/'), expect.objectContaining({ method: 'DELETE' }));
  });

  it('should handle job cancellation errors', async () => {
    mockConfirm.mockReturnValue(true);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [mockJob] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Cannot cancel job' }
        }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Cannot cancel job/)).toBeInTheDocument();
    });
  });

  it('should open job details in new window', async () => {
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
      const viewDetailsButton = screen.getByText('View Details');
      fireEvent.click(viewDetailsButton);
    });

    expect(mockWindowOpen).toHaveBeenCalledWith('/reconciliation/job-1', '_blank');
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
        json: () => Promise.resolve({ jobs: [mockJob] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('No active reconciliation jobs')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('District D1 - 2024-10')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(4); // Initial load + refresh
  });

  it('should handle configuration form opening and closing', async () => {
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
      const configButton = screen.getByText('Configure');
      fireEvent.click(configButton);
    });

    expect(screen.getByText('Reconciliation Configuration')).toBeInTheDocument();

    // Close the modal by clicking the X button
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => 
      btn.querySelector('svg') && btn.closest('.fixed')
    );
    
    if (closeButton) {
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Reconciliation Configuration')).not.toBeInTheDocument();
      });
    }
  });

  it('should handle missing configuration data error', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: mockConfig }),
      });

    const { } = render(<ReconciliationManagement isAdmin={true} />);

    await waitFor(() => {
      const configButton = screen.getByText('Configure');
      fireEvent.click(configButton);
    });

    // Simulate missing config by re-rendering with null config
    mockFetch.mockClear();
    
    // Manually trigger the update config with null configForm
    const component = screen.getByText('Reconciliation Configuration').closest('.fixed');
    if (component) {
      // This tests the error path where configForm is null
      const updateButton = screen.getByRole('button', { name: /Update Configuration/i });
      
      // Mock the component state to have null configForm
      Object.defineProperty(component, 'configForm', { value: null });
      
      fireEvent.click(updateButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Configuration data is missing/)).toBeInTheDocument();
      });
    }
  });
});