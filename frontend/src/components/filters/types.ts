/**
 * Filter component types and interfaces for the ClubsTable
 */

import { ClubTrend } from '../../hooks/useDistrictAnalytics'
import { HealthStatus, Trajectory } from '../../types/clubHealth'

/**
 * Sortable field types for the clubs table
 */
export type SortField =
  | 'name'
  | 'membership'
  | 'dcpGoals'
  | 'division'
  | 'area'
  | 'distinguished'
  | 'healthStatus'
  | 'trajectory'

/**
 * Sort direction types
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Filter operators for different data types
 */
export type FilterOperator =
  | 'contains'
  | 'startsWith'
  | 'equals'
  | 'range'
  | 'in'

/**
 * Individual column filter configuration
 */
export interface ColumnFilter {
  field: SortField
  type: 'text' | 'numeric' | 'categorical'
  value: string | (number | null)[] | string[]
  operator?: FilterOperator
}

/**
 * Filter state for all columns
 */
export interface FilterState {
  [key: string]: ColumnFilter | null
}

/**
 * Column configuration for filtering and sorting
 */
export interface ColumnConfig {
  field: SortField
  label: string
  sortable: boolean
  filterable: boolean
  filterType: 'text' | 'numeric' | 'categorical'
  filterOptions?: string[]
  sortCustom?: (a: unknown, b: unknown) => number
  tooltip?: string
}

/**
 * Props for column header component
 */
export interface ColumnHeaderProps {
  field: SortField
  label: string
  sortable: boolean
  filterable: boolean
  filterType: 'text' | 'numeric' | 'categorical'
  currentSort: { field: SortField | null; direction: SortDirection }
  currentFilter: ColumnFilter | null
  onSort: (field: SortField) => void
  onFilter: (field: SortField, filter: ColumnFilter | null) => void
  options?: string[]
  tooltip?: string
  className?: string
}

/**
 * Base props for all filter components
 */
export interface BaseFilterProps {
  onClear: () => void
  className?: string
}

/**
 * Props for text filter component
 */
export interface TextFilterProps extends BaseFilterProps {
  value: string
  onChange: (value: string, operator: 'contains' | 'startsWith') => void
  placeholder?: string
}

/**
 * Props for numeric filter component
 */
export interface NumericFilterProps extends BaseFilterProps {
  value: [number | null, number | null]
  onChange: (min: number | null, max: number | null) => void
  label: string
  min?: number
  max?: number
}

/**
 * Props for categorical filter component
 */
export interface CategoricalFilterProps extends BaseFilterProps {
  options: string[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  label: string
  multiple?: boolean
}

/**
 * Extended ClubTrend interface with computed properties for filtering
 */
export interface ProcessedClubTrend extends ClubTrend {
  // Computed values for filtering
  latestMembership: number
  latestDcpGoals: number
  distinguishedOrder: number // For proper Distinguished column sorting
}

/**
 * Enhanced ClubTrend interface extending ProcessedClubTrend with health data
 */
export interface EnhancedClubTrend extends ProcessedClubTrend {
  // Health classification data
  healthStatus?: HealthStatus
  trajectory?: Trajectory
  healthReasons?: string[]
  trajectoryReasons?: string[]
  healthDataAge?: number // Age in hours
  healthDataTimestamp?: string

  // Computed properties for filtering and sorting
  healthStatusOrder: number // For sorting: Intervention Required=0, Vulnerable=1, Thriving=2, Unknown=3
  trajectoryOrder: number // For sorting: Declining=0, Stable=1, Recovering=2, Unknown=3
}

/**
 * Health data integration status for tracking data freshness and errors
 */
export interface HealthDataStatus {
  isLoading: boolean
  isError: boolean
  isStale: boolean // > 24 hours old
  isOutdated: boolean // > 7 days old
  lastUpdated?: string
  errorMessage?: string
}

/**
 * Column configurations for the clubs table
 */
export const COLUMN_CONFIGS: ColumnConfig[] = [
  {
    field: 'name',
    label: 'Club Name',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'division',
    label: 'Division',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'area',
    label: 'Area',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'membership',
    label: 'Members',
    sortable: true,
    filterable: true,
    filterType: 'numeric',
  },
  {
    field: 'dcpGoals',
    label: 'DCP Goals',
    sortable: true,
    filterable: true,
    filterType: 'numeric',
  },
  {
    field: 'healthStatus',
    label: 'Health Status',
    sortable: true,
    filterable: true,
    filterType: 'categorical',
    filterOptions: [
      'Thriving',
      'Vulnerable',
      'Intervention Required',
      'Unknown',
    ],
    tooltip:
      'Club health classification based on membership trends, DCP goal achievement, and CSP submission status.\n\n• Thriving: Strong performance across all metrics, meeting or exceeding goals\n• Vulnerable: Warning signs present, may need support to maintain performance\n• Intervention Required: Critical issues requiring immediate attention and action\n• Unknown: Health data not available or insufficient for classification\n\nClick to sort by priority (most critical first) or filter by specific health status.',
    sortCustom: (a: unknown, b: unknown) => {
      // Custom sort order: Intervention Required, Vulnerable, Thriving, Unknown
      const order = {
        'Intervention Required': 0,
        Vulnerable: 1,
        Thriving: 2,
        Unknown: 3,
      }
      const aValue = a as keyof typeof order
      const bValue = b as keyof typeof order
      return (order[aValue] || 999) - (order[bValue] || 999)
    },
  },
  {
    field: 'trajectory',
    label: 'Trajectory',
    sortable: true,
    filterable: true,
    filterType: 'categorical',
    filterOptions: ['Recovering', 'Stable', 'Declining', 'Unknown'],
    tooltip:
      'Club trend direction based on month-over-month changes in membership and DCP goals.\n\n• Recovering: Showing positive improvement trends, moving in right direction\n• Stable: Maintaining consistent performance levels, no significant changes\n• Declining: Concerning downward trends, performance deteriorating over time\n• Unknown: Trajectory data not available or insufficient for trend analysis\n\nClick to sort by urgency (declining first) or filter by specific trajectory.',
    sortCustom: (a: unknown, b: unknown) => {
      // Custom sort order: Declining, Stable, Recovering, Unknown
      const order = { Declining: 0, Stable: 1, Recovering: 2, Unknown: 3 }
      const aValue = a as keyof typeof order
      const bValue = b as keyof typeof order
      return (order[aValue] || 999) - (order[bValue] || 999)
    },
  },
  {
    field: 'distinguished',
    label: 'Distinguished',
    sortable: true,
    filterable: true,
    filterType: 'categorical',
    filterOptions: ['Distinguished', 'Select', 'President', 'Smedley'],
    sortCustom: (a: unknown, b: unknown) => {
      const order = { Distinguished: 0, Select: 1, President: 2, Smedley: 3 }
      const aValue = a as keyof typeof order
      const bValue = b as keyof typeof order
      return (order[aValue] || 999) - (order[bValue] || 999)
    },
  },
]
