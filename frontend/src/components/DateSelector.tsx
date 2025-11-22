import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { AvailableDatesResponse } from '../types/districts';

interface DateSelectorProps {
  onDateChange: (date: string) => void;
  selectedDate?: string;
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const DateSelector: React.FC<DateSelectorProps> = ({ onDateChange, selectedDate }) => {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Fetch available dates from backend
  const { data: availableDatesData, isLoading } = useQuery<AvailableDatesResponse>({
    queryKey: ['available-dates'],
    queryFn: async () => {
      const response = await apiClient.get<AvailableDatesResponse>('/districts/available-dates');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const availableDates = availableDatesData?.dates || [];

  // Parse selected date to set month and day
  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate);
      setSelectedMonth(date.getMonth() + 1);
      setSelectedDay(date.getDate());
    }
  }, [selectedDate]);

  // Get available months (months that have at least one date)
  const availableMonths = React.useMemo(() => {
    const months = new Set<number>();
    availableDates.forEach(d => months.add(d.month));
    return Array.from(months).sort((a, b) => a - b);
  }, [availableDates]);

  // Get available days for selected month
  const availableDays = React.useMemo(() => {
    if (!selectedMonth) return [];
    return availableDates
      .filter(d => d.month === selectedMonth)
      .map(d => d.day)
      .sort((a, b) => a - b);
  }, [availableDates, selectedMonth]);

  // Handle month change
  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    setSelectedDay(null); // Reset day when month changes
  };

  // Handle day change
  const handleDayChange = (day: number) => {
    setSelectedDay(day);
    
    // Find the full date string and trigger callback
    if (selectedMonth) {
      const dateObj = availableDates.find(d => d.month === selectedMonth && d.day === day);
      if (dateObj) {
        onDateChange(dateObj.date);
      }
    }
  };

  // Check if a specific month is available
  const isMonthAvailable = (month: number) => {
    return availableMonths.includes(month);
  };

  // Check if a specific day is available
  const isDayAvailable = (day: number) => {
    return availableDays.includes(day);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="animate-pulse flex gap-3">
          <div className="h-10 w-32 bg-gray-200 rounded"></div>
          <div className="h-10 w-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <label className="text-sm font-medium text-gray-700">
        Select Date:
      </label>
      
      {/* Month Dropdown */}
      <div className="relative">
        <select
          value={selectedMonth || ''}
          onChange={(e) => handleMonthChange(Number(e.target.value))}
          className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-gray-900 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none pr-10 bg-white"
          aria-label="Select month"
        >
          <option value="">Select Month</option>
          {MONTHS.map(month => (
            <option
              key={month.value}
              value={month.value}
              disabled={!isMonthAvailable(month.value)}
            >
              {month.label}
              {!isMonthAvailable(month.value) ? ' (unavailable)' : ''}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>

      {/* Day Dropdown */}
      <div className="relative">
        <select
          value={selectedDay || ''}
          onChange={(e) => handleDayChange(Number(e.target.value))}
          disabled={!selectedMonth}
          className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-gray-900 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none pr-10 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
          aria-label="Select day"
        >
          <option value="">Select Day</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
            <option
              key={day}
              value={day}
              disabled={!isDayAvailable(day)}
            >
              {day}
              {selectedMonth && !isDayAvailable(day) ? ' (unavailable)' : ''}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>

      {/* Current Selection Indicator */}
      {selectedMonth && selectedDay && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-blue-900">
            {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedDay}
          </span>
        </div>
      )}
    </div>
  );
};

export default DateSelector;
