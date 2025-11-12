import React from 'react';
import { useRealTimeMembership } from '../hooks/useIntegratedData';
import StatCard from './StatCard';

interface RealTimeMembershipCardProps {
  districtId: string;
}

const RealTimeMembershipCard: React.FC<RealTimeMembershipCardProps> = ({
  districtId,
}) => {
  const { currentCount, changeFromBase, lastUpdated, isRealTime, isLoading } = 
    useRealTimeMembership(districtId);

  if (isLoading) {
    return (
      <StatCard
        name="Total Members (Real-Time)"
        value="..."
        changePercent={0}
        trend="neutral"
      />
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="relative">
      <StatCard
        name={
          <div className="flex items-center gap-2">
            <span>Total Members</span>
            {isRealTime && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Live
              </span>
            )}
          </div>
        }
        value={currentCount.toLocaleString()}
        change={changeFromBase}
        changePercent={0}
        trend={changeFromBase > 0 ? 'positive' : changeFromBase < 0 ? 'negative' : 'neutral'}
        footer={
          <div className="text-xs text-gray-500 mt-2">
            {isRealTime ? (
              <>Updated with daily reports through {formatDate(lastUpdated)}</>
            ) : (
              <>As of {formatDate(lastUpdated)}</>
            )}
          </div>
        }
      />
    </div>
  );
};

export default RealTimeMembershipCard;
