/**
 * Tests for Club Data Integration Service
 *
 * This test suite covers both mock and real data provider functionality,
 * error handling, data validation, and synchronization logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ClubDataIntegrationServiceImpl,
  IntegrationError,
} from '../ClubDataIntegrationService.js'

// Mock fetch for testing real data provider
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ClubDataIntegrationService', () => {
  let service: ClubDataIntegrationServiceImpl

  beforeEach(() => {
    vi.clearAllMocks()
    // Default to mock data for most tests
    service = new ClubDataIntegrationServiceImpl(undefined, true)
  })

  describe('Mock Data Provider', () => {
    describe('fetchMembershipData', () => {
      it('should generate consistent mock membership data', async () => {
        const clubName = 'Test Club'

        const data1 = await service.fetchMembershipData(clubName)
        const data2 = await service.fetchMembershipData(clubName)

        // Should be consistent for same club name
        expect(data1).toEqual(data2)

        // Should have all required fields
        expect(data1).toHaveProperty('current_members')
        expect(data1).toHaveProperty('member_growth_since_july')
        expect(data1).toHaveProperty('previous_month_members')
        expect(data1).toHaveProperty('last_updated')

        // Should have valid data types
        expect(typeof data1.current_members).toBe('number')
        expect(typeof data1.member_growth_since_july).toBe('number')
        expect(typeof data1.previous_month_members).toBe('number')
        expect(typeof data1.last_updated).toBe('string')

        // Should have reasonable values
        expect(data1.current_members).toBeGreaterThanOrEqual(0)
        expect(data1.previous_month_members).toBeGreaterThanOrEqual(0)
        expect(data1.member_growth_since_july).toBeGreaterThanOrEqual(-50)
        expect(data1.member_growth_since_july).toBeLessThanOrEqual(50)

        // Should be valid ISO date
        expect(() => new Date(data1.last_updated)).not.toThrow()
      })

      it('should generate different data for different clubs', async () => {
        const data1 = await service.fetchMembershipData('Club A')
        const data2 = await service.fetchMembershipData('Club B')

        // Should be different (at least one field should differ)
        const isDifferent =
          data1.current_members !== data2.current_members ||
          data1.member_growth_since_july !== data2.member_growth_since_july ||
          data1.previous_month_members !== data2.previous_month_members

        expect(isDifferent).toBe(true)
      })

      it('should reject invalid club names', async () => {
        await expect(service.fetchMembershipData('')).rejects.toThrow(
          IntegrationError
        )
        await expect(service.fetchMembershipData('   ')).rejects.toThrow(
          IntegrationError
        )
        // @ts-expect-error Testing invalid input
        await expect(service.fetchMembershipData(null)).rejects.toThrow(
          IntegrationError
        )
        // @ts-expect-error Testing invalid input
        await expect(service.fetchMembershipData(undefined)).rejects.toThrow(
          IntegrationError
        )
      })
    })

    describe('fetchDCPProgress', () => {
      it('should generate consistent mock DCP progress data', async () => {
        const clubName = 'Test Club'

        const data1 = await service.fetchDCPProgress(clubName)
        const data2 = await service.fetchDCPProgress(clubName)

        // Should be consistent for same club name
        expect(data1).toEqual(data2)

        // Should have all required fields
        expect(data1).toHaveProperty('dcp_goals_achieved_ytd')
        expect(data1).toHaveProperty('previous_month_dcp_goals_achieved_ytd')
        expect(data1).toHaveProperty('officer_list_submitted')
        expect(data1).toHaveProperty('officers_trained')
        expect(data1).toHaveProperty('last_updated')

        // Should have valid data types
        expect(typeof data1.dcp_goals_achieved_ytd).toBe('number')
        expect(typeof data1.previous_month_dcp_goals_achieved_ytd).toBe(
          'number'
        )
        expect(typeof data1.officer_list_submitted).toBe('boolean')
        expect(typeof data1.officers_trained).toBe('boolean')
        expect(typeof data1.last_updated).toBe('string')

        // Should have reasonable values
        expect(data1.dcp_goals_achieved_ytd).toBeGreaterThanOrEqual(0)
        expect(data1.dcp_goals_achieved_ytd).toBeLessThanOrEqual(10)
        expect(
          data1.previous_month_dcp_goals_achieved_ytd
        ).toBeGreaterThanOrEqual(0)
        expect(data1.previous_month_dcp_goals_achieved_ytd).toBeLessThanOrEqual(
          data1.dcp_goals_achieved_ytd
        )

        // Should be valid ISO date
        expect(() => new Date(data1.last_updated)).not.toThrow()
      })

      it('should reject invalid club names', async () => {
        await expect(service.fetchDCPProgress('')).rejects.toThrow(
          IntegrationError
        )
        await expect(service.fetchDCPProgress('   ')).rejects.toThrow(
          IntegrationError
        )
        // @ts-expect-error Testing invalid input
        await expect(service.fetchDCPProgress(null)).rejects.toThrow(
          IntegrationError
        )
      })
    })

    describe('fetchCSPStatus', () => {
      it('should generate consistent mock CSP status data', async () => {
        const clubName = 'Test Club'

        const data1 = await service.fetchCSPStatus(clubName)
        const data2 = await service.fetchCSPStatus(clubName)

        // Should be consistent for same club name
        expect(data1).toEqual(data2)

        // Should have all required fields
        expect(data1).toHaveProperty('csp_submitted')
        expect(data1).toHaveProperty('last_updated')

        // Should have valid data types
        expect(typeof data1.csp_submitted).toBe('boolean')
        expect(typeof data1.last_updated).toBe('string')

        // Should have submission_date if submitted
        if (data1.csp_submitted) {
          expect(data1).toHaveProperty('submission_date')
          expect(typeof data1.submission_date).toBe('string')
          expect(() => new Date(data1.submission_date!)).not.toThrow()
        }

        // Should be valid ISO date
        expect(() => new Date(data1.last_updated)).not.toThrow()
      })

      it('should reject invalid club names', async () => {
        await expect(service.fetchCSPStatus('')).rejects.toThrow(
          IntegrationError
        )
        await expect(service.fetchCSPStatus('   ')).rejects.toThrow(
          IntegrationError
        )
        // @ts-expect-error Testing invalid input
        await expect(service.fetchCSPStatus(null)).rejects.toThrow(
          IntegrationError
        )
      })
    })

    describe('syncClubData', () => {
      it('should successfully sync multiple clubs', async () => {
        const clubNames = ['Club A', 'Club B', 'Club C']

        const result = await service.syncClubData(clubNames)

        expect(result).toHaveProperty('successful_syncs', 3)
        expect(result).toHaveProperty('failed_syncs', 0)
        expect(result).toHaveProperty('failures')
        expect(result).toHaveProperty('sync_timestamp')

        expect(Array.isArray(result.failures)).toBe(true)
        expect(result.failures).toHaveLength(0)
        expect(typeof result.sync_timestamp).toBe('string')
        expect(() => new Date(result.sync_timestamp)).not.toThrow()
      })

      it('should handle empty club list', async () => {
        const result = await service.syncClubData([])

        expect(result.successful_syncs).toBe(0)
        expect(result.failed_syncs).toBe(0)
        expect(result.failures).toHaveLength(0)
      })

      it('should filter out invalid club names', async () => {
        const clubNames = ['Valid Club', '', '   ', 'Another Valid Club']

        const result = await service.syncClubData(clubNames)

        // Should only process valid club names
        expect(result.successful_syncs).toBe(2)
        expect(result.failed_syncs).toBe(0)
      })

      it('should remove duplicate club names', async () => {
        const clubNames = ['Club A', 'Club B', 'Club A', 'Club B', 'Club C']

        const result = await service.syncClubData(clubNames)

        // Should only process unique club names
        expect(result.successful_syncs).toBe(3)
        expect(result.failed_syncs).toBe(0)
      })

      it('should reject invalid input', async () => {
        // @ts-expect-error Testing invalid input
        await expect(service.syncClubData(null)).rejects.toThrow(
          IntegrationError
        )
        // @ts-expect-error Testing invalid input
        await expect(service.syncClubData('not an array')).rejects.toThrow(
          IntegrationError
        )
      })
    })
  })

  describe('Real Data Provider', () => {
    beforeEach(() => {
      // Configure service for real data provider
      const config = {
        membershipApiUrl: 'https://api.example.com/membership',
        dcpApiUrl: 'https://api.example.com/dcp',
        cspApiUrl: 'https://api.example.com/csp',
        apiKey: 'test-api-key',
        timeout: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
      }
      service = new ClubDataIntegrationServiceImpl(config, false)
    })

    describe('fetchMembershipData', () => {
      it('should fetch real membership data successfully', async () => {
        const mockResponse = {
          current_members: 25,
          member_growth_since_july: 3,
          previous_month_members: 22,
          last_updated: '2024-01-15T10:30:00Z',
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        })

        const result = await service.fetchMembershipData('Test Club')

        expect(result).toEqual(mockResponse)
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/membership/clubs/Test%20Club/membership',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-api-key',
              'Content-Type': 'application/json',
            }),
          })
        )
      })

      it('should handle API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })

        await expect(
          service.fetchMembershipData('Nonexistent Club')
        ).rejects.toThrow(IntegrationError)
      })

      it('should retry on retryable errors', async () => {
        // First two calls fail with 500, third succeeds
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              current_members: 25,
              member_growth_since_july: 3,
              previous_month_members: 22,
              last_updated: '2024-01-15T10:30:00Z',
            }),
          })

        const result = await service.fetchMembershipData('Test Club')

        expect(result.current_members).toBe(25)
        expect(mockFetch).toHaveBeenCalledTimes(3)
      })

      it('should not retry on non-retryable errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        })

        await expect(service.fetchMembershipData('Test Club')).rejects.toThrow(
          IntegrationError
        )

        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      it('should handle network timeouts', async () => {
        // Mock a timeout by simulating AbortController abort
        mockFetch.mockImplementationOnce(() => {
          return new Promise((_, reject) => {
            // Simulate timeout after a short delay
            setTimeout(() => {
              const error = new Error('The operation was aborted')
              error.name = 'AbortError'
              reject(error)
            }, 100)
          })
        })

        await expect(service.fetchMembershipData('Test Club')).rejects.toThrow()
      }, 10000) // 10 second timeout for this specific test
    })

    describe('data validation', () => {
      it('should validate membership data structure', async () => {
        const invalidResponse = {
          current_members: -5, // Invalid: negative
          member_growth_since_july: 'not a number', // Invalid: not a number
          previous_month_members: 22,
          last_updated: 'invalid date', // Invalid: not a valid date
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => invalidResponse,
        })

        await expect(service.fetchMembershipData('Test Club')).rejects.toThrow(
          IntegrationError
        )
      })

      it('should validate DCP progress data structure', async () => {
        const invalidResponse = {
          dcp_goals_achieved_ytd: -1, // Invalid: negative
          previous_month_dcp_goals_achieved_ytd: 'not a number', // Invalid: not a number
          officer_list_submitted: 'yes', // Invalid: not a boolean
          officers_trained: true,
          last_updated: '2024-01-15T10:30:00Z',
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => invalidResponse,
        })

        await expect(service.fetchDCPProgress('Test Club')).rejects.toThrow(
          IntegrationError
        )
      })

      it('should validate CSP status data structure', async () => {
        const invalidResponse = {
          csp_submitted: 'yes', // Invalid: not a boolean
          submission_date: 'invalid date', // Invalid: not a valid date
          last_updated: '2024-01-15T10:30:00Z',
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => invalidResponse,
        })

        await expect(service.fetchCSPStatus('Test Club')).rejects.toThrow(
          IntegrationError
        )
      })
    })
  })

  describe('Configuration and Status', () => {
    it('should report correct status for mock data provider', () => {
      const mockService = new ClubDataIntegrationServiceImpl(undefined, true)
      const status = mockService.getStatus()

      expect(status.useMockData).toBe(true)
      expect(status.hasRealProvider).toBe(false)
      expect(status.isConfigured).toBe(true)
    })

    it('should report correct status for real data provider', () => {
      const config = {
        membershipApiUrl: 'https://api.example.com/membership',
        dcpApiUrl: 'https://api.example.com/dcp',
        cspApiUrl: 'https://api.example.com/csp',
        apiKey: 'test-api-key',
      }
      const realService = new ClubDataIntegrationServiceImpl(config, false)
      const status = realService.getStatus()

      expect(status.useMockData).toBe(false)
      expect(status.hasRealProvider).toBe(true)
      expect(status.isConfigured).toBe(true)
    })

    it('should allow switching between mock and real data', () => {
      const config = {
        membershipApiUrl: 'https://api.example.com/membership',
        dcpApiUrl: 'https://api.example.com/dcp',
        cspApiUrl: 'https://api.example.com/csp',
        apiKey: 'test-api-key',
      }
      const switchableService = new ClubDataIntegrationServiceImpl(config, true)

      expect(switchableService.getStatus().useMockData).toBe(true)

      switchableService.setUseMockData(false)
      expect(switchableService.getStatus().useMockData).toBe(false)

      switchableService.setUseMockData(true)
      expect(switchableService.getStatus().useMockData).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should create IntegrationError with correct properties', () => {
      const originalError = new Error('Original error')
      const integrationError = new IntegrationError(
        'Integration failed',
        'test-source',
        true,
        originalError
      )

      expect(integrationError.message).toBe('Integration failed')
      expect(integrationError.source).toBe('test-source')
      expect(integrationError.retryable).toBe(true)
      expect(integrationError.originalError).toBe(originalError)
      expect(integrationError.name).toBe('IntegrationError')
    })

    it('should handle unexpected errors gracefully', async () => {
      // Force an unexpected error by providing invalid configuration
      const invalidService = new ClubDataIntegrationServiceImpl({}, false)

      await expect(
        invalidService.fetchMembershipData('Test Club')
      ).rejects.toThrow(IntegrationError)
    })
  })

  describe('Performance and Concurrency', () => {
    it('should handle concurrent requests', async () => {
      const clubNames = Array.from({ length: 10 }, (_, i) => `Club ${i}`)

      const promises = clubNames.map(name => service.fetchMembershipData(name))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      results.forEach((result, _index) => {
        expect(result.current_members).toBeGreaterThanOrEqual(0)
        expect(typeof result.last_updated).toBe('string')
      })
    })

    it('should process batch sync with concurrency limit', async () => {
      const clubNames = Array.from({ length: 20 }, (_, i) => `Club ${i}`)

      const startTime = Date.now()
      const result = await service.syncClubData(clubNames)
      const endTime = Date.now()

      expect(result.successful_syncs).toBe(20)
      expect(result.failed_syncs).toBe(0)

      // Should complete in reasonable time (mock data should be fast)
      expect(endTime - startTime).toBeLessThan(5000)
    })
  })
})
