import React from 'react'
import { useDistrictExport } from '../hooks/useDistrictExport'

interface DistrictExportButtonProps {
  districtId: string
  startDate?: string
  endDate?: string
}

export const DistrictExportButton: React.FC<DistrictExportButtonProps> = ({
  districtId,
  startDate,
  endDate,
}) => {
  const { isExporting, error, exportToCSV, clearError } =
    useDistrictExport(districtId)

  const handleExport = () => {
    clearError()
    exportToCSV(startDate, endDate)
  }

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-2 px-3 py-2 bg-tm-loyal-blue text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm font-tm-headline font-medium"
        title="Export district analytics to CSV"
      >
        {isExporting ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
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
            Exporting...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export CSV
          </>
        )}
      </button>
      {error && (
        <div className="absolute top-full mt-1 right-0 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm px-2 py-1 whitespace-nowrap z-10">
          {error.message}
        </div>
      )}
    </div>
  )
}
