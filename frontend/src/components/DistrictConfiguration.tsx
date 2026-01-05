import React, { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { useDistrictConfigurationManager } from '../hooks/useDistrictConfiguration'

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
    editMode,
    setEditMode,
    localDistricts,
    newDistrictInput,
    setNewDistrictInput,
    initializeLocalState,
    addDistrictLocally,
    removeDistrictLocally,
    saveChanges,
    cancelChanges,
    addDistrict,
    removeDistrict,
    isSaving,
    isRemoving,
    saveError,
    removeError,
  } = useDistrictConfigurationManager()

  const [quickAddInput, setQuickAddInput] = useState('')
  const [quickAddError, setQuickAddError] = useState('')

  // Initialize local state when data loads
  useEffect(() => {
    if (data && !editMode) {
      initializeLocalState()
    }
  }, [data, editMode, initializeLocalState])

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

  // Handle add to local state in edit mode
  const handleAddToLocal = () => {
    const districtId = newDistrictInput.trim().toUpperCase()
    if (districtId && !localDistricts.includes(districtId)) {
      addDistrictLocally(districtId)
      setNewDistrictInput('')
    }
  }

  // Handle save changes
  const handleSave = async () => {
    const success = await saveChanges()
    if (!success && saveError) {
      alert(`Failed to save configuration: ${saveError.message}`)
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
    <div className="space-y-6">
      {/* Configuration Overview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-tm-black">
              District Configuration
            </h2>
            <p className="text-tm-cool-gray mt-1">
              Manage which districts are included in data snapshots
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-tm-cool-gray">
              Last updated: {configuration?.lastUpdated ? new Date(configuration.lastUpdated).toLocaleDateString() : 'Never'}
            </div>
            <div className="text-sm text-tm-cool-gray">
              By: {configuration?.updatedBy || 'Unknown'}
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-tm-loyal-blue bg-opacity-10 rounded-lg p-4 border border-tm-loyal-blue border-opacity-20">
            <div className="text-2xl font-bold text-tm-loyal-blue">
              {configuration?.configuredDistricts.length || 0}
            </div>
            <div className="text-sm text-tm-black">Configured Districts</div>
          </div>
          <div className="bg-tm-loyal-blue bg-opacity-5 rounded-lg p-4 border border-tm-loyal-blue border-opacity-10">
            <div className="text-2xl font-bold text-tm-loyal-blue">
              {validation?.validDistricts.length || 0}
            </div>
            <div className="text-sm text-tm-black">Valid Districts</div>
          </div>
          <div className="bg-tm-true-maroon bg-opacity-5 rounded-lg p-4 border border-tm-true-maroon border-opacity-20">
            <div className="text-2xl font-bold text-tm-true-maroon">
              {validation?.invalidDistricts.length || 0}
            </div>
            <div className="text-sm text-tm-black">Invalid Districts</div>
          </div>
        </div>

        {/* Validation Warnings */}
        {validation?.warnings && validation.warnings.length > 0 && (
          <div className="bg-tm-happy-yellow bg-opacity-20 border border-tm-happy-yellow border-opacity-50 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-tm-black mb-2">Configuration Warnings</h4>
            <ul className="space-y-1">
              {validation.warnings.map((warning, index) => (
                <li key={index} className="text-sm text-tm-black">
                  • {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Quick Add District */}
      {!editMode && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-tm-black mb-4">
            Add District
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={quickAddInput}
              onChange={(e) => {
                setQuickAddInput(e.target.value)
                setQuickAddError('')
              }}
              placeholder="Enter district ID (e.g., 42, F)"
              className="flex-1 px-3 py-2 border-2 border-tm-cool-gray rounded-md focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue focus:border-tm-loyal-blue bg-tm-white text-tm-black placeholder-tm-cool-gray"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleQuickAdd()
                }
              }}
            />
            <Button
              onClick={handleQuickAdd}
              disabled={!quickAddInput.trim()}
              variant="primary"
            >
              Add District
            </Button>
          </div>
          {quickAddError && (
            <p className="text-red-600 text-sm mt-2">{quickAddError}</p>
          )}
        </div>
      )}

      {/* District List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-tm-black">
            Configured Districts
          </h3>
          {!editMode ? (
            <Button
              onClick={() => setEditMode(true)}
              variant="secondary"
              disabled={!configuration?.configuredDistricts.length}
            >
              Edit Configuration
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                variant="primary"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                onClick={cancelChanges}
                disabled={isSaving}
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {editMode && (
          <div className="mb-4 p-4 bg-tm-happy-yellow bg-opacity-20 rounded-lg">
            <div className="flex gap-3 mb-2">
              <input
                type="text"
                value={newDistrictInput}
                onChange={(e) => setNewDistrictInput(e.target.value)}
                placeholder="Add district ID"
                className="flex-1 px-3 py-2 border-2 border-tm-cool-gray rounded-md focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue focus:border-tm-loyal-blue bg-tm-white text-tm-black placeholder-tm-cool-gray"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddToLocal()
                  }
                }}
              />
              <Button
                onClick={handleAddToLocal}
                disabled={!newDistrictInput.trim()}
                variant="accent"
                size="sm"
              >
                Add
              </Button>
            </div>
            <p className="text-sm text-tm-black">
              Add districts to the configuration. Changes are not saved until you click "Save Changes".
            </p>
          </div>
        )}

        {/* District Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {(editMode ? localDistricts : configuration?.configuredDistricts || []).map((districtId) => {
            const collectionInfo = validation?.lastCollectionInfo.find(
              info => info.districtId === districtId
            )
            const isValid = validation?.validDistricts.includes(districtId)
            const isInvalid = validation?.invalidDistricts.includes(districtId)

            return (
              <div
                key={districtId}
                className={`relative p-3 rounded-lg border-2 ${
                  isInvalid
                    ? 'border-tm-true-maroon border-opacity-50 bg-tm-true-maroon bg-opacity-5'
                    : isValid
                    ? 'border-tm-loyal-blue border-opacity-50 bg-tm-loyal-blue bg-opacity-5'
                    : 'border-tm-cool-gray border-opacity-50 bg-tm-cool-gray bg-opacity-10'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-tm-black">
                      District {districtId}
                    </div>
                    {collectionInfo && (
                      <div className="text-xs text-tm-cool-gray mt-1">
                        {collectionInfo.lastSuccessfulCollection
                          ? `Last: ${new Date(collectionInfo.lastSuccessfulCollection).toLocaleDateString()}`
                          : 'Never collected'}
                      </div>
                    )}
                  </div>
                  {editMode ? (
                    <button
                      onClick={() => removeDistrictLocally(districtId)}
                      className="text-tm-true-maroon hover:text-tm-black text-sm font-bold"
                      title="Remove from configuration"
                    >
                      ×
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRemove(districtId)}
                      disabled={isRemoving}
                      className="text-tm-true-maroon hover:text-tm-black text-sm font-bold disabled:opacity-50"
                      title="Remove district"
                    >
                      ×
                    </button>
                  )}
                </div>
                
                {/* Status indicator */}
                <div className="mt-2">
                  {isInvalid && (
                    <span className="inline-block px-2 py-1 text-xs bg-tm-true-maroon bg-opacity-20 text-tm-true-maroon rounded border border-tm-true-maroon border-opacity-30">
                      Invalid
                    </span>
                  )}
                  {isValid && (
                    <span className="inline-block px-2 py-1 text-xs bg-tm-loyal-blue bg-opacity-20 text-tm-loyal-blue rounded border border-tm-loyal-blue border-opacity-30">
                      Valid
                    </span>
                  )}
                  {!isValid && !isInvalid && (
                    <span className="inline-block px-2 py-1 text-xs bg-tm-cool-gray bg-opacity-30 text-tm-black rounded border border-tm-cool-gray border-opacity-50">
                      Unknown
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {(!configuration?.configuredDistricts.length && !editMode) && (
          <div className="text-center py-8 text-tm-cool-gray">
            <p>No districts configured yet.</p>
            <p className="text-sm mt-1">Add districts to start collecting data.</p>
          </div>
        )}

        {(editMode && localDistricts.length === 0) && (
          <div className="text-center py-8 text-tm-cool-gray">
            <p>No districts in configuration.</p>
            <p className="text-sm mt-1">Add districts using the input above.</p>
          </div>
        )}
      </div>

      {/* Collection History */}
      {validation?.lastCollectionInfo && validation.lastCollectionInfo.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-tm-black mb-4">
            Collection History
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-tm-cool-gray divide-opacity-30">
              <thead className="bg-tm-loyal-blue bg-opacity-5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-tm-black uppercase tracking-wider">
                    District
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-tm-black uppercase tracking-wider">
                    Last Collection
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-tm-black uppercase tracking-wider">
                    Recent Success Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-tm-black uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-tm-cool-gray divide-opacity-20">
                {validation.lastCollectionInfo.map((info) => (
                  <tr key={info.districtId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-tm-black">
                      District {info.districtId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-tm-cool-gray">
                      {info.lastSuccessfulCollection
                        ? new Date(info.lastSuccessfulCollection).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-tm-cool-gray">
                      {info.recentSuccessCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          info.status === 'valid'
                            ? 'bg-tm-loyal-blue bg-opacity-20 text-tm-loyal-blue border border-tm-loyal-blue border-opacity-30'
                            : info.status === 'invalid'
                            ? 'bg-tm-true-maroon bg-opacity-20 text-tm-true-maroon border border-tm-true-maroon border-opacity-30'
                            : 'bg-tm-cool-gray bg-opacity-30 text-tm-black border border-tm-cool-gray border-opacity-50'
                        }`}
                      >
                        {info.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error Display */}
      {(saveError || removeError) && (
        <div className="bg-tm-true-maroon bg-opacity-10 border border-tm-true-maroon border-opacity-30 rounded-lg p-4">
          <h4 className="font-medium text-tm-true-maroon mb-2">Operation Failed</h4>
          <p className="text-tm-black text-sm">
            {saveError?.message || removeError?.message || 'An error occurred'}
          </p>
        </div>
      )}
    </div>
  )
}