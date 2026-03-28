import { describe, it, expect } from 'vitest'
import { computeTiedRanks } from '../tieRankingUtils'

describe('computeTiedRanks', () => {
  it('assigns competition-style ranks to numeric scores', () => {
    const items = [
      { id: '1', score: 100 },
      { id: '2', score: 100 }, // tie
      { id: '3', score: 90 },
      { id: '4', score: 85 },
      { id: '5', score: 85 }, // tie
      { id: '6', score: 80 },
    ]

    const ranks = computeTiedRanks(items, item => item.score)

    expect(ranks).toEqual([
      { rank: 1, isTied: true },
      { rank: 1, isTied: true },
      { rank: 3, isTied: false },
      { rank: 4, isTied: true },
      { rank: 4, isTied: true },
      { rank: 6, isTied: false },
    ])
  })

  it('handles empty arrays without error', () => {
    const items: { score: number }[] = []
    const ranks = computeTiedRanks(items, item => item.score)
    expect(ranks).toEqual([])
  })

  it('handles single item arrays', () => {
    const items = [{ id: '1', score: 10 }]
    const ranks = computeTiedRanks(items, item => item.score)
    expect(ranks).toEqual([{ rank: 1, isTied: false }])
  })

  it('handles all items tied', () => {
    const items = [
      { id: '1', score: 5 },
      { id: '2', score: 5 },
      { id: '3', score: 5 },
    ]
    const ranks = computeTiedRanks(items, item => item.score)
    expect(ranks).toEqual([
      { rank: 1, isTied: true },
      { rank: 1, isTied: true },
      { rank: 1, isTied: true },
    ])
  })

  it('handles items with no ties', () => {
    const items = [
      { id: '1', score: 10 },
      { id: '2', score: 9 },
      { id: '3', score: 8 },
    ]
    const ranks = computeTiedRanks(items, item => item.score)
    expect(ranks).toEqual([
      { rank: 1, isTied: false },
      { rank: 2, isTied: false },
      { rank: 3, isTied: false },
    ])
  })
})
