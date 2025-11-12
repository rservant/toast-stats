/**
 * Mock Toastmasters API Service for development
 * Returns sample data without making real API calls
 */

export class MockToastmastersAPIService {
  async authenticate(_username: string, _password: string): Promise<boolean> {
    return true
  }

  async getDistricts() {
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

  async getDistrictStatistics(_districtId: string) {
    const baseMembers = 3000
    const baseMemberCount = baseMembers + Math.floor(Math.random() * 500)
    const previousMemberCount = baseMemberCount - 50
    
    return {
      districtId: _districtId,
      asOfDate: new Date().toISOString().split('T')[0],
      membership: {
        total: baseMemberCount,
        change: baseMemberCount - previousMemberCount,
        changePercent: ((baseMemberCount - previousMemberCount) / previousMemberCount) * 100,
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

  async getMembershipHistory(_districtId: string, months: number) {
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

  async getClubs(_districtId: string) {
    const clubs = []
    const statuses: Array<'active' | 'suspended' | 'ineligible' | 'low'> = [
      'active', 'active', 'active', 'active', 'active', 'active',
      'suspended', 'ineligible', 'low'
    ]
    const levels: Array<'select' | 'distinguished' | 'president'> = ['select', 'distinguished', 'president']
    
    for (let i = 1; i <= 20; i++) {
      const status = statuses[i % statuses.length]
      const distinguished = i % 3 === 0
      clubs.push({
        id: `club-${i}`,
        name: `Sample Club ${i}`,
        status,
        memberCount: 20 + Math.floor(Math.random() * 30),
        distinguished,
        distinguishedLevel: distinguished ? levels[i % levels.length] : undefined,
        awards: Math.floor(Math.random() * 15),
      })
    }
    return { clubs }
  }

  async getEducationalAwards(_districtId: string, months: number) {
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

  async getDailyReports(_districtId: string, startDate: string, endDate: string) {
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

  async getDailyReportDetail(_districtId: string, date: string) {
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
}
