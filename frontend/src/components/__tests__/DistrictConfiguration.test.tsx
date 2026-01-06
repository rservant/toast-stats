import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { DistrictConfiguration } from '../DistrictConfiguration'
import { renderWithProviders } from '../../__tests__/test-utils'
import * as apiModule from '../../services/api'

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

interface MockApiClient {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const mockConfigurationResponse = {
  configuration: {
    configuredDistricts: ['42', '7', 'F'],
    lastUpdated: '2025-01-05T10:00:00Z',
    updatedBy: 'admin',
    version: 1,
  },
  status: {
    hasConfiguredDistricts: true,
    totalDistricts: 3,
  },
  validation: {
    isValid: true,
    configuredDistricts: ['42', '7', 'F'],
    validDistricts: ['42', '7', 'F'],
    invalidDistricts: [],
    warnings: [],
    lastCollectionInfo: [
      {
        districtId: '42',
        lastSuccessfulCollection: '2025-01-04T15:30:00Z',
        status: 'valid' as const,
        recentSuccessCount: 5,
      },
      {
        districtId: '7',
        lastSuccessfulCollection: '2025-01-04T15:30:00Z',
        status: 'valid' as const,
        recentSuccessCount: 3,
      },
      {
        districtId: 'F',
        lastSuccessfulCollection: null,
        status: 'valid' as const,
        recentSuccessCount: 0,
      },
    ],
  },
  metadata: {
    operation_id: 'test-op-123',
    duration_ms: 150,
  },
}

describe('DistrictConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Access Control', () => {
    it('should show access denied message when user is not admin', () => {
      renderWithProviders(<DistrictConfiguration isAdmin={false} />)

      expect(
        screen.getByText(
          'Admin access required to manage district configuration'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          /District configuration determines which districts are included/
        )
      ).toBeInTheDocument()
    })

    it('should show configuration interface when user is admin', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockResolvedValueOnce({
        data: mockConfigurationResponse,
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByText('District Configuration')).toBeInTheDocument()
      })

      expect(
        screen.getByRole('heading', { name: 'Configured Districts' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Add District' })
      ).toBeInTheDocument()
    })
  })

  describe('Configuration Display', () => {
    it('should display configuration overview with correct statistics', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockResolvedValueOnce({
        data: mockConfigurationResponse,
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByText('District Configuration')).toBeInTheDocument()
      })

      // Check the statistics cards more specifically using getAllByText and checking context
      const configuredDistrictsElements = screen.getAllByText(
        'Configured Districts'
      )
      expect(configuredDistrictsElements).toHaveLength(2) // One in stats card, one as heading

      expect(screen.getByText('Valid Districts')).toBeInTheDocument()
      expect(screen.getByText('Invalid Districts')).toBeInTheDocument()
      expect(screen.getByText('Last updated: 1/5/2025')).toBeInTheDocument()
      expect(screen.getByText('By: admin')).toBeInTheDocument()
    })

    it('should display configured districts in grid format', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockResolvedValueOnce({
        data: mockConfigurationResponse,
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getAllByText(/District 42/)).toHaveLength(2) // Grid + table
      })

      expect(screen.getAllByText(/District 7/)).toHaveLength(2) // Grid + table
      expect(screen.getAllByText(/District F/)).toHaveLength(2) // Grid + table

      // Check for status indicators
      const validBadges = screen.getAllByText('Valid')
      expect(validBadges).toHaveLength(3)
    })

    it('should display collection history table', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockResolvedValueOnce({
        data: mockConfigurationResponse,
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByText('Collection History')).toBeInTheDocument()
      })

      // Check table headers
      expect(screen.getByText('District')).toBeInTheDocument()
      expect(screen.getByText('Last Collection')).toBeInTheDocument()
      expect(screen.getByText('Recent Success Count')).toBeInTheDocument()

      // Check table data - use getAllByText since districts appear in both grid and table
      expect(screen.getAllByText(/District 42/)).toHaveLength(2)
      expect(screen.getByText('5')).toBeInTheDocument() // Recent success count for district 42
      expect(screen.getByText('Never')).toBeInTheDocument() // District F has no collections
    })
  })

  describe('Configuration Warnings', () => {
    it('should display validation warnings when present', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      const responseWithWarnings = {
        ...mockConfigurationResponse,
        validation: {
          ...mockConfigurationResponse.validation,
          isValid: false,
          invalidDistricts: ['99'],
          warnings: [
            'District ID "99" not found in Toastmasters system. No similar districts found.',
          ],
        },
      }

      apiClient.get.mockResolvedValueOnce({
        data: responseWithWarnings,
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByText('Configuration Warnings')).toBeInTheDocument()
      })

      expect(
        screen.getByText(/District ID "99" not found in Toastmasters system/)
      ).toBeInTheDocument()
    })
  })

  describe('Quick Add District', () => {
    it('should allow adding a district via quick add', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockResolvedValueOnce({
        data: mockConfigurationResponse,
      })

      // Mock successful add district response
      apiClient.post.mockResolvedValueOnce({
        data: { success: true },
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Add District' })
        ).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(
        'Enter district ID (e.g., 42, F)'
      )
      const addButton = screen.getByRole('button', { name: 'Add District' })

      fireEvent.change(input, { target: { value: '123' } })
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/admin/districts/config', {
          districtIds: ['123'],
          replace: false,
        })
      })
    })

    it('should show error for duplicate district', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockResolvedValueOnce({
        data: mockConfigurationResponse,
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Add District' })
        ).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(
        'Enter district ID (e.g., 42, F)'
      )
      const addButton = screen.getByRole('button', { name: 'Add District' })

      fireEvent.change(input, { target: { value: '42' } }) // District already exists
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(
          screen.getByText('District is already configured')
        ).toBeInTheDocument()
      })

      // Should not make API call for duplicate
      expect(apiClient.post).not.toHaveBeenCalled()
    })
  })

  describe('Edit Mode', () => {
    it('should enter edit mode and allow local modifications', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockResolvedValueOnce({
        data: mockConfigurationResponse,
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByText('Edit Configuration')).toBeInTheDocument()
      })

      const editButton = screen.getByRole('button', {
        name: 'Edit Configuration',
      })
      fireEvent.click(editButton)

      // Should show edit mode UI
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Add district ID')).toBeInTheDocument()
    })

    it('should save changes when in edit mode', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockResolvedValueOnce({
        data: mockConfigurationResponse,
      })

      // Mock successful save response
      apiClient.post.mockResolvedValueOnce({
        data: { success: true },
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(screen.getByText('Edit Configuration')).toBeInTheDocument()
      })

      // Enter edit mode
      const editButton = screen.getByRole('button', {
        name: 'Edit Configuration',
      })
      fireEvent.click(editButton)

      // Save changes
      const saveButton = screen.getByRole('button', { name: 'Save Changes' })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/admin/districts/config', {
          districtIds: ['42', '7', 'F'], // Original districts
          replace: true,
        })
      })
    })
  })

  describe('Loading and Error States', () => {
    it('should show loading state', () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockImplementationOnce(() => new Promise(() => {})) // Never resolves

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('should show error state', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      apiClient.get.mockRejectedValueOnce(new Error('Network error'))

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(
          screen.getByText('Error Loading District Configuration')
        ).toBeInTheDocument()
      })

      expect(screen.getByText('Network error')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no districts configured', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient
      const emptyResponse = {
        ...mockConfigurationResponse,
        configuration: {
          ...mockConfigurationResponse.configuration,
          configuredDistricts: [],
        },
        status: {
          hasConfiguredDistricts: false,
          totalDistricts: 0,
        },
        validation: {
          ...mockConfigurationResponse.validation,
          configuredDistricts: [],
          validDistricts: [],
          lastCollectionInfo: [],
        },
      }

      apiClient.get.mockResolvedValueOnce({
        data: emptyResponse,
      })

      renderWithProviders(<DistrictConfiguration isAdmin={true} />)

      await waitFor(() => {
        expect(
          screen.getByText('No districts configured yet.')
        ).toBeInTheDocument()
      })

      expect(
        screen.getByText('Add districts to start collecting data.')
      ).toBeInTheDocument()
    })
  })
})
