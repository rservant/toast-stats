/**
 * Real Toastmasters API Service
 * Uses the scraper to fetch real data and transforms it to match our API format
 */

import { ToastmastersScraper } from './ToastmastersScraper.js'
import { CacheManager } from './CacheManager.js'
import { logger } from '../utils/logger.js'

export class RealToastmastersAPIService {
  private scraper: ToastmastersScraper
  private cacheManager: CacheManager

  constructor() {
    this.scraper = new ToastmastersScraper()
    this.cacheManager = new CacheManager()
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.scraper.closeBrowser()
  }

  /**
   * Get list of all districts (simple list)
   */
  async getDistricts() {
    try {
      const districts = await this.scraper.getAllDistrictsList()
      
      logger.info('Districts fetched', { count: districts.length })
      return { districts }
    } catch (_error) {
      logger.error('Failed to get districts', error)
      throw error
    }
  }

  /**
   * Get all districts with performance rankings
   * Uses file-based cache to avoid re-downloading data
   */
  async getAllDistrictsRankings(date?: string) {
    try {
      const targetDate = date || CacheManager.getTodayDate()
      
      // Check cache first
      const cachedData = await this.cacheManager.getCache(targetDate, 'districts')
      if (cachedData) {
        logger.info('Using cached district rankings', { date: targetDate })
        return cachedData
      }

      // Cache miss - fetch from scraper
      logger.info('Fetching fresh district rankings', { date: targetDate })
      
      // If a specific date is requested, use date selection
      let allDistricts
      if (date) {
        allDistricts = await this.scraper.getAllDistrictsForDate(date)
      } else {
        allDistricts = await this.scraper.getAllDistricts()
      }
      
      // First pass: collect all metrics
      const districtData = allDistricts.map((row: any) => ({
        districtId: row['DISTRICT'] || '',
        districtName: `District ${row['DISTRICT']}`,
        region: row['REGION'] || '',
        paidClubs: parseInt(row['Paid Clubs'] || '0', 10),
        paidClubBase: parseInt(row['Paid Club Base'] || '0', 10),
        clubGrowthPercent: parseFloat(row['% Club Growth']?.replace('%', '') || '0'),
        totalPayments: parseInt(row['Total YTD Payments'] || '0', 10),
        paymentBase: parseInt(row['Payment Base'] || '0', 10),
        paymentGrowthPercent: parseFloat(row['% Payment Growth']?.replace('%', '') || '0'),
        activeClubs: parseInt(row['Active Clubs'] || '0', 10),
        distinguishedClubs: parseInt(row['Total Distinguished Clubs'] || '0', 10),
        selectDistinguished: parseInt(row['Select Distinguished Clubs'] || '0', 10),
        presidentsDistinguished: parseInt(row['Presidents Distinguished Clubs'] || '0', 10),
        distinguishedPercent: parseFloat(row['% Distinguished Clubs']?.replace('%', '') || '0'),
      }))

      // Second pass: rank each district in each category (1 = best)
      // Handle ties by giving them the same rank
      // Rank by PERCENTAGES, not absolute counts
      const sortedByClubs = [...districtData].sort((a, b) => b.clubGrowthPercent - a.clubGrowthPercent)
      const sortedByPayments = [...districtData].sort((a, b) => b.paymentGrowthPercent - a.paymentGrowthPercent)
      const sortedByDistinguished = [...districtData].sort((a, b) => b.distinguishedPercent - a.distinguishedPercent)

      const totalDistricts = districtData.length

      // Create ranking maps with tie handling and Borda points
      // Borda point formula: bordaPoints = totalDistricts - rank + 1
      const clubsRank = new Map<string, number>()
      const clubsBordaPoints = new Map<string, number>()
      let currentRank = 1
      let previousValue = sortedByClubs[0]?.clubGrowthPercent
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
      previousValue = sortedByPayments[0]?.paymentGrowthPercent
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
      previousValue = sortedByDistinguished[0]?.distinguishedPercent
      sortedByDistinguished.forEach((d, i) => {
        if (i > 0 && d.distinguishedPercent < previousValue) {
          currentRank = i + 1
        }
        distinguishedRank.set(d.districtId, currentRank)
        const bordaPoints = totalDistricts - currentRank + 1
        distinguishedBordaPoints.set(d.districtId, bordaPoints)
        previousValue = d.distinguishedPercent
      })

      // Third pass: calculate aggregate score using Borda count (sum of Borda points - higher is better)
      const rankings = districtData.map((district) => {
        const clubRank = clubsRank.get(district.districtId) || 999
        const paymentRank = paymentsRank.get(district.districtId) || 999
        const distRank = distinguishedRank.get(district.districtId) || 999
        
        const clubBorda = clubsBordaPoints.get(district.districtId) || 1
        const paymentBorda = paymentsBordaPoints.get(district.districtId) || 1
        const distBorda = distinguishedBordaPoints.get(district.districtId) || 1
        
        // Sum of Borda points (higher is better, so we'll sort descending)
        const aggregateScore = clubBorda + paymentBorda + distBorda
        
        return {
          ...district,
          clubsRank: clubRank,
          paymentsRank: paymentRank,
          distinguishedRank: distRank,
          aggregateScore,
        }
      }).sort((a, b) => b.aggregateScore - a.aggregateScore) // Higher score is better
      
      logger.info('District rankings calculated', { count: rankings.length })
      
      const result = { rankings, date: targetDate }
      
      // Cache the result
      await this.cacheManager.setCache(targetDate, result, 'districts')
      
      return result
    } catch (_error) {
      logger.error('Failed to get district rankings', error)
      throw error
    }
  }

  /**
   * Get all cached dates
   */
  async getCachedDates(): Promise<string[]> {
    return this.cacheManager.getCachedDates('districts')
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    return this.cacheManager.clearCache()
  }

  /**
   * Get district statistics
   */
  async getDistrictStatistics(districtId: string) {
    try {
      const clubData = await this.scraper.getClubPerformance(districtId)

      // Calculate statistics from club data
      const totalClubs = clubData.length
      const activeClubs = clubData.filter((club: any) => 
        club['Club Status']?.toLowerCase() === 'active'
      ).length
      
      const suspendedClubs = clubData.filter((club: any) => 
        club['Club Status']?.toLowerCase() === 'suspended'
      ).length
      
      const ineligibleClubs = clubData.filter((club: any) => 
        club['Club Status']?.toLowerCase() === 'ineligible'
      ).length
      
      const lowClubs = clubData.filter((club: any) => 
        club['Club Status']?.toLowerCase() === 'low'
      ).length
      
      const distinguishedClubs = clubData.filter((club: any) => {
        const status = club['Club Distinguished Status'] || ''
        return status.toLowerCase().includes('distinguished') || 
               status.toLowerCase().includes('select') ||
               status.toLowerCase().includes('president')
      }).length

      // Calculate membership stats
      const totalMembers = clubData.reduce((sum: number, club: any) => {
        const members = parseInt(club['Active Members'] || '0', 10)
        return sum + members
      }, 0)

      const baseMembership = clubData.reduce((sum: number, club: any) => {
        const base = parseInt(club['Mem. Base'] || '0', 10)
        return sum + base
      }, 0)

      const membershipChange = totalMembers - baseMembership
      const changePercent = baseMembership > 0 ? (membershipChange / baseMembership) * 100 : 0

      // Get top clubs by membership
      const topClubs = clubData
        .map((club: any) => ({
          clubId: club['Club Number'] || '',
          clubName: club['Club Name'] || 'Unknown Club',
          memberCount: parseInt(club['Active Members'] || '0', 10),
        }))
        .sort((a: any, b: any) => b.memberCount - a.memberCount)
        .slice(0, 10)

      return {
        districtId,
        asOfDate: new Date().toISOString().split('T')[0],
        membership: {
          total: totalMembers,
          change: membershipChange,
          changePercent: parseFloat(changePercent.toFixed(2)),
          byClub: topClubs,
        },
        clubs: {
          total: totalClubs,
          active: activeClubs,
          suspended: suspendedClubs,
          ineligible: ineligibleClubs,
          low: lowClubs,
          distinguished: distinguishedClubs,
        },
        education: {
          totalAwards: 0, // Would need additional scraping
          byType: [],
          topClubs: [],
        },
      }
    } catch (_error) {
      logger.error('Failed to get district statistics', { districtId, error })
      throw error
    }
  }

  /**
   * Get membership history
   */
  async getMembershipHistory(districtId: string, months: number) {
    try {
      // Note: Historical data would require scraping historical year pages
      // For now, we'll use current data and generate a simple history
      const stats = await this.getDistrictStatistics(districtId)
      
      const data = []
      const now = new Date()
      const currentTotal = stats.membership.total
      const monthlyChange = Math.floor(stats.membership.change / months)
      
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const count = currentTotal - (monthlyChange * i)
        
        data.push({
          date: date.toISOString().split('T')[0],
          count: Math.max(0, count),
        })
      }
      
      return { data }
    } catch (_error) {
      logger.error('Failed to get membership history', { districtId, error })
      throw error
    }
  }

  /**
   * Get clubs for a district
   */
  async getClubs(districtId: string) {
    try {
      const clubData = await this.scraper.getClubPerformance(districtId)
      
      const clubs = clubData.map((row: any) => {
        const distinguishedStatus = row['Club Distinguished Status'] || ''
        const distinguished = distinguishedStatus.trim().length > 0
        let distinguishedLevel: 'select' | 'distinguished' | 'president' | undefined
        
        if (distinguished) {
          const status = distinguishedStatus.toLowerCase()
          if (status.includes('president')) {
            distinguishedLevel = 'president'
          } else if (status.includes('select')) {
            distinguishedLevel = 'select'
          } else {
            distinguishedLevel = 'distinguished'
          }
        }
        
        // Calculate total awards
        const level1s = parseInt(row['Level 1s'] || '0', 10)
        const level2s = parseInt(row['Level 2s'] || '0', 10)
        const level3s = parseInt(row['Level 3s'] || '0', 10)
        const level4s = parseInt(row['Level 4s, Path Completions, or DTM Awards'] || '0', 10)
        const totalAwards = level1s + level2s + level3s + level4s
        
        return {
          id: row['Club Number'] || '',
          name: row['Club Name'] || 'Unknown Club',
          status: (row['Club Status']?.toLowerCase() || 'active') as 'active' | 'suspended' | 'ineligible' | 'low',
          memberCount: parseInt(row['Active Members'] || '0', 10),
          distinguished,
          distinguishedLevel,
          awards: totalAwards,
        }
      })
      
      return { clubs }
    } catch (_error) {
      logger.error('Failed to get clubs', { districtId, error })
      throw error
    }
  }

  /**
   * Get educational awards
   */
  async getEducationalAwards(districtId: string, months: number) {
    try {
      // Educational awards would require additional scraping
      // For now, return empty data structure
      const byMonth = []
      const now = new Date()
      
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        byMonth.push({
          month: date.toISOString().slice(0, 7),
          count: 0,
        })
      }
      
      return {
        totalAwards: 0,
        byType: [],
        topClubs: [],
        byMonth,
      }
    } catch (_error) {
      logger.error('Failed to get educational awards', { districtId, error })
      throw error
    }
  }

  /**
   * Get daily reports
   */
  async getDailyReports(districtId: string, _startDate: string, _endDate: string) {
    // Daily reports would require additional scraping or different data source
    // For now, return empty structure
    logger.info('Getting daily reports (placeholder)', { districtId })
    return { reports: [] }
  }

  /**
   * Get daily report detail
   */
  async getDailyReportDetail(districtId: string, date: string) {
    try {
      // Daily report detail would require additional scraping
      // For now, return empty structure
      return {
        date,
        newMembers: [],
        renewals: [],
        clubChanges: [],
        awards: [],
        summary: {
          totalNewMembers: 0,
          totalRenewals: 0,
          totalAwards: 0,
          netMembershipChange: 0,
          dayOverDayChange: 0,
        },
      }
    } catch (_error) {
      logger.error('Failed to get daily report detail', { districtId, date, error })
      throw error
    }
  }

  /**
   * Get available dates with month/day information
   */
  async getAvailableDates() {
    try {
      const cachedDates = await this.cacheManager.getCachedDates('districts')
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      
      const dates = cachedDates.map(dateStr => {
        const date = new Date(dateStr + 'T00:00:00')
        return {
          date: dateStr,
          month: date.getMonth() + 1, // 1-12
          day: date.getDate(),
          monthName: monthNames[date.getMonth()],
        }
      })
      
      const programYearStart = CacheManager.getProgramYearStart()
      
      return {
        dates,
        programYear: {
          startDate: programYearStart.toISOString().split('T')[0],
          endDate: new Date(programYearStart.getFullYear() + 1, 5, 30).toISOString().split('T')[0], // June 30
          year: CacheManager.getProgramYear(),
        },
      }
    } catch (_error) {
      logger.error('Failed to get available dates', error)
      throw error
    }
  }

  /**
   * Get rank history for a specific district
   * Uses optimized historical index for faster queries
   */
  async getDistrictRankHistory(districtId: string, startDate?: string, endDate?: string) {
    try {
      // Determine date range - default to current program year
      const start = startDate || CacheManager.getProgramYearStart().toISOString().split('T')[0]
      const end = endDate || new Date().toISOString().split('T')[0]
      
      // Use optimized index-based query
      const snapshots = await this.cacheManager.getDistrictRankHistory(districtId, start, end)
      
      // Transform snapshots to history format
      const history = snapshots.map(snapshot => ({
        date: snapshot.date,
        aggregateScore: snapshot.aggregateScore,
        clubsRank: snapshot.clubsRank,
        paymentsRank: snapshot.paymentsRank,
        distinguishedRank: snapshot.distinguishedRank,
      }))
      
      const districtName = snapshots.length > 0 
        ? snapshots[0].districtName 
        : `District ${districtId}`
      
      return {
        districtId,
        districtName,
        history,
        programYear: {
          startDate: start,
          endDate: end,
          year: CacheManager.getProgramYear(),
        },
      }
    } catch (_error) {
      logger.error('Failed to get district rank history', { districtId, error })
      throw error
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStatistics() {
    try {
      return await this.cacheManager.getCacheStatistics()
    } catch (_error) {
      logger.error('Failed to get cache statistics', error)
      throw error
    }
  }

  /**
   * Get cache metadata for a specific date
   */
  async getCacheMetadata(date: string) {
    try {
      return await this.cacheManager.getMetadata(date)
    } catch (_error) {
      logger.error('Failed to get cache metadata', { date, error })
      throw error
    }
  }

}
