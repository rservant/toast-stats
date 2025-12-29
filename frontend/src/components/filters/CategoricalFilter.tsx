import React, { useState, useEffect } from 'react'
import { CategoricalFilterProps } from './types'

/**
 * CategoricalFilter Component
 *
 * Provides multi-select filtering for categorical columns like Status and Distinguished.
 *
 * Features:
 * - Multi-select checkboxes for all available options
 * - Select all/none functionality
 * - Clear filter functionality
 * - Visual indication of selected items
 *
 * @component
 */
export const CategoricalFilter: React.FC<CategoricalFilterProps> = ({
  options,
  selectedValues,
  onChange,
  onClear,
  label,
  multiple = true,
  className = '',
}) => {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedValues)

  // Update local selection when props change
  useEffect(() => {
    setLocalSelected(selectedValues)
  }, [selectedValues])

  // Handle option toggle
  const handleToggle = (option: string) => {
    let newSelected: string[]

    if (multiple) {
      if (localSelected.includes(option)) {
        newSelected = localSelected.filter(item => item !== option)
      } else {
        newSelected = [...localSelected, option]
      }
    } else {
      // Single select mode
      newSelected = localSelected.includes(option) ? [] : [option]
    }

    setLocalSelected(newSelected)
    onChange(newSelected)
  }

  // Handle select all
  const handleSelectAll = () => {
    if (localSelected.length === options.length) {
      // All selected, clear all
      setLocalSelected([])
      onChange([])
    } else {
      // Not all selected, select all
      setLocalSelected(options)
      onChange(options)
    }
  }

  // Handle clear
  const handleClear = () => {
    setLocalSelected([])
    onClear()
  }

  const hasSelection = localSelected.length > 0
  const allSelected = localSelected.length === options.length

  return (
    <div
      className={`p-4 bg-white border border-gray-200 rounded-lg shadow-lg min-w-64 max-w-80 ${className}`}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {hasSelection && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-all duration-200"
              tabIndex={0}
              aria-label="Clear categorical filter"
            >
              Clear
            </button>
          )}
        </div>

        {/* Select All/None (only for multiple mode) */}
        {multiple && options.length > 1 && (
          <div className="pb-2 border-b border-gray-100">
            <button
              type="button"
              onClick={handleSelectAll}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.currentTarget.click()
                }
              }}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-all duration-200"
              tabIndex={0}
              aria-label={
                allSelected ? 'Deselect all options' : 'Select all options'
              }
            >
              <div
                className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                  allSelected
                    ? 'bg-blue-600 border-blue-600'
                    : localSelected.length > 0
                      ? 'bg-blue-100 border-blue-600'
                      : 'border-gray-300'
                }`}
              >
                {allSelected && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {localSelected.length > 0 && !allSelected && (
                  <div className="w-2 h-2 bg-blue-600 rounded-sm" />
                )}
              </div>
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}

        {/* Options */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {options.map(option => {
            const isSelected = localSelected.includes(option)
            return (
              <label
                key={option}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 hover:shadow-sm rounded px-2 py-1 transition-all duration-200 focus-within:bg-gray-50"
                onClick={() => handleToggle(option)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(option)}
                  className="sr-only"
                  tabIndex={0}
                  aria-label={`${isSelected ? 'Unselect' : 'Select'} ${option}`}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleToggle(option)
                    }
                  }}
                />
                <div
                  className={`w-4 h-4 border-2 rounded flex items-center justify-center focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 hover:bg-blue-700 hover:border-blue-700'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                  tabIndex={-1}
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700 capitalize hover:text-gray-900 transition-colors duration-200">
                  {option}
                </span>
              </label>
            )
          })}
        </div>

        {/* Selection Summary */}
        {hasSelection && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 border-t border-gray-100">
            {localSelected.length === 1
              ? `1 ${label.toLowerCase()} selected`
              : `${localSelected.length} ${label.toLowerCase()}s selected`}
            {localSelected.length <= 3 && (
              <div className="mt-1 text-gray-600">
                {localSelected.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
