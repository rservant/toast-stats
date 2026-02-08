/**
 * BordaCountRankingCalculator service for computing district rankings using Borda count system
 *
 * This service implements the sophisticated Borda count ranking algorithm that was
 * previously part of the legacy cache system. It calculates rankings across three
 * categories: club growth, payment growth, and distinguished club percentages.
 *
 * CRITICAL: This code is migrated from backend/src/services/RankingCalculator.ts,
 * not rewritten, to preserve bug fixes.
 *
 * @module @toastmasters/analytics-core/rankings
 */
/**
 * Default no-op logger for when no logger is provided.
 */
const noopLogger = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { },
};
/**
 * Borda Count Ranking Calculator implementation
 *
 * Implements the sophisticated ranking system using Borda count scoring:
 * - Ranks districts in three categories: club growth, payment growth, distinguished percentage
 * - Handles ties by assigning the same rank to districts with equal values
 * - Calculates Borda points: (total districts - rank + 1)
 * - Sums Borda points across categories for aggregate score
 * - Orders districts by aggregate score (highest first)
 *
 * CRITICAL: This code is migrated from backend/src/services/RankingCalculator.ts,
 * not rewritten, to preserve bug fixes.
 */
export class BordaCountRankingCalculator {
    constructor(config) {
        this.RANKING_VERSION = '2.0';
        this.logger = config?.logger ?? noopLogger;
    }
    /**
     * Calculate rankings for all districts using Borda count system
     */
    async calculateRankings(districts) {
        const startTime = Date.now();
        const calculatedAt = new Date().toISOString();
        this.logger.info('Starting Borda count ranking calculation', {
            operation: 'calculateRankings',
            districtCount: districts.length,
            rankingVersion: this.RANKING_VERSION,
            calculatedAt,
        });
        try {
            if (districts.length === 0) {
                this.logger.warn('No districts provided for ranking calculation');
                return districts;
            }
            // Step 1: Extract ranking metrics from district data
            const metrics = this.extractRankingMetrics(districts);
            this.logger.debug('Extracted ranking metrics', {
                operation: 'calculateRankings',
                metricsCount: metrics.length,
            });
            // Step 2: Calculate category rankings
            const clubRankings = this.calculateCategoryRanking(metrics, 'clubGrowthPercent', 'clubs');
            const paymentRankings = this.calculateCategoryRanking(metrics, 'paymentGrowthPercent', 'payments');
            const distinguishedRankings = this.calculateCategoryRanking(metrics, 'distinguishedPercent', 'distinguished');
            this.logger.debug('Calculated category rankings', {
                operation: 'calculateRankings',
                clubRankings: clubRankings.length,
                paymentRankings: paymentRankings.length,
                distinguishedRankings: distinguishedRankings.length,
            });
            // Step 3: Calculate aggregate rankings
            const aggregateRankings = this.calculateAggregateRankings(clubRankings, paymentRankings, distinguishedRankings);
            this.logger.debug('Calculated aggregate rankings', {
                operation: 'calculateRankings',
                aggregateRankings: aggregateRankings.length,
            });
            // Step 4: Apply rankings to district data
            const rankedDistricts = this.applyRankingsToDistricts(districts, metrics, aggregateRankings, calculatedAt);
            // Step 5: Sort districts by aggregate score (highest first)
            const sortedDistricts = rankedDistricts.sort((a, b) => {
                const scoreA = a.ranking?.aggregateScore || 0;
                const scoreB = b.ranking?.aggregateScore || 0;
                return scoreB - scoreA;
            });
            const duration = Date.now() - startTime;
            this.logger.info('Completed Borda count ranking calculation', {
                operation: 'calculateRankings',
                districtCount: sortedDistricts.length,
                rankingVersion: this.RANKING_VERSION,
                durationMs: duration,
                calculatedAt,
            });
            return sortedDistricts;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const duration = Date.now() - startTime;
            this.logger.error('Ranking calculation failed', {
                operation: 'calculateRankings',
                error: errorMessage,
                districtCount: districts.length,
                durationMs: duration,
            });
            // Return original districts without ranking data on failure
            return districts;
        }
    }
    /**
     * Get the current ranking algorithm version
     */
    getRankingVersion() {
        return this.RANKING_VERSION;
    }
    /**
     * Build AllDistrictsRankingsData from ranked districts.
     * This method transforms the ranked district statistics into the file format
     * expected by all-districts-rankings.json.
     *
     * @param rankedDistricts - Districts with ranking data (output from calculateRankings)
     * @param snapshotId - The snapshot ID (date in YYYY-MM-DD format)
     * @returns AllDistrictsRankingsData structure ready to be written to all-districts-rankings.json
     */
    buildRankingsData(rankedDistricts, snapshotId) {
        const calculatedAt = new Date().toISOString();
        this.logger.info('Building rankings data structure', {
            operation: 'buildRankingsData',
            snapshotId,
            districtCount: rankedDistricts.length,
            rankingVersion: this.RANKING_VERSION,
        });
        // Build metadata
        const metadata = {
            snapshotId,
            calculatedAt,
            schemaVersion: '1.0',
            calculationVersion: '1.0',
            rankingVersion: this.RANKING_VERSION,
            sourceCsvDate: snapshotId, // Snapshot ID is the date
            csvFetchedAt: calculatedAt, // Use calculation time as fetch time
            totalDistricts: rankedDistricts.length,
            fromCache: false, // Rankings are freshly computed
        };
        // Filter districts with ranking data and sort by aggregate score (highest first)
        const districtsWithRankings = rankedDistricts
            .filter(district => district.ranking !== undefined)
            .sort((a, b) => {
            const scoreA = a.ranking?.aggregateScore ?? 0;
            const scoreB = b.ranking?.aggregateScore ?? 0;
            return scoreB - scoreA;
        });
        // Build rankings array with pre-computed overallRank
        // overallRank is the position when sorted by aggregateScore (1 = best)
        const rankings = districtsWithRankings.map((district, index) => {
            const ranking = district.ranking;
            return {
                districtId: district.districtId,
                districtName: ranking.districtName,
                region: ranking.region,
                paidClubs: ranking.paidClubs,
                paidClubBase: ranking.paidClubBase,
                clubGrowthPercent: ranking.clubGrowthPercent,
                totalPayments: ranking.totalPayments,
                paymentBase: ranking.paymentBase,
                paymentGrowthPercent: ranking.paymentGrowthPercent,
                activeClubs: ranking.activeClubs,
                distinguishedClubs: ranking.distinguishedClubs,
                selectDistinguished: ranking.selectDistinguished,
                presidentsDistinguished: ranking.presidentsDistinguished,
                distinguishedPercent: ranking.distinguishedPercent,
                clubsRank: ranking.clubsRank,
                paymentsRank: ranking.paymentsRank,
                distinguishedRank: ranking.distinguishedRank,
                aggregateScore: ranking.aggregateScore,
                overallRank: index + 1, // 1-indexed position based on aggregateScore
            };
        });
        this.logger.info('Built rankings data structure', {
            operation: 'buildRankingsData',
            snapshotId,
            totalDistricts: rankings.length,
            rankingVersion: this.RANKING_VERSION,
        });
        return {
            metadata,
            rankings,
        };
    }
    /**
     * Extract ranking metrics from district statistics
     */
    extractRankingMetrics(districts) {
        const metrics = [];
        for (const district of districts) {
            try {
                // Extract metrics from the raw district performance data
                const districtPerformance = district.districtPerformance?.[0];
                if (!districtPerformance) {
                    this.logger.warn('No district performance data found', {
                        districtId: district.districtId,
                        operation: 'extractRankingMetrics',
                    });
                    continue;
                }
                const metric = {
                    districtId: district.districtId,
                    districtName: districtPerformance.DISTRICT || district.districtId,
                    region: districtPerformance.REGION || 'Unknown',
                    clubGrowthPercent: this.parsePercentage(districtPerformance['% Club Growth']),
                    paymentGrowthPercent: this.parsePercentage(districtPerformance['% Payment Growth']),
                    distinguishedPercent: this.calculateDistinguishedPercent(districtPerformance),
                    paidClubs: this.parseNumber(districtPerformance['Paid Clubs']),
                    paidClubBase: this.parseNumber(districtPerformance['Paid Club Base']),
                    totalPayments: this.parseNumber(districtPerformance['Total YTD Payments']),
                    paymentBase: this.parseNumber(districtPerformance['Payment Base']),
                    distinguishedClubs: this.parseNumber(districtPerformance['Total Distinguished Clubs']),
                    activeClubs: this.parseNumber(districtPerformance['Active Clubs']),
                    selectDistinguished: this.parseNumber(districtPerformance['Select Distinguished Clubs']),
                    presidentsDistinguished: this.parseNumber(districtPerformance['Presidents Distinguished Clubs']),
                };
                metrics.push(metric);
            }
            catch (error) {
                this.logger.warn('Failed to extract metrics for district', {
                    districtId: district.districtId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    operation: 'extractRankingMetrics',
                });
            }
        }
        return metrics;
    }
    /**
     * Calculate distinguished club percentage from raw data
     */
    calculateDistinguishedPercent(data) {
        const distinguishedClubs = this.parseNumber(data['Total Distinguished Clubs']);
        const activeClubs = this.parseNumber(data['Active Clubs']);
        if (activeClubs === 0) {
            return 0;
        }
        return (distinguishedClubs / activeClubs) * 100;
    }
    /**
     * Calculate ranking for a single category
     */
    calculateCategoryRanking(metrics, valueField, category) {
        // Sort districts by value (highest first)
        const sortedMetrics = [...metrics].sort((a, b) => {
            const aValue = a[valueField];
            const bValue = b[valueField];
            return bValue - aValue;
        });
        const rankings = [];
        let currentRank = 1;
        for (let i = 0; i < sortedMetrics.length; i++) {
            const metric = sortedMetrics[i];
            if (!metric) {
                continue;
            }
            const value = metric[valueField];
            // Handle ties: if current value equals previous value, use same rank
            if (i > 0) {
                const previousMetric = sortedMetrics[i - 1];
                if (previousMetric) {
                    const previousValue = previousMetric[valueField];
                    if (value !== previousValue) {
                        currentRank = i + 1;
                    }
                }
            }
            // Calculate Borda points: total districts - rank + 1
            const bordaPoints = metrics.length - currentRank + 1;
            rankings.push({
                districtId: metric.districtId,
                rank: currentRank,
                bordaPoints,
                value,
            });
        }
        this.logger.debug('Calculated category ranking', {
            category,
            totalDistricts: metrics.length,
            uniqueRanks: new Set(rankings.map(r => r.rank)).size,
            operation: 'calculateCategoryRanking',
        });
        return rankings;
    }
    /**
     * Calculate aggregate rankings by summing Borda points across categories
     */
    calculateAggregateRankings(clubRankings, paymentRankings, distinguishedRankings) {
        const aggregateMap = new Map();
        // Initialize aggregate rankings
        for (const ranking of clubRankings) {
            aggregateMap.set(ranking.districtId, {
                districtId: ranking.districtId,
                clubsRank: ranking.rank,
                paymentsRank: 0,
                distinguishedRank: 0,
                aggregateScore: ranking.bordaPoints,
            });
        }
        // Add payment rankings
        for (const ranking of paymentRankings) {
            const aggregate = aggregateMap.get(ranking.districtId);
            if (aggregate) {
                aggregate.paymentsRank = ranking.rank;
                aggregate.aggregateScore += ranking.bordaPoints;
            }
        }
        // Add distinguished rankings
        for (const ranking of distinguishedRankings) {
            const aggregate = aggregateMap.get(ranking.districtId);
            if (aggregate) {
                aggregate.distinguishedRank = ranking.rank;
                aggregate.aggregateScore += ranking.bordaPoints;
            }
        }
        // Sort by aggregate score (highest first)
        const sortedAggregates = Array.from(aggregateMap.values()).sort((a, b) => b.aggregateScore - a.aggregateScore);
        this.logger.debug('Calculated aggregate rankings', {
            totalDistricts: sortedAggregates.length,
            highestScore: sortedAggregates[0]?.aggregateScore || 0,
            lowestScore: sortedAggregates[sortedAggregates.length - 1]?.aggregateScore || 0,
            operation: 'calculateAggregateRankings',
        });
        return sortedAggregates;
    }
    /**
     * Apply calculated rankings to district statistics
     */
    applyRankingsToDistricts(districts, metrics, aggregateRankings, calculatedAt) {
        const metricsMap = new Map(metrics.map(m => [m.districtId, m]));
        const rankingsMap = new Map(aggregateRankings.map(r => [r.districtId, r]));
        return districts.map(district => {
            const metric = metricsMap.get(district.districtId);
            const ranking = rankingsMap.get(district.districtId);
            if (!metric || !ranking) {
                // Return district without ranking data if metrics/rankings are missing
                this.logger.warn('Missing metrics or rankings for district', {
                    districtId: district.districtId,
                    hasMetric: !!metric,
                    hasRanking: !!ranking,
                    operation: 'applyRankingsToDistricts',
                });
                return district;
            }
            const rankingData = {
                clubsRank: ranking.clubsRank,
                paymentsRank: ranking.paymentsRank,
                distinguishedRank: ranking.distinguishedRank,
                aggregateScore: ranking.aggregateScore,
                clubGrowthPercent: metric.clubGrowthPercent,
                paymentGrowthPercent: metric.paymentGrowthPercent,
                distinguishedPercent: metric.distinguishedPercent,
                paidClubBase: metric.paidClubBase,
                paymentBase: metric.paymentBase,
                paidClubs: metric.paidClubs,
                totalPayments: metric.totalPayments,
                distinguishedClubs: metric.distinguishedClubs,
                activeClubs: metric.activeClubs,
                selectDistinguished: metric.selectDistinguished,
                presidentsDistinguished: metric.presidentsDistinguished,
                region: metric.region,
                districtName: metric.districtName,
                rankingVersion: this.RANKING_VERSION,
                calculatedAt,
            };
            return {
                ...district,
                ranking: rankingData,
            };
        });
    }
    /**
     * Parse percentage string to number
     */
    parsePercentage(value) {
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string') {
            // Remove % sign and parse as float
            const cleaned = value.replace('%', '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }
    /**
     * Parse number from various input types
     */
    parseNumber(value) {
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string') {
            // Remove commas and parse as integer
            const cleaned = value.replace(/,/g, '').trim();
            const parsed = parseInt(cleaned, 10);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }
}
