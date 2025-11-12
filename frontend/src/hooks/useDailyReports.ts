import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type {
  DailyReportsResponse,
  DailyReportDetailResponse,
} from '../types/districts';

/**
 * React Query hook to fetch daily reports for a date range
 */
export const useDailyReports = (
  districtId: string | null,
  startDate: string,
  endDate: string
) => {
  return useQuery<DailyReportsResponse, Error>({
    queryKey: ['dailyReports', districtId, startDate, endDate],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required');
      }
      const response = await apiClient.get<DailyReportsResponse>(
        `/districts/${districtId}/daily-reports`,
        {
          params: { startDate, endDate },
        }
      );
      return response.data;
    },
    enabled: !!districtId && !!startDate && !!endDate,
    staleTime: 15 * 60 * 1000, // 15 minutes - matches backend cache
    retry: 2,
  });
};

/**
 * React Query hook to fetch detailed daily report for a specific date
 */
export const useDailyReportDetail = (
  districtId: string | null,
  date: string | null
) => {
  return useQuery<DailyReportDetailResponse, Error>({
    queryKey: ['dailyReportDetail', districtId, date],
    queryFn: async () => {
      if (!districtId || !date) {
        throw new Error('District ID and date are required');
      }
      const response = await apiClient.get<DailyReportDetailResponse>(
        `/districts/${districtId}/daily-reports/${date}`
      );
      return response.data;
    },
    enabled: !!districtId && !!date,
    staleTime: 15 * 60 * 1000, // 15 minutes - matches backend cache
    retry: 2,
  });
};
