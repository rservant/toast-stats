/**
 * Compute competition-style ranks with tie detection (#236).
 * Items with equal scores share the same rank (e.g., 1, 1, 3, 4).
 */
export function computeTiedRanks<T>(
  items: T[],
  getScore: (item: T) => number
): { rank: number; isTied: boolean }[] {
  if (items.length === 0) return []

  // Count occurrences of each score
  const scoreCounts = new Map<number, number>()
  items.forEach(item => {
    const score = getScore(item)
    scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1)
  })

  // Assign ranks — competition ranking (1, 1, 3, not 1, 1, 2)
  let currentRank = 1
  return items.map((item, index) => {
    if (index > 0 && getScore(item) !== getScore(items[index - 1]!)) {
      currentRank = index + 1
    }
    const score = getScore(item)
    const isTied = (scoreCounts.get(score) ?? 0) > 1
    return { rank: currentRank, isTied }
  })
}
