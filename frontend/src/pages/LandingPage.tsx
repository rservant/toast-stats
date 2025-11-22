import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

interface DistrictRanking {
  districtId: string;
  districtName: string;
  region: string;
  paidClubs: number;
  paidClubBase: number;
  clubGrowthPercent: number;
  totalPayments: number;
  paymentBase: number;
  paymentGrowthPercent: number;
  activeClubs: number;
  distinguishedClubs: number;
  selectDistinguished: number;
  presidentsDistinguished: number;
  distinguishedPercent: number;
  clubsRank: number;
  paymentsRank: number;
  distinguishedRank: number;
  aggregateScore: number;
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'aggregate' | 'clubs' | 'payments' | 'distinguished'>('aggregate');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['district-rankings'],
    queryFn: async () => {
      const response = await apiClient.get('/districts/rankings');
      return response.data;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  const rankings: DistrictRanking[] = data?.rankings || [];

  // Get unique regions for filter
  const regions = React.useMemo(() => {
    const uniqueRegions = new Set(rankings.map(r => r.region));
    return Array.from(uniqueRegions).sort();
  }, [rankings]);

  // Initialize selected regions to all regions when data loads
  React.useEffect(() => {
    if (regions.length > 0 && selectedRegions.length === 0) {
      setSelectedRegions(regions);
    }
  }, [regions, selectedRegions.length]);

  // Filter by selected regions
  const filteredRankings = React.useMemo(() => {
    if (selectedRegions.length === 0) {
      return rankings;
    }
    return rankings.filter(r => selectedRegions.includes(r.region));
  }, [rankings, selectedRegions]);

  const sortedRankings = React.useMemo(() => {
    const sorted = [...filteredRankings];
    switch (sortBy) {
      case 'clubs':
        return sorted.sort((a, b) => a.clubsRank - b.clubsRank); // Lower rank is better
      case 'payments':
        return sorted.sort((a, b) => a.paymentsRank - b.paymentsRank); // Lower rank is better
      case 'distinguished':
        return sorted.sort((a, b) => a.distinguishedRank - b.distinguishedRank); // Lower rank is better
      default:
        return sorted.sort((a, b) => a.aggregateScore - b.aggregateScore); // Lower score is better
    }
  }, [filteredRankings, sortBy]);

  const handleDistrictClick = (districtId: string) => {
    navigate(`/district/${districtId}`);
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500 text-white';
    if (rank === 2) return 'bg-gray-400 text-white';
    if (rank === 3) return 'bg-amber-600 text-white';
    if (rank <= 10) return 'bg-blue-500 text-white';
    return 'bg-gray-200 text-gray-700';
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="space-y-3 mt-8">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Rankings</h2>
            <p className="text-red-600">{(error as Error)?.message || 'Failed to load district rankings'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Toastmasters District Rankings
          </h1>
          <p className="text-gray-600">
            Compare district performance across paid clubs, payments, and distinguished clubs
          </p>
        </div>

        {/* Sort Controls */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 self-center mr-2">Sort by:</span>
            <button
              onClick={() => setSortBy('aggregate')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'aggregate'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Overall Score
            </button>
            <button
              onClick={() => setSortBy('clubs')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'clubs'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Paid Clubs
            </button>
            <button
              onClick={() => setSortBy('payments')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'payments'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Total Payments
            </button>
            <button
              onClick={() => setSortBy('distinguished')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'distinguished'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Distinguished Clubs
            </button>
          </div>
        </div>

        {/* Rankings Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Region Filter in Table Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <span className="text-sm font-semibold text-gray-900">Filter Regions:</span>
              </div>
              <div className="flex-1">
                {/* Quick Select Buttons */}
                <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-gray-200">
                  <button
                    onClick={() => setSelectedRegions(regions)}
                    className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    All Regions
                  </button>
                  <button
                    onClick={() => {
                      const regions1to7 = regions.filter(r => {
                        const num = parseInt(r, 10);
                        return !isNaN(num) && num >= 1 && num <= 7;
                      });
                      setSelectedRegions(regions1to7);
                    }}
                    className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    Regions 1-7
                  </button>
                  <button
                    onClick={() => setSelectedRegions([])}
                    className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                {/* Individual Region Checkboxes */}
                <div className="flex flex-wrap gap-3">
                  {regions.map((region) => {
                    const count = rankings.filter(r => r.region === region).length;
                    return (
                      <label key={region} className="inline-flex items-center cursor-pointer hover:bg-gray-100 px-3 py-1 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(region)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRegions([...selectedRegions, region]);
                            } else {
                              setSelectedRegions(selectedRegions.filter(r => r !== region));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Region {region} ({count})
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedRegions.length > 0 && selectedRegions.length < regions.length && (
                  <div className="mt-2 text-sm text-blue-600 font-medium">
                    Showing {filteredRankings.length} districts from {selectedRegions.length} region{selectedRegions.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    District
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid Clubs
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Payments
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distinguished
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedRankings.map((district, index) => {
                  const rank = index + 1;
                  return (
                    <tr
                      key={district.districtId}
                      onClick={() => handleDistrictClick(district.districtId)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold ${getRankBadgeColor(rank)}`}>
                          {rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{district.districtName}</div>
                        <div className="text-sm text-gray-500">{district.activeClubs} active clubs</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {district.region}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">{formatNumber(district.paidClubs)}</div>
                        <div className="text-xs text-blue-600">
                          Rank #{district.clubsRank}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">{formatNumber(district.totalPayments)}</div>
                        <div className="text-xs text-blue-600">
                          Rank #{district.paymentsRank}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">{formatNumber(district.distinguishedClubs)}</div>
                        <div className="text-xs text-blue-600">
                          Rank #{district.distinguishedRank}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-bold text-blue-600">{formatNumber(Math.round(district.aggregateScore))}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Scoring Methodology</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
            <div>
              <span className="font-medium text-gray-900">Paid Clubs:</span> Number of clubs with paid memberships
            </div>
            <div>
              <span className="font-medium text-gray-900">Total Payments:</span> Year-to-date membership payments
            </div>
            <div>
              <span className="font-medium text-gray-900">Distinguished Clubs:</span> Clubs achieving distinguished status
            </div>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm">
            <p className="font-medium text-blue-900 mb-2">Ranking Formula:</p>
            <p className="text-blue-800">
              Each district is ranked separately in each category (1 = best). The <strong>Overall Score</strong> is the sum of these three ranks.
            </p>
            <p className="text-blue-700 mt-2 text-xs">
              Example: If a district ranks #5 in Paid Clubs, #3 in Payments, and #8 in Distinguished Clubs, their Overall Score = 5 + 3 + 8 = 16 (lower is better)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
