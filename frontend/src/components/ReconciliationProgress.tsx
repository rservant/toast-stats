import React from 'react';
import { Tooltip, InfoIcon } from './Tooltip';

/**
 * Represents a metric change during reconciliation
 */
export interface MetricChange {
  /** Name of the metric that changed */
  metricName: string;
  /** Previous value */
  previousValue: number;
  /** Current value */
  currentValue: number;
  /** Percentage change (positive or negative) */
  percentageChange: number;
  /** Whether this change is considered significant */
  isSignificant: boolean;
}

/**
 * Props for the ReconciliationProgress component
 */
interface ReconciliationProgressProps {
  /** Array of metric changes detected during reconciliation */
  metricChanges: MetricChange[];
  /** The target month being reconciled (YYYY-MM format) */
  targetMonth: string;
  /** Optional CSS classes */
  className?: string;
  /** Whether to show detailed change information */
  showDetails?: boolean;
}

/**
 * ReconciliationProgress Component
 * 
 * Displays metric changes and progress visualization during the reconciliation
 * process, showing how key performance indicators have evolved.
 * 
 * Requirements: 5.2, 5.4
 * - Shows which metrics changed on each day and by how much
 * - Indicates stability period in the reconciliation view
 * 
 * @component
 */
export const ReconciliationProgress: React.FC<ReconciliationProgressProps> = ({
  metricChanges,
  targetMonth,
  className = '',
  showDetails = true,
}) => {
  const formatValue = (value: number, metricName: string) => {
    // Format based on metric type
    if (metricName.toLowerCase().includes('percent') || metricName.toLowerCase().includes('%')) {
      return `${value.toFixed(1)}%`;
    }
    if (metricName.toLowerCase().includes('count') || metricName.toLowerCase().includes('total')) {
      return value.toLocaleString();
    }
    return value.toLocaleString();
  };

  const formatPercentageChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const getChangeColor = (change: MetricChange) => {
    if (change.isSignificant) {
      return change.percentageChange >= 0 
        ? 'text-green-700 bg-green-50 border-green-200'
        : 'text-red-700 bg-red-50 border-red-200';
    }
    return change.percentageChange >= 0
      ? 'text-blue-700 bg-blue-50 border-blue-200'
      : 'text-orange-700 bg-orange-50 border-orange-200';
  };

  const getChangeIcon = (change: MetricChange) => {
    if (change.percentageChange > 0) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
      );
    }
    if (change.percentageChange < 0) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    );
  };

  const getTooltipContent = (change: MetricChange) => {
    let content = `${change.metricName}\n`;
    content += `Previous: ${formatValue(change.previousValue, change.metricName)}\n`;
    content += `Current: ${formatValue(change.currentValue, change.metricName)}\n`;
    content += `Change: ${formatPercentageChange(change.percentageChange)}`;
    
    if (change.isSignificant) {
      content += '\n\nThis change is considered significant and may extend the reconciliation period.';
    }
    
    return content;
  };

  const significantChanges = metricChanges.filter(change => change.isSignificant);
  const minorChanges = metricChanges.filter(change => !change.isSignificant);

  if (metricChanges.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Metric Changes
          </h3>
          <Tooltip content="Shows how key performance metrics have changed during the reconciliation period">
            <InfoIcon />
          </Tooltip>
        </div>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600">No metric changes detected for {targetMonth}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Metric Changes
        </h3>
        <Tooltip content="Shows how key performance metrics have changed during reconciliation. Significant changes may extend the monitoring period.">
          <InfoIcon />
        </Tooltip>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{metricChanges.length}</div>
          <div className="text-sm text-gray-600">Total Changes</div>
        </div>
        <div className="text-center p-3 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-700">{significantChanges.length}</div>
          <div className="text-sm text-gray-600">Significant</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">{minorChanges.length}</div>
          <div className="text-sm text-gray-600">Minor</div>
        </div>
      </div>

      {/* Significant Changes */}
      {significantChanges.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Significant Changes</h4>
          <div className="space-y-3">
            {significantChanges.map((change, index) => (
              <div key={`significant-${index}`} className={`rounded-lg border p-4 ${getChangeColor(change)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getChangeIcon(change)}
                    <span className="font-medium">{change.metricName}</span>
                    <Tooltip content={getTooltipContent(change)}>
                      <InfoIcon />
                    </Tooltip>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {formatPercentageChange(change.percentageChange)}
                    </div>
                  </div>
                </div>
                {showDetails && (
                  <div className="mt-2 text-sm opacity-75">
                    <span>
                      {formatValue(change.previousValue, change.metricName)} → {formatValue(change.currentValue, change.metricName)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minor Changes */}
      {minorChanges.length > 0 && showDetails && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Minor Changes</h4>
          <div className="space-y-2">
            {minorChanges.map((change, index) => (
              <div key={`minor-${index}`} className={`rounded-lg border p-3 ${getChangeColor(change)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getChangeIcon(change)}
                    <span className="text-sm font-medium">{change.metricName}</span>
                    <Tooltip content={getTooltipContent(change)}>
                      <InfoIcon />
                    </Tooltip>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatPercentageChange(change.percentageChange)}
                    </div>
                    <div className="text-xs opacity-75">
                      {formatValue(change.previousValue, change.metricName)} → {formatValue(change.currentValue, change.metricName)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full" />
            <span>Significant changes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span>Minor changes</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
            <span>Increase</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
            <span>Decrease</span>
          </div>
        </div>
      </div>
    </div>
  );
};