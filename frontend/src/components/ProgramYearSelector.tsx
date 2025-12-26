import React from 'react'
import {
  ProgramYear,
  formatProgramYear,
  getProgramYearProgress,
} from '../utils/programYear'

interface ProgramYearSelectorProps {
  availableProgramYears: ProgramYear[]
  selectedProgramYear: ProgramYear
  onProgramYearChange: (programYear: ProgramYear) => void
  className?: string
  showProgress?: boolean
}

export const ProgramYearSelector: React.FC<ProgramYearSelectorProps> = ({
  availableProgramYears,
  selectedProgramYear,
  onProgramYearChange,
  className = '',
  showProgress = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = parseInt(e.target.value)
    const programYear = availableProgramYears.find(py => py.year === year)
    if (programYear) {
      onProgramYearChange(programYear)
    }
  }

  const progress = showProgress
    ? getProgramYearProgress(selectedProgramYear)
    : null

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label
        htmlFor="program-year-selector"
        className="text-xs sm:text-sm font-medium text-gray-700"
      >
        Program Year
      </label>
      <div className="relative">
        <select
          id="program-year-selector"
          value={selectedProgramYear.year}
          onChange={handleChange}
          className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 text-sm appearance-none pr-10"
          style={{ color: '#111827' }}
        >
          {availableProgramYears.map(programYear => (
            <option
              key={programYear.year}
              value={programYear.year}
              className="text-gray-900 bg-white"
            >
              {formatProgramYear(programYear)}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg
            className="fill-current h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
          >
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>

      {/* Progress Bar */}
      {showProgress && progress !== null && progress < 100 && (
        <div className="mt-1">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Program Year Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Date Range Display */}
      <div className="text-xs text-gray-500">
        {new Date(selectedProgramYear.startDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}{' '}
        -{' '}
        {new Date(selectedProgramYear.endDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </div>
    </div>
  )
}
