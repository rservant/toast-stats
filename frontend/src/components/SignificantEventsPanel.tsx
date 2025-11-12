import React from 'react';
import { useSignificantEvents } from '../hooks/useIntegratedData';
import type { SignificantEvent } from '../utils/dataIntegration';

interface SignificantEventsPanelProps {
  districtId: string;
  daysToShow?: number;
  maxEvents?: number;
}

const SignificantEventsPanel: React.FC<SignificantEventsPanelProps> = ({
  districtId,
  daysToShow = 30,
  maxEvents = 5,
}) => {
  const { events, isLoading, error } = useSignificantEvents(districtId, daysToShow);

  const getEventIcon = (type: SignificantEvent['type']) => {
    switch (type) {
      case 'membership_spike':
        return '📈';
      case 'membership_drop':
        return '📉';
      case 'new_club':
        return '🎉';
      case 'club_suspended':
        return '⚠️';
      case 'high_awards':
        return '🏆';
      default:
        return '📊';
    }
  };

  const getEventColor = (type: SignificantEvent['type']) => {
    switch (type) {
      case 'membership_spike':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'membership_drop':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'new_club':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'club_suspended':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'high_awards':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Significant Events
        </h2>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Significant Events
        </h2>
        <div className="text-center py-4">
          <p className="text-red-600 text-sm">Failed to load events</p>
        </div>
      </div>
    );
  }

  const displayEvents = events.slice(0, maxEvents);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Significant Events
        </h2>
        <span className="text-sm text-gray-500">
          Last {daysToShow} days
        </span>
      </div>

      {displayEvents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No significant events in the selected period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayEvents.map((event, index) => (
            <div
              key={`${event.date}-${event.type}-${index}`}
              className={`border rounded-lg p-4 ${getEventColor(event.type)}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl" role="img" aria-label={event.type}>
                  {getEventIcon(event.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-medium">
                      {event.description}
                    </p>
                    <span className="text-xs whitespace-nowrap">
                      {formatDate(event.date)}
                    </span>
                  </div>
                  {event.clubName && (
                    <p className="text-xs mt-1 opacity-75">
                      Club: {event.clubName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length > maxEvents && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            +{events.length - maxEvents} more events
          </p>
        </div>
      )}
    </div>
  );
};

export default SignificantEventsPanel;
