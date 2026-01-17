import type {
  RecognitionLevel,
  RecognitionTargets,
} from '../components/TargetProgressCard'

/**
 * Check if a recognition level is achieved based on current value and targets
 */
export function isLevelAchieved(
  level: RecognitionLevel,
  current: number,
  targets: RecognitionTargets | null
): boolean {
  if (!targets) return false
  return current >= targets[level]
}

/**
 * Check if a level is at or below the achieved level
 */
export function isLevelAtOrBelowAchieved(
  level: RecognitionLevel,
  achievedLevel: RecognitionLevel | null
): boolean {
  if (!achievedLevel) return false
  const levelOrder: RecognitionLevel[] = [
    'distinguished',
    'select',
    'presidents',
    'smedley',
  ]
  const levelIndex = levelOrder.indexOf(level)
  const achievedIndex = levelOrder.indexOf(achievedLevel)
  return levelIndex <= achievedIndex
}
