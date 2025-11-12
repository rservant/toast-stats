import { useState } from 'react';
import { DateRangeSelector } from './DateRangeSelector';
import { DailyReportTrends } from './DailyReportTrends';
import { useDailyReports } from '../hooks/useDailyReports';
import { ExportButton } from './ExportButton';
import { exportDailyReports } from '../utils/csvExport';

interface HistoricalDailyReportsProps {
  districtId: string | null;
  districtName: string;
}

export const HistoricalDailyReports = ({
  districtId,
  districtName,
}: HistoricalDailyReportsProps) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading, error } = useDailyReports(
    districtId,
    startDate,
    endDate
  );

  const handleDateRangeChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const handleExport = () => {
    if (data?.reports && data.reports.length > 0 && districtId) {
      exportDailyReports(data.reports, districtId, districtName);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">
          Historical Daily Reports
        </h2>
        <ExportButton
          onExport={handleExport}
          disabled={!data?.reports || data.reports.length === 0}
          label="Export"
        />
      </div>

      <DateRangeSelector
        onDateRangeChange={handleDateRangeChange}
        maxDays={90}
      />

      <DailyReportTrends data={data} isLoading={isLoading} error={error} />
    </div>
  );
};
