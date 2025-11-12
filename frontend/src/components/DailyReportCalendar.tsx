import { useState, useMemo } from 'react';
import { useDailyReports } from '../hooks/useDailyReports';

interface DailyReportCalendarProps {
  districtId: string | null;
  onDateSelect: (date: string) => void;
}

export const DailyReportCalendar = ({
  districtId,
  onDateSelect,
}: DailyReportCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate start and end dates for the current month
  const { startDate, endDate } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [currentDate]);

  // Fetch daily reports for the current month
  const { data, isLoading, error } = useDailyReports(
    districtId,
    startDate,
    endDate
  );

  // Create a map of dates to activity levels for quick lookup
  const activityMap = useMemo(() => {
    if (!data?.reports) return new Map<string, number>();

    const map = new Map<string, number>();
    data.reports.forEach((report) => {
      const totalActivity =
        report.newMembers + report.renewals + report.awards;
      map.set(report.date, totalActivity);
    });
    return map;
  }, [data]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date | null; dateString: string | null }> = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, dateString: null });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      days.push({ date, dateString });
    }

    return days;
  }, [currentDate]);

  // Get activity level color class
  const getActivityColor = (dateString: string | null): string => {
    if (!dateString) return '';

    const activity = activityMap.get(dateString) || 0;

    if (activity === 0) return 'bg-gray-100 hover:bg-gray-200';
    if (activity < 5) return 'bg-green-100 hover:bg-green-200';
    if (activity < 10) return 'bg-green-300 hover:bg-green-400';
    return 'bg-green-500 hover:bg-green-600 text-white';
  };

  // Check if date is today
  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Check if date is in the future
  const isFuture = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  // Navigate to previous month
  const handlePreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  // Navigate to next month
  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  // Handle date click
  const handleDateClick = (dateString: string | null, date: Date | null) => {
    if (dateString && date && !isFuture(date)) {
      onDateSelect(dateString);
    }
  };

  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">
          Error loading daily reports: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Daily Activity</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousMonth}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition-colors"
            aria-label="Previous month"
          >
            ←
          </button>
          <span className="text-lg font-medium text-gray-700 min-w-[180px] text-center">
            {monthYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition-colors"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading calendar...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-semibold text-gray-600 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              const { date, dateString } = day;
              const future = isFuture(date);
              const today = isToday(date);

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(dateString, date)}
                  disabled={!date || future}
                  className={`
                    aspect-square p-2 rounded text-sm font-medium transition-colors
                    ${!date ? 'invisible' : ''}
                    ${future ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : ''}
                    ${date && !future ? getActivityColor(dateString) : ''}
                    ${today ? 'ring-2 ring-blue-500' : ''}
                    ${date && !future ? 'cursor-pointer' : ''}
                  `}
                  aria-label={
                    date
                      ? `${date.toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                        })}`
                      : undefined
                  }
                >
                  {date ? date.getDate() : ''}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 rounded"></div>
              <span>No activity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded"></div>
              <span>Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-300 rounded"></div>
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>High</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
