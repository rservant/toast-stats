import React, { useState } from 'react'

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
    <button
      onClick={handleExport}
      disabled={disabled || isExporting}
      className={`
        inline-flex items-center gap-2 px-4 py-2 
        bg-blue-600 text-white rounded-lg
        hover:bg-blue-700 
        disabled:bg-gray-400 disabled:cursor-not-allowed
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${className}
      `}
      aria-label={
        isExporting
          ? 'Exporting data to CSV file'
          : `${label} - Download data as CSV file`
      }
      aria-busy={isExporting}
    >
      {isExporting ? (
        <>
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Exporting...</span>
        </>
      ) : (
        <>
          <DownloadIcon />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}
