import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'

/**
 * District configuration data structure
 */
export interface DistrictConfiguration {
  configuredDistricts: string[]
  lastUpdated: string
  updatedBy: string
  version: number
}

/**
 * Configuration change record for audit trail
 */
export interface ConfigurationChange {
  timestamp: string
  action: 'add' | 'remove' | 'replace'
  districtId: string | null
  adminUser: string
  previousDistricts?: string[]
  newDistricts?: string[]
  context?: string
}

/**
 * District collection information
 */
export interface DistrictCollectionInfo {
  districtId: string
  lastSuccessfulCollection: string | null
  status: 'valid' | 'invalid' | 'unknown'
  recentSuccessCount: number
}

/**
 * Configuration validation result
 */
export interface ConfigurationValidationResult {
  isValid: boolean
  configuredDistricts: string[]
  validDistricts: string[]
  invalidDistricts: string[]
  warnings: string[]
  lastCollectionInfo: DistrictCollectionInfo[]
}

/**
 * District configuration response from API
 */
export interface DistrictConfigurationResponse {
  configuration: DistrictConfiguration
  status: {
    hasConfiguredDistricts: boolean
    totalDistricts: number
  }
  validation: ConfigurationValidationResult
  metadata: {
    operation_id: string
    duration_ms: number
  }
}

/**
 * Hook for fetching district configuration
 */
export function useDistrictConfiguration() {
  return useQuery({
    queryKey: ['district-configuration'],
    queryFn: async (): Promise<DistrictConfigurationResponse> => {
      const response = await apiClient.get('/admin/districts/config')
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook for adding districts to configuration
 */
export function useAddDistricts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      districtIds,
      replace = false,
    }: {
      districtIds: string[]
      replace?: boolean
    }) => {
      const response = await apiClient.post('/admin/districts/config', {
        districtIds,
        replace,
      })
      return response.data
    },
    onSuccess: () => {
      // Invalidate and refetch district configuration
      queryClient.invalidateQueries({ queryKey: ['district-configuration'] })
      // Also invalidate rankings since district changes affect snapshots
      queryClient.invalidateQueries({ queryKey: ['district-rankings'] })
    },
  })
}

/**
 * Hook for removing a district from configuration
 */
export function useRemoveDistrict() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (districtId: string) => {
      const response = await apiClient.delete(
        `/admin/districts/config/${districtId}`
      )
      return response.data
    },
    onSuccess: () => {
      // Invalidate and refetch district configuration
      queryClient.invalidateQueries({ queryKey: ['district-configuration'] })
      // Also invalidate rankings since district changes affect snapshots
      queryClient.invalidateQueries({ queryKey: ['district-rankings'] })
    },
  })
}

/**
 * Hook for managing district configuration with local state
 */
export function useDistrictConfigurationManager() {
  const [editMode, setEditMode] = useState(false)
  const [localDistricts, setLocalDistricts] = useState<string[]>([])
  const [newDistrictInput, setNewDistrictInput] = useState('')

  const { data, isLoading, error, refetch } = useDistrictConfiguration()
  const addDistrictsMutation = useAddDistricts()
  const removeDistrictMutation = useRemoveDistrict()

  // Initialize local state when data loads
  const initializeLocalState = useCallback(() => {
    if (data?.configuration?.configuredDistricts) {
      setLocalDistricts([...data.configuration.configuredDistricts])
    }
  }, [data?.configuration?.configuredDistricts])

  // Add district to local state
  const addDistrictLocally = useCallback((districtId: string) => {
    const cleanId = districtId.trim().toUpperCase()
    if (cleanId && !localDistricts.includes(cleanId)) {
      setLocalDistricts(prev => [...prev, cleanId].sort())
    }
  }, [localDistricts])

  // Remove district from local state
  const removeDistrictLocally = useCallback((districtId: string) => {
    setLocalDistricts(prev => prev.filter(id => id !== districtId))
  }, [])

  // Save changes to server
  const saveChanges = useCallback(async () => {
    try {
      await addDistrictsMutation.mutateAsync({
        districtIds: localDistricts,
        replace: true,
      })
      setEditMode(false)
      return true
    } catch (error) {
      console.error('Failed to save district configuration:', error)
      return false
    }
  }, [localDistricts, addDistrictsMutation])

  // Cancel changes and revert to server state
  const cancelChanges = useCallback(() => {
    initializeLocalState()
    setEditMode(false)
    setNewDistrictInput('')
  }, [initializeLocalState])

  // Add single district immediately (not in edit mode)
  const addDistrict = useCallback(async (districtId: string) => {
    try {
      await addDistrictsMutation.mutateAsync({
        districtIds: [districtId],
        replace: false,
      })
      return true
    } catch (error) {
      console.error('Failed to add district:', error)
      return false
    }
  }, [addDistrictsMutation])

  // Remove single district immediately (not in edit mode)
  const removeDistrict = useCallback(async (districtId: string) => {
    try {
      await removeDistrictMutation.mutateAsync(districtId)
      return true
    } catch (error) {
      console.error('Failed to remove district:', error)
      return false
    }
  }, [removeDistrictMutation])

  return {
    // Data
    data,
    isLoading,
    error,
    refetch,

    // Edit mode state
    editMode,
    setEditMode,
    localDistricts,
    newDistrictInput,
    setNewDistrictInput,

    // Local state management
    initializeLocalState,
    addDistrictLocally,
    removeDistrictLocally,

    // Server operations
    saveChanges,
    cancelChanges,
    addDistrict,
    removeDistrict,

    // Mutation states
    isSaving: addDistrictsMutation.isPending,
    isRemoving: removeDistrictMutation.isPending,
    saveError: addDistrictsMutation.error,
    removeError: removeDistrictMutation.error,
  }
}