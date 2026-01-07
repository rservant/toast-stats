import React, { useState, useRef, useEffect } from 'react'
import { ColumnHeaderProps } from './filters/types'
import { TextFilter } from './filters/TextFilter'
import { NumericFilter } from './filters/NumericFilter'
import { CategoricalFilter } from './filters/CategoricalFilter'

/**
 * Focus trap utility for managing focus within dropdowns
 */
const useFocusTrap = (
  isActive: boolean,
  containerRef: React.RefObject<HTMLElement>
) => {
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)

    // Focus first element when trap becomes active
    if (firstElement) {
      firstElement.focus()
    }

    return () => {
      container.removeEventListener('keydown', handleTabKey)
    }
  }, [isActive, containerRef])
}

/**
 * Interactive column header component with sort and filter capabilities
 *
 * Features:
 * - Clickable headers with dropdown/popover functionality
 * - Visual indicators for sort and filter states
 * - Hover states and accessibility attributes
 * - Keyboard navigation support
 * - Focus management for dropdowns
 */
export const ColumnHeader: React.FC<ColumnHeaderProps> = ({
  field,
  label,
  sortable,
  filterable,
  filterType,
  currentSort,
  currentFilter,
  onSort,
  onFilter,
  options = [],
  className = '',
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [filterValue, setFilterValue] = useState<
    string | [number | null, number | null] | string[]
  >(() => {
    if (currentFilter) {
      if (
        currentFilter.type === 'numeric' &&
        Array.isArray(currentFilter.value)
      ) {
        // Convert number[] to [number | null, number | null]
        const numArray = currentFilter.value as number[]
        return [numArray[0] ?? null, numArray[1] ?? null] as [
          number | null,
          number | null,
        ]
      }
      return currentFilter.value as string | string[]
    }
    switch (filterType) {
      case 'numeric':
        return [null, null] as [number | null, number | null]
      case 'categorical':
        return [] as string[]
      default:
        return ''
    }
  })

  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Enable focus trapping when dropdown is open
  useFocusTrap(isDropdownOpen, dropdownRef)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false)
        buttonRef.current?.focus()
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscapeKey)
      }
    }

    return undefined
  }, [isDropdownOpen])

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsDropdownOpen(!isDropdownOpen)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setIsDropdownOpen(false)
      buttonRef.current?.focus()
    } else if (event.key === 'ArrowDown' && !isDropdownOpen) {
      event.preventDefault()
      setIsDropdownOpen(true)
    }
  }

  // Handle filter application
  const handleFilterApply = () => {
    if (filterType === 'text' && typeof filterValue === 'string') {
      if (filterValue.trim()) {
        onFilter(field, {
          field,
          type: filterType,
          value: filterValue,
          operator: 'contains',
        })
      } else {
        onFilter(field, null)
      }
    } else if (filterType === 'numeric' && Array.isArray(filterValue)) {
      const [min, max] = filterValue as [number | null, number | null]
      if (min !== null || max !== null) {
        onFilter(field, {
          field,
          type: filterType,
          value: [min, max],
          operator: 'range',
        })
      } else {
        onFilter(field, null)
      }
    } else if (filterType === 'categorical' && Array.isArray(filterValue)) {
      const selectedValues = filterValue as string[]
      if (selectedValues.length > 0) {
        onFilter(field, {
          field,
          type: filterType,
          value: selectedValues,
          operator: 'in',
        })
      } else {
        onFilter(field, null)
      }
    }
    setIsDropdownOpen(false)
  }

  // Handle filter clear
  const handleFilterClear = () => {
    switch (filterType) {
      case 'numeric':
        setFilterValue([null, null] as [number | null, number | null])
        break
      case 'categorical':
        setFilterValue([] as string[])
        break
      default:
        setFilterValue('')
    }
    onFilter(field, null)
    setIsDropdownOpen(false)
  }

  // Get sort icon
  const getSortIcon = () => {
    if (!sortable) return null

    const isCurrentSort = currentSort.field === field
    const isAsc = currentSort.direction === 'asc'

    if (!isCurrentSort) {
      return (
        <svg
          className="w-4 h-4 text-gray-400 group-hover:text-gray-700 transition-colors duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      )
    }

    return isAsc ? (
      <svg
        className="w-4 h-4 text-tm-loyal-blue"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 text-tm-loyal-blue"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    )
  }

  // Get filter icon
  const getFilterIcon = () => {
    if (!filterable) return null

    const hasActiveFilter = currentFilter !== null

    return (
      <svg
        className={`w-4 h-4 transition-colors duration-200 ${hasActiveFilter ? 'text-tm-loyal-blue' : 'text-gray-400 group-hover:text-gray-700'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
        />
      </svg>
    )
  }

  // Render filter component
  const renderFilterComponent = () => {
    switch (filterType) {
      case 'text':
        return (
          <TextFilter
            value={filterValue as string}
            onChange={value => {
              setFilterValue(value)
            }}
            onClear={handleFilterClear}
            placeholder={`Filter ${label.toLowerCase()}...`}
          />
        )
      case 'numeric':
        return (
          <NumericFilter
            value={filterValue as [number | null, number | null]}
            onChange={(min, max) => {
              setFilterValue([min, max] as [number | null, number | null])
            }}
            onClear={handleFilterClear}
            label={label}
          />
        )
      case 'categorical':
        return (
          <CategoricalFilter
            options={options}
            selectedValues={filterValue as string[]}
            onChange={values => {
              setFilterValue(values)
            }}
            onClear={handleFilterClear}
            label={label}
            multiple={true}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        onKeyDown={handleKeyDown}
        className="group flex items-center gap-2 px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue focus:ring-inset transition-all duration-200 w-full cursor-pointer"
        tabIndex={0}
        aria-expanded={isDropdownOpen}
        aria-haspopup="true"
        aria-label={`${label} column header. ${sortable ? 'Sortable. ' : ''}${filterable ? 'Filterable. ' : ''}${currentSort.field === field ? `Currently sorted ${currentSort.direction}ending. ` : ''}${currentFilter ? 'Has active filter. ' : ''}Press Enter or Space to open options, Arrow Down to open dropdown.`}
      >
        <span className="flex-1">{label}</span>
        <div className="flex items-center gap-1">
          {getSortIcon()}
          {getFilterIcon()}
          {(sortable || filterable) && (
            <svg
              className={`w-3 h-3 text-gray-400 group-hover:text-gray-700 transition-all duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </button>

      {/* Dropdown/Popover */}
      {isDropdownOpen && (sortable || filterable) && (
        <div className="absolute top-full left-0 z-50 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200">
          <div className="p-4 space-y-4">
            {/* Sort Options */}
            {sortable && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Sort</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onSort(field)
                      if (
                        currentSort.field !== field ||
                        currentSort.direction !== 'asc'
                      ) {
                        // Will be handled by parent component
                      }
                      setIsDropdownOpen(false)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.currentTarget.click()
                      }
                    }}
                    className={`px-3 py-1 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue transition-all duration-200 ${
                      currentSort.field === field &&
                      currentSort.direction === 'asc'
                        ? 'bg-tm-loyal-blue-20 text-tm-loyal-blue border-tm-loyal-blue hover:bg-tm-loyal-blue-30'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm'
                    }`}
                    tabIndex={0}
                    aria-label={`Sort ${label} ascending (A to Z)`}
                  >
                    Sort A-Z
                  </button>
                  <button
                    onClick={() => {
                      if (
                        currentSort.field === field &&
                        currentSort.direction === 'asc'
                      ) {
                        onSort(field) // This will toggle to desc
                      } else {
                        onSort(field)
                        if (currentSort.direction === 'asc') {
                          onSort(field) // Toggle to desc
                        }
                      }
                      setIsDropdownOpen(false)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.currentTarget.click()
                      }
                    }}
                    className={`px-3 py-1 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue transition-all duration-200 ${
                      currentSort.field === field &&
                      currentSort.direction === 'desc'
                        ? 'bg-tm-loyal-blue-20 text-tm-loyal-blue border-tm-loyal-blue hover:bg-tm-loyal-blue-30'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm'
                    }`}
                    tabIndex={0}
                    aria-label={`Sort ${label} descending (Z to A)`}
                  >
                    Sort Z-A
                  </button>
                </div>
              </div>
            )}

            {/* Filter Options */}
            {filterable && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Filter</h4>
                {renderFilterComponent()}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleFilterApply}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.currentTarget.click()
                      }
                    }}
                    className="px-3 py-1 text-sm bg-tm-loyal-blue text-tm-white rounded hover:bg-tm-loyal-blue-90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue transition-all duration-200"
                    tabIndex={0}
                    aria-label={`Apply ${label} filter`}
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleFilterClear}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.currentTarget.click()
                      }
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 hover:text-gray-900 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
                    tabIndex={0}
                    aria-label={`Clear ${label} filter`}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
