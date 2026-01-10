import React, { useState } from 'react'
import { Button } from './ui/Button'
import { useDistrictConfigurationManager } from '../hooks/useDistrictConfiguration'
import { parseLocalDate } from '../utils/dateFormatting'

interface DistrictConfigurationProps {
  isAdmin: boolean
}

export const DistrictConfiguration: React.FC<DistrictConfigurationProps> = ({
  isAdmin,
}) => {
  const {
    data,
    isLoading,
    error,
    addDistrict,
    removeDistrict,
    isRemoving,
    saveError,
    removeError,
  } = useDistrictConfigurationManager()

  const [quickAddInput, setQuickAddInput] = useState('')
  const [quickAddError, setQuickAddError] = useState('')

  // Handle quick add district
  const handleQuickAdd = async () => {
    const districtId = quickAddInput.trim().toUpperCase()
    if (!districtId) {
      setQuickAddError('Please enter a district ID')
      return
    }

    if (data?.configuration.configuredDistricts.includes(districtId)) {
      setQuickAddError('District is already configured')
      return
    }

    const success = await addDistrict(districtId)
    if (success) {
      setQuickAddInput('')
      setQuickAddError('')
    } else {
      setQuickAddError('Failed to add district. Please check the district ID.')
    }
  }

  // Handle remove district
  const handleRemove = async (districtId: string) => {
    if (window.confirm(`Remove district ${districtId} from configuration?`)) {
      await removeDistrict(districtId)
    }
  }

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Admin access required to manage district configuration
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                District configuration determines which districts are included
                in data snapshots. Contact an administrator to modify this
                setting.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-tm-true-maroon bg-opacity-10 border border-tm-true-maroon border-opacity-30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-tm-true-maroon mb-2">
          Error Loading District Configuration
        </h3>
        <p className="text-tm-black mb-4">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
        <Button onClick={() => window.location.reload()} variant="secondary">
          Retry
        </Button>
      </div>
    )
  }

  const configuration = data?.configuration
  const validation = data?.validation

  return (
    <div className="space-y-4">
      {/* Stats + Add District Row */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Stats */}
          <div className="flex gap-6">
            <div>
              <span className="text-2xl font-bold text-tm-black">
                {configuration?.configuredDistricts.length || 0}
              </span>
              <span className="text-sm text-gray-500 ml-2">Configured</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-green-600">
                {validation?.validDistricts.length || 0}
              </span>
              <span className="text-sm text-gray-500 ml-2">Valid</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-tm-true-maroon">
                {validation?.invalidDistricts.length || 0}
              </span>
              <span className="text-sm text-gray-500 ml-2">Invalid</span>
            </div>
          </div>

          {/* Add District Form */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={quickAddInput}
              onChange={e => {
                setQuickAddInput(e.target.value)
                setQuickAddError('')
              }}
              placeholder="District ID"
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue text-sm text-gray-900 bg-white"
              onKeyPress={e => {
                if (e.key === 'Enter') {
                  handleQuickAdd()
                }
              }}
            />
            <Button
              onClick={handleQuickAdd}
              disabled={!quickAddInput.trim()}
              variant="primary"
              size="sm"
            >
              Add
            </Button>
            {quickAddError && (
              <span className="text-red-600 text-sm">{quickAddError}</span>
            )}
          </div>

          {/* Last Updated */}
          <div className="text-xs text-gray-400">
            Updated:{' '}
            {configuration?.lastUpdated
              ? parseLocalDate(configuration.lastUpdated).toLocaleDateString()
              : 'Never'}
          </div>
        </div>
      </div>

      {/* Validation Warnings */}
      {validation?.warnings && validation.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm">
          {validation.warnings.map((warning, index) => (
            <span key={index} className="text-yellow-800">
              {warning}
            </span>
          ))}
        </div>
      )}

      {/* District List */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-semibold text-tm-black mb-3">Districts</h3>

        {/* District Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {(configuration?.configuredDistricts || []).map(districtId => {
            const collectionInfo = validation?.lastCollectionInfo?.find(
              info => info.districtId === districtId
            )
            const isValid = validation?.validDistricts?.includes(districtId)
            const isInvalid = validation?.invalidDistricts?.includes(districtId)

            // Determine status text
            const statusText = collectionInfo?.lastSuccessfulCollection
              ? parseLocalDate(
                  collectionInfo.lastSuccessfulCollection
                ).toLocaleDateString()
              : isValid
                ? 'Valid'
                : isInvalid
                  ? 'Invalid'
                  : 'Pending'

            return (
              <div
                key={districtId}
                className={`relative px-3 py-2 rounded border bg-white text-sm ${
                  isInvalid
                    ? 'border-l-2 border-l-tm-true-maroon border-t-gray-200 border-r-gray-200 border-b-gray-200'
                    : isValid
                      ? 'border-l-2 border-l-green-500 border-t-gray-200 border-r-gray-200 border-b-gray-200'
                      : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-tm-black">
                    {districtId}
                  </span>
                  <button
                    onClick={() => handleRemove(districtId)}
                    disabled={isRemoving}
                    className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-tm-true-maroon transition-colors"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {statusText}
                </div>
              </div>
            )
          })}
        </div>

        {!configuration?.configuredDistricts.length && (
          <p className="text-center py-4 text-gray-500 text-sm">
            No districts configured. Add one above.
          </p>
        )}
      </div>

      {/* Error Display */}
      {(saveError || removeError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          {saveError?.message || removeError?.message || 'An error occurred'}
        </div>
      )}
    </div>
  )
}
