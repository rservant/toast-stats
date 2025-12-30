import React from 'react'
import { StatusIndicator } from './StatusIndicator'
import { Alert } from '../Alert/Alert'

/**
 * Demo component to showcase StatusIndicator and Alert components
 * This demonstrates the brand compliance implementation for task 8
 */
export const StatusIndicatorDemo: React.FC = () => {
  return (
    <div className="p-8 space-y-8 bg-tm-white">
      <div className="space-y-4">
        <h1 className="tm-h1 text-tm-loyal-blue">
          Status Indicators & Alerts Demo
        </h1>
        <p className="tm-body-medium text-tm-black">
          Demonstrating brand-compliant status indicators and alerts using TM
          True Maroon and TM Happy Yellow.
        </p>
      </div>

      {/* Status Indicators Section */}
      <div className="space-y-4">
        <h2 className="tm-h2 text-tm-loyal-blue">Status Indicators</h2>

        <div className="space-y-3">
          <h3 className="tm-h3">
            TM True Maroon Usage (Alerts & Secondary Emphasis)
          </h3>
          <div className="flex flex-wrap gap-4">
            <StatusIndicator variant="warning">Warning</StatusIndicator>
            <StatusIndicator variant="error">Error</StatusIndicator>
            <StatusIndicator variant="warning" size="sm">
              !
            </StatusIndicator>
            <StatusIndicator variant="error" size="lg">
              ×
            </StatusIndicator>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="tm-h3">
            TM Happy Yellow Usage (Highlights & Accents)
          </h3>
          <div className="flex flex-wrap gap-4">
            <StatusIndicator variant="highlight">Featured</StatusIndicator>
            <StatusIndicator variant="highlight" size="sm">
              ★
            </StatusIndicator>
            <StatusIndicator variant="highlight" size="lg">
              New
            </StatusIndicator>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="tm-h3">Other Brand Colors</h3>
          <div className="flex flex-wrap gap-4">
            <StatusIndicator variant="success">Success</StatusIndicator>
            <StatusIndicator variant="info">Info</StatusIndicator>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="space-y-4">
        <h2 className="tm-h2 text-tm-loyal-blue">Alert Components</h2>

        <div className="space-y-4">
          <h3 className="tm-h3">TM True Maroon Alerts</h3>

          <Alert variant="warning" title="Warning Alert">
            This warning uses TM True Maroon (#772432) for secondary emphasis
            and alerts. The background uses 10% opacity for proper contrast.
          </Alert>

          <Alert variant="error" title="Error Alert">
            This error alert also uses TM True Maroon for critical messaging.
            All text maintains WCAG AA contrast requirements.
          </Alert>
        </div>

        <div className="space-y-4">
          <h3 className="tm-h3">TM Happy Yellow Highlights</h3>

          <Alert variant="highlight" title="Featured Content">
            This highlight alert uses TM Happy Yellow (#F2DF74) for accents and
            highlights. The 20% opacity background ensures proper text contrast.
          </Alert>
        </div>

        <div className="space-y-4">
          <h3 className="tm-h3">Other Brand Colors</h3>

          <Alert variant="success" title="Success">
            Success alerts use TM Loyal Blue for positive feedback.
          </Alert>

          <Alert variant="info" title="Information">
            Info alerts use TM Cool Gray for neutral information.
          </Alert>
        </div>

        <div className="space-y-4">
          <h3 className="tm-h3">Dismissible Alert</h3>

          <Alert
            variant="highlight"
            title="Dismissible Highlight"
            onClose={() => console.log('Alert dismissed')}
          >
            This alert can be dismissed. The close button meets the 44px touch
            target requirement.
          </Alert>
        </div>
      </div>

      {/* Brand Compliance Summary */}
      <div className="space-y-4 p-6 bg-tm-cool-gray-10 rounded-lg">
        <h2 className="tm-h2 text-tm-loyal-blue">Brand Compliance Summary</h2>
        <div className="space-y-2 tm-body-medium">
          <p>
            <strong>✓ Requirement 1.2:</strong> TM True Maroon (#772432) used
            for alerts and secondary emphasis
          </p>
          <p>
            <strong>✓ Requirement 1.4:</strong> TM Happy Yellow (#F2DF74) used
            for highlights and accents
          </p>
          <p>
            <strong>✓ Requirement 4.5:</strong> Consistent status indicator
            patterns implemented
          </p>
          <p>
            <strong>✓ Requirement 3.1:</strong> All combinations meet WCAG AA
            contrast requirements (4.5:1+)
          </p>
          <p>
            <strong>✓ Touch Targets:</strong> Large size components meet 44px
            minimum requirement
          </p>
          <p>
            <strong>✓ Accessibility:</strong> Proper ARIA attributes and
            semantic markup
          </p>
        </div>
      </div>
    </div>
  )
}

export default StatusIndicatorDemo
