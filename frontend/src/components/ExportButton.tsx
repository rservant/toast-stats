import React, { useState } from 'react'
import { Button } from './ui/Button'

interface ExportButtonProps {
  onExport: () => void | Promise<void>
  label?: string
  disabled?: boolean
  className?: string
}

/**
 * Download icon SVG component
 */
const DownloadIcon = () => (
  <svg
    className="h-5 w-5"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
)

/**
 * Reusable export button component with loading state
 */
export const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  label = 'Export CSV',
  disabled = false,
  className = '',
}) => {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (disabled || isExporting) return

    setIsExporting(true)
    try {
      await onExport()
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || isExporting}
      variant="primary"
      loading={isExporting}
      className={className}
      aria-label={
        isExporting
          ? 'Exporting data to CSV file'
          : `${label} - Download data as CSV file`
      }
      aria-busy={isExporting}
    >
      {!isExporting && <DownloadIcon />}
      <span>{isExporting ? 'Exporting...' : label}</span>
    </Button>
  )
}
