/**
 * Mock Toastmasters API Service for development
 * Returns sample data without making real API calls
 */

export class MockToastmastersAPIService {
  async getDistricts(): Promise<{
    districts: Array<{ id: string; name: string }>
  }> {
    return {
      districts: [
        { id: '1', name: 'District 1' },
        { id: '2', name: 'District 2' },
        { id: '10', name: 'District 10' },
        { id: '25', name: 'District 25' },
        { id: '46', name: 'District 46' },
        { id: '101', name: 'District 101' },
      ],
    }
  }

  async getAllDistrictsRankings(date?: string): Promise<unknown[]> {
    try {
      const districtIds = ['1', '2', '10', '25', '46', '61', '101', '120']
      const mockData = []

      for (let i = 0; i < districtIds.length; i++) {
        const id = districtIds[i]
        const paidClubs = 80 + Math.floor(Math.random() * 100)
        const totalPayments = 2000 + Math.floor(Math.random() * 3000)
        const distinguishedClubs = Math.floor(Math.random() * 40)

        // Ensure paidClubs is never zero to avoid division by zero
        const safePaidClubs = Math.max(paidClubs, 1)

        mockData.push({
          districtId: id,
          districtName: `District ${id}`,
          region: `0${Math.floor(i / 2) + 1}`,
          paidClubs: safePaidClubs,
          paidClubBase: safePaidClubs + Math.floor(Math.random() * 20) - 10,
          clubGrowthPercent: Math.random() * 20 - 10,
          totalPayments,
          paymentBase: totalPayments + Math.floor(Math.random() * 1000) - 500,
          paymentGrowthPercent: Math.random() * 30 - 15,
          activeClubs: safePaidClubs + Math.floor(Math.random() * 10),
          distinguishedClubs,
          selectDistinguished: Math.floor(distinguishedClubs * 0.3),
          presidentsDistinguished: Math.floor(distinguishedClubs * 0.2),
          distinguishedPercent: (distinguishedClubs / safePaidClubs) * 100,
        })
      }

      // Rank by each category with tie handling - RANK BY PERCENTAGES, not absolute counts
      const sortedByClubs = [...mockData].sort(
        (a, b) => b.clubGrowthPercent - a.clubGrowthPercent
      )
      const sortedByPayments = [...mockData].sort(
        (a, b) => b.paymentGrowthPercent - a.paymentGrowthPercent
      )
      const sortedByDistinguished = [...mockData].sort(
        (a, b) => b.distinguishedPercent - a.distinguishedPercent
      )

      const totalDistricts = mockData.length

      // Ensure we have data to work with
      if (totalDistricts === 0) {
        return {
          rankings: [],
          date: date || new Date().toISOString().split('T')[0],
        }
      }

      // Create ranking maps with tie handling and Borda points
      // Borda point formula: bordaPoints = totalDistricts - rank + 1
      const clubsRank = new Map<string, number>()
      const clubsBordaPoints = new Map<string, number>()
      let currentRank = 1
      let previousValue = sortedByClubs[0]?.clubGrowthPercent ?? 0
      sortedByClubs.forEach((d, i) => {
        if (i > 0 && d.clubGrowthPercent < previousValue) {
          currentRank = i + 1
        }
        clubsRank.set(d.districtId, currentRank)
        const bordaPoints = totalDistricts - currentRank + 1
        clubsBordaPoints.set(d.districtId, bordaPoints)
        previousValue = d.clubGrowthPercent
      })

      const paymentsRank = new Map<string, number>()
      const paymentsBordaPoints = new Map<string, number>()
      currentRank = 1
      previousValue = sortedByPayments[0]?.paymentGrowthPercent ?? 0
      sortedByPayments.forEach((d, i) => {
        if (i > 0 && d.paymentGrowthPercent < previousValue) {
          currentRank = i + 1
        }
        paymentsRank.set(d.districtId, currentRank)
        const bordaPoints = totalDistricts - currentRank + 1
        paymentsBordaPoints.set(d.districtId, bordaPoints)
        previousValue = d.paymentGrowthPercent
      })

      const distinguishedRank = new Map<string, number>()
      const distinguishedBordaPoints = new Map<string, number>()
      currentRank = 1
      previousValue = sortedByDistinguished[0]?.distinguishedPercent ?? 0
      sortedByDistinguished.forEach((d, i) => {
        if (i > 0 && d.distinguishedPercent < previousValue) {
          currentRank = i + 1
        }
        distinguishedRank.set(d.districtId, currentRank)
        const bordaPoints = totalDistricts - currentRank + 1
        distinguishedBordaPoints.set(d.districtId, bordaPoints)
        previousValue = d.distinguishedPercent
      })

      const rankings = mockData
        .map(district => {
          const clubBorda = clubsBordaPoints.get(district.districtId) || 1
          const paymentBorda = paymentsBordaPoints.get(district.districtId) || 1
          const distBorda =
            distinguishedBordaPoints.get(district.districtId) || 1

          return {
            ...district,
            clubsRank: clubsRank.get(district.districtId) || 999,
            paymentsRank: paymentsRank.get(district.districtId) || 999,
            distinguishedRank:
              distinguishedRank.get(district.districtId) || 999,
            aggregateScore: clubBorda + paymentBorda + distBorda,
          }
        })
        .sort((a, b) => b.aggregateScore - a.aggregateScore) // Higher score is better

      return { rankings, date: date || new Date().toISOString().split('T')[0] }
    } catch (error) {
      console.error(
        'Error in MockToastmastersAPIService.getAllDistrictsRankings:',
        error
      )
      // Return empty rankings instead of throwing
      return {
        rankings: [],
        date: date || new Date().toISOString().split('T')[0],
      }
    }
  }

  async getDistrictStatistics(_districtId: string): Promise<unknown> {
    const baseMembers = 3000
    const baseMemberCount = baseMembers + Math.floor(Math.random() * 500)
    const previousMemberCount = baseMemberCount - 50

    return {
      districtId: _districtId,
      asOfDate: new Date().toISOString().split('T')[0],
      membership: {
        total: baseMemberCount,
        change: baseMemberCount - previousMemberCount,
        changePercent:
          ((baseMemberCount - previousMemberCount) / previousMemberCount) * 100,
        byClub: Array.from({ length: 10 }, (_, i) => ({
          clubId: `club-${i + 1}`,
          clubName: `Sample Club ${i + 1}`,
          memberCount: 20 + Math.floor(Math.random() * 30),
        })),
      },
      clubs: {
        total: 125,
        active: 115,
        suspended: 3,
        ineligible: 5,
        low: 2,
        distinguished: 45,
      },
      education: {
        totalAwards: 234,
        byType: [
          { type: 'Level 1', count: 80 },
          { type: 'Level 2', count: 60 },
          { type: 'Level 3', count: 45 },
          { type: 'Level 4', count: 30 },
          { type: 'Level 5', count: 19 },
        ],
        topClubs: Array.from({ length: 5 }, (_, i) => ({
          clubId: `club-${i + 1}`,
          clubName: `Top Club ${i + 1}`,
          awards: 25 - i * 3,
        })),
      },
    }
  }

  async getMembershipHistory(
    _districtId: string,
    months: number
  ): Promise<unknown[]> {
    const data = []
    const now = new Date()
    let baseCount = 2800

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      baseCount += Math.floor(Math.random() * 40) - 15 // Random growth/decline
      data.push({
        date: date.toISOString().split('T')[0],
        count: baseCount,
      })
    }

    return { data }
  }

  async getClubs(_districtId: string): Promise<{ clubs: unknown[] }> {
    const clubs = []
    const statuses: Array<'active' | 'suspended' | 'ineligible' | 'low'> = [
      'active',
      'active',
      'active',
      'active',
      'active',
      'active',
      'suspended',
      'ineligible',
      'low',
    ]
    const levels: Array<'select' | 'distinguished' | 'president'> = [
      'select',
      'distinguished',
      'president',
    ]

    for (let i = 1; i <= 20; i++) {
      const status = statuses[i % statuses.length]
      const distinguished = i % 3 === 0
      clubs.push({
        id: `club-${i}`,
        name: `Sample Club ${i}`,
        status,
        memberCount: 20 + Math.floor(Math.random() * 30),
        distinguished,
        distinguishedLevel: distinguished
          ? levels[i % levels.length]
          : undefined,
        awards: Math.floor(Math.random() * 15),
      })
    }
    return { clubs }
  }

  async getEducationalAwards(
    _districtId: string,
    months: number
  ): Promise<unknown> {
    const byMonth = []
    const now = new Date()

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      byMonth.push({
        month: date.toISOString().slice(0, 7),
        count: Math.floor(Math.random() * 30) + 10,
      })
    }

    return {
      totalAwards: byMonth.reduce((sum, m) => sum + m.count, 0),
      byType: [
        { type: 'Level 1', count: 80 },
        { type: 'Level 2', count: 60 },
        { type: 'Level 3', count: 45 },
        { type: 'Level 4', count: 30 },
        { type: 'Level 5', count: 19 },
      ],
      topClubs: Array.from({ length: 5 }, (_, i) => ({
        clubId: `club-${i + 1}`,
        clubName: `Top Club ${i + 1}`,
        awards: 25 - i * 3,
      })),
      byMonth,
    }
  }

  async getDailyReports(
    _districtId: string,
    startDate: string,
    endDate: string
  ): Promise<unknown[]> {
    const reports = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const newMembers = Math.floor(Math.random() * 10)
      const renewals = Math.floor(Math.random() * 20)
      reports.push({
        date: d.toISOString().slice(0, 10),
        newMembers,
        renewals,
        clubChanges: [],
        awards: Math.floor(Math.random() * 5),
      })
    }

    return { reports }
  }

  async getDailyReportDetail(
    _districtId: string,
    date: string
  ): Promise<unknown> {
    const newMembers = Array.from({ length: 5 }, (_, i) => ({
      name: `New Member ${i + 1}`,
      clubId: `club-${i + 1}`,
      clubName: `Sample Club ${i + 1}`,
    }))

    const renewals = Array.from({ length: 15 }, (_, i) => ({
      name: `Renewed Member ${i + 1}`,
      clubId: `club-${(i % 10) + 1}`,
      clubName: `Sample Club ${(i % 10) + 1}`,
    }))

    const awards = Array.from({ length: 3 }, (_, i) => ({
      type: `Level ${i + 1}`,
      recipient: `Member ${i + 1}`,
      clubId: `club-${i + 1}`,
      clubName: `Sample Club ${i + 1}`,
    }))

    return {
      date,
      newMembers,
      renewals,
      clubChanges: [],
      awards,
      summary: {
        totalNewMembers: newMembers.length,
        totalRenewals: renewals.length,
        totalAwards: awards.length,
        netMembershipChange: newMembers.length - 2,
        dayOverDayChange: 3,
      },
    }
  }

  async getCachedDates(): Promise<string[]> {
    try {
      // Return some mock cached dates
      const dates = []
      const today = new Date()
      for (let i = 0; i < 10; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i * 7) // Weekly dates
        dates.push(date.toISOString().split('T')[0])
      }
      return dates.reverse()
    } catch (error) {
      console.error(
        'Error in MockToastmastersAPIService.getCachedDates:',
        error
      )
      return []
    }
  }

  async clearCache(): Promise<{ success: boolean; message: string }> {
    // Mock implementation - just return success
    return { success: true, message: 'Mock cache cleared' }
  }

  async getAvailableDates(): Promise<string[]> {
    try {
      const cachedDates = await this.getCachedDates()

      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ]

      const dates = cachedDates.map(dateStr => {
        const date = new Date(dateStr + 'T00:00:00')
        return {
          date: dateStr,
          month: date.getMonth() + 1,
          day: date.getDate(),
          monthName: monthNames[date.getMonth()],
        }
      })

      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      const programYearStart =
        month >= 7 ? new Date(year, 6, 1) : new Date(year - 1, 6, 1)

      return {
        dates,
        programYear: {
          startDate: programYearStart.toISOString().split('T')[0],
          endDate: new Date(programYearStart.getFullYear() + 1, 5, 30)
            .toISOString()
            .split('T')[0],
          year: month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`,
        },
      }
    } catch (error) {
      console.error(
        'Error in MockToastmastersAPIService.getAvailableDates:',
        error
      )
      return {
        dates: [],
        programYear: {
          startDate: '2024-07-01',
          endDate: '2025-06-30',
          year: '2024-2025',
        },
      }
    }
  }

  async getDistrictRankHistory(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<unknown> {
    const cachedDates = await this.getCachedDates()
    const start = startDate || cachedDates[0]
    const end = endDate || cachedDates[cachedDates.length - 1]

    const datesInRange = cachedDates.filter(
      date => date >= start && date <= end
    )

    // Generate mock historical rank data with Borda count system
    // With 8 districts, ranks range from 1-8, Borda points range from 8-1
    // Aggregate score is sum of 3 categories, so range is 3-24
    const history = datesInRange.map(date => {
      const clubsRank = 3 + Math.floor(Math.random() * 4) // Rank 3-6
      const paymentsRank = 2 + Math.floor(Math.random() * 5) // Rank 2-6
      const distinguishedRank = 4 + Math.floor(Math.random() * 4) // Rank 4-7

      // Calculate Borda points for each rank (8 districts total)
      const totalDistricts = 8
      const clubsBorda = totalDistricts - clubsRank + 1
      const paymentsBorda = totalDistricts - paymentsRank + 1
      const distinguishedBorda = totalDistricts - distinguishedRank + 1

      return {
        date,
        aggregateScore: clubsBorda + paymentsBorda + distinguishedBorda,
        clubsRank,
        paymentsRank,
        distinguishedRank,
      }
    })

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    return {
      districtId,
      districtName: `District ${districtId}`,
      history,
      programYear: {
        startDate: start,
        endDate: end,
        year: month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`,
      },
    }
  }

  async getCacheStatistics(): Promise<unknown> {
    const dates = await this.getCachedDates()
    return {
      totalDates: dates.length,
      dateRange: {
        earliest: dates[0] || null,
        latest: dates[dates.length - 1] || null,
      },
      completeDates: dates.length,
      partialDates: 0,
      emptyDates: 0,
      totalDistricts: 8,
      programYears: ['2024-2025'],
      cacheSize: 0,
    }
  }

  async getCacheMetadata(date: string): Promise<unknown | null> {
    const dates = await this.getCachedDates()
    if (!dates.includes(date)) {
      return null
    }

    return {
      date,
      timestamp: Date.now(),
      dataCompleteness: 'complete' as const,
      districtCount: 8,
      source: 'mock' as const,
      programYear: '2024-2025',
    }
  }
}
