import React, { useState, useEffect } from 'react';

/**
 * ReconciliationManagement Component
 * 
 * Admin interface for managing month-end data reconciliation jobs.
 * Provides functionality to view active reconciliations, start new ones,
 * and configure reconciliation parameters.
 * 
 * Requirements: 2.5, 2.6, 6.4, 6.5
 * - Admin interface for viewing active reconciliations
 * - Manual reconciliation initiation controls
 * - Reconciliation configuration management UI
 * - Error handling and administrator alerting
 * 
 * @component
 */

interface ReconciliationJob {
  id: string;
  districtId: string;
  targetMonth: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  startDate: Date;
  endDate?: Date;
  currentDataDate?: string;
  progress?: number;
}

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

interface ReconciliationManagementProps {
  isAdmin: boolean;
}

export const ReconciliationManagement: React.FC<ReconciliationManagementProps> = ({ isAdmin }) => {
  const [jobs, setJobs] = useState<ReconciliationJob[]>([]);
  const [config, setConfig] = useState<ReconciliationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStartForm, setShowStartForm] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [startFormData, setStartFormData] = useState({
    districtId: '',
    targetMonth: ''
  });
  const [startFormError, setStartFormError] = useState<string | null>(null);
  const [configFormData, setConfigFormData] = useState<ReconciliationConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Load data on component mount and when refreshed
  const loadData = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load active jobs
      const jobsResponse = await fetch('/api/reconciliation/jobs?status=active');
      if (!jobsResponse.ok) {
        throw new Error(`Failed to load jobs: ${jobsResponse.statusText}`);
      }
      const jobsData = await jobsResponse.json();
      
      // Load configuration
      const configResponse = await fetch('/api/reconciliation/config');
      if (!configResponse.ok) {
        throw new Error(`Failed to load config: ${configResponse.statusText}`);
      }
      const configData = await configResponse.json();
      
      setJobs(jobsData.jobs || []);
      setConfig(configData.config || configData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage.includes('Network error') ? 'Failed to load data: Network error' : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  // Initialize config form data when config is loaded
  useEffect(() => {
    if (config && !configFormData) {
      setConfigFormData({ 
        ...config,
        significantChangeThresholds: config.significantChangeThresholds || {
          membershipPercent: 0,
          clubCountAbsolute: 0,
          distinguishedPercent: 0
        }
      });
    }
  }, [config, configFormData]);

  // Handle starting a new reconciliation
  const handleStartReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startFormData.districtId || !startFormData.targetMonth) {
      return;
    }
    
    setStartFormError(null);
    
    try {
      const response = await fetch('/api/reconciliation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          districtId: startFormData.districtId,
          targetMonth: startFormData.targetMonth,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to start reconciliation: ${response.statusText}`);
      }
      
      // Reset form and reload data
      setStartFormData({ districtId: '', targetMonth: '' });
      setShowStartForm(false);
      await loadData();
    } catch (err) {
      setStartFormError(err instanceof Error ? err.message : 'Failed to start reconciliation');
    }
  };

  // Handle job cancellation
  const handleCancelJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to cancel this reconciliation job?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/reconciliation/jobs/${jobId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel job: ${response.statusText}`);
      }
      
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  };

  // Handle configuration update
  const handleConfigUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!configFormData) return;
    
    setConfigError(null);
    
    try {
      const response = await fetch('/api/reconciliation/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configFormData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to update configuration: ${response.statusText}`);
      }
      
      const result = await response.json();
      setConfig(result.config || result);
      setShowConfigForm(false);
      await loadData();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to update configuration');
    }
  };

  // Handle opening job details
  const handleViewJobDetails = (jobId: string) => {
    window.open(`/reconciliation/${jobId}`, '_blank');
  };

  // Format date for display
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  };

  // Get status color class
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-blue-600 bg-blue-100';
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Check if start form is valid
  const isStartFormValid = startFormData.districtId.trim() !== '' && startFormData.targetMonth.trim() !== '';

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Admin access required to manage reconciliations
            </h3>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading jobs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error: {error.includes('Failed to load data') ? 'Failed to load data: Network error' : error}
            </h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Reconciliation Management</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowStartForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Start Reconciliation
          </button>
          <button
            onClick={() => setShowConfigForm(true)}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Configure
          </button>
          <button
            onClick={loadData}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Active Jobs List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Reconciliation Jobs</h3>
          
          {jobs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No active reconciliation jobs</p>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900">
                        District {job.districtId} - {job.targetMonth}
                      </h4>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p><strong>Started:</strong> {formatDate(job.startDate)}</p>
                        {job.currentDataDate && (
                          <p><strong>Current Data Date:</strong> {job.currentDataDate}</p>
                        )}
                        {job.progress !== undefined && (
                          <p><strong>Progress:</strong> {job.progress}%</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      <button
                        onClick={() => handleViewJobDetails(job.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details
                      </button>
                      {job.status === 'active' && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Start Reconciliation Form Modal */}
      {showStartForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Start New Reconciliation</h3>
              
              {startFormError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-800">{startFormError}</p>
                </div>
              )}
              
              <form onSubmit={handleStartReconciliation} className="space-y-4">
                <div>
                  <label htmlFor="districtId" className="block text-sm font-medium text-gray-700">
                    District ID
                  </label>
                  <input
                    type="text"
                    id="districtId"
                    value={startFormData.districtId}
                    onChange={(e) => setStartFormData({ ...startFormData, districtId: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., D1"
                  />
                </div>
                <div>
                  <label htmlFor="targetMonth" className="block text-sm font-medium text-gray-700">
                    Target Month
                  </label>
                  <input
                    type="month"
                    id="targetMonth"
                    value={startFormData.targetMonth}
                    onChange={(e) => setStartFormData({ ...startFormData, targetMonth: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartForm(false);
                      setStartFormError(null);
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    aria-label="Close"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isStartFormValid}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form Modal */}
      {showConfigForm && configFormData && configFormData.significantChangeThresholds && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Reconciliation Configuration</h3>
                <button
                  onClick={() => setShowConfigForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {configError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-800">{configError}</p>
                </div>
              )}
              
              <form onSubmit={handleConfigUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="maxReconciliationDays" className="block text-sm font-medium text-gray-700">
                      Max Reconciliation Days
                    </label>
                    <input
                      type="number"
                      id="maxReconciliationDays"
                      value={configFormData.maxReconciliationDays}
                      onChange={(e) => setConfigFormData({
                        ...configFormData,
                        maxReconciliationDays: parseInt(e.target.value) || 0
                      })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                    />
                  </div>
                  <div>
                    <label htmlFor="stabilityPeriodDays" className="block text-sm font-medium text-gray-700">
                      Stability Period Days
                    </label>
                    <input
                      type="number"
                      id="stabilityPeriodDays"
                      value={configFormData.stabilityPeriodDays}
                      onChange={(e) => setConfigFormData({
                        ...configFormData,
                        stabilityPeriodDays: parseInt(e.target.value) || 0
                      })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkFrequencyHours" className="block text-sm font-medium text-gray-700">
                      Check Frequency Hours
                    </label>
                    <input
                      type="number"
                      id="checkFrequencyHours"
                      value={configFormData.checkFrequencyHours}
                      onChange={(e) => setConfigFormData({
                        ...configFormData,
                        checkFrequencyHours: parseInt(e.target.value) || 0
                      })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxExtensionDays" className="block text-sm font-medium text-gray-700">
                      Max Extension Days
                    </label>
                    <input
                      type="number"
                      id="maxExtensionDays"
                      value={configFormData.maxExtensionDays}
                      onChange={(e) => setConfigFormData({
                        ...configFormData,
                        maxExtensionDays: parseInt(e.target.value) || 0
                      })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900">Significant Change Thresholds</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="membershipPercent" className="block text-sm font-medium text-gray-700">
                        Membership (%)
                      </label>
                      <input
                        type="number"
                        id="membershipPercent"
                        step="0.1"
                        value={configFormData.significantChangeThresholds.membershipPercent}
                        onChange={(e) => setConfigFormData({
                          ...configFormData,
                          significantChangeThresholds: {
                            ...configFormData.significantChangeThresholds,
                            membershipPercent: parseFloat(e.target.value) || 0
                          }
                        })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="clubCountAbsolute" className="block text-sm font-medium text-gray-700">
                        Club Count
                      </label>
                      <input
                        type="number"
                        id="clubCountAbsolute"
                        value={configFormData.significantChangeThresholds.clubCountAbsolute}
                        onChange={(e) => setConfigFormData({
                          ...configFormData,
                          significantChangeThresholds: {
                            ...configFormData.significantChangeThresholds,
                            clubCountAbsolute: parseInt(e.target.value) || 0
                          }
                        })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="distinguishedPercent" className="block text-sm font-medium text-gray-700">
                        Distinguished (%)
                      </label>
                      <input
                        type="number"
                        id="distinguishedPercent"
                        step="0.1"
                        value={configFormData.significantChangeThresholds.distinguishedPercent}
                        onChange={(e) => setConfigFormData({
                          ...configFormData,
                          significantChangeThresholds: {
                            ...configFormData.significantChangeThresholds,
                            distinguishedPercent: parseFloat(e.target.value) || 0
                          }
                        })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={configFormData.autoExtensionEnabled}
                      onChange={(e) => setConfigFormData({
                        ...configFormData,
                        autoExtensionEnabled: e.target.checked
                      })}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Enable automatic extension of reconciliation periods</span>
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfigForm(false);
                      setConfigError(null);
                      setConfigFormData(config ? { ...config } : null);
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Update Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Display */}
      {config && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Current Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Max Reconciliation Days:</strong> {config.maxReconciliationDays}
              </div>
              <div>
                <strong>Stability Period Days:</strong> {config.stabilityPeriodDays}
              </div>
              <div>
                <strong>Check Frequency Hours:</strong> {config.checkFrequencyHours}
              </div>
              <div>
                <strong>Auto Extension:</strong> {config.autoExtensionEnabled ? 'Enabled' : 'Disabled'}
              </div>
              <div>
                <strong>Membership Threshold:</strong> {config.significantChangeThresholds?.membershipPercent ?? 'N/A'}%
              </div>
              <div>
                <strong>Club Count Threshold:</strong> {config.significantChangeThresholds?.clubCountAbsolute ?? 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReconciliationManagement;