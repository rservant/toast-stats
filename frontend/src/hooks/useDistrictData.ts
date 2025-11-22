import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

/**
 * Interface for district cache entry containing all three report types
 */
export interface DistrictCacheEntry {
  districtId: string;
  date: string;
  districtPerformance: any[];
  divisionPerformance: any[];
  clubPerformance: any[];
  fetchedAt: string;
}

/**
 * Interface for cached dates response
 */
export interface CachedDatesResponse {
  districtId: string;
  dates: string[];
  count: number;
  dateRange: {
    startDate: string;
    endDate: string;
  } | null;
}

/**
 * Hook to fetch district data for a specific date
 * Retrieves cached district data including district, division, and club performance
 * 
 * @param districtId - The district ID to fetch data for
 * @param date - The date in YYYY-MM-DD format
 * @param enabled - Whether the query should be enabled (default: true)
 * @returns Query result with district cache entry
 * 
 * Requirements: 1.4
 */
export const useDistrictData = (
  districtId: string | null,
  date: string | null,
  enabled: boolean = true
) => {
  return useQuery<DistrictCacheEntry, Error>({
    queryKey: ['districtData', districtId, date],
    queryFn: async () => {
      if (!districtId || !date) {
        throw new Error('District ID and date are required');
      }

      const response = await apiClient.get<DistrictCacheEntry>(
        `/districts/${districtId}/data/${date}`
      );
      return response.data;
    },
    enabled: enabled && !!districtId && !!date,
    staleTime: 10 * 60 * 1000, // 10 minutes - data is historical and doesn't change
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (no data) or 400 (bad request)
      if (error?.response?.status === 404 || error?.response?.status === 400) {
        return false;
      }
      // Retry up to 2 times for network errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

/**
 * Hook to fetch all cached dates for a district
 * Returns list of dates that have cached data available
 * 
 * @param districtId - The district ID to fetch cached dates for
 * @param enabled - Whether the query should be enabled (default: true)
 * @returns Query result with cached dates and date range
 * 
 * Requirements: 1.4
 */
export const useDistrictCachedDates = (
  districtId: string | null,
  enabled: boolean = true
) => {
  return useQuery<CachedDatesResponse, Error>({
    queryKey: ['district-cached-dates', districtId],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required');
      }

      const response = await apiClient.get<CachedDatesResponse>(
        `/districts/${districtId}/cached-dates`
      );
      return response.data;
    },
    enabled: enabled && !!districtId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (no data) or 400 (bad request)
      if (error?.response?.status === 404 || error?.response?.status === 400) {
        return false;
      }
      // Retry up to 2 times for network errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
