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
    <nav className="space-y-3" aria-label="District selection">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <label
          htmlFor="district-select"
          className="text-sm font-medium text-gray-700 flex-shrink-0"
        >
          Select District:
        </label>
        <select
          id="district-select"
          value={selectedDistrictId || ''}
          onChange={handleDistrictChange}
          className="block w-full sm:w-64 min-h-[44px] px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
          aria-label="Select a Toastmasters district to view statistics"
          aria-required="true"
          aria-describedby={selectedDistrictId ? 'current-district' : undefined}
        >
          <option value="">-- Choose a district --</option>
          {data.districts.map((district: District) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </select>
      </div>
      
      {selectedDistrictId && (
        <div className="mt-2">
          <p id="current-district" className="text-base sm:text-lg font-semibold text-gray-900" role="status" aria-live="polite">
            Current District: <span className="text-blue-600">{getSelectedDistrictName()}</span>
          </p>
        </div>
      )}
    </nav>
  );
};

export default DistrictSelector;
