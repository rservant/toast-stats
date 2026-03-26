import React, { useState } from 'react'

export interface ChartAccessibilityProps {
  /** Descriptive label for screen readers (e.g., "Membership trend: 20 to 25 over 6 months") */
  ariaLabel: string
  /** Data to render in table fallback */
  tableData: {
    headers: string[]
    rows: (string | number)[][]
  }
  /** Table caption for context */
  caption: string
  /** Chart content */
  children: React.ReactNode
  /** Optional className */
  className?: string
}

/**
 * ChartAccessibility (#218)
 *
 * Wrapper that provides:
 * 1. aria-label on the chart container
 * 2. Toggle: "Show as table" / "Show as chart"
 * 3. Accessible data table fallback with caption, headers, and rows
 */
const ChartAccessibility: React.FC<ChartAccessibilityProps> = ({
  ariaLabel,
  tableData,
  caption,
  children,
  className,
}) => {
  const [showTable, setShowTable] = useState(false)

  return (
    <div className={className}>
      {/* Toggle button */}
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setShowTable(prev => !prev)}
          className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
          aria-label={showTable ? 'Show as chart' : 'Show as data table'}
          data-testid="chart-a11y-toggle"
        >
          {showTable ? '📊 Show as chart' : '📋 Show as table'}
        </button>
      </div>

      {showTable ? (
        /* Accessible data table */
        <div
          role="region"
          aria-label={`${caption} — data table`}
          data-testid="chart-a11y-table"
        >
          <table className="w-full text-sm text-left border-collapse">
            <caption className="text-xs text-gray-500 mb-2 text-left">
              {caption}
            </caption>
            <thead>
              <tr>
                {tableData.headers.map((header, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-3 py-2 border-b border-gray-200 font-medium text-gray-700 bg-gray-50"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b border-gray-100">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-3 py-2 text-gray-900">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Chart with aria-label */
        <div role="img" aria-label={ariaLabel} data-testid="chart-a11y-chart">
          {children}
        </div>
      )}
    </div>
  )
}

export default ChartAccessibility
