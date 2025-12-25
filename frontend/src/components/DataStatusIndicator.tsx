import React from 'react';
import { DataStatus } from '../types/reconciliation';
import { Tooltip, InfoIcon } from './Tooltip';

interface DataStatusIndicatorProps {
  dataStatus: DataStatus;
  className?: string;
  showDetails?: boolean;
}

/**
 * Component to display data collection status and reconciliation information
 */
export const DataStatusIndicator: React.FC<DataStatusIndicatorProps> = ({
  dataStatus,
  className = '',
  showDetails = true,
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = () => {
    if (dataStatus.isFinal) return 'text-green-700 bg-green-100 border-green-200';
    if (dataStatus.isPreliminary) return 'text-amber-700 bg-amber-100 border-amber-200';
    return 'text-gray-700 bg-gray-100 border-gray-200';
  };

  const getStatusIcon = () => {
    if (dataStatus.isFinal) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (dataStatus.isPreliminary) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const getStatusText = () => {
    if (dataStatus.isFinal) return 'Final';
    if (dataStatus.isPreliminary) return 'Preliminary';
    return 'Processing';
  };

  const getTooltipContent = () => {
    let content = `Data collected as of ${formatDate(dataStatus.dataCollectionDate)}. `;
    
    if (dataStatus.isFinal) {
      content += 'This data has been finalized after the reconciliation period.';
    } else if (dataStatus.isPreliminary) {
      content += 'This data is preliminary and may change during the reconciliation period.';
    } else {
      content += 'Data collection is in progress.';
    }

    if (dataStatus.reconciliationStatus?.message) {
      content += ` ${dataStatus.reconciliationStatus.message}`;
    }

    return content;
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Status Badge */}
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-sm font-medium ${getStatusColor()}`}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        <Tooltip content={getTooltipContent()}>
          <InfoIcon />
        </Tooltip>
      </div>

      {/* Data Collection Date */}
      {showDetails && (
        <span className="text-sm text-gray-600">
          Data as of {formatDate(dataStatus.dataCollectionDate)}
        </span>
      )}

      {/* Reconciliation Phase */}
      {showDetails && dataStatus.reconciliationStatus && !dataStatus.isFinal && (
        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
          {dataStatus.reconciliationStatus.phase === 'monitoring' && 'Monitoring Changes'}
          {dataStatus.reconciliationStatus.phase === 'stabilizing' && `Stabilizing (${dataStatus.reconciliationStatus.daysStable}/${dataStatus.reconciliationStatus.daysActive} days)`}
          {dataStatus.reconciliationStatus.phase === 'finalizing' && 'Finalizing'}
          {dataStatus.reconciliationStatus.phase === 'failed' && 'Reconciliation Failed'}
        </span>
      )}
    </div>
  );
};