import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import DistrictSelector from '../components/DistrictSelector';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import ErrorBoundary from '../components/ErrorBoundary';

const DashboardPage: React.FC = () => {
  const { logout } = useAuth();
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);

  const handleDistrictSelect = (districtId: string) => {
    setSelectedDistrictId(districtId);
  };

  const header = (
    <>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Toastmasters District Visualizer
        </h1>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          aria-label="Logout"
        >
          Logout
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <DistrictSelector
          selectedDistrictId={selectedDistrictId}
          onDistrictSelect={handleDistrictSelect}
        />
      </div>
    </>
  );

  return (
    <ErrorBoundary>
      {selectedDistrictId ? (
        <DashboardLayout header={header}>
          {/* Example stat cards - these will be populated with real data in subsequent tasks */}
          <StatCard
            name="Total Members"
            value="1,234"
            change={45}
            changePercent={3.8}
            trend="positive"
          />
          <StatCard
            name="Total Clubs"
            value="56"
            change={-2}
            changePercent={-3.4}
            trend="negative"
          />
          <StatCard
            name="Educational Awards"
            value="189"
            change={12}
            changePercent={6.8}
            trend="positive"
          />
          <StatCard
            name="Distinguished Clubs"
            value="42"
            changePercent={75.0}
            trend="neutral"
          />
        </DashboardLayout>
      ) : (
        <div className="min-h-screen bg-gray-100">
          <div className="container mx-auto px-4 py-8">
            {header}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
              <p className="text-blue-800">
                Please select a district to view statistics and visualizations
              </p>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

export default DashboardPage;
