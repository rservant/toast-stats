import { useState, useCallback } from 'react'
import { apiClient } from '../services/api'

interface ExportState {
  isExporting: boolean
  error: Error | null
}

interface UseDistrictExportResult extends ExportState {
  exportToCSV: (startDate?: string, endDate?: string) => Promise<void>
  clearError: () => void
}

/**
 * Hook to handle district data export to CSV
 */
export const useDistrictExport = (
  districtId: string | null
): UseDistrictExportResult => {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    error: null,
  })

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const exportToCSV = useCallback(
    async (startDate?: string, endDate?: string) => {
      if (!districtId) {
        setState(prev => ({
          ...prev,
          error: new Error('District ID is required'),
        }))
        return
      }

      setState({ isExporting: true, error: null })

      try {
        const params = new URLSearchParams({ format: 'csv' })
        if (startDate) params.append('startDate', startDate)
        if (endDate) params.append('endDate', endDate)

        const response = await apiClient.get(
          `/districts/${districtId}/export?${params.toString()}`,
          {
            responseType: 'blob',
          }
        )

        // Extract filename from Content-Disposition header or generate one
        const contentDisposition = response.headers['content-disposition']
        let filename = `district_${districtId}_analytics.csv`
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/)
          if (filenameMatch?.[1]) {
            filename = filenameMatch[1]
          }
        }

        // Create blob and trigger download
        const blob = new Blob([response.data as BlobPart], { type: 'text/csv;charset=utf-8' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        setState({ isExporting: false, error: null })
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to export data')
        setState({ isExporting: false, error })
      }
    },
    [districtId]
  )

  return {
    ...state,
    exportToCSV,
    clearError,
  }
}
