// Brand Components
export * from './brand'

// Navigation Components
export * from './Navigation'

// Header Components
export * from './Header'

// UI Components
export * from './ui/Button'
export * from './ui/Form'

// Existing components
export { Tooltip, InfoIcon } from './Tooltip'

// Chart Components
export { MembershipPaymentsChart } from './MembershipPaymentsChart'
export type { MembershipPaymentsChartProps } from './MembershipPaymentsChart'

// Ranking Components
export { default as RankingCard } from './RankingCard'
export type { RankingCardProps } from './RankingCard'

export { default as FullYearRankingChart } from './FullYearRankingChart'
export type {
  FullYearRankingChartProps,
  RankMetric,
} from './FullYearRankingChart'

// Area Recognition Components
export { CriteriaExplanation } from './CriteriaExplanation'
export type { CriteriaExplanationProps } from './CriteriaExplanation'

// Division Recognition Components
export { DivisionCriteriaExplanation } from './DivisionCriteriaExplanation'
export type { DivisionCriteriaExplanationProps } from './DivisionCriteriaExplanation'

// Division and Area Recognition Panel
export {
  DivisionAreaRecognitionPanel,
  AreaRecognitionPanel, // Deprecated alias for backward compatibility
} from './DivisionAreaRecognitionPanel'
export type {
  DivisionAreaRecognitionPanelProps,
  AreaRecognitionPanelProps, // Deprecated alias for backward compatibility
} from './DivisionAreaRecognitionPanel'

// Division and Area Progress Summary
export {
  DivisionAreaProgressSummary,
  AreaProgressSummary, // Deprecated alias for backward compatibility
} from './DivisionAreaProgressSummary'
export type {
  DivisionAreaProgressSummaryProps,
  AreaProgressSummaryProps, // Deprecated alias for backward compatibility
  AreaWithDivision, // Deprecated - use DivisionPerformance[] instead
} from './DivisionAreaProgressSummary'
