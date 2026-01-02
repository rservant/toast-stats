/**
 * Club Data Integration Service
 *
 * This service handles integration with external data sources for club health classification.
 * It provides interfaces for fetching membership data, DCP progress, and CSP status from
 * external systems, with mock implementations for development and testing.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import {
  ClubDataIntegrationService,
  MembershipData,
  DCPProgress,
  CSPStatus,
  SyncResult,
} from '../types/clubHealth.js'
import { logger } from '../utils/logger.js'

/**
 * Configuration for external data sources
 */
interface DataSourceConfig {
  membershipApiUrl?: string
  dcpApiUrl?: string
  cspApiUrl?: string
  apiKey?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

/**
 * API Response types for external data sources
 */
interface MembershipApiResponse {
  current_members?: number
  member_growth_since_july?: number
  previous_month_members?: number
  last_updated?: string
}

interface DCPApiResponse {
  dcp_goals_achieved_ytd?: number
  previous_month_dcp_goals_achieved_ytd?: number
  officer_list_submitted?: boolean
  officers_trained?: boolean
  last_updated?: string
}

interface CSPApiResponse {
  csp_submitted?: boolean
  submission_date?: string
  last_updated?: string
}

/**
 * Error types for integration failures
 */
export class IntegrationError extends Error {
  constructor(
    message: string,
    public source: string,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'IntegrationError'
  }
}

/**
 * Mock data provider for development and testing
 */
class MockDataProvider {
  /**
   * Generate a consistent timestamp based on club name
   */
  private generateConsistentTimestamp(clubName: string): string {
    const hash = this.simpleHash(clubName)
    // Generate a consistent date within the last 30 days
    const daysAgo = hash % 30
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    date.setHours(12, 0, 0, 0) // Set to noon to avoid timezone issues
    return date.toISOString()
  }

  /**
   * Generate mock membership data for a club
   */
  generateMockMembershipData(clubName: string): MembershipData {
    // Generate consistent but varied data based on club name hash
    const hash = this.simpleHash(clubName)
    const baseMembers = 15 + (hash % 25) // 15-39 members
    const growth = -5 + (hash % 11) // -5 to +5 growth
    const previousMembers = Math.max(1, baseMembers - (hash % 5) + 2) // Previous month variation

    return {
      current_members: baseMembers,
      member_growth_since_july: growth,
      previous_month_members: previousMembers,
      last_updated: this.generateConsistentTimestamp(clubName),
    }
  }

  /**
   * Generate mock DCP progress data for a club
   */
  generateMockDCPProgress(clubName: string): DCPProgress {
    const hash = this.simpleHash(clubName)
    const currentGoals = hash % 8 // 0-7 goals achieved
    const previousGoals = Math.max(0, currentGoals - (hash % 3)) // Previous month goals

    return {
      dcp_goals_achieved_ytd: currentGoals,
      previous_month_dcp_goals_achieved_ytd: previousGoals,
      officer_list_submitted: hash % 3 !== 0, // 66% chance of submission
      officers_trained: hash % 4 !== 0, // 75% chance of training
      last_updated: this.generateConsistentTimestamp(clubName),
    }
  }

  /**
   * Generate mock CSP status for a club
   */
  generateMockCSPStatus(clubName: string): CSPStatus {
    const hash = this.simpleHash(clubName)
    const submitted = hash % 5 !== 0 // 80% chance of submission

    return {
      csp_submitted: submitted,
      submission_date: submitted
        ? this.generateRecentDate(clubName)
        : undefined,
      last_updated: this.generateConsistentTimestamp(clubName),
    }
  }

  /**
   * Simple hash function for consistent mock data generation
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Generate a recent date for CSP submission (deterministic based on club name)
   */
  private generateRecentDate(clubName: string): string {
    const hash = this.simpleHash(clubName)
    const now = new Date()
    const daysAgo = hash % 90 // Within last 90 days, but deterministic
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    return date.toISOString()
  }
}

/**
 * Real data provider for production integration
 */
class RealDataProvider {
  constructor(private config: DataSourceConfig) {}

  /**
   * Fetch membership data from external API
   */
  async fetchMembershipData(clubName: string): Promise<MembershipData> {
    try {
      const url = `${this.config.membershipApiUrl}/clubs/${encodeURIComponent(clubName)}/membership`
      const response = (await this.makeApiRequest(
        url,
        'membership'
      )) as MembershipApiResponse

      return {
        current_members: response.current_members || 0,
        member_growth_since_july: response.member_growth_since_july || 0,
        previous_month_members: response.previous_month_members || 0,
        last_updated: response.last_updated || new Date().toISOString(),
      }
    } catch (error) {
      throw new IntegrationError(
        `Failed to fetch membership data for club: ${clubName}`,
        'membership',
        true,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Fetch DCP progress from external API
   */
  async fetchDCPProgress(clubName: string): Promise<DCPProgress> {
    try {
      const url = `${this.config.dcpApiUrl}/clubs/${encodeURIComponent(clubName)}/dcp`
      const response = (await this.makeApiRequest(url, 'dcp')) as DCPApiResponse

      return {
        dcp_goals_achieved_ytd: response.dcp_goals_achieved_ytd || 0,
        previous_month_dcp_goals_achieved_ytd:
          response.previous_month_dcp_goals_achieved_ytd || 0,
        officer_list_submitted: response.officer_list_submitted || false,
        officers_trained: response.officers_trained || false,
        last_updated: response.last_updated || new Date().toISOString(),
      }
    } catch (error) {
      throw new IntegrationError(
        `Failed to fetch DCP progress for club: ${clubName}`,
        'dcp',
        true,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Fetch CSP status from external API
   */
  async fetchCSPStatus(clubName: string): Promise<CSPStatus> {
    try {
      const url = `${this.config.cspApiUrl}/clubs/${encodeURIComponent(clubName)}/csp`
      const response = (await this.makeApiRequest(url, 'csp')) as CSPApiResponse

      return {
        csp_submitted: response.csp_submitted || false,
        submission_date: response.submission_date,
        last_updated: response.last_updated || new Date().toISOString(),
      }
    } catch (error) {
      throw new IntegrationError(
        `Failed to fetch CSP status for club: ${clubName}`,
        'csp',
        true,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Make HTTP request to external API with retry logic
   */
  private async makeApiRequest(
    url: string,
    source: string
  ): Promise<MembershipApiResponse | DCPApiResponse | CSPApiResponse> {
    const maxAttempts = this.config.retryAttempts || 3
    const retryDelay = this.config.retryDelay || 1000
    const timeout = this.config.timeout || 5000

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'ClubHealthClassification/1.0',
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = (await response.json()) as
          | MembershipApiResponse
          | DCPApiResponse
          | CSPApiResponse

        logger.info('External API request successful', {
          url,
          source,
          attempt,
          status: response.status,
        })

        return data
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts
        const isRetryableError = this.isRetryableError(error)

        logger.warn('External API request failed', {
          url,
          source,
          attempt,
          maxAttempts,
          error: error instanceof Error ? error.message : String(error),
          retryable: isRetryableError && !isLastAttempt,
        })

        if (isLastAttempt || !isRetryableError) {
          throw error
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
      }
    }

    throw new Error('All retry attempts exhausted')
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors and timeouts are retryable
      if (error.name === 'AbortError' || error.name === 'TypeError') {
        return true
      }

      // HTTP 5xx errors are retryable
      if (error.message.includes('HTTP 5')) {
        return true
      }

      // HTTP 429 (rate limit) is retryable
      if (error.message.includes('HTTP 429')) {
        return true
      }
    }

    return false
  }
}

/**
 * Implementation of Club Data Integration Service
 */
export class ClubDataIntegrationServiceImpl implements ClubDataIntegrationService {
  private mockProvider: MockDataProvider
  private realProvider?: RealDataProvider
  private useMockData: boolean

  constructor(config?: DataSourceConfig, useMockData: boolean = true) {
    this.mockProvider = new MockDataProvider()
    this.useMockData = useMockData

    if (!useMockData && config) {
      this.realProvider = new RealDataProvider(config)
    }

    logger.info('Club Data Integration Service initialized', {
      useMockData,
      hasRealProvider: !!this.realProvider,
    })
  }

  /**
   * Fetch current membership data for a club
   */
  async fetchMembershipData(clubName: string): Promise<MembershipData> {
    const startTime = Date.now()

    try {
      if (
        !clubName ||
        typeof clubName !== 'string' ||
        clubName.trim().length === 0
      ) {
        throw new IntegrationError(
          'Club name is required and must be a non-empty string',
          'validation',
          false
        )
      }

      let data: MembershipData

      if (this.useMockData) {
        // Use mock data for development/testing
        data = this.mockProvider.generateMockMembershipData(clubName)
        logger.info('Mock membership data generated', {
          clubName,
          currentMembers: data.current_members,
          growth: data.member_growth_since_july,
        })
      } else {
        // Use real data provider
        if (!this.realProvider) {
          throw new IntegrationError(
            'Real data provider not configured',
            'configuration',
            false
          )
        }

        data = await this.realProvider.fetchMembershipData(clubName)
        logger.info('Real membership data fetched', {
          clubName,
          currentMembers: data.current_members,
          growth: data.member_growth_since_july,
        })
      }

      // Validate data integrity
      this.validateMembershipData(data, clubName)

      const processingTime = Date.now() - startTime
      logger.info('Membership data fetch completed', {
        clubName,
        processingTime: `${processingTime}ms`,
        useMockData: this.useMockData,
      })

      return data
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Failed to fetch membership data', {
        clubName,
        processingTime: `${processingTime}ms`,
        useMockData: this.useMockData,
        error: error instanceof Error ? error.message : String(error),
      })

      // Re-throw IntegrationError as-is, wrap others
      if (error instanceof IntegrationError) {
        throw error
      }

      throw new IntegrationError(
        `Unexpected error fetching membership data for club: ${clubName}`,
        'unknown',
        false,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Fetch DCP progress data for a club
   */
  async fetchDCPProgress(clubName: string): Promise<DCPProgress> {
    const startTime = Date.now()

    try {
      if (
        !clubName ||
        typeof clubName !== 'string' ||
        clubName.trim().length === 0
      ) {
        throw new IntegrationError(
          'Club name is required and must be a non-empty string',
          'validation',
          false
        )
      }

      let data: DCPProgress

      if (this.useMockData) {
        // Use mock data for development/testing
        data = this.mockProvider.generateMockDCPProgress(clubName)
        logger.info('Mock DCP progress generated', {
          clubName,
          currentGoals: data.dcp_goals_achieved_ytd,
          officerListSubmitted: data.officer_list_submitted,
          officersTrained: data.officers_trained,
        })
      } else {
        // Use real data provider
        if (!this.realProvider) {
          throw new IntegrationError(
            'Real data provider not configured',
            'configuration',
            false
          )
        }

        data = await this.realProvider.fetchDCPProgress(clubName)
        logger.info('Real DCP progress fetched', {
          clubName,
          currentGoals: data.dcp_goals_achieved_ytd,
          officerListSubmitted: data.officer_list_submitted,
          officersTrained: data.officers_trained,
        })
      }

      // Validate data integrity
      this.validateDCPProgress(data, clubName)

      const processingTime = Date.now() - startTime
      logger.info('DCP progress fetch completed', {
        clubName,
        processingTime: `${processingTime}ms`,
        useMockData: this.useMockData,
      })

      return data
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Failed to fetch DCP progress', {
        clubName,
        processingTime: `${processingTime}ms`,
        useMockData: this.useMockData,
        error: error instanceof Error ? error.message : String(error),
      })

      // Re-throw IntegrationError as-is, wrap others
      if (error instanceof IntegrationError) {
        throw error
      }

      throw new IntegrationError(
        `Unexpected error fetching DCP progress for club: ${clubName}`,
        'unknown',
        false,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Fetch CSP submission status for a club
   */
  async fetchCSPStatus(clubName: string): Promise<CSPStatus> {
    const startTime = Date.now()

    try {
      if (
        !clubName ||
        typeof clubName !== 'string' ||
        clubName.trim().length === 0
      ) {
        throw new IntegrationError(
          'Club name is required and must be a non-empty string',
          'validation',
          false
        )
      }

      let data: CSPStatus

      if (this.useMockData) {
        // Use mock data for development/testing
        data = this.mockProvider.generateMockCSPStatus(clubName)
        logger.info('Mock CSP status generated', {
          clubName,
          cspSubmitted: data.csp_submitted,
          submissionDate: data.submission_date,
        })
      } else {
        // Use real data provider
        if (!this.realProvider) {
          throw new IntegrationError(
            'Real data provider not configured',
            'configuration',
            false
          )
        }

        data = await this.realProvider.fetchCSPStatus(clubName)
        logger.info('Real CSP status fetched', {
          clubName,
          cspSubmitted: data.csp_submitted,
          submissionDate: data.submission_date,
        })
      }

      // Validate data integrity
      this.validateCSPStatus(data, clubName)

      const processingTime = Date.now() - startTime
      logger.info('CSP status fetch completed', {
        clubName,
        processingTime: `${processingTime}ms`,
        useMockData: this.useMockData,
      })

      return data
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Failed to fetch CSP status', {
        clubName,
        processingTime: `${processingTime}ms`,
        useMockData: this.useMockData,
        error: error instanceof Error ? error.message : String(error),
      })

      // Re-throw IntegrationError as-is, wrap others
      if (error instanceof IntegrationError) {
        throw error
      }

      throw new IntegrationError(
        `Unexpected error fetching CSP status for club: ${clubName}`,
        'unknown',
        false,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Synchronize data for multiple clubs
   */
  async syncClubData(clubNames: string[]): Promise<SyncResult> {
    const startTime = Date.now()

    try {
      // Handle null/undefined input first, before any other operations
      if (
        clubNames === null ||
        clubNames === undefined ||
        !Array.isArray(clubNames)
      ) {
        throw new IntegrationError(
          'Club names must be provided as an array',
          'validation',
          false
        )
      }

      if (clubNames.length === 0) {
        return {
          successful_syncs: 0,
          failed_syncs: 0,
          failures: [],
          sync_timestamp: new Date().toISOString(),
        }
      }

      // Remove duplicates and filter out invalid names
      const uniqueClubNames = [...new Set(clubNames)]
        .filter(
          name => name && typeof name === 'string' && name.trim().length > 0
        )
        .map(name => name.trim())

      logger.info('Starting club data synchronization', {
        totalClubs: clubNames.length,
        uniqueClubs: uniqueClubNames.length,
        useMockData: this.useMockData,
      })

      const failures: Array<{ club_name: string; error: string }> = []
      let successfulSyncs = 0

      // Process clubs in parallel with concurrency limit
      const concurrencyLimit = 5
      const chunks = this.chunkArray(uniqueClubNames, concurrencyLimit)

      for (const chunk of chunks) {
        const promises = chunk.map(async clubName => {
          try {
            // Fetch all data types for the club
            await Promise.all([
              this.fetchMembershipData(clubName),
              this.fetchDCPProgress(clubName),
              this.fetchCSPStatus(clubName),
            ])

            successfulSyncs++
            logger.debug('Club sync successful', { clubName })
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            failures.push({
              club_name: clubName,
              error: errorMessage,
            })

            logger.warn('Club sync failed', {
              clubName,
              error: errorMessage,
            })
          }
        })

        await Promise.all(promises)
      }

      const result: SyncResult = {
        successful_syncs: successfulSyncs,
        failed_syncs: failures.length,
        failures,
        sync_timestamp: new Date().toISOString(),
      }

      const processingTime = Date.now() - startTime
      logger.info('Club data synchronization completed', {
        totalClubs: uniqueClubNames.length,
        successfulSyncs: result.successful_syncs,
        failedSyncs: result.failed_syncs,
        processingTime: `${processingTime}ms`,
        useMockData: this.useMockData,
      })

      return result
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Failed to synchronize club data', {
        clubCount: clubNames ? clubNames.length : 0,
        processingTime: `${processingTime}ms`,
        useMockData: this.useMockData,
        error: error instanceof Error ? error.message : String(error),
      })

      // Re-throw IntegrationError as-is, wrap others
      if (error instanceof IntegrationError) {
        throw error
      }

      throw new IntegrationError(
        'Unexpected error during club data synchronization',
        'unknown',
        false,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Validate membership data integrity
   */
  private validateMembershipData(data: MembershipData, clubName: string): void {
    const errors: string[] = []

    if (typeof data.current_members !== 'number' || data.current_members < 0) {
      errors.push('current_members must be a non-negative number')
    }

    if (typeof data.member_growth_since_july !== 'number') {
      errors.push('member_growth_since_july must be a number')
    }

    if (
      typeof data.previous_month_members !== 'number' ||
      data.previous_month_members < 0
    ) {
      errors.push('previous_month_members must be a non-negative number')
    }

    if (!data.last_updated || typeof data.last_updated !== 'string') {
      errors.push('last_updated must be a valid ISO date string')
    } else {
      try {
        new Date(data.last_updated)
      } catch {
        errors.push('last_updated must be a valid ISO date string')
      }
    }

    if (errors.length > 0) {
      throw new IntegrationError(
        `Invalid membership data for club ${clubName}: ${errors.join(', ')}`,
        'validation',
        false
      )
    }
  }

  /**
   * Validate DCP progress data integrity
   */
  private validateDCPProgress(data: DCPProgress, clubName: string): void {
    const errors: string[] = []

    if (
      typeof data.dcp_goals_achieved_ytd !== 'number' ||
      data.dcp_goals_achieved_ytd < 0
    ) {
      errors.push('dcp_goals_achieved_ytd must be a non-negative number')
    }

    if (
      typeof data.previous_month_dcp_goals_achieved_ytd !== 'number' ||
      data.previous_month_dcp_goals_achieved_ytd < 0
    ) {
      errors.push(
        'previous_month_dcp_goals_achieved_ytd must be a non-negative number'
      )
    }

    if (typeof data.officer_list_submitted !== 'boolean') {
      errors.push('officer_list_submitted must be a boolean')
    }

    if (typeof data.officers_trained !== 'boolean') {
      errors.push('officers_trained must be a boolean')
    }

    if (!data.last_updated || typeof data.last_updated !== 'string') {
      errors.push('last_updated must be a valid ISO date string')
    } else {
      try {
        new Date(data.last_updated)
      } catch {
        errors.push('last_updated must be a valid ISO date string')
      }
    }

    if (errors.length > 0) {
      throw new IntegrationError(
        `Invalid DCP progress data for club ${clubName}: ${errors.join(', ')}`,
        'validation',
        false
      )
    }
  }

  /**
   * Validate CSP status data integrity
   */
  private validateCSPStatus(data: CSPStatus, clubName: string): void {
    const errors: string[] = []

    if (typeof data.csp_submitted !== 'boolean') {
      errors.push('csp_submitted must be a boolean')
    }

    if (data.submission_date !== undefined) {
      if (typeof data.submission_date !== 'string') {
        errors.push('submission_date must be a string when provided')
      } else {
        try {
          new Date(data.submission_date)
        } catch {
          errors.push(
            'submission_date must be a valid ISO date string when provided'
          )
        }
      }
    }

    if (!data.last_updated || typeof data.last_updated !== 'string') {
      errors.push('last_updated must be a valid ISO date string')
    } else {
      try {
        new Date(data.last_updated)
      } catch {
        errors.push('last_updated must be a valid ISO date string')
      }
    }

    if (errors.length > 0) {
      throw new IntegrationError(
        `Invalid CSP status data for club ${clubName}: ${errors.join(', ')}`,
        'validation',
        false
      )
    }
  }

  /**
   * Split array into chunks of specified size
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Switch between mock and real data providers
   */
  setUseMockData(useMockData: boolean): void {
    this.useMockData = useMockData
    logger.info('Data provider mode changed', { useMockData })
  }

  /**
   * Get current configuration status
   */
  getStatus(): {
    useMockData: boolean
    hasRealProvider: boolean
    isConfigured: boolean
  } {
    return {
      useMockData: this.useMockData,
      hasRealProvider: !!this.realProvider,
      isConfigured: this.useMockData || !!this.realProvider,
    }
  }
}
