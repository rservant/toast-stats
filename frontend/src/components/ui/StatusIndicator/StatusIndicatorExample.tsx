import React from 'react'
import { StatusIndicator } from './StatusIndicator'

export const StatusIndicatorExample: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <h2 className="tm-h2 mb-4">Status Indicator Examples</h2>

      <div className="space-y-4">
        <h3 className="tm-h3">Variants</h3>
        <div className="flex flex-wrap gap-4">
          <StatusIndicator variant="success">Success</StatusIndicator>
          <StatusIndicator variant="warning">Warning</StatusIndicator>
          <StatusIndicator variant="error">Error</StatusIndicator>
          <StatusIndicator variant="info">Info</StatusIndicator>
          <StatusIndicator variant="highlight">Highlight</StatusIndicator>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="tm-h3">Sizes</h3>
        <div className="flex flex-wrap items-center gap-4">
          <StatusIndicator variant="highlight" size="sm">
            Small
          </StatusIndicator>
          <StatusIndicator variant="highlight" size="md">
            Medium
          </StatusIndicator>
          <StatusIndicator variant="highlight" size="lg">
            Large
          </StatusIndicator>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="tm-h3">Numbers and Icons</h3>
        <div className="flex flex-wrap gap-4">
          <StatusIndicator variant="success">5</StatusIndicator>
          <StatusIndicator variant="warning">!</StatusIndicator>
          <StatusIndicator variant="error">×</StatusIndicator>
          <StatusIndicator variant="info">i</StatusIndicator>
          <StatusIndicator variant="highlight">★</StatusIndicator>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="tm-h3">Brand Color Usage</h3>
        <div className="space-y-2 tm-body-medium">
          <p>
            <strong>TM True Maroon (#772432):</strong> Used for warning and
            error status indicators
          </p>
          <p>
            <strong>TM Happy Yellow (#F2DF74):</strong> Used for highlight
            status indicators
          </p>
          <p>
            <strong>TM Loyal Blue (#004165):</strong> Used for success status
            indicators
          </p>
          <p>
            <strong>TM Cool Gray (#A9B2B1):</strong> Used for info status
            indicators
          </p>
        </div>
      </div>
    </div>
  )
}

export default StatusIndicatorExample
