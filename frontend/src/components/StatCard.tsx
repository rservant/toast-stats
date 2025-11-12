import React from 'react';

export interface StatCardProps {
  name: string;
  value: string | number;
  change?: number;
  changePercent?: number;
  trend?: 'positive' | 'negative' | 'neutral';
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  name,
  value,
  change,
  changePercent,
  trend = 'neutral',
  isLoading = false,
}) => {
  // Determine trend color
  const getTrendColor = () => {
    if (trend === 'positive') return 'text-green-600';
    if (trend === 'negative') return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendBgColor = () => {
    if (trend === 'positive') return 'bg-green-50';
    if (trend === 'negative') return 'bg-red-50';
    return 'bg-gray-50';
  };

  const getTrendIcon = () => {
    if (trend === 'positive') return '↑';
    if (trend === 'negative') return '↓';
    return '→';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200">
      <h3 className="text-sm font-medium text-gray-600 mb-2">{name}</h3>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      
      {(change !== undefined || changePercent !== undefined) && (
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getTrendBgColor()} ${getTrendColor()}`}>
          <span className="mr-1" aria-hidden="true">{getTrendIcon()}</span>
          <span>
            {change !== undefined && (
              <span className="mr-1">
                {change > 0 ? '+' : ''}{change}
              </span>
            )}
            {changePercent !== undefined && (
              <span>
                ({changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%)
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
