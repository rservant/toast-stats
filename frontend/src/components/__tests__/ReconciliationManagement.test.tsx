import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ReconciliationManagement } from '../ReconciliationManagement';

// Mock fetch globally
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

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

describe('ReconciliationManagement', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockWindowOpen.mockClear();
    mockConfirm.mockClear();
  });

  const mockActiveJobs = [
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
      status: 'active',
      startDate: new Date('2024-10-01'),
      currentDataDate: '2024-09-30',
    },
  ];

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

  describe('Access Control', () => {
    it('should show access denied message when user is not admin', () => {
      render(<ReconciliationManagement isAdmin={false} />);
      
      expect(screen.getByText('Admin access required to manage reconciliations')).toBeInTheDocument();
      expect(screen.queryByText('Reconciliation Management')).not.toBeInTheDocument();
    });

    it('should show management interface when user is admin', async () => {
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
  });

  describe('Data Loading', () => {
    it('should load active jobs and configuration on mount', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobs: mockActiveJobs }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ config: mockConfig }),
        });

      render(<ReconciliationManagement isAdmin={true} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/jobs?status=active');
        expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/config');
      });

      expect(screen.getByText('District D1 - 2024-10')).toBeInTheDocument();
      expect(screen.getByText('District D2 - 2024-09')).toBeInTheDocument();
    });

    it('should show loading state while fetching data', () => {
      mockFetch
        .mockImplementationOnce(() => new Promise(() => {})) // Never resolves
        .mockImplementationOnce(() => new Promise(() => {}));

      render(<ReconciliationManagement isAdmin={true} />);
      
      expect(screen.getByText('Loading jobs...')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      render(<ReconciliationManagement isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Failed to load data/)).toBeInTheDocument();
      });
    });

    it('should handle failed HTTP responses', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({}),
        });

      render(<ReconciliationManagement isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });
  });

  describe('Job Management', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobs: mockActiveJobs }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ config: mockConfig }),
        });
    });

    it('should display active jobs correctly', async () => {
      render(<ReconciliationManagement isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText('District D1 - 2024-10')).toBeInTheDocument();
        expect(screen.getByText('District D2 - 2024-09')).toBeInTheDocument();
        expect(screen.getAllByText('active')).toHaveLength(2);
      });
    });

    it('should show empty state when no active jobs', async () => {
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

    it('should open job details in new window', async () => {
      render(<ReconciliationManagement isAdmin={true} />);

      await waitFor(() => {
        const viewDetailsButtons = screen.getAllByText('View Details');
        fireEvent.click(viewDetailsButtons[0]);
      });

      expect(mockWindowOpen).toHaveBeenCalledWith('/reconciliation/job-1', '_blank');
    });

    it('should cancel job with confirmation', async () => {
      mockConfirm.mockReturnValue(true);
      mockFetch
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
        const cancelButtons = screen.getAllByText('Cancel');
        fireEvent.click(cancelButtons[0]);
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

      render(<ReconciliationManagement isAdmin={true} />);

      await waitFor(() => {
        const cancelButtons = screen.getAllByText('Cancel');
        fireEvent.click(cancelButtons[0]);
      });

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('/jobs/'), expect.objectContaining({ method: 'DELETE' }));
    });
  });

  describe('Start Reconciliation Form', () => {
    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobs: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ config: mockConfig }),
        });
    });

    it('should open start reconciliation form', async () => {
      render(<ReconciliationManagement isAdmin={true} />);

      await waitFor(() => {
        const startButton = screen.getByText('Start Reconciliation');
        fireEvent.click(startButton);
      });

      expect(screen.getByText('Start New Reconciliation')).toBeInTheDocument();
      expect(screen.getByLabelText('District ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Target Month')).toBeInTheDocument();
    });

    it('should close start reconciliation form', async () => {
      render(<ReconciliationManagement isAdmin={true} />);

      await waitFor(() => {
        const startButton = screen.getByText('Start Reconciliation');
        fireEvent.click(startButton);
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(screen.queryByText('Start New Reconciliation')).not.toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      render(<ReconciliationManagement isAdmin={true} />);

      await waitFor(() => {
        const startButton = screen.getByText('Start Reconciliation');
        fireEvent.click(startButton);
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
      expect(submitButton).not.toBeDisabled();
    });

    it('should submit start reconciliation form successfully', async () => {
      mockFetch
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

      // Fill form
      const districtInput = screen.getByLabelText('District ID');
      const monthInput = screen.getByLabelText('Target Month');
      fireEvent.change(districtInput, { target: { value: 'D1' } });
      fireEvent.change(monthInput, { target: { value: '2024-10' } });

      // Submit
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

    it('should handle start reconciliation errors', async () => {
      mockFetch.mockResolvedValueOnce({
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
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
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
        expect(screen.getByText('Configure')).toBeInTheDocument();
      });
    });

    it('should open configuration form', async () => {
      const configButton = screen.getByText('Configure');
      fireEvent.click(configButton);

      await waitFor(() => {
        expect(screen.getByText('Reconciliation Configuration')).toBeInTheDocument();
        expect(screen.getByLabelText('Max Reconciliation Days')).toBeInTheDocument();
      });
    });

    it('should close configuration form', async () => {
      const configButton = screen.getByText('Configure');
      fireEvent.click(configButton);

      await waitFor(() => {
        expect(screen.getByText('Reconciliation Configuration')).toBeInTheDocument();
      });

      const closeButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg') && btn.closest('.fixed')
      );
      fireEvent.click(closeButton!);

      await waitFor(() => {
        expect(screen.queryByText('Reconciliation Configuration')).not.toBeInTheDocument();
      });
    });

    it('should update configuration values', async () => {
      const configButton = screen.getByText('Configure');
      fireEvent.click(configButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Max Reconciliation Days')).toBeInTheDocument();
      });

      // Update max reconciliation days
      const maxDaysInput = screen.getByLabelText('Max Reconciliation Days');
      fireEvent.change(maxDaysInput, { target: { value: '20' } });
      expect(maxDaysInput).toHaveValue(20);

      // Update stability period
      const stabilityInput = screen.getByLabelText('Stability Period Days');
      fireEvent.change(stabilityInput, { target: { value: '5' } });
      expect(stabilityInput).toHaveValue(5);

      // Update membership threshold
      const membershipInput = screen.getByLabelText('Membership (%)');
      fireEvent.change(membershipInput, { target: { value: '2.5' } });
      expect(membershipInput).toHaveValue(2.5);

      // Toggle auto extension
      const autoExtensionCheckbox = screen.getByLabelText(/Enable automatic extension/);
      fireEvent.click(autoExtensionCheckbox);
      expect(autoExtensionCheckbox).not.toBeChecked();
    });

    it('should submit configuration updates successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, config: mockConfig }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobs: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ config: mockConfig }),
        });

      const configButton = screen.getByText('Configure');
      fireEvent.click(configButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Max Reconciliation Days')).toBeInTheDocument();
      });

      // Update a value
      const maxDaysInput = screen.getByLabelText('Max Reconciliation Days');
      fireEvent.change(maxDaysInput, { target: { value: '20' } });

      // Submit
      const updateButton = screen.getByRole('button', { name: /Update Configuration/i });
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/reconciliation/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"maxReconciliationDays":20'),
        });
      });
    });

    it('should handle configuration update errors', async () => {
      const configButton = screen.getByText('Configure');
      fireEvent.click(configButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Update Configuration/i })).toBeInTheDocument();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Invalid configuration values' }
        }),
      });

      const updateButton = screen.getByRole('button', { name: /Update Configuration/i });
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid configuration values/)).toBeInTheDocument();
      });
    });

    it('should cancel configuration changes', async () => {
      const configButton = screen.getByText('Configure');
      fireEvent.click(configButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Max Reconciliation Days')).toBeInTheDocument();
      });

      // Make changes
      const maxDaysInput = screen.getByLabelText('Max Reconciliation Days');
      fireEvent.change(maxDaysInput, { target: { value: '20' } });

      // Cancel
      const cancelButton = screen.getAllByText('Cancel').find(btn => 
        btn.closest('.fixed') // Find cancel button in modal
      );
      fireEvent.click(cancelButton!);

      await waitFor(() => {
        expect(screen.queryByText('Reconciliation Configuration')).not.toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
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
          json: () => Promise.resolve({ jobs: mockActiveJobs }),
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
  });

  describe('Status Colors', () => {
    it('should display correct status colors for different job statuses', async () => {
      const jobsWithDifferentStatuses = [
        { ...mockActiveJobs[0], status: 'active' },
        { ...mockActiveJobs[0], id: 'job-2', status: 'completed' },
        { ...mockActiveJobs[0], id: 'job-3', status: 'failed' },
        { ...mockActiveJobs[0], id: 'job-4', status: 'cancelled' },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobs: jobsWithDifferentStatuses }),
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
  });
});