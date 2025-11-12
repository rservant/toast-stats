import { useState } from 'react';
import { DateRangeSelector } from './DateRangeSelector';
import { DailyReportTrends } from './DailyReportTrends';
import { useDailyReports } from '../hooks/useDailyReports';

interface HistoricalDailyReportsProps {
  districtId: string | null;
}

export const HistoricalDailyReports = ({
  districtId,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">
          Historical Daily Reports
        </h2>
      </div>

      <DateRangeSelector
        onDateRangeChange={handleDateRangeChange}
        maxDays={90}
      />

      <DailyReportTrends data={data} isLoading={isLoading} error={error} />
    </div>
  );
};
