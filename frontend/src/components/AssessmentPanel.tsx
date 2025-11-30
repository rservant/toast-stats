import React from 'react';
import { useDistrictCachedDates } from '../hooks/useDistrictData';
import useAssessment, { AssessmentSummary } from '../hooks/useAssessment';

interface Props {
  districtId: string;
  selectedProgramYear: { startDate: string; endDate: string };
  selectedDate?: string | undefined;
}

const monthFromDate = (d: string) => d.slice(0, 7); // YYYY-MM

const uniqueMonths = (dates: string[]) => {
  const set = new Set<string>();
  for (const d of dates) set.add(monthFromDate(d));
  return Array.from(set).sort();
};

const AssessmentPanel: React.FC<Props> = ({ districtId, selectedProgramYear, selectedDate }) => {
  const { data: cachedDatesData } = useDistrictCachedDates(districtId || '');
  const { isComputing, computeMonthlySummary, generateAssessment, fetchAssessment } = useAssessment();

  const allDates = cachedDatesData?.dates || [];

  // Months available within the program year
  const months = React.useMemo(() => uniqueMonths(allDates.filter((d) => d >= selectedProgramYear.startDate && d <= selectedProgramYear.endDate)), [allDates, selectedProgramYear]);

  const defaultMonth = selectedDate ? monthFromDate(selectedDate) : months.length ? months[months.length - 1] : undefined;
  const [month, setMonth] = React.useState<string | undefined>(defaultMonth);
  const [summary, setSummary] = React.useState<AssessmentSummary | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [genResult, setGenResult] = React.useState<any>(null);
  const [persisted, setPersisted] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMonth(defaultMonth);
  }, [defaultMonth]);

  const handleCompute = async () => {
    // For option A (thin client): fetch authoritative persisted assessment from server
    setError(null);
    if (!month) return setError('Select a month');
    try {
      const res = await fetchAssessment(districtId, `${selectedProgramYear.startDate}/${selectedProgramYear.endDate}`, month);
      if (res) {
        setPersisted(res.data || res);
      } else {
        setPersisted(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch persisted assessment');
    }
  };

  const handleGenerate = async () => {
    setError(null);
    if (!month) return setError('Select a month');
    setIsGenerating(true);
    try {
      const payload = {
        districtId,
        programYearStart: selectedProgramYear.startDate,
        programYearEnd: selectedProgramYear.endDate,
        month,
      };
      const res = await generateAssessment(payload as any);
      setGenResult(res);
      // After generation, fetch persisted assessment to reflect authoritative copy
      const persistedRes = await fetchAssessment(districtId, `${selectedProgramYear.startDate}/${selectedProgramYear.endDate}`, month);
      setPersisted(persistedRes?.data || persistedRes || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to generate assessment');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Assessment</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Month</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md p-2">
            <option value="">Select month</option>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">Months with cached data in the selected program year</div>
        </div>

        <div className="sm:col-span-2 flex items-end gap-2">
          <button onClick={handleCompute} className="px-4 py-2 bg-blue-600 text-white rounded-md" disabled={isComputing || !month}>
            {isComputing ? 'Refreshing...' : 'Load Persisted Assessment'}
          </button>
          <button onClick={handleGenerate} className="px-4 py-2 bg-green-600 text-white rounded-md" disabled={isGenerating || !month || !!persisted}>
            {isGenerating ? 'Generating...' : persisted ? 'Already Generated' : 'Generate Immutable Assessment'}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}


      {persisted && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="p-4 border rounded-md">
            <div className="text-xs text-gray-500">Generated At</div>
            <div className="text-lg font-semibold">{persisted.created_at || persisted.timestamp || 'N/A'}</div>
          </div>
          <div className="p-4 border rounded-md">
            <div className="text-xs text-gray-500">Goal 1 Status</div>
            <div className="text-lg font-semibold">{persisted.data?.goal_1_status?.status || persisted.goal_1_status?.status || 'N/A'}</div>
          </div>
          <div className="p-4 border rounded-md">
            <div className="text-xs text-gray-500">Goal 2 Status</div>
            <div className="text-lg font-semibold">{persisted.data?.goal_2_status?.status || persisted.goal_2_status?.status || 'N/A'}</div>
          </div>
        </div>
      )}

      {!persisted && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="p-4 border rounded-md">
            <div className="text-xs text-gray-500">Snapshot Date (preview)</div>
            <div className="text-lg font-semibold">{summary.snapshotDate || 'N/A'}</div>
          </div>
          <div className="p-4 border rounded-md">
            <div className="text-xs text-gray-500">Total Clubs (snapshot)</div>
            <div className="text-lg font-semibold">{summary.totalClubs ?? 'N/A'}</div>
          </div>
          <div className="p-4 border rounded-md">
            <div className="text-xs text-gray-500">Total Membership (snapshot)</div>
            <div className="text-lg font-semibold">{summary.totalMembership ?? 'N/A'}</div>
          </div>
        </div>
      )}

      {genResult && (
        <div className="mt-4 p-4 border-l-4 border-green-500 bg-green-50 rounded-md">
          <div className="text-sm text-green-800">Assessment generated successfully.</div>
          <pre className="text-xs mt-2 text-gray-700 overflow-auto">{JSON.stringify(genResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default AssessmentPanel;
