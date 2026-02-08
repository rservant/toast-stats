/**
 * Membership Analytics Module - Backend Version
 *
 * COPIED from backend/src/services/analytics/MembershipAnalyticsModule.ts
 * This is the hardened version with all bug fixes preserved.
 *
 * This file is a reference copy for task 3.2 adaptation.
 * Task 3.2 will merge this logic into the main MembershipAnalyticsModule.ts,
 * adapting it to work with DistrictStatistics[] instead of IAnalyticsDataSource.
 *
 * KEY DIFFERENCES from analytics-core version:
 * 1. Uses IAnalyticsDataSource for async data loading (backend pattern)
 * 2. Has generateMembershipAnalytics() returning full MembershipAnalytics type
 * 3. Includes seasonal patterns analysis (identifySeasonalPatterns)
 * 4. Includes program year change calculation (calculateProgramYearChange)
 * 5. Includes top growth/declining clubs analysis
 * 6. Includes year-over-year membership comparison
 *
 * The analytics-core version:
 * 1. Works directly with DistrictStatistics[] (no async data loading)
 * 2. Has generateMembershipTrends() returning simpler MembershipTrendData
 * 3. Has public getTotalMembership() and calculateMembershipChange() methods
 *
 * Requirements: 1.1, 1.2
 */
import { parseIntSafe, ensureString } from './AnalyticsUtils.js';
/**
 * Simple logger interface for compatibility.
 */
const logger = {
    info: (message, context) => {
        if (process.env['NODE_ENV'] !== 'test') {
            console.log(`[INFO] ${message}`, context);
        }
    },
    warn: (message, context) => {
        if (process.env['NODE_ENV'] !== 'test') {
            console.warn(`[WARN] ${message}`, context);
        }
    },
    error: (message, context) => {
        if (process.env['NODE_ENV'] !== 'test') {
            console.error(`[ERROR] ${message}`, context);
        }
    },
};
// ========== Main Module Class ==========
/**
 * MembershipAnalyticsModule (Backend Version)
 *
 * Specialized module for membership-related analytics calculations.
 * Accepts dependencies via constructor injection for testability.
 *
 * Requirements: 1.1, 1.2
 */
export class MembershipAnalyticsModuleBackend {
    /**
     * Create a MembershipAnalyticsModuleBackend instance
     *
     * @param dataSource - IAnalyticsDataSource for snapshot-based data retrieval
     */
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    /**
     * Generate comprehensive membership analytics
     *
     * @param districtId - The district ID to analyze
     * @param startDate - Optional start date filter (inclusive)
     * @param endDate - Optional end date filter (inclusive)
     * @returns MembershipAnalytics object
     */
    async generateMembershipAnalytics(districtId, startDate, endDate) {
        try {
            const dataEntries = await this.loadDistrictData(districtId, startDate, endDate);
            if (dataEntries.length === 0) {
                throw new Error('No cached data available for membership analytics');
            }
            // Calculate membership trend over time
            const membershipTrend = this.calculateMembershipTrend(dataEntries);
            const totalMembership = membershipTrend[membershipTrend.length - 1]?.count || 0;
            const membershipChange = this.calculateMembershipChange(membershipTrend);
            // Calculate program year change
            const programYearChange = this.calculateProgramYearChange(membershipTrend);
            // Analyze club trends to identify top growth and declining clubs
            const clubTrends = await this.analyzeClubTrends(districtId, dataEntries);
            const topGrowthClubs = this.calculateTopGrowthClubs(clubTrends);
            const topDecliningClubs = this.calculateTopDecliningClubs(clubTrends);
            // Identify seasonal patterns
            const seasonalPatterns = this.identifySeasonalPatterns(membershipTrend);
            // Calculate year-over-year comparison if data available
            const yearOverYearComparison = await this.calculateMembershipYearOverYear(districtId, dataEntries);
            const analytics = {
                totalMembership,
                membershipChange,
                programYearChange,
                membershipTrend,
                topGrowthClubs,
                topDecliningClubs,
                seasonalPatterns,
                yearOverYearComparison,
            };
            logger.info('Generated membership analytics', {
                districtId,
                totalMembership,
                membershipChange,
                programYearChange,
                topGrowthClubs: topGrowthClubs.length,
                topDecliningClubs: topDecliningClubs.length,
            });
            return analytics;
        }
        catch (error) {
            logger.error('Failed to generate membership analytics', {
                districtId,
                error,
            });
            throw error;
        }
    }
    /**
     * Calculate year-over-year membership comparison
     *
     * @param districtId - The district ID
     * @param dataEntries - Array of district cache entries
     * @returns Year-over-year comparison or undefined if not available
     */
    async calculateMembershipYearOverYear(districtId, dataEntries) {
        if (dataEntries.length === 0) {
            return undefined;
        }
        const latestEntry = dataEntries[dataEntries.length - 1];
        if (!latestEntry) {
            return undefined;
        }
        const currentDate = latestEntry.date;
        // Calculate previous year date (subtract 1 year)
        const currentYear = parseInt(currentDate.substring(0, 4));
        const previousYearDate = `${currentYear - 1}${currentDate.substring(4)}`;
        try {
            const previousEntry = await this.getDistrictDataForDate(districtId, previousYearDate);
            if (!previousEntry) {
                logger.info('No previous year data available for comparison', {
                    districtId,
                    currentDate,
                    previousYearDate,
                });
                return undefined;
            }
            const currentMembership = this.getTotalMembership(latestEntry);
            const previousMembership = this.getTotalMembership(previousEntry);
            const membershipChange = currentMembership - previousMembership;
            const percentageChange = previousMembership > 0
                ? Math.round((membershipChange / previousMembership) * 1000) / 10
                : 0;
            return {
                currentMembership,
                previousMembership,
                percentageChange,
                membershipChange,
            };
        }
        catch (error) {
            logger.warn('Failed to calculate year-over-year membership comparison', {
                districtId,
                currentDate,
                error,
            });
            return undefined;
        }
    }
    // ========== Private Helper Methods ==========
    /**
     * Calculate membership trend over time
     */
    calculateMembershipTrend(dataEntries) {
        return dataEntries.map(entry => ({
            date: entry.date,
            count: this.getTotalMembership(entry),
        }));
    }
    /**
     * Get total membership from a cache entry
     *
     * @param entry - District cache entry
     * @returns Total membership count
     */
    getTotalMembership(entry) {
        return entry.clubPerformance.reduce((sum, club) => {
            const membership = parseIntSafe(club['Active Members'] ||
                club['Active Membership'] ||
                club['Membership']);
            return sum + (isNaN(membership) ? 0 : membership);
        }, 0);
    }
    /**
     * Calculate membership change
     */
    calculateMembershipChange(membershipTrend) {
        if (membershipTrend.length < 2) {
            return 0;
        }
        const first = membershipTrend[0]?.count ?? 0;
        const last = membershipTrend[membershipTrend.length - 1]?.count ?? 0;
        return last - first;
    }
    /**
     * Calculate top growth clubs
     */
    calculateTopGrowthClubs(clubTrends) {
        const growthClubs = clubTrends
            .map(club => {
            if (club.membershipTrend.length < 2) {
                return { clubId: club.clubId, clubName: club.clubName, growth: 0 };
            }
            const first = club.membershipTrend[0]?.count ?? 0;
            const last = club.membershipTrend[club.membershipTrend.length - 1]?.count ?? 0;
            const growth = last - first;
            return { clubId: club.clubId, clubName: club.clubName, growth };
        })
            .filter(club => club.growth > 0)
            .sort((a, b) => b.growth - a.growth)
            .slice(0, 10);
        return growthClubs;
    }
    /**
     * Calculate top declining clubs
     */
    calculateTopDecliningClubs(clubTrends) {
        const decliningClubs = clubTrends
            .map(club => {
            if (club.membershipTrend.length < 2) {
                return { clubId: club.clubId, clubName: club.clubName, decline: 0 };
            }
            const first = club.membershipTrend[0]?.count ?? 0;
            const last = club.membershipTrend[club.membershipTrend.length - 1]?.count ?? 0;
            const decline = first - last;
            return { clubId: club.clubId, clubName: club.clubName, decline };
        })
            .filter(club => club.decline > 0)
            .sort((a, b) => b.decline - a.decline)
            .slice(0, 10);
        return decliningClubs;
    }
    /**
     * Identify seasonal patterns in membership changes
     * Analyzes month-over-month changes to detect patterns
     */
    identifySeasonalPatterns(membershipTrend) {
        if (membershipTrend.length < 2) {
            return [];
        }
        const monthlyChanges = new Map();
        for (let i = 1; i < membershipTrend.length; i++) {
            const currentPoint = membershipTrend[i];
            const previousPoint = membershipTrend[i - 1];
            const month = parseInt(currentPoint.date.substring(5, 7));
            const change = currentPoint.count - previousPoint.count;
            if (!monthlyChanges.has(month)) {
                monthlyChanges.set(month, []);
            }
            monthlyChanges.get(month).push(change);
        }
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
        ];
        const patterns = [];
        for (let month = 1; month <= 12; month++) {
            const changes = monthlyChanges.get(month) || [];
            if (changes.length === 0) {
                continue;
            }
            const averageChange = changes.reduce((sum, val) => sum + val, 0) / changes.length;
            let trend;
            if (averageChange > 2) {
                trend = 'growth';
            }
            else if (averageChange < -2) {
                trend = 'decline';
            }
            else {
                trend = 'stable';
            }
            patterns.push({
                month,
                monthName: monthNames[month - 1] || 'Unknown',
                averageChange: Math.round(averageChange * 10) / 10,
                trend,
            });
        }
        patterns.sort((a, b) => a.month - b.month);
        return patterns;
    }
    /**
     * Calculate program year membership change
     * Toastmasters program year runs July 1 - June 30
     */
    calculateProgramYearChange(membershipTrend) {
        if (membershipTrend.length === 0) {
            return 0;
        }
        const latestDate = membershipTrend[membershipTrend.length - 1]?.date;
        if (!latestDate) {
            return 0;
        }
        const latestYear = parseInt(latestDate.substring(0, 4));
        const latestMonth = parseInt(latestDate.substring(5, 7));
        let programYearStart;
        if (latestMonth >= 7) {
            programYearStart = `${latestYear}-07-01`;
        }
        else {
            programYearStart = `${latestYear - 1}-07-01`;
        }
        const programYearStartData = membershipTrend.find(point => point.date >= programYearStart);
        if (!programYearStartData) {
            return this.calculateMembershipChange(membershipTrend);
        }
        const startMembership = programYearStartData.count;
        const currentMembership = membershipTrend[membershipTrend.length - 1]?.count;
        if (currentMembership === undefined) {
            return 0;
        }
        return currentMembership - startMembership;
    }
    /**
     * Analyze club trends over time
     */
    async analyzeClubTrends(_districtId, dataEntries) {
        const latestEntry = dataEntries[dataEntries.length - 1];
        if (!latestEntry) {
            return [];
        }
        const clubMap = new Map();
        for (const club of latestEntry.clubPerformance) {
            const clubId = ensureString(club['Club Number'] || club['Club ID'] || club['ClubID']);
            if (!clubId)
                continue;
            const clubName = ensureString(club['Club Name'] || club['ClubName']);
            clubMap.set(clubId, {
                clubId,
                clubName,
                divisionId: ensureString(club['Division']),
                divisionName: ensureString(club['Division Name']) || ensureString(club['Division']),
                areaId: ensureString(club['Area']),
                areaName: ensureString(club['Area Name']) || ensureString(club['Area']),
                membershipTrend: [],
                dcpGoalsTrend: [],
                currentStatus: 'thriving',
                riskFactors: [],
                distinguishedLevel: 'NotDistinguished',
            });
        }
        for (const entry of dataEntries) {
            for (const club of entry.clubPerformance) {
                const clubId = ensureString(club['Club Number'] || club['Club ID'] || club['ClubID']);
                if (!clubId || !clubMap.has(clubId))
                    continue;
                const clubTrend = clubMap.get(clubId);
                const membership = parseIntSafe(club['Active Members'] ||
                    club['Active Membership'] ||
                    club['Membership']);
                const dcpGoals = parseIntSafe(club['Goals Met']);
                clubTrend.membershipTrend.push({
                    date: entry.date,
                    count: isNaN(membership) ? 0 : membership,
                });
                clubTrend.dcpGoalsTrend.push({
                    date: entry.date,
                    goalsAchieved: isNaN(dcpGoals) ? 0 : dcpGoals,
                });
            }
        }
        return Array.from(clubMap.values());
    }
    /**
     * Map DistrictStatisticsBackend to DistrictCacheEntry format
     */
    mapDistrictStatisticsToEntry(stats, snapshotDate) {
        return {
            districtId: stats.districtId,
            date: snapshotDate,
            districtPerformance: stats.districtPerformance ?? [],
            divisionPerformance: stats.divisionPerformance ?? [],
            clubPerformance: stats.clubPerformance ?? [],
            fetchedAt: stats.asOfDate,
        };
    }
    /**
     * Load cached data for a district within a date range
     */
    async loadDistrictData(districtId, startDate, endDate) {
        try {
            const snapshots = await this.dataSource.getSnapshotsInRange(startDate, endDate);
            if (snapshots.length === 0) {
                const latestSnapshot = await this.dataSource.getLatestSnapshot();
                if (!latestSnapshot) {
                    logger.warn('No snapshot data found for district', {
                        districtId,
                        startDate,
                        endDate,
                    });
                    return [];
                }
                const districtData = await this.dataSource.getDistrictData(latestSnapshot.snapshot_id, districtId);
                if (!districtData) {
                    logger.warn('No district data found in latest snapshot', {
                        districtId,
                        snapshotId: latestSnapshot.snapshot_id,
                    });
                    return [];
                }
                return [
                    this.mapDistrictStatisticsToEntry(districtData, latestSnapshot.snapshot_id),
                ];
            }
            const dataEntries = [];
            for (const snapshotInfo of snapshots) {
                const districtData = await this.dataSource.getDistrictData(snapshotInfo.snapshotId, districtId);
                if (districtData) {
                    dataEntries.push(this.mapDistrictStatisticsToEntry(districtData, snapshotInfo.dataAsOfDate));
                }
            }
            dataEntries.sort((a, b) => a.date.localeCompare(b.date));
            logger.info('Loaded district data for membership analytics', {
                districtId,
                totalSnapshots: snapshots.length,
                loadedEntries: dataEntries.length,
                dateRange: {
                    start: dataEntries[0]?.date,
                    end: dataEntries[dataEntries.length - 1]?.date,
                },
            });
            return dataEntries;
        }
        catch (error) {
            logger.error('Failed to load district data', {
                districtId,
                startDate,
                endDate,
                error,
            });
            throw error;
        }
    }
    /**
     * Get district data for a specific date
     */
    async getDistrictDataForDate(districtId, date) {
        try {
            const districtData = await this.dataSource.getDistrictData(date, districtId);
            if (!districtData) {
                return null;
            }
            return this.mapDistrictStatisticsToEntry(districtData, date);
        }
        catch (error) {
            logger.warn('Failed to get district data for date', {
                districtId,
                date,
                error,
            });
            return null;
        }
    }
}
