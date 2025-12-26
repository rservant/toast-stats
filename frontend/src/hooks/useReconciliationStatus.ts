import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { DataStatusResponse } from '../types/reconciliation'

/**
 * Hook to fetch reconciliation status for a district and month
 */
export const useReconciliationStatus = (
  districtId: string,
  targetMonth: string
) => {
  return useQuery({
    queryKey: ['reconciliation-status', districtId, targetMonth],
    queryFn: async (): Promise<DataStatusResponse> => {
      const response = await apiClient.get(
        `/reconciliation/status/${districtId}/${targetMonth}`
      )
      return response.data
    },
    enabled: !!districtId && !!targetMonth,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for active reconciliations
  })
}

/**
 * Hook to get current month in YYYY-MM format for reconciliation
 */
export const useCurrentReconciliationMonth = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
