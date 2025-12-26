import React from 'react'
import { ExportButton } from './ExportButton'
import { DataStatus } from '../types/reconciliation'

interface EnhancedExportButtonProps {
  onExport: (metadata?: ExportMetadata) => void | Promise<void>
  dataStatus?: DataStatus
  label?: string
  disabled?: boolean
  className?: string
}

export interface ExportMetadata {
  reconciliationStatus: string
  dataCollectionDate: string
  exportTimestamp: string
  isPreliminary: boolean
  isFinal: boolean
  reconciliationPhase?: string
}

/**
 * Enhanced export button that includes reconciliation metadata in exports
 */
export const EnhancedExportButton: React.FC<EnhancedExportButtonProps> = ({
  onExport,
  dataStatus,
  label = 'Export CSV',
  disabled = false,
  className = '',
}) => {
  const handleExport = async () => {
    if (!dataStatus) {
      await onExport()
      return
    }

    const metadata: ExportMetadata = {
      reconciliationStatus: dataStatus.isFinal
        ? 'Final'
        : dataStatus.isPreliminary
          ? 'Preliminary'
          : 'Current',
      dataCollectionDate: dataStatus.dataCollectionDate,
      exportTimestamp: new Date().toISOString(),
      isPreliminary: dataStatus.isPreliminary,
      isFinal: dataStatus.isFinal,
      reconciliationPhase: dataStatus.reconciliationStatus?.phase,
    }

    await onExport(metadata)
  }

  return (
    <ExportButton
      onExport={handleExport}
      label={label}
      disabled={disabled}
      className={className}
    />
  )
}
