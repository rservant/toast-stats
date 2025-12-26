import { useState } from 'react';
import { apiClient } from '../services/api';

export interface AssessmentSummary {
  month: string; // YYYY-MM
  snapshotDate?: string;
  totalClubs?: number;
  totalMembership?: number;
  distinctClubsSeen?: number;
}

export interface ClubData {
  clubId?: string;
  id?: string;
  club_id?: string;
  clubName?: string;
  membership?: number;
  members?: number;
  membershipTotal?: number;
  membership_count?: number;
  currentMembers?: number;
  totalMembers?: number;
  [key: string]: unknown; // Allow additional dynamic fields
}

export interface DistrictDataResponse {
  clubPerformance?: ClubData[];
  districtPerformance?: unknown[];
  [key: string]: unknown;
}

export const extractMembershipFromClub = (club: ClubData): number => {
  if (!club || typeof club !== 'object') return 0;
  const candidates = ['membership', 'members', 'membershipTotal', 'membership_count', 'currentMembers', 'totalMembers'];
  for (const key of candidates) {
    const v = club[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.match(/^\d+$/)) return parseInt(v, 10);
  }
  return 0;
};

/**
 * Hook for computing a lightweight assessment summary from cached daily district data.
 * It intentionally computes a conservative snapshot (latest date in month) and simple aggregates.
 */
export const useAssessment = () => {
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const computeMonthlySummary = async (
    districtId: string,
    month: string, // YYYY-MM
    datesInMonth: string[] // full YYYY-MM-DD dates that belong to the month
  ): Promise<AssessmentSummary> => {
    setIsComputing(true);
    setError(null);
    try {
      if (!districtId) throw new Error('districtId required');
      if (!month) throw new Error('month required');

      // If there are no dates, return empty summary
      if (!datesInMonth || datesInMonth.length === 0) {
        return { month };
      }

      // Fetch all dates in parallel (cached by api client / server)
      const responses = await Promise.all(
        datesInMonth.map((d) => apiClient.get(`/districts/${districtId}/data/${d}`).then((r) => r.data).catch(() => null))
      );

      const validResponses = responses.filter(Boolean) as DistrictDataResponse[];
      // Determine latest available date in the month
      const latest = [...datesInMonth]
        .filter((_, i) => !!responses[i])
        .sort()
        .pop();

      // Snapshot comes from latest day's data if present
      const latestData: DistrictDataResponse | null = latest ? await apiClient.get(`/districts/${districtId}/data/${latest}`).then((r) => r.data).catch(() => null) : null;

      let totalClubs: number | undefined = undefined;
      let totalMembership: number | undefined = undefined;

      if (latestData && Array.isArray(latestData.clubPerformance)) {
        totalClubs = latestData.clubPerformance.length;
        totalMembership = latestData.clubPerformance.reduce((acc: number, club: ClubData) => acc + extractMembershipFromClub(club), 0);
      } else if (latestData && Array.isArray(latestData.districtPerformance)) {
        totalClubs = latestData.districtPerformance.length;
      }

      // Count distinct club ids seen across all days (best-effort)
      const clubIdSet = new Set<string>();
      for (const day of validResponses) {
        const clubs = day.clubPerformance || [];
        for (const c of clubs) {
          if (c && (c.clubId || c.id || c.club_id)) {
            clubIdSet.add(String(c.clubId || c.id || c.club_id));
          } else if (c && c.clubName) {
            clubIdSet.add(c.clubName);
          }
        }
      }

      const summary: AssessmentSummary = {
        month,
        snapshotDate: latest || undefined,
        totalClubs,
        totalMembership,
        distinctClubsSeen: clubIdSet.size || undefined,
      };

      setIsComputing(false);
      return summary;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      setError(error);
      setIsComputing(false);
      throw error;
    }
  };

  const generateAssessment = async (payload: { districtId: string; programYearStart: string; programYearEnd: string; month: string }) => {
    // POST to backend to persist immutable assessment
    // Backend expects district_number, program_year, month (transform from frontend payload)
    const backendPayload = {
      district_number: Number(payload.districtId),
      program_year: `${payload.programYearStart}/${payload.programYearEnd}`,
      month: payload.month,
    };
    console.log('useAssessment.generateAssessment - transformed payload:', backendPayload);
    const resp = await apiClient.post('/assessment/generate', backendPayload);
    return resp.data;
  };

  const fetchAssessment = async (districtId: string, programYear: string, month: string) => {
    // GET persisted assessment from server. Backend expects path params: /monthly/:districtId/:programYear/:month
    try {
      const resp = await apiClient.get(`/assessment/monthly/${districtId}/${encodeURIComponent(programYear)}/${encodeURIComponent(month)}`);
      return resp.data;
    } catch (err: unknown) {
      // If server returns 404 or no assessment, we return null for caller to decide
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { status?: number } };
        if (axiosError.response?.status === 404) return null;
      }
      throw err;
    }
  };

  const deleteAssessment = async (districtId: string, programYear: string, month: string) => {
    // DELETE persisted assessment from server
    const resp = await apiClient.delete(`/assessment/monthly/${districtId}/${encodeURIComponent(programYear)}/${encodeURIComponent(month)}`);
    return resp.data;
  };

  return {
    isComputing,
    error,
    computeMonthlySummary,
    generateAssessment,
    fetchAssessment,
    deleteAssessment,
  };
};

export default useAssessment;
