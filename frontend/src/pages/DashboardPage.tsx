import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import DistrictSelector from '../components/DistrictSelector';

const DashboardPage: React.FC = () => {
  const { logout } = useAuth();
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);

  const handleDistrictSelect = (districtId: string) => {
    setSelectedDistrictId(districtId);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Toastmasters District Visualizer
          </h1>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <DistrictSelector
            selectedDistrictId={selectedDistrictId}
            onDistrictSelect={handleDistrictSelect}
          />
        </div>

        {selectedDistrictId ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600">
              District statistics and visualizations will be displayed here in subsequent tasks
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-blue-800">
              Please select a district to view statistics and visualizations
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
