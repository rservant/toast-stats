import React, { useState, useEffect } from 'react';
import { Tooltip, InfoIcon } from './Tooltip';
import { ReconciliationJob } from '../types/reconciliation';

/**
 * Configuration for reconciliation settings
 */
interface ReconciliationConfig {
  maxReconciliationDays: number;
  stabilityPeriodDays: number;
  checkFrequencyHours: number;
  significantChangeThresholds: {
    membershipPercent: number;
    clubCountAbsolute: number;
    distinguishedPercent: number;
  };
  autoExtensionEnabled: boolean;
  maxExtensionDays: number;
}

/**
 * Props for the ReconciliationManagement component
 */
interface ReconciliationManagementProps {
  /** Optional CSS classes */
  className?: string;
  /** Whether the user has admin permissions */
  isAdmin?: boolean;
}

/**
 * ReconciliationManagement Component
 * 
 * Admin interface for managing reconciliation jobs and configuration.
 * Provides controls for viewing active reconciliations, manual initiation,
 * and configuration management.
 * 
 * Requirements: 6.4, 6.5
 * - Create admin interface for viewing active reconciliations
 * - Add manual reconciliation initiation controls
 * - Implement reconciliation configuration management UI
 * 
 * @component
 */
export const ReconciliationManagement: React.FC<ReconciliationManagementProps> = ({
  className = '',
  isAdmin = false,
}) => {
  const [activeJobs, setActiveJobs] = useState<ReconciliationJob[]>([]);
  const [config, setConfig] = useState<ReconciliationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStartForm, setShowStartForm] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);

  // Form states
  const [startForm, setStartForm] = useState({
    districtId: '',
    targetMonth: '',
  });
  const [configForm, setConfigForm] = useState<ReconciliationConfig | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load active jobs and configuration in parallel
      const [jobsResponse, configResponse] = await Promise.all([
        fetch('/api/reconciliation/jobs?status=active'),
        fetch('/api/reconciliation/config')
      ]);

      if (!jobsResponse.ok) {
        throw new Error('Failed to load reconciliation jobs');
      }

      if (!configResponse.ok) {
        throw new Error('Failed to load reconciliation configuration');
      }

      const jobsData = await jobsResponse.json();
      const configData = await configResponse.json();

      setActiveJobs(jobsData.jobs || []);
      setConfig(configData.config);
      setConfigForm(configData.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartReconciliation = async () => {
    if (!startForm.districtId || !startForm.targetMonth) {
      setError('District ID and target month are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/reconciliation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          districtId: startForm.districtId,
          targetMonth: startForm.targetMonth,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to start reconciliation');
      }

      // Reset form and reload data
      setStartForm({ districtId: '', targetMonth: '' });
      setShowStartForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this reconciliation job?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/reconciliation/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to cancel reconciliation');
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    if (!configForm) {
      setError('Configuration data is missing');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/reconciliation/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update configuration');
      }

      setShowConfigForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-blue-700 bg-blue-100 border-blue-200';
      case 'completed':
        return 'text-green-700 bg-green-100 border-green-200';
      case 'failed':
        return 'text-red-700 bg-red-100 border-red-200';
      case 'cancelled':
        return 'text-gray-700 bg-gray-100 border-gray-200';
      default:
        return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  if (!isAdmin) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-gray-600">Admin access required to manage reconciliations</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">
              Reconciliation Management
            </h2>
            <Tooltip content="Admin interface for managing month-end data reconciliation jobs and configuration">
              <InfoIcon />
            </Tooltip>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStartForm(true)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Reconciliation
            </button>
            <button
              onClick={() => setShowConfigForm(true)}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Configure
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Active Jobs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Active Reconciliation Jobs
          </h3>
          <Tooltip content="Currently running reconciliation jobs across all districts">
            <InfoIcon />
          </Tooltip>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading jobs...</p>
          </div>
        ) : activeJobs.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-600">No active reconciliation jobs</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeJobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(job.status)}`}>
                      {job.status}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        District {job.districtId} - {job.targetMonth}
                      </div>
                      <div className="text-sm text-gray-600">
                        Started: {formatDate(job.startDate)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.open(`/reconciliation/${job.id}`, '_blank')}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleCancelJob(job.id)}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">Job ID:</span> {job.id}
                    </div>
                    <div>
                      <span className="font-medium">Current Data Date:</span> {job.currentDataDate || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Start Reconciliation Modal */}
      {showStartForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Start New Reconciliation</h3>
              <button
                onClick={() => setShowStartForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="districtId" className="block text-sm font-medium text-gray-700 mb-1">
                  District ID
                </label>
                <input
                  id="districtId"
                  type="text"
                  value={startForm.districtId}
                  onChange={(e) => setStartForm({ ...startForm, districtId: e.target.value })}
                  placeholder="e.g., D1, D42, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="targetMonth" className="block text-sm font-medium text-gray-700 mb-1">
                  Target Month
                </label>
                <input
                  id="targetMonth"
                  type="month"
                  value={startForm.targetMonth}
                  onChange={(e) => setStartForm({ ...startForm, targetMonth: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleStartReconciliation}
                  disabled={loading || !startForm.districtId || !startForm.targetMonth}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Starting...' : 'Start Reconciliation'}
                </button>
                <button
                  onClick={() => setShowStartForm(false)}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigForm && config && configForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Reconciliation Configuration</h3>
              <button
                onClick={() => setShowConfigForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Settings */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Basic Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Reconciliation Days
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={configForm.maxReconciliationDays}
                      onChange={(e) => setConfigForm({
                        ...configForm,
                        maxReconciliationDays: parseInt(e.target.value) || 15
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stability Period Days
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={configForm.stabilityPeriodDays}
                      onChange={(e) => setConfigForm({
                        ...configForm,
                        stabilityPeriodDays: parseInt(e.target.value) || 3
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Check Frequency (Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="48"
                      value={configForm.checkFrequencyHours}
                      onChange={(e) => setConfigForm({
                        ...configForm,
                        checkFrequencyHours: parseInt(e.target.value) || 24
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Extension Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={configForm.maxExtensionDays}
                      onChange={(e) => setConfigForm({
                        ...configForm,
                        maxExtensionDays: parseInt(e.target.value) || 5
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Change Thresholds */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Significant Change Thresholds</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Membership (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={configForm.significantChangeThresholds.membershipPercent}
                      onChange={(e) => setConfigForm({
                        ...configForm,
                        significantChangeThresholds: {
                          ...configForm.significantChangeThresholds,
                          membershipPercent: parseFloat(e.target.value) || 1
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Club Count (Absolute)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={configForm.significantChangeThresholds.clubCountAbsolute}
                      onChange={(e) => setConfigForm({
                        ...configForm,
                        significantChangeThresholds: {
                          ...configForm.significantChangeThresholds,
                          clubCountAbsolute: parseInt(e.target.value) || 1
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Distinguished (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={configForm.significantChangeThresholds.distinguishedPercent}
                      onChange={(e) => setConfigForm({
                        ...configForm,
                        significantChangeThresholds: {
                          ...configForm.significantChangeThresholds,
                          distinguishedPercent: parseFloat(e.target.value) || 2
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Extension Settings */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Extension Settings</h4>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoExtension"
                    checked={configForm.autoExtensionEnabled}
                    onChange={(e) => setConfigForm({
                      ...configForm,
                      autoExtensionEnabled: e.target.checked
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="autoExtension" className="ml-2 block text-sm text-gray-900">
                    Enable automatic extension when significant changes are detected
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleUpdateConfig}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Configuration'}
                </button>
                <button
                  onClick={() => {
                    setConfigForm(config);
                    setShowConfigForm(false);
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};