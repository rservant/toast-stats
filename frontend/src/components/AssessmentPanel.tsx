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
  const { isComputing, generateAssessment, fetchAssessment, deleteAssessment } = useAssessment();

  const allDates = cachedDatesData?.dates || [];

  // Months available within the program year
  // Compute months and default selection from available cached dates within the program year.
  const datesInRange = React.useMemo(
    () => allDates.filter((d) => d >= selectedProgramYear.startDate && d <= selectedProgramYear.endDate),
    [allDates, selectedProgramYear]
  );

  const months = React.useMemo(() => uniqueMonths(datesInRange), [datesInRange]);

  // Default to the month containing the latest available cached date (data is often one day behind).
  const latestDateInRange = datesInRange.length ? [...datesInRange].sort().pop() : undefined;
  // Determine if previous month is complete (data available through its last day).
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentMonth = monthFromDate(todayIso);

  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const prevYear = prev.getFullYear();
  const prevMonthIdx = prev.getMonth();
  const prevLastDay = new Date(prevYear, prevMonthIdx + 1, 0).getDate();
  const prevLastStr = `${prevYear.toString().padStart(4, '0')}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

  const previousMonthComplete = !!latestDateInRange && latestDateInRange >= prevLastStr;

  // Helper: check if a given YYYY-MM month is complete according to cached dates
  const isMonthComplete = (m: string) => {
    const [yStr, monStr] = m.split('-');
    const y = Number(yStr);
    const mon = Number(monStr) - 1;
    const lastDay = new Date(y, mon + 1, 0).getDate();
    const lastDayStr = `${yStr}-${String(mon + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return datesInRange.includes(lastDayStr);
  };

  // Default month logic:
  // - If previous month is complete, prefer the current month (we generate assessments for current month using the completed previous-month snapshot)
  // - Otherwise default to latest completed month (month containing latestDateInRange)
  const defaultMonth = selectedDate
    ? monthFromDate(selectedDate)
    : previousMonthComplete && currentMonth >= selectedProgramYear.startDate && currentMonth <= selectedProgramYear.endDate
    ? currentMonth
    : latestDateInRange
    ? monthFromDate(latestDateInRange)
    : months.length
    ? months[months.length - 1]
    : undefined;
  const [month, setMonth] = React.useState<string | undefined>(defaultMonth);
  const [summary] = React.useState<AssessmentSummary | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [genResult, setGenResult] = React.useState<any>(null);
  const [persisted, setPersisted] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMonth(defaultMonth);
  }, [defaultMonth]);

  // Determine whether selected month can be generated
  const canGenerateForSelectedMonth = React.useMemo(() => {
    if (!month) return false;
    // If month equals the current month, require previous month to be complete
    if (month === currentMonth) return previousMonthComplete;
    // Otherwise require that the month itself is complete in cached dates
    return isMonthComplete(month);
  }, [month, currentMonth, previousMonthComplete, datesInRange]);

  const handleCompute = async () => {
    // For option A (thin client): fetch authoritative persisted assessment from server
    setError(null);
    if (!month) return setError('Select a month');
    try {
      const res = await fetchAssessment(districtId, `${selectedProgramYear.startDate}/${selectedProgramYear.endDate}`, month);
      if (res && res.data) {
        console.log('AssessmentPanel.handleCompute - fetched assessment:', res.data);
        setPersisted(res.data);
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
      console.log('AssessmentPanel.handleGenerate - sending payload:', payload);
      const res = await generateAssessment(payload as any);
      console.log('AssessmentPanel.handleGenerate - response:', res);
      setGenResult(res);
      // After generation, fetch persisted assessment to reflect authoritative copy
      const persistedRes = await fetchAssessment(districtId, `${selectedProgramYear.startDate}/${selectedProgramYear.endDate}`, month);
      if (persistedRes && persistedRes.data) {
        console.log('AssessmentPanel.handleGenerate - fetched persisted:', persistedRes.data);
        setPersisted(persistedRes.data);
      }
    } catch (err: any) {
      console.error('AssessmentPanel.handleGenerate - error:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to generate assessment');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    // Delete existing and regenerate
    setError(null);
    if (!month) return setError('Select a month');
    setIsGenerating(true);
    try {
      // Delete existing assessment
      await deleteAssessment(districtId, `${selectedProgramYear.startDate}/${selectedProgramYear.endDate}`, month);
      console.log('AssessmentPanel.handleRegenerate - deleted existing assessment');
      // Clear state
      setPersisted(null);
      setGenResult(null);
      // Regenerate
      const payload = {
        districtId,
        programYearStart: selectedProgramYear.startDate,
        programYearEnd: selectedProgramYear.endDate,
        month,
      };
      const res = await generateAssessment(payload as any);
      console.log('AssessmentPanel.handleRegenerate - regenerated:', res);
      setGenResult(res);
      // Fetch persisted assessment
      const persistedRes = await fetchAssessment(districtId, `${selectedProgramYear.startDate}/${selectedProgramYear.endDate}`, month);
      if (persistedRes && persistedRes.data) {
        console.log('AssessmentPanel.handleRegenerate - fetched persisted:', persistedRes.data);
        setPersisted(persistedRes.data);
      }
    } catch (err: any) {
      console.error('AssessmentPanel.handleRegenerate - error:', err?.message);
      setError(err?.message || 'Failed to regenerate assessment');
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
          {latestDateInRange && (
            <div className="text-xs text-gray-500 mt-1">Data available through {latestDateInRange}</div>
          )}
          {!canGenerateForSelectedMonth && month === currentMonth && (
            <div className="text-xs text-orange-600 mt-1">Previous month is not yet complete. Data must be available through {prevLastStr} to generate the current month's assessment.</div>
          )}
        </div>

        <div className="sm:col-span-2 flex items-end gap-2 flex-wrap">
          <button onClick={handleCompute} className="px-4 py-2 bg-blue-600 text-white rounded-md" disabled={isComputing || !month}>
            {isComputing ? 'Refreshing...' : 'Load Persisted Assessment'}
          </button>
          <button onClick={handleGenerate} className="px-4 py-2 bg-green-600 text-white rounded-md" disabled={isGenerating || !month || !!persisted}>
            {isGenerating ? 'Generating...' : persisted ? 'Already Generated' : 'Generate Immutable Assessment'}
          </button>
          {persisted && (
            <button onClick={handleRegenerate} className="px-4 py-2 bg-orange-600 text-white rounded-md" disabled={isGenerating || !month}>
              {isGenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}


      {persisted && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="p-4 border rounded-md bg-gray-50">
            <div className="text-xs font-semibold text-gray-600">Generated At</div>
            <div className="text-sm text-gray-900 mt-1">{persisted.created_at || persisted.timestamp || 'N/A'}</div>
          </div>
          <div className="p-4 border rounded-md bg-gray-50">
            <div className="text-xs font-semibold text-gray-600">Goal 1 Status</div>
            <div className={`text-sm font-semibold mt-1 ${
              persisted.goal_1_status === 'On Track' ? 'text-green-700' : 'text-red-700'
            }`}>
              {persisted.goal_1_status || 'N/A'}
            </div>
          </div>
          <div className="p-4 border rounded-md bg-gray-50">
            <div className="text-xs font-semibold text-gray-600">Goal 2 Status</div>
            <div className={`text-sm font-semibold mt-1 ${
              persisted.goal_2_status === 'On Track' ? 'text-green-700' : 'text-red-700'
            }`}>
              {persisted.goal_2_status || 'N/A'}
            </div>
          </div>
          <div className="p-4 border rounded-md bg-gray-50">
            <div className="text-xs font-semibold text-gray-600">Goal 3 Status</div>
            <div className={`text-sm font-semibold mt-1 ${
              persisted.goal_3_status === 'On Track' ? 'text-green-700' : 'text-red-700'
            }`}>
              {persisted.goal_3_status || 'N/A'}
            </div>
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
