import { useDailyReportDetail } from '../hooks/useDailyReports';
import type { ClubChange } from '../types/districts';
import { ExportButton } from './ExportButton';
import { exportDailyReportDetail } from '../utils/csvExport';

interface DailyReportDetailProps {
  districtId: string | null;
  districtName: string;
  selectedDate: string | null;
  onClose: () => void;
}

export const DailyReportDetail = ({
  districtId,
  districtName,
  selectedDate,
  onClose,
}: DailyReportDetailProps) => {
  const { data, isLoading, error } = useDailyReportDetail(
    districtId,
    selectedDate
  );

  if (!selectedDate) {
    return null;
  }

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleExport = () => {
    if (data && districtId) {
      exportDailyReportDetail(data, districtId, districtName);
    }
  };

  const getChangeTypeLabel = (changeType: ClubChange['changeType']): string => {
    const labels: Record<ClubChange['changeType'], string> = {
      chartered: 'Chartered',
      suspended: 'Suspended',
      reinstated: 'Reinstated',
      closed: 'Closed',
    };
    return labels[changeType];
  };

  const getChangeTypeColor = (changeType: ClubChange['changeType']): string => {
    const colors: Record<ClubChange['changeType'], string> = {
      chartered: 'text-green-700 bg-green-100',
      reinstated: 'text-green-700 bg-green-100',
      suspended: 'text-yellow-700 bg-yellow-100',
      closed: 'text-red-700 bg-red-100',
    };
    return colors[changeType];
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Daily Report - {formattedDate}
        </h2>
        <div className="flex items-center gap-2">
          <ExportButton
            onExport={handleExport}
            disabled={!data}
            label="Export"
            className="text-sm px-3 py-1.5"
          />
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition-colors"
            aria-label="Close detail view"
          >
            ✕
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading report details...</div>
        </div>
      )}

      {error && (
        <div className="text-red-600">
          Error loading report: {error.message}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">
                New Members
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {data.summary.totalNewMembers}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">
                Renewals
              </div>
              <div className="text-2xl font-bold text-green-900">
                {data.summary.totalRenewals}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium">Awards</div>
              <div className="text-2xl font-bold text-purple-900">
                {data.summary.totalAwards}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium">
                Net Change
              </div>
              <div
                className={`text-2xl font-bold ${
                  data.summary.netMembershipChange >= 0
                    ? 'text-green-900'
                    : 'text-red-900'
                }`}
              >
                {data.summary.netMembershipChange >= 0 ? '+' : ''}
                {data.summary.netMembershipChange}
              </div>
            </div>
          </div>

          {/* Day-over-Day Comparison */}
          {data.summary.dayOverDayChange !== 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium mb-1">
                Day-over-Day Change
              </div>
              <div
                className={`text-lg font-semibold ${
                  data.summary.dayOverDayChange > 0
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}
              >
                {data.summary.dayOverDayChange > 0 ? '↑' : '↓'}{' '}
                {Math.abs(data.summary.dayOverDayChange)} members compared to
                previous day
              </div>
            </div>
          )}

          {/* New Members */}
          {data.newMembers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                New Members ({data.newMembers.length})
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Club
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.newMembers.map((member, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {member.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {member.clubName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Renewals */}
          {data.renewals.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Renewals ({data.renewals.length})
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Club
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.renewals.map((member, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {member.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {member.clubName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Club Changes */}
          {data.clubChanges.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Club Changes ({data.clubChanges.length})
              </h3>
              <div className="space-y-2">
                {data.clubChanges.map((change, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {change.clubName}
                      </div>
                      {change.details && (
                        <div className="text-sm text-gray-600">
                          {change.details}
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getChangeTypeColor(
                        change.changeType
                      )}`}
                    >
                      {getChangeTypeLabel(change.changeType)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Awards */}
          {data.awards.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Educational Awards ({data.awards.length})
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Recipient
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Award
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Club
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.awards.map((award, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {award.recipient}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {award.type}
                          {award.level && ` - ${award.level}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {award.clubName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No Activity Message */}
          {data.newMembers.length === 0 &&
            data.renewals.length === 0 &&
            data.clubChanges.length === 0 &&
            data.awards.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No activity recorded for this day.
              </div>
            )}
        </div>
      )}
    </div>
  );
};
