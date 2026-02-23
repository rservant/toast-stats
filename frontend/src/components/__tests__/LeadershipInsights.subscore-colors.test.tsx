/**
 * Unit tests for LeadershipInsights sub-score color-coding (#90)
 *
 * Verifies that Health, Growth, and DCP sub-score cells use color-coded
 * pills (green ≥75, yellow ≥50, red <50) — same pattern as Overall.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import { LeadershipInsights } from '../LeadershipInsights'

const makeInsights = (
  overrides: Partial<{
    healthScore: number
    growthScore: number
    dcpScore: number
    overallScore: number
  }> = {}
) => ({
  leadershipScores: [
    {
      divisionId: 'A',
      divisionName: 'Division A',
      healthScore: overrides.healthScore ?? 80,
      growthScore: overrides.growthScore ?? 55,
      dcpScore: overrides.dcpScore ?? 30,
      overallScore: overrides.overallScore ?? 60,
      rank: 1,
      isBestPractice: false,
    },
  ],
  bestPracticeDivisions: [],
  leadershipChanges: [],
  areaDirectorCorrelations: [],
  summary: {
    topPerformingDivisions: [],
    topPerformingAreas: [],
    averageLeadershipScore: 60,
    totalBestPracticeDivisions: 0,
  },
})

describe('LeadershipInsights — Sub-Score Color-Coding (#90)', () => {
  it('should render health sub-score with a green pill when ≥75', () => {
    render(
      <LeadershipInsights
        insights={makeInsights({ healthScore: 80 })}
        isLoading={false}
      />
    )

    // The health score cell should have the green color class
    const healthCell = screen.getByText('80')
    expect(healthCell).toHaveClass('text-green-600')
    expect(healthCell).toHaveClass('bg-green-100')
  })

  it('should render growth sub-score with a yellow pill when 50-74', () => {
    render(
      <LeadershipInsights
        insights={makeInsights({ growthScore: 55 })}
        isLoading={false}
      />
    )

    const growthCell = screen.getByText('55')
    expect(growthCell).toHaveClass('text-yellow-600')
    expect(growthCell).toHaveClass('bg-yellow-100')
  })

  it('should render DCP sub-score with a red pill when <50', () => {
    render(
      <LeadershipInsights
        insights={makeInsights({ dcpScore: 30 })}
        isLoading={false}
      />
    )

    const dcpCell = screen.getByText('30')
    expect(dcpCell).toHaveClass('text-red-600')
    expect(dcpCell).toHaveClass('bg-red-100')
  })

  it('should render all sub-scores as rounded pill badges', () => {
    render(
      <LeadershipInsights
        insights={makeInsights({
          healthScore: 90,
          growthScore: 65,
          dcpScore: 20,
        })}
        isLoading={false}
      />
    )

    // All three sub-scores should use the rounded-full pill style
    for (const value of ['90', '65', '20']) {
      const cell = screen.getByText(value)
      expect(cell).toHaveClass('rounded-full')
    }
  })
})
