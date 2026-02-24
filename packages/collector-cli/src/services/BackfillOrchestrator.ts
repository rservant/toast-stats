/**
 * Backfill Orchestrator
 *
 * Orchestrates the 3-phase historical data backfill:
 *   Phase 1: Discovery — download districtsummary for each date to discover districts
 *   Phase 2: Collection — download per-district CSVs (district, division, club)
 *   Phase 3: Transform — run existing transform pipeline on collected data
 *
 * Requirements (#123):
 *   - Resume-capable (skip already-cached files)
 *   - Progress reporting
 *   - Graceful shutdown on SIGINT
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
    HttpCsvDownloader,
    type DateFrequency,
    type ReportType,
} from './HttpCsvDownloader.js'
import { logger } from '../utils/logger.js'

export interface BackfillConfig {
    startYear: number
    endYear: number
    frequency: DateFrequency
    ratePerSecond: number
    outputDir: string
    cooldownEvery?: number
    cooldownMs?: number
    phase?: 'discover' | 'collect' | 'all'
    resume?: boolean
}

export interface BackfillScope {
    programYears: string[]
    datesPerYear: number
    phase1Requests: number
    requestsPerDistrict: number
}

export interface Phase1Result {
    districtsPerYear: Record<string, string[]>
    totalDistricts: number
    requestsMade: number
}

export interface BackfillProgress {
    phase: number
    total: number
    completed: number
    currentYear: string
    currentDistrict?: string
    requestsMade: number
    startTime: number
}

export interface TimeEstimate {
    totalSeconds: number
    humanReadable: string
}

/**
 * Build the cache file path for a given download spec.
 */
function buildCachePath(
    outputDir: string,
    programYear: string,
    reportType: ReportType,
    dateStr: string,
    districtId?: string
): string {
    const safeDate = dateStr.replace(/\//g, '-')
    const parts = [outputDir, programYear, reportType]
    if (districtId) {
        parts.push(districtId)
    }
    return path.join(...parts, `${safeDate}.csv`)
}

export class BackfillOrchestrator {
    private readonly config: BackfillConfig
    // Using 'public' for test access — the test accesses this via cast
    public readonly downloader: HttpCsvDownloader
    private aborted = false
    private progress: BackfillProgress = {
        phase: 0,
        total: 0,
        completed: 0,
        currentYear: '',
        requestsMade: 0,
        startTime: Date.now(),
    }

    constructor(config: BackfillConfig) {
        this.config = config
        this.downloader = new HttpCsvDownloader({
            ratePerSecond: config.ratePerSecond,
            cooldownEvery: config.cooldownEvery ?? 100,
            cooldownMs: config.cooldownMs ?? 5000,
        })
    }

    /**
     * Calculate the total scope of the backfill operation.
     */
    calculateScope(): BackfillScope {
        const programYears = this.downloader.getProgramYearRange(
            this.config.startYear,
            this.config.endYear
        )
        // Use first year to estimate dates per year (they're all approximately the same)
        const dates = this.downloader.generateDateGrid(
            programYears[0]!,
            this.config.frequency
        )
        const datesPerYear = dates.length

        return {
            programYears,
            datesPerYear,
            phase1Requests: datesPerYear * programYears.length,
            // Per district: 3 report types × dates per year
            requestsPerDistrict: datesPerYear * 3,
        }
    }

    /**
     * Estimate completion time.
     */
    estimateTime(totalRequests: number, ratePerSecond: number): TimeEstimate {
        const totalSeconds = totalRequests / ratePerSecond
        let humanReadable: string

        if (totalSeconds < 60) {
            humanReadable = `${Math.round(totalSeconds)} seconds`
        } else if (totalSeconds < 3600) {
            humanReadable = `${Math.round(totalSeconds / 60)} min`
        } else {
            const hours = Math.floor(totalSeconds / 3600)
            const mins = Math.round((totalSeconds % 3600) / 60)
            humanReadable = `${hours}h ${mins}min`
        }

        return { totalSeconds, humanReadable }
    }

    /**
     * Phase 1: Discovery — download summary CSVs to discover district IDs per year.
     */
    async runPhase1Discovery(): Promise<Phase1Result> {
        const scope = this.calculateScope()
        const districtsPerYear: Record<string, string[]> = {}
        let requestsMade = 0

        this.progress = {
            phase: 1,
            total: scope.phase1Requests,
            completed: 0,
            currentYear: '',
            requestsMade: 0,
            startTime: Date.now(),
        }

        logger.info('Phase 1: Discovery starting', {
            programYears: scope.programYears.length,
            datesPerYear: scope.datesPerYear,
            totalRequests: scope.phase1Requests,
        })

        for (const year of scope.programYears) {
            if (this.aborted) break

            this.progress.currentYear = year
            const dates = this.downloader.generateDateGrid(year, this.config.frequency)
            const discoveredDistricts = new Set<string>()

            for (const date of dates) {
                if (this.aborted) break

                const cachePath = buildCachePath(
                    this.config.outputDir,
                    year,
                    'districtsummary',
                    `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
                )

                // Resume: skip if already cached
                if (this.config.resume) {
                    try {
                        await fs.access(cachePath)
                        this.progress.completed++
                        // Read the cached file to discover districts
                        const cached = await fs.readFile(cachePath, 'utf-8')
                        const districts = this.downloader.parseDistrictsFromSummary(cached)
                        for (const d of districts) discoveredDistricts.add(d)
                        continue
                    } catch {
                        // File doesn't exist, download it
                    }
                }

                try {
                    const result = await this.downloader.downloadCsv({
                        programYear: year,
                        reportType: 'districtsummary',
                        date,
                    })

                    requestsMade++
                    this.progress.completed++
                    this.progress.requestsMade = requestsMade

                    // Save to cache
                    await fs.mkdir(path.dirname(cachePath), { recursive: true })
                    await fs.writeFile(cachePath, result.content, 'utf-8')

                    // Parse districts from this summary
                    const districts = this.downloader.parseDistrictsFromSummary(
                        result.content
                    )
                    for (const d of districts) discoveredDistricts.add(d)

                    logger.info('Phase 1 progress', {
                        year,
                        date: date.toISOString().split('T')[0],
                        completed: this.progress.completed,
                        total: this.progress.total,
                        districtsFound: discoveredDistricts.size,
                    })
                } catch (error) {
                    logger.error('Phase 1: failed to download summary', {
                        year,
                        date: date.toISOString().split('T')[0],
                        error,
                    })
                }
            }

            const sortedDistricts = Array.from(discoveredDistricts).sort((a, b) => {
                const numA = parseInt(a, 10)
                const numB = parseInt(b, 10)
                if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b)
                if (isNaN(numA)) return 1
                if (isNaN(numB)) return -1
                return numA - numB
            })

            districtsPerYear[year] = sortedDistricts

            logger.info('Phase 1: year complete', {
                year,
                districtsDiscovered: sortedDistricts.length,
            })
        }

        const totalDistricts = Object.values(districtsPerYear).reduce(
            (sum, d) => sum + d.length,
            0
        )

        return { districtsPerYear, totalDistricts, requestsMade }
    }

    /**
     * Phase 2: Collection — download per-district CSVs for all discovered districts.
     */
    async runPhase2Collection(
        districtsPerYear: Record<string, string[]>
    ): Promise<{ requestsMade: number; errors: number }> {
        const reportTypes: ReportType[] = [
            'districtperformance',
            'divisionperformance',
            'clubperformance',
        ]
        let requestsMade = 0
        let errors = 0

        // Calculate total
        let total = 0
        for (const [year, districts] of Object.entries(districtsPerYear)) {
            const dates = this.downloader.generateDateGrid(
                year,
                this.config.frequency
            )
            total += districts.length * reportTypes.length * dates.length
        }

        this.progress = {
            phase: 2,
            total,
            completed: 0,
            currentYear: '',
            requestsMade: 0,
            startTime: Date.now(),
        }

        logger.info('Phase 2: Collection starting', {
            totalRequests: total,
            estimate: this.estimateTime(total, this.config.ratePerSecond),
        })

        for (const [year, districts] of Object.entries(districtsPerYear)) {
            if (this.aborted) break

            this.progress.currentYear = year
            const dates = this.downloader.generateDateGrid(
                year,
                this.config.frequency
            )

            for (const districtId of districts) {
                if (this.aborted) break

                this.progress.currentDistrict = districtId

                for (const reportType of reportTypes) {
                    for (const date of dates) {
                        if (this.aborted) break

                        const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
                        const cachePath = buildCachePath(
                            this.config.outputDir,
                            year,
                            reportType,
                            dateStr,
                            districtId
                        )

                        // Resume: skip if already cached
                        if (this.config.resume) {
                            try {
                                await fs.access(cachePath)
                                this.progress.completed++
                                continue
                            } catch {
                                // File doesn't exist, download it
                            }
                        }

                        try {
                            const result = await this.downloader.downloadCsv({
                                programYear: year,
                                reportType,
                                districtId,
                                date,
                            })

                            requestsMade++
                            this.progress.completed++
                            this.progress.requestsMade = requestsMade

                            await fs.mkdir(path.dirname(cachePath), { recursive: true })
                            await fs.writeFile(cachePath, result.content, 'utf-8')

                            if (this.progress.completed % 100 === 0) {
                                logger.info('Phase 2 progress', {
                                    year,
                                    districtId,
                                    reportType,
                                    completed: this.progress.completed,
                                    total,
                                    percentComplete: (
                                        (this.progress.completed / total) *
                                        100
                                    ).toFixed(1),
                                })
                            }
                        } catch (error) {
                            errors++
                            logger.error('Phase 2: failed to download', {
                                year,
                                districtId,
                                reportType,
                                date: date.toISOString().split('T')[0],
                                error,
                            })
                        }
                    }
                }
            }
        }

        return { requestsMade, errors }
    }

    /**
     * Run the full backfill pipeline.
     */
    async run(): Promise<void> {
        const scope = this.calculateScope()
        const phase = this.config.phase ?? 'all'

        logger.info('Backfill starting', {
            startYear: this.config.startYear,
            endYear: this.config.endYear,
            frequency: this.config.frequency,
            ratePerSecond: this.config.ratePerSecond,
            outputDir: this.config.outputDir,
            phase,
            programYears: scope.programYears.length,
            datesPerYear: scope.datesPerYear,
        })

        // Set up graceful shutdown
        const handler = (): void => {
            logger.info('Received SIGINT — finishing current request and saving progress...')
            this.aborted = true
        }
        process.on('SIGINT', handler)

        try {
            // Phase 1: Discovery
            const phase1Result = await this.runPhase1Discovery()
            logger.info('Phase 1 complete', {
                districtsPerYear: Object.fromEntries(
                    Object.entries(phase1Result.districtsPerYear).map(([y, d]) => [
                        y,
                        d.length,
                    ])
                ),
                totalDistricts: phase1Result.totalDistricts,
                requestsMade: phase1Result.requestsMade,
            })

            if (phase === 'discover') {
                logger.info('Discovery-only mode — stopping after Phase 1')
                return
            }

            if (this.aborted) {
                logger.info('Aborted after Phase 1')
                return
            }

            // Phase 2: Collection
            const phase2Result = await this.runPhase2Collection(
                phase1Result.districtsPerYear
            )
            logger.info('Phase 2 complete', {
                requestsMade: phase2Result.requestsMade,
                errors: phase2Result.errors,
            })

            if (phase === 'collect' || this.aborted) {
                logger.info('Collection complete — run transform separately')
                return
            }

            // Phase 3: Transform (placeholder — runs existing pipeline)
            logger.info(
                'Phase 3: Transform — run the existing transform pipeline on collected data'
            )
        } finally {
            process.removeListener('SIGINT', handler)
        }
    }

    /**
     * Get current progress snapshot.
     */
    getProgress(): BackfillProgress {
        return { ...this.progress }
    }

    /**
     * Signal abort.
     */
    abort(): void {
        this.aborted = true
    }
}
