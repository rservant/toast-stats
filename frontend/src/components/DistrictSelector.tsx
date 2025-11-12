import React, { useEffect } from 'react';
import { useDistricts } from '../hooks/useDistricts';
import type { District } from '../types/districts';

interface DistrictSelectorProps {
  selectedDistrictId: string | null;
  onDistrictSelect: (districtId: string) => void;
}

const DistrictSelector: React.FC<DistrictSelectorProps> = ({
  selectedDistrictId,
  onDistrictSelect,
}) => {
  const { data, isLoading, isError, error } = useDistricts();

  // Load persisted district from localStorage on mount
  useEffect(() => {
    if (!selectedDistrictId) {
      const savedDistrictId = localStorage.getItem('selectedDistrictId');
      if (savedDistrictId && data?.districts) {
        // Verify the saved district still exists
        const districtExists = data.districts.some(
          (d) => d.id === savedDistrictId
        );
        if (districtExists) {
          onDistrictSelect(savedDistrictId);
        }
      }
    }
  }, [data, selectedDistrictId, onDistrictSelect]);

  const handleDistrictChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const districtId = event.target.value;
    if (districtId) {
      onDistrictSelect(districtId);
      // Persist selection to localStorage
      localStorage.setItem('selectedDistrictId', districtId);
    }
  };

  const getSelectedDistrictName = (): string => {
    if (!selectedDistrictId || !data?.districts) {
      return '';
    }
    const district = data.districts.find((d) => d.id === selectedDistrictId);
    return district?.name || '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" aria-hidden="true"></div>
        <span className="text-gray-600">Loading districts...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-3" role="alert" aria-live="assertive">
        <p className="text-red-800 text-sm">
          Failed to load districts: {error?.message || 'Unknown error'}
        </p>
      </div>
    );
  }

  if (!data?.districts || data.districts.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3" role="status">
        <p className="text-yellow-800 text-sm">No districts available</p>
      </div>
    );
  }

  return (
    <nav className="space-y-4" aria-label="District selection">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label
          htmlFor="district-select"
          className="text-base font-semibold text-gray-900 flex-shrink-0"
        >
          Select District:
        </label>
        <div className="relative flex-1 sm:max-w-md">
          <select
            id="district-select"
            value={selectedDistrictId || ''}
            onChange={handleDistrictChange}
            className="block w-full min-h-[48px] px-4 py-3 pr-10 bg-white border-2 border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium text-gray-900 transition-colors cursor-pointer appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em',
            }}
            aria-label="Select a Toastmasters district to view statistics"
            aria-required="true"
            aria-describedby={selectedDistrictId ? 'current-district' : undefined}
          >
            <option value="" className="text-gray-500">Choose a district...</option>
            {data.districts.map((district: District) => (
              <option key={district.id} value={district.id} className="text-gray-900">
                {district.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {selectedDistrictId && (
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4">
          <p id="current-district" className="text-sm sm:text-base text-gray-700" role="status" aria-live="polite">
            <span className="font-medium text-gray-900">Viewing:</span>{' '}
            <span className="font-bold text-blue-700">{getSelectedDistrictName()}</span>
          </p>
        </div>
      )}
    </nav>
  );
};

export default DistrictSelector;
