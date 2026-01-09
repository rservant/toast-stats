import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminHealth,
  useAdminPerformance,
  useResetPerformanceMetrics,
  useProcessSeparationCompliance,
  useAdminSnapshots,
} from '../hooks/useAdminMonitoring'
import type {
  HealthStatus,
  ComplianceStatus,
  SnapshotMetadata,
} from '../types/admin'

// ============================================================================
// Helper Components
// ============================================================================

interface StatusBadgeProps {
  status: 'success' | 'partial' | 'failed' | HealthStatus | ComplianceStatus
  size?: 'sm' | 'md'
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const baseClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  const colorClasses: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    healthy: 'bg-green-100 text-green-800',
    compliant: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    warning: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    critical: 'bg-red-100 text-red-800',
    non_compliant: 'bg-red-100 text-red-800',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${baseClasses} ${colorClasses[status] || 'bg-gray-100 text-gray-800'}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string | undefined
  status?: 'success' | 'warning' | 'error'
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  status,
}) => {
  const borderColor =
    status === 'success'
      ? 'border-l-green-500'
      : status === 'warning'
        ? 'border-l-yellow-500'
        : status === 'error'
          ? 'border-l-red-500'
          : 'border-l-tm-loyal-blue'

  return (
    <div
      className={`bg-white rounded-lg shadow p-3 border-l-4 ${borderColor}`}
      role="region"
      aria-label={title}
    >
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-xl font-bold text-tm-black mt-0.5">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
  isLoading?: boolean
  error?: Error | null
}

const Section: React.FC<SectionProps> = ({
  title,
  children,
  isLoading,
  error,
}) => (
  <section className="bg-white rounded-lg shadow p-4 mb-4" aria-labelledby={`section-${title.toLowerCase().replace(/\s/g, '-')}`}>
    <h2
      id={`section-${title.toLowerCase().replace(/\s/g, '-')}`}
      className="text-lg font-semibold text-tm-black mb-3"
    >
      {title}
    </h2>
    {isLoading ? (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    ) : error ? (
      <div className="text-red-600 p-4 bg-red-50 rounded" role="alert">
        Error: {error.message}
      </div>
    ) : (
      children
    )}
  </section>
)

// ============================================================================
// Main Component
// ============================================================================

const AdminDashboardPage: React.FC = () => {
  const [snapshotLimit] = useState(10)

  // Fetch all admin data
  const healthQuery = useAdminHealth()
  const performanceQuery = useAdminPerformance()
  const complianceQuery = useProcessSeparationCompliance()
  const snapshotsQuery = useAdminSnapshots(undefined, snapshotLimit)
  const resetMetricsMutation = useResetPerformanceMetrics()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-tm-black">Admin Dashboard</h1>
            <p className="text-sm text-gray-600">
              System health, performance metrics, and operational monitoring
            </p>
          </div>
          <Link
            to="/"
            className="px-4 py-2 bg-tm-loyal-blue text-white rounded hover:bg-opacity-90 transition-colors min-h-[44px] flex items-center"
          >
            ← Back to Home
          </Link>
        </div>

        {/* System Health Section */}
        <Section
          title="System Health"
          isLoading={healthQuery.isLoading}
          error={healthQuery.error}
        >
          {healthQuery.data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <MetricCard
                  title="Store Status"
                  value={healthQuery.data.health.is_ready ? 'Ready' : 'Not Ready'}
                  status={healthQuery.data.health.is_ready ? 'success' : 'error'}
                />
                <MetricCard
                  title="Current Snapshot"
                  value={
                    healthQuery.data.health.current_snapshot
                      ? 'Available'
                      : 'None'
                  }
                  subtitle={
                    healthQuery.data.health.current_snapshot
                      ? `${healthQuery.data.health.current_snapshot.district_count} districts`
                      : undefined
                  }
                  status={
                    healthQuery.data.health.current_snapshot ? 'success' : 'warning'
                  }
                />
                <MetricCard
                  title="Recent Snapshots"
                  value={healthQuery.data.health.recent_activity.total_snapshots}
                  subtitle={`${healthQuery.data.health.recent_activity.successful_snapshots} successful`}
                />
                <MetricCard
                  title="Failed Snapshots"
                  value={healthQuery.data.health.recent_activity.failed_snapshots}
                  status={
                    healthQuery.data.health.recent_activity.failed_snapshots > 0
                      ? 'warning'
                      : 'success'
                  }
                />
              </div>

              {healthQuery.data.health.current_snapshot && (
                <div className="bg-gray-50 rounded p-3">
                  <h3 className="font-medium text-sm text-tm-black mb-2">
                    Current Snapshot Details
                  </h3>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <dt className="text-gray-500">ID</dt>
                      <dd className="font-mono text-xs truncate">
                        {healthQuery.data.health.current_snapshot.snapshot_id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Created</dt>
                      <dd>
                        {formatDate(
                          healthQuery.data.health.current_snapshot.created_at
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Schema Version</dt>
                      <dd>
                        {healthQuery.data.health.current_snapshot.schema_version}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Status</dt>
                      <dd>
                        <StatusBadge
                          status={healthQuery.data.health.current_snapshot.status}
                          size="sm"
                        />
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </>
          )}
        </Section>

        {/* Performance Metrics Section */}
        <Section
          title="Performance Metrics"
          isLoading={performanceQuery.isLoading}
          error={performanceQuery.error}
        >
          {performanceQuery.data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <MetricCard
                  title="Total Reads"
                  value={performanceQuery.data.performance.totalReads.toLocaleString()}
                />
                <MetricCard
                  title="Cache Hit Rate"
                  value={`${performanceQuery.data.performance.cache_hit_rate_percent}%`}
                  status={
                    performanceQuery.data.performance.cache_hit_rate_percent >= 80
                      ? 'success'
                      : performanceQuery.data.performance.cache_hit_rate_percent >=
                          50
                        ? 'warning'
                        : 'error'
                  }
                />
                <MetricCard
                  title="Avg Read Time"
                  value={formatDuration(
                    performanceQuery.data.performance.averageReadTime
                  )}
                />
                <MetricCard
                  title="Max Concurrent Reads"
                  value={performanceQuery.data.performance.maxConcurrentReads}
                />
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded p-3">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Cache Hits:</span>{' '}
                  {performanceQuery.data.performance.cacheHits} |{' '}
                  <span className="font-medium">Cache Misses:</span>{' '}
                  {performanceQuery.data.performance.cacheMisses}
                </div>
                <button
                  onClick={() => resetMetricsMutation.mutate()}
                  disabled={resetMetricsMutation.isPending}
                  className="px-4 py-2 bg-tm-true-maroon text-white rounded hover:bg-opacity-90 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {resetMetricsMutation.isPending
                    ? 'Resetting...'
                    : 'Reset Metrics'}
                </button>
              </div>
            </>
          )}
        </Section>

        {/* Process Separation Compliance Section */}
        <Section
          title="Process Separation Compliance"
          isLoading={complianceQuery.isLoading}
          error={complianceQuery.error}
        >
          {complianceQuery.data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <MetricCard
                  title="Compliance Score"
                  value={`${complianceQuery.data.compliance.processSeparationScore}/100`}
                  status={
                    complianceQuery.data.compliance.processSeparationScore >= 80
                      ? 'success'
                      : complianceQuery.data.compliance.processSeparationScore >=
                          60
                        ? 'warning'
                        : 'error'
                  }
                />
                <div className="bg-white rounded-lg shadow p-3 border-l-4 border-l-tm-loyal-blue">
                  <p className="text-sm text-gray-600">Compliance Status</p>
                  <div className="mt-1">
                    <StatusBadge
                      status={complianceQuery.data.compliance.complianceStatus}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-3 border-l-4 border-l-tm-loyal-blue">
                  <p className="text-sm text-gray-600">Read Operations</p>
                  <div className="mt-1">
                    <StatusBadge
                      status={complianceQuery.data.compliance.readOperationHealth}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-3 border-l-4 border-l-tm-loyal-blue">
                  <p className="text-sm text-gray-600">Refresh Operations</p>
                  <div className="mt-1">
                    <StatusBadge
                      status={
                        complianceQuery.data.compliance.refreshOperationHealth
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-3 text-sm text-gray-600">
                Last validation:{' '}
                {formatDate(complianceQuery.data.compliance.lastValidationTime)}
              </div>
            </>
          )}
        </Section>

        {/* Recent Snapshots Section */}
        <Section
          title="Recent Snapshots"
          isLoading={snapshotsQuery.isLoading}
          error={snapshotsQuery.error}
        >
          {snapshotsQuery.data && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Snapshot ID
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Created
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Districts
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Schema
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {snapshotsQuery.data.snapshots.map(
                    (snapshot: SnapshotMetadata) => (
                      <tr key={snapshot.snapshot_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                          {snapshot.snapshot_id.substring(0, 12)}...
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(snapshot.created_at)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <StatusBadge status={snapshot.status} size="sm" />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                          {snapshot.district_count ?? '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                          {snapshot.schema_version}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              {snapshotsQuery.data.snapshots.length === 0 && (
                <p className="text-center py-4 text-gray-500">
                  No snapshots found
                </p>
              )}

              <div className="mt-2 text-sm text-gray-500">
                Showing {snapshotsQuery.data.snapshots.length} of{' '}
                {snapshotsQuery.data.metadata.total_count} snapshots
              </div>
            </div>
          )}
        </Section>

        {/* Quick Links */}
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-tm-black mb-3">
            Admin Quick Links
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/districts"
              className="px-4 py-2 bg-tm-loyal-blue text-white rounded hover:bg-opacity-90 transition-colors min-h-[44px] flex items-center"
            >
              District Configuration
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AdminDashboardPage
